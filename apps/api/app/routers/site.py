"""Seedha Site, Pro previews and the demo reset (owner routes)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep, require_owner_session
from app.errors import ApiError
from app.models import Base, Property
from app.ratelimit import rate_limited
from app.services.desk import business_date, utc_now
from app.services.link import room_rates
from app.services.pro import active_consents, audit
from app.services.site import (
    NEARBY,
    SAMPLE_ADDRESS,
    SETUP_CHAT,
    WELCOME,
    approve_package,
    get_config,
    packages,
)

site_router = APIRouter(prefix="/site", tags=["site"])
pro_router = APIRouter(prefix="/pro", tags=["pro"])
demo_router = APIRouter(prefix="/demo", tags=["demo"])


class SiteRoomOut(BaseModel):
    """A room type at its public rate (paise)."""

    room_type: str
    nightly_rate: int


class PackageOut(BaseModel):
    """A package with its computed price (paise)."""

    key: str
    name: str
    includes: str
    price: int
    why: str
    approved: bool


class SiteOut(BaseModel):
    """Everything the Website screen and its preview show."""

    stage: str
    mood: str
    lang: str
    live: bool
    published_at: datetime | None
    address: str
    hotel: str
    location: str
    welcome: dict[str, str]
    nearby: str
    setup_chat: list[tuple[str, str]]
    rooms: list[SiteRoomOut]
    packages: list[PackageOut]


class SitePatchIn(BaseModel):
    """Move through setup or change the look."""

    stage: Literal["empty", "chat", "review"] | None = None
    mood: Literal["pine", "stone", "sky"] | None = None
    lang: Literal["en", "hi"] | None = None


def site_out(session: SessionDep, prop: Property) -> SiteOut:
    """Shape the site for the screen."""
    config = get_config(session, prop.id)
    return SiteOut(
        stage=config.stage,
        mood=config.mood,
        lang=config.lang,
        live=config.published_at is not None,
        published_at=config.published_at,
        address=SAMPLE_ADDRESS,
        hotel=prop.short_name,
        location=prop.address,
        welcome=WELCOME,
        nearby=NEARBY,
        setup_chat=list(SETUP_CHAT),
        rooms=[
            SiteRoomOut(room_type=t, nightly_rate=r)
            for t, r in room_rates(session, prop.id).items()
        ],
        packages=[
            PackageOut(
                key=p.spec.key,
                name=p.spec.name,
                includes=p.spec.includes,
                price=p.price,
                why=p.why,
                approved=p.approved,
            )  # fmt: skip
            for p in packages(session, prop, config)
        ],
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
    pulse_sample: bool
    rate_watch_sample: bool


@pro_router.get("", response_model=ProOut)
def get_pro(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> ProOut:
    """Audit and proof counts from the data; Pulse and Rate Watch are samples."""
    result = audit(session, prop.id)
    return ProOut(
        audit_claim=result.claim,
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


@demo_router.post(
    "/reset",
    response_model=ResetOut,
    dependencies=[Depends(require_owner_session), Depends(rate_limited("demo_reset"))],
)
def reset_demo(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> ResetOut:
    """Wipe everything and reload the fictional sample hotel (sample data only)."""
    from seed.load import load_sample  # noqa: PLC0415  (demo-only dependency on the seed package)

    if not prop.is_sample:
        raise ApiError(403, "not_sample", "Reset is only available for the sample hotel")
    day = business_date(session, prop.id, utc_now().date())
    # Sign-in records survive a reset: anyone can press it on the sample
    # hotel, and it must not wipe accounts or OTP locks (security review S6).
    keep = {"owner_account", "otp_challenge"}
    for table in reversed(Base.metadata.sorted_tables):
        if table.name not in keep:
            session.execute(delete(table))
    session.flush()
    session.expunge_all()  # forget objects whose rows were just deleted
    load_sample(session, settings.demo_date or day, with_statements=False,
                device_key=settings.desk_device_key)  # fmt: skip
    return ResetOut(ok=True, demo_date=(settings.demo_date or day).isoformat())
