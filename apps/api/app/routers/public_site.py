"""The hotel's own website (World B), public. Serves a published site, or the
sample hotel, and never any guest data: rooms at public rates, approved
packages with computed prices, nearby places and the hotel's contact."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import SessionDep
from app.errors import ApiError
from app.models import Property
from app.ratelimit import rate_limited
from app.routers.site import PublicPackageOut, SiteContentOut, public_package, site_content
from app.services.desk import business_date, utc_now
from app.services.link import free_room, room_rates
from app.services.site import get_config, is_public, packages, slugify

router = APIRouter(
    prefix="/public/site", tags=["public"], dependencies=[Depends(rate_limited("site"))]
)

BOOKING_HORIZON_DAYS = 365
MAX_NIGHTS = 14


class PublicSiteOut(SiteContentOut):
    """The hotel site. `today` is the hotel's day, for the booking bar."""

    published: bool
    today: date
    packages: list[PublicPackageOut]


class AvailabilityOut(BaseModel):
    """Whether the booking bar's choice can be booked. `reason` when closed."""

    open: bool
    reason: str | None
    check_in: date
    nights: int
    room_type: str


def find_site(session: SessionDep, slug: str) -> Property:
    """The property whose site lives at this slug, if guests may see it."""
    for prop in session.scalars(select(Property).order_by(Property.id)):
        if slugify(prop.short_name) == slug and is_public(prop, get_config(session, prop.id)):
            return prop
    raise ApiError(404, "no_such_site", "There is no hotel site at this address")


@router.get("/{slug}", response_model=PublicSiteOut)
def public_site(slug: str, session: SessionDep) -> PublicSiteOut:
    """The hotel's site as guests see it. Packages appear only once approved."""
    prop = find_site(session, slug)
    config = get_config(session, prop.id)
    return PublicSiteOut(
        **site_content(session, prop, config),
        published=config.published_at is not None,
        today=business_date(session, prop.id, utc_now().date()),
        packages=[public_package(p) for p in packages(session, prop, config) if p.approved],
    )


@router.get("/{slug}/availability", response_model=AvailabilityOut)
def availability(
    slug: str,
    session: SessionDep,
    check_in: date,
    room_type: Annotated[str, Query(min_length=1, max_length=60)],
    nights: Annotated[int, Query(ge=1, le=MAX_NIGHTS)] = 2,
) -> AvailabilityOut:
    """Closed when the date is past, too far ahead, or every room of the type is taken."""
    prop = find_site(session, slug)
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
