"""Guest-facing endpoints that need no login: the consent page."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.deps import PropertyDep, SessionDep, SettingsDep, WordingDep
from app.errors import ApiError
from app.services.consent import (
    CONSENT_WORDING,
    WORDING_VERSION,
    ConsentError,
    record_consent,
    resolve_token,
)
from app.services.desk import enqueue, property_device, utc_now
from app.services.messages import draft_for_booking

router = APIRouter(prefix="/public", tags=["public"])


class ConsentPageOut(BaseModel):
    """What the guest sees before saying yes. No personal data beyond a greeting."""

    hotel: str
    city: str
    guest_short_name: str
    perk: str
    wording: str
    wording_version: str
    expires_at: datetime


class ConsentIn(BaseModel):
    """The guest's answer. `agree` must be literally true (rule 5)."""

    agree: bool
    whatsapp: str = Field(min_length=10, max_length=20)


class ConsentOut(BaseModel):
    """Confirmation for the guest."""

    ok: bool
    guest_short_name: str
    already_subscribed: bool


def consent_error(exc: ConsentError) -> ApiError:
    """Expired and used links are 410 Gone; the rest are 404 or 422."""
    status = {"link_expired": 410, "link_used": 410, "invalid_link": 404}.get(exc.code, 422)
    return ApiError(status, exc.code, exc.message)


@router.get("/consent/{token}", response_model=ConsentPageOut)
def consent_page(token: str, session: SessionDep, prop: PropertyDep) -> ConsentPageOut:
    """Details for the guest's consent page."""
    try:
        record = resolve_token(session, token, utc_now())
    except ConsentError as exc:
        raise consent_error(exc) from exc
    guest = record.booking.guest
    return ConsentPageOut(
        hotel=prop.short_name,
        city=prop.city,
        guest_short_name=guest.short_name if guest else "Guest",
        perk=prop.perk_text,
        wording=CONSENT_WORDING,
        wording_version=WORDING_VERSION,
        expires_at=record.expires_at,
    )


@router.post("/consent/{token}", response_model=ConsentOut)
def give_consent(
    token: str, body: ConsentIn, session: SessionDep, prop: PropertyDep,
    settings: SettingsDep, wording: WordingDep,
) -> ConsentOut:  # fmt: skip
    """Save an explicit yes, then light the Desk ring green. If the guest has
    already checked out, the win-back draft is prepared now."""
    now = utc_now()
    try:
        record = resolve_token(session, token, now)
        result = record_consent(session, record, body.agree, body.whatsapp, now)
    except ConsentError as exc:
        raise consent_error(exc) from exc
    draft_for_booking(session, prop, record.booking.id, settings.web_origin, wording)
    guest = record.booking.guest
    short = guest.short_name if guest else "Guest"
    device = property_device(session, prop.id)
    enqueue(session, device, "show_ok", {"text": f"Thank you, {short}", "sub": "Consent saved"})
    enqueue(session, device, "set_ring", {"color": "green"})
    enqueue(session, device, "beep", {"pattern": "chime"})
    return ConsentOut(ok=True, guest_short_name=short, already_subscribed=not result.created)
