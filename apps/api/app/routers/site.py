"""Seedha Site, Pro previews and the demo reset (owner routes)."""

from __future__ import annotations

import ipaddress
import os
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep, require_owner_session
from app.errors import ApiError
from app.models import Base, Property, SiteConfig, SiteContent, SitePhoto
from app.public_mode import is_production, is_real_owner
from app.ratelimit import rate_limited
from app.routers.auth import NowDep
from app.services.desk import business_date, utc_now
from app.services.link import room_rates
from app.services.pro import active_consents, audit
from app.services.site import (
    CONTACT,
    GALLERY,
    GOOGLE_CATEGORIES,
    GOOGLE_PHOTOS,
    LOCATION,
    MAX_PACKAGE_NIGHTS,
    MIN_PACKAGE_NIGHTS,
    NAME_HI,
    NEARBY,
    SETUP,
    TAGLINE,
    Package,
    approve_package,
    decide_package,
    get_config,
    google_description,
    packages,
    rooms_copy,
    slugify,
)
from app.services.site_gen import read_content, read_rooms
from app.services.site_photos import list_photos
from app.services.slug import (
    SlugProblem,
    current_slug,
    display_address,
    problem,
    set_slug,
    site_url,
    suggested_slug,
)

site_router = APIRouter(prefix="/site", tags=["site"])
pro_router = APIRouter(prefix="/pro", tags=["pro"])
demo_router = APIRouter(prefix="/demo", tags=["demo"])


class SiteRoomOut(BaseModel):
    """A room type at its public rate (paise), with its Hindi name and a short line."""

    room_type: str
    name_hi: str
    detail: dict[str, str]
    nightly_rate: int


class PublicPackageOut(BaseModel):
    """A package as guests see it, with its computed price (paise)."""

    key: str
    name: dict[str, str]
    includes: dict[str, str]
    nights: int
    price: int


class PriceLineOut(BaseModel):
    """One line of how a package price is worked out (paise)."""

    label: str
    amount: int


class PackageOut(PublicPackageOut):
    """A suggested package with the reason and the owner's decision."""

    room_type: str
    nightly_rate: int
    lines: list[PriceLineOut]
    why: str
    state: str  # pending, approved or skipped
    approved: bool


class NearbyOut(BaseModel):
    """A nearby place and how far it is."""

    place: dict[str, str]
    distance: dict[str, str]


class ContactOut(BaseModel):
    """The hotel's contact. The sample hotel's are placeholders."""

    phone: str
    upi: str
    placeholder: bool


class SitePhotoOut(BaseModel):
    """One of the owner's photos. `url` is versioned (?v=) on public pages.
    `caption_hi` falls back to the English caption."""

    id: int
    url: str
    width: int
    height: int
    caption_en: str
    caption_hi: str


class SiteTextOut(BaseModel):
    """The owner's generated or edited text (never a price: prices are rooms only)."""

    description: dict[str, str]
    why_book_direct: dict[str, list[str]]


class SiteContentOut(BaseModel):
    """What the hotel's own site shows (World B). No guest data, ever.

    `text` and `photos` are the owner's own build once there is one (else
    null and empty: the labelled sample render). `url` is the full public
    address; `booking_url` is Seedha Link on the app host: absolute when the
    site is served on its own host (SITE_ROOT_DOMAIN), else "/link"."""

    slug: str
    address: str
    sample: bool
    mood: str
    lang: str
    hotel: str
    hotel_hi: str
    location: dict[str, str]
    tagline: dict[str, str]
    rooms_count: int
    rooms: list[SiteRoomOut]
    nearby: list[NearbyOut]
    gallery: list[dict[str, str]]
    contact: ContactOut
    url: str = ""
    source: str = "none"
    text: SiteTextOut | None = None
    photos: list[SitePhotoOut] = Field(default_factory=list)
    hide_branding: bool = False
    booking_url: str = "/link"


class SetupOut(BaseModel):
    """The sample hotel's WhatsApp setup answers."""

    photos_sent: int
    photos_wanted: int
    photo_labels: list[str]
    photo_tip: str
    voice_length: str
    voice_summary: str


class GoogleKitOut(BaseModel):
    """Ready to paste into a Google Business Profile."""

    description: dict[str, str]
    categories: list[str]
    photos: list[str]


class SiteOut(SiteContentOut):
    """Everything the owner's Website screen shows."""

    stage: str
    live: bool
    published_at: datetime | None
    owner_name: str
    packages: list[PackageOut]
    setup: SetupOut
    google: GoogleKitOut


class SitePatchIn(BaseModel):
    """Move through setup or change the look."""

    stage: Literal["empty", "chat", "review"] | None = None
    mood: Literal["pine", "stone", "sky"] | None = None
    lang: Literal["en", "hi"] | None = None


class BrandingIn(BaseModel):
    """A Pro setting: hide "Built with Seedha" and "Powered by Seedha"."""

    hide_branding: bool


class BrandingOut(BaseModel):
    """The branding setting as stored."""

    hide_branding: bool


class PublishIn(BaseModel):
    """The address the owner picked (empty = the suggestion)."""

    slug: str | None = Field(default=None, max_length=80)


class PublishOut(BaseModel):
    """The site is live at `url` (`address` is the same without the scheme)."""

    slug: str
    url: str
    address: str
    published: Literal[True] = True
    published_at: datetime


class AddressOut(BaseModel):
    """The site's address for the Publish panel. `slug` is the address in use
    (null until the first publish, except the sample hotel's default);
    `suggested_slug` prefills the box; `root_domain` is SITE_ROOT_DOMAIN ("" =
    sites live at <app>/h/<slug>). `hide_branding` is the Pro setting."""

    slug: str | None
    suggested_slug: str
    url: str | None
    address: str | None
    published: bool
    root_domain: str
    hide_branding: bool


class SlugCheckOut(BaseModel):
    """Whether an address can be used; `reason` is a code, `message` its sentence."""

    slug: str
    ok: bool
    reason: SlugProblem | None
    message: str | None
    suggestion: str
    url: str


SLUG_MESSAGES: dict[SlugProblem, str] = {
    "slug_invalid": "Use 3 to 40 small letters, numbers and single hyphens, "
    "starting and ending with a letter or number.",
    "slug_reserved": "This address is reserved. Please pick another.",
    "slug_taken": "Another hotel uses this address. Please pick another.",
}


class PackagePatchIn(BaseModel):
    """Approve, skip, bring back, or change the nights of a package."""

    state: Literal["pending", "approved", "skipped"] | None = None
    nights: int | None = Field(default=None, ge=MIN_PACKAGE_NIGHTS, le=MAX_PACKAGE_NIGHTS)


def built_content(session: Session, property_id: int) -> SiteContent | None:
    """The owner's build, if any (read only: a public page never creates rows)."""
    row = session.scalar(select(SiteContent).where(SiteContent.property_id == property_id))
    return row if row is not None and row.source != "none" else None


def photo_url(slug: str, photo: SitePhoto, *, public: bool) -> str:
    """Public pages: cacheable, versioned by the photo's hash. Owner: the private preview route."""
    if public:
        return f"/api/public/site/{slug}/photos/{photo.id}?v={photo.sha256[:8]}"
    return f"/api/site/photos/{photo.id}"


def site_photos(session: Session, prop: Property, slug: str, *, public: bool) -> list[SitePhotoOut]:
    """The owner's photos in order, with captions (Hindi falls back to English)."""
    return [
        SitePhotoOut(
            id=p.id,
            url=photo_url(slug, p, public=public),
            width=p.width,
            height=p.height,
            caption_en=p.caption_en,
            caption_hi=p.caption_hi or p.caption_en,
        )
        for p in list_photos(session, prop.id)
    ]


def site_text(row: SiteContent) -> SiteTextOut:
    """Description and why-book-direct points from the build."""
    text = read_content(row)
    return SiteTextOut(
        description={"en": text["description_en"], "hi": text["description_hi"]},
        why_book_direct={"en": text["why_book_direct_en"], "hi": text["why_book_direct_hi"]},
    )


def built_rooms(row: SiteContent) -> list[SiteRoomOut]:
    """Room types with ONLY the prices the owner typed (paise); blurbs from the build."""
    return [
        SiteRoomOut(room_type=r.name, name_hi=r.name, nightly_rate=r.price_paise,
                    detail={"en": r.blurb_en, "hi": r.blurb_hi or r.blurb_en})
        for r in read_rooms(row)
        if r.price_paise > 0
    ]  # fmt: skip


def sample_rooms(session: Session, prop: Property) -> list[SiteRoomOut]:
    """Room types at the rooms table's public rates (the sample render)."""
    rooms = []
    for room_type, rate in room_rates(session, prop.id).items():
        name_hi, detail = rooms_copy(room_type)
        rooms.append(SiteRoomOut(room_type=room_type, name_hi=name_hi, detail=detail,
                                 nightly_rate=rate))  # fmt: skip
    return rooms


def booking_url(settings: Settings) -> str:
    """Seedha Link lives on the app host. A hotel host serves only its own page, so
    with a root domain the link is absolute; on /h/<slug> it is same-origin."""
    if settings.site_root_domain:
        return f"{settings.web_origin.rstrip('/')}/link"
    return "/link"


def site_content(
    session: Session, prop: Property, config: SiteConfig, settings: Settings, *, public: bool
) -> dict[str, Any]:
    """The fields both the owner screen and the public site share.

    The owner always previews their build. Guests see it only once the site
    is published; until then the sample hotel keeps its labelled sample page.
    """
    slug = current_slug(prop, config) or slugify(prop.short_name)
    url = site_url(slug, settings.web_origin, settings.site_root_domain)
    row = built_content(session, prop.id)
    if row is not None and public and config.published_at is None:
        row = None
    photos = site_photos(session, prop, slug, public=public) if row is not None else []
    return {
        "slug": slug,
        "address": display_address(url),
        "url": url,
        "sample": prop.is_sample,
        "mood": config.mood,
        "lang": config.lang,
        "hotel": prop.short_name,
        "hotel_hi": NAME_HI if prop.is_sample else prop.short_name,
        "location": LOCATION if prop.is_sample else {"en": prop.city, "hi": prop.city},
        "tagline": TAGLINE if prop.is_sample else {"en": "", "hi": ""},
        "rooms_count": prop.rooms_count,
        "rooms": built_rooms(row) if row is not None else sample_rooms(session, prop),
        "nearby": [NearbyOut(place=p, distance=d) for p, d in NEARBY] if prop.is_sample else [],
        "gallery": [] if photos else list(GALLERY),
        "contact": ContactOut(placeholder=prop.is_sample, **CONTACT),
        "source": row.source if row is not None else "none",
        "text": site_text(row) if row is not None else None,
        "photos": photos,
        "hide_branding": bool(config.hide_branding),
        "booking_url": booking_url(settings),
    }


def public_package(p: Package) -> PublicPackageOut:
    """A package as guests see it."""
    return PublicPackageOut(key=p.spec.key, name=p.spec.name, nights=p.nights, price=p.price,
                            includes={"en": p.includes("en"), "hi": p.includes("hi")})  # fmt: skip


def owner_package(p: Package, rates: dict[str, int]) -> PackageOut:
    """A package with everything the owner needs to decide."""
    return PackageOut(
        **public_package(p).model_dump(),
        room_type=p.spec.room_type,
        nightly_rate=rates[p.spec.room_type],
        lines=[PriceLineOut(label=x.label, amount=x.amount) for x in p.lines],
        why=p.why,
        state=p.state,
        approved=p.approved,
    )


def site_out(session: Session, prop: Property, settings: Settings) -> SiteOut:
    """Shape the site for the screen."""
    config = get_config(session, prop.id)
    rates = room_rates(session, prop.id)
    return SiteOut(
        **site_content(session, prop, config, settings, public=False),
        stage=config.stage,
        live=config.published_at is not None,
        published_at=config.published_at,
        owner_name=prop.owner_name,
        packages=[owner_package(p, rates) for p in packages(session, prop, config)],
        setup=SetupOut.model_validate(SETUP),
        google=GoogleKitOut(
            description=google_description(prop),
            categories=list(GOOGLE_CATEGORIES),
            photos=list(GOOGLE_PHOTOS),
        ),  # fmt: skip
    )


@site_router.get("", response_model=SiteOut)
def get_site(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> SiteOut:
    """The site as it stands."""
    return site_out(session, prop, settings)


@site_router.patch("", response_model=SiteOut)
def patch_site(
    body: SitePatchIn,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
) -> SiteOut:
    """Change setup stage, look or language."""
    config = get_config(session, prop.id)
    if body.stage is not None:
        config.stage = body.stage
    if body.mood is not None:
        config.mood = body.mood
    if body.lang is not None:
        config.lang = body.lang
    return site_out(session, prop, settings)


@site_router.patch("/branding", response_model=BrandingOut)
def patch_branding(
    body: BrandingIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> BrandingOut:
    """The Pro setting that hides Seedha's footer and button line on the hotel site."""
    config = get_config(session, prop.id)
    config.hide_branding = body.hide_branding
    return BrandingOut(hide_branding=config.hide_branding)


@site_router.post("/packages/{key}", response_model=SiteOut)
def approve(
    key: str, _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> SiteOut:
    """Owner approves a suggested package for the site."""
    try:
        approve_package(get_config(session, prop.id), key)
    except KeyError as exc:
        raise ApiError(404, "no_such_package", "No package with that key") from exc
    return site_out(session, prop, settings)


@site_router.patch("/packages/{key}", response_model=SiteOut)
def change_package(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    key: str,
    body: PackagePatchIn,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
) -> SiteOut:
    """Skip, bring back or change the nights. The price is worked out again by code."""
    try:
        decide_package(get_config(session, prop.id), key, state=body.state, nights=body.nights)
    except KeyError as exc:
        raise ApiError(404, "no_such_package", "No package with that key") from exc
    return site_out(session, prop, settings)


def slug_check(
    session: Session, prop: Property, settings: Settings, now: datetime, raw: str | None
) -> SlugCheckOut:
    """Check an address (or the suggestion when none is given)."""
    config = get_config(session, prop.id)
    suggestion = suggested_slug(session, prop, config, now)
    slug = (raw or "").strip().lower() or suggestion
    why = problem(session, slug, prop.id, now)
    return SlugCheckOut(
        slug=slug,
        ok=why is None,
        reason=why,
        message=SLUG_MESSAGES[why] if why else None,
        suggestion=suggestion,
        url=site_url(slug, settings.web_origin, settings.site_root_domain),
    )


@site_router.get("/slug/check", response_model=SlugCheckOut)
def check_slug(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    now: NowDep,
    slug: Annotated[str | None, Query(max_length=80)] = None,
) -> SlugCheckOut:
    """Live check for the Publish panel: {slug, ok, reason, message, suggestion, url}."""
    return slug_check(session, prop, settings, now, slug)


def publishable(session: Session, config: SiteConfig) -> bool:
    """The build has content, or the older sample setup reached review."""
    return built_content(session, config.property_id) is not None or config.stage == "review"


@site_router.get("/address", response_model=AddressOut)
def get_address(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep, now: NowDep
) -> AddressOut:
    """The address in use (if any), the suggestion and whether the site is live."""
    config = get_config(session, prop.id)
    slug = current_slug(prop, config)
    url = site_url(slug, settings.web_origin, settings.site_root_domain) if slug else None
    return AddressOut(
        slug=slug,
        suggested_slug=suggested_slug(session, prop, config, now),
        url=url,
        address=display_address(url) if url else None,
        published=config.published_at is not None,
        root_domain=settings.site_root_domain,
        hide_branding=bool(config.hide_branding),
    )


@site_router.post("/publish", response_model=PublishOut)
def publish(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    now: NowDep,
    body: PublishIn | None = None,
) -> PublishOut:
    """Nothing goes live before the owner taps Publish. Picks or changes the address;
    a changed address keeps redirecting from the old one for 30 days. A slug that
    cannot be used is a 422 with error.code slug_invalid, slug_reserved or slug_taken."""
    config = get_config(session, prop.id)
    if not publishable(session, config):
        raise ApiError(409, "not_ready", "Build your site before publishing")
    check = slug_check(session, prop, settings, now, body.slug if body else None)
    if check.reason is not None:
        raise ApiError(422, check.reason, SLUG_MESSAGES[check.reason])
    try:
        with session.begin_nested():
            set_slug(prop, config, check.slug, now)
            config.published_at = config.published_at or now
    except IntegrityError as exc:  # another hotel took it a moment ago
        raise ApiError(422, "slug_taken", SLUG_MESSAGES["slug_taken"]) from exc
    return PublishOut(
        slug=check.slug,
        url=check.url,
        address=display_address(check.url),
        published_at=config.published_at or now,
    )


class ProOut(BaseModel):
    """Pro previews. `sample` marks figures that need outside data."""

    audit_claim: int
    audit_cancelled_lines: int
    audit_over_rate_lines: int
    consents: int
    # The Audit is computed from statements; on the sample hotel those are
    # sample rows, so it carries a Sample label too (D10).
    audit_sample: bool
    pulse_sample: bool
    rate_watch_sample: bool


@pro_router.get("", response_model=ProOut)
def get_pro(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> ProOut:
    """Audit and proof counts from the data; Pulse and Rate Watch are samples."""
    result = audit(session, prop.id)
    return ProOut(
        audit_claim=result.claim,
        audit_sample=prop.is_sample,
        audit_cancelled_lines=result.cancelled_lines,
        audit_over_rate_lines=result.over_rate_lines,
        consents=active_consents(session, prop.id),
        pulse_sample=True,
        rate_watch_sample=True,
    )


class ResetOut(BaseModel):
    """Confirmation of a demo reset."""

    ok: bool
    demo_date: str


def is_loopback(host: str) -> bool:
    """True for 127.0.0.0/8, ::1 and IPv4-mapped loopback; False for names and junk."""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    mapped = getattr(ip, "ipv4_mapped", None)
    return bool(ip.is_loopback or (mapped is not None and mapped.is_loopback))


def local_reset_only(request: Request) -> None:
    """With SEEDHA_PUBLIC=1 (make demo-live) only the machine running Seedha may reset.

    The web app's BFF forwards the real client address in X-Forwarded-For and
    uvicorn resolves it into request.client, so a visitor through the tunnel
    shows up with their own address, never loopback.

    Hosted (SEEDHA_ENV=production) every client is remote, so the address
    decides nothing: a signed-in session may reset only when it is a real
    owner account (OWNER_PHONES). The demo subject (Direct beta login, open to
    anyone) is refused. A server-side call with the owner token and no session
    (the operator) passes on to the owner check.
    """
    if is_production(request):
        if "x-seedha-subject" in request.headers and not is_real_owner(request):
            raise ApiError(403, "reset_owner_only", "Only the owner can reset the hosted demo")
        return
    if os.environ.get("SEEDHA_PUBLIC", "") != "1":
        return
    host = request.client.host if request.client else ""
    if not is_loopback(host):
        raise ApiError(403, "reset_local_only", "Reset works only on the computer running the demo")


@demo_router.post(
    "/reset",
    response_model=ResetOut,
    dependencies=[
        Depends(local_reset_only),
        Depends(require_owner_session),
        Depends(rate_limited("demo_reset")),
    ],
)
def reset_demo(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> ResetOut:
    """Wipe everything and reload the fictional sample hotel (sample data only)."""
    from seed.load import load_sample  # noqa: PLC0415  (demo-only dependency on the seed package)

    if not prop.is_sample:
        raise ApiError(403, "not_sample", "Reset is only available for the sample hotel")
    day = business_date(session, prop.id, utc_now().date())
    # Account records survive a reset: anyone can press it on the sample
    # hotel, and it must not wipe accounts, their saved details and staff
    # invites, or OTP locks (security review S6).
    keep = {"owner_account", "otp_challenge", "owner_settings", "staff_invite"}
    for table in reversed(Base.metadata.sorted_tables):
        if table.name not in keep:
            session.execute(delete(table))
    session.flush()
    session.expunge_all()  # forget objects whose rows were just deleted
    load_sample(session, settings.demo_date or day, with_statements=False,
                device_key=settings.desk_device_key, with_inbox=True)  # fmt: skip
    return ResetOut(ok=True, demo_date=(settings.demo_date or day).isoformat())
