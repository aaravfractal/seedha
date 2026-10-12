"""The hotel's own website (World B), public. Serves a published site, or the
sample hotel, and never any guest data: rooms at public rates (or, for an
owner's build, only the prices the owner typed), approved packages with
computed prices, nearby places, the hotel's contact and the owner's photos.

Read only: these routes never call Claude and never write site content. A
renamed address keeps answering for 30 days with `redirect_to` set, and
`/resolve` tells the web app's proxy where a slug leads.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Query, Response
from pydantic import BaseModel

from app.deps import SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Property
from app.ratelimit import rate_limited
from app.routers.auth import NowDep
from app.routers.site import (
    PublicPackageOut,
    SiteContentOut,
    public_package,
    sample_locked,
    site_content,
)
from app.services.desk import business_date, utc_now
from app.services.link import free_room, room_rates
from app.services.site import get_config, packages
from app.services.site_photos import find_photo
from app.services.slug import resolve

router = APIRouter(prefix="/public/site", tags=["public"])

SITE_LIMIT = Depends(rate_limited("site"))
# A page view loads up to 8 photos; they have their own, larger allowance.
PHOTO_LIMIT = Depends(rate_limited("site_photo"))
BOOKING_HORIZON_DAYS = 365
MAX_NIGHTS = 14
PHOTO_CACHE = "public, max-age=86400, immutable"
NOT_LIVE = "This hotel site isn't live yet"


class PublicSiteOut(SiteContentOut):
    """The hotel site. `today` is the hotel's day, for the booking bar.
    `redirect_to` is the new address's slug when an old one (renamed within
    30 days) was asked for."""

    published: bool
    today: date
    packages: list[PublicPackageOut]
    redirect_to: str | None = None


class ResolveOut(BaseModel):
    """Where a slug leads: live here, moved to `slug`, or nothing."""

    state: Literal["live", "moved", "none"]
    slug: str


class AvailabilityOut(BaseModel):
    """Whether the booking bar's choice can be booked. `reason` when closed."""

    open: bool
    reason: str | None
    check_in: date
    nights: int
    room_type: str


def find_site(session: SessionDep, slug: str, now: datetime) -> tuple[Property, str | None]:
    """The property whose site lives (or lived, within 30 days) at this slug,
    if guests may see it, with the new slug when it has moved."""
    found = resolve(session, slug, now)
    if found.prop is None:
        raise ApiError(404, "no_such_site", NOT_LIVE)
    return found.prop, (found.slug if found.state == "moved" else None)


@router.get("/{slug}", response_model=PublicSiteOut, dependencies=[SITE_LIMIT])
def public_site(
    slug: str, session: SessionDep, settings: SettingsDep, now: NowDep
) -> PublicSiteOut:
    """The hotel's site as guests see it. Packages appear only once approved."""
    prop, moved_to = find_site(session, slug, now)
    config = get_config(session, prop.id)
    return PublicSiteOut(
        **site_content(session, prop, config, settings, public=True),
        published=config.published_at is not None,
        today=business_date(session, prop.id, utc_now().date()),
        packages=[public_package(p) for p in packages(session, prop, config) if p.approved],
        redirect_to=moved_to,
    )


@router.get("/{slug}/resolve", response_model=ResolveOut, dependencies=[SITE_LIMIT])
def resolve_slug(slug: str, session: SessionDep, now: NowDep) -> ResolveOut:
    """For the web proxy: live, moved (308 to the new slug) or none (not live yet)."""
    found = resolve(session, slug, now)
    return ResolveOut(state=found.state, slug=found.slug)


@router.get("/{slug}/photos/{photo_id}", dependencies=[PHOTO_LIMIT])
def public_photo(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    slug: str,
    photo_id: int,
    session: SessionDep,
    settings: SettingsDep,
    now: NowDep,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    """A published site's photo. Cached a day by browsers and CDNs; the URL
    carries ?v=<hash> so a replaced photo gets a new address. Never a photo a
    visitor uploaded to the shared demo's sample hotel (production)."""
    prop, _ = find_site(session, slug, now)
    row = None
    if get_config(session, prop.id).published_at is not None and not sample_locked(prop, settings):
        row = find_photo(session, prop.id, photo_id)
    if row is None:
        raise ApiError(404, "no_such_photo", "No photo with that id")
    etag = f'"{row.sha256}"'
    headers = {"Cache-Control": PHOTO_CACHE, "ETag": etag}
    if if_none_match is not None and etag in if_none_match:
        return Response(status_code=304, headers=headers)
    return Response(content=row.data, media_type="image/jpeg", headers=headers)


@router.get("/{slug}/availability", response_model=AvailabilityOut, dependencies=[SITE_LIMIT])
def availability(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    slug: str,
    session: SessionDep,
    now: NowDep,
    check_in: date,
    room_type: Annotated[str, Query(min_length=1, max_length=60)],
    nights: Annotated[int, Query(ge=1, le=MAX_NIGHTS)] = 2,
) -> AvailabilityOut:
    """Closed when the date is past, too far ahead, or every room of the type is taken."""
    prop, _ = find_site(session, slug, now)
    if room_type not in room_rates(session, prop.id):
        raise ApiError(404, "no_such_room", "No room of that type")
    today = business_date(session, prop.id, utc_now().date())
    reason: str | None = None
    if check_in <= today:
        reason = "past"
    elif check_in > today + timedelta(days=BOOKING_HORIZON_DAYS):
        reason = "too_far"
    elif free_room(session, prop.id, room_type, check_in, nights) is None:
        reason = "full"
    return AvailabilityOut(open=reason is None, reason=reason, check_in=check_in, nights=nights,
                           room_type=room_type)  # fmt: skip
