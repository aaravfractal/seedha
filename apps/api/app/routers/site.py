"""Seedha Site, Pro previews and the demo reset (owner routes)."""

from __future__ import annotations

import ipaddress
import os
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep, require_owner_session
from app.errors import ApiError
from app.models import Base, Property, SiteConfig
from app.public_mode import is_production, is_real_owner
from app.ratelimit import rate_limited
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
    SAMPLE_ADDRESS,
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


class SiteContentOut(BaseModel):
    """What the hotel's own site shows (World B). No guest data, ever."""

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


class PackagePatchIn(BaseModel):
    """Approve, skip, bring back, or change the nights of a package."""

    state: Literal["pending", "approved", "skipped"] | None = None
    nights: int | None = Field(default=None, ge=MIN_PACKAGE_NIGHTS, le=MAX_PACKAGE_NIGHTS)


def site_content(session: Session, prop: Property, config: SiteConfig) -> dict[str, Any]:
    """The fields both the owner screen and the public site share."""
    rooms = []
    for room_type, rate in room_rates(session, prop.id).items():
        name_hi, detail = rooms_copy(room_type)
        rooms.append(SiteRoomOut(room_type=room_type, name_hi=name_hi, detail=detail,
                                 nightly_rate=rate))  # fmt: skip
    return {
        "slug": slugify(prop.short_name),
        "address": SAMPLE_ADDRESS,
        "sample": prop.is_sample,
        "mood": config.mood,
        "lang": config.lang,
        "hotel": prop.short_name,
        "hotel_hi": NAME_HI,
        "location": LOCATION,
        "tagline": TAGLINE,
        "rooms_count": prop.rooms_count,
        "rooms": rooms,
        "nearby": [NearbyOut(place=p, distance=d) for p, d in NEARBY],
        "gallery": list(GALLERY),
        "contact": ContactOut(placeholder=prop.is_sample, **CONTACT),
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


def site_out(session: SessionDep, prop: Property) -> SiteOut:
    """Shape the site for the screen."""
    config = get_config(session, prop.id)
    rates = room_rates(session, prop.id)
    return SiteOut(
        **site_content(session, prop, config),
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
def get_site(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> SiteOut:
    """The site as it stands."""
    return site_out(session, prop)


@site_router.patch("", response_model=SiteOut)
def patch_site(
    body: SitePatchIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> SiteOut:
    """Change setup stage, look or language."""
    config = get_config(session, prop.id)
    if body.stage is not None:
        config.stage = body.stage
    if body.mood is not None:
        config.mood = body.mood
    if body.lang is not None:
        config.lang = body.lang
    return site_out(session, prop)


@site_router.post("/packages/{key}", response_model=SiteOut)
def approve(key: str, _owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> SiteOut:
    """Owner approves a suggested package for the site."""
    try:
        approve_package(get_config(session, prop.id), key)
    except KeyError as exc:
        raise ApiError(404, "no_such_package", "No package with that key") from exc
    return site_out(session, prop)


@site_router.patch("/packages/{key}", response_model=SiteOut)
def change_package(
    key: str, body: PackagePatchIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> SiteOut:
    """Skip, bring back or change the nights. The price is worked out again by code."""
    try:
        decide_package(get_config(session, prop.id), key, state=body.state, nights=body.nights)
    except KeyError as exc:
        raise ApiError(404, "no_such_package", "No package with that key") from exc
    return site_out(session, prop)


@site_router.post("/publish", response_model=SiteOut)
def publish(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> SiteOut:
    """Nothing goes live before the owner taps Publish."""
    config = get_config(session, prop.id)
    if config.stage != "review":
        raise ApiError(409, "not_ready", "Finish the setup chat before publishing")
    config.published_at = config.published_at or utc_now()
    return site_out(session, prop)


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
