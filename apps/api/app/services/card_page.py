"""The card page: a guest who scanned the hotel's printed card verifies a past
stay with its booking reference, rates it once, or leaves a private note.

Verification looks only at the hotel's own booking rows. When a WhatsApp
number is on file for that stay it can only be a Desk consent (rule 4: OTA
contacts are never stored), and then the last 4 digits of that number are
needed too; a wrong pair answers the same as an unknown reference, so the
page never says which part failed.

A verified stay gets a 30-minute, single-use token held in a 'card'
SiteRating row (only its SHA-256 is stored, bound to that booking and hotel).
Verifying again before rating replaces the token. Rating fills the row once;
every source shares one rule: one given rating per stay.

Private notes (SiteFeedback) are for the owner only: never public, never
counted, and nothing about the visitor is stored.
"""

from __future__ import annotations

import re
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Booking, Consent, PerkCode, Room, SiteFeedback, SiteRating
from app.services.consent import as_utc
from app.services.site_details import Flat, PlainText
from app.services.site_ratings import (
    TOKEN_BYTES,
    RatingIn,
    find_token,
    stay_end,
    stay_rated,
    token_hash,
)

TOKEN_LIFETIME = timedelta(minutes=30)
NEXT_STAY_DAYS = 14
RECENT_RATING_DAYS = 7
PHONE_DIGITS = 4

VerifyState = Literal["verified", "needs_phone", "not_found", "not_ended", "already_rated"]
BookingRef = Annotated[str, Field(min_length=1, max_length=30, pattern=r"^[A-Za-z0-9-]+$")]
Message = Annotated[str, Field(min_length=1, max_length=500), Flat, PlainText]


class VerifyIn(BaseModel):
    """A booking reference and, when asked for, the last 4 digits of the
    WhatsApp number given at the Desk."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    booking_ref: BookingRef
    phone_last4: Annotated[str, Field(pattern=r"^[0-9]{4}$")] | None = None


class VerifyOut(BaseModel):
    """The verify answer. Stay details and the token only when verified (the
    route leaves out fields that were not set)."""

    state: VerifyState
    stay_token: str | None = None
    room_type: str | None = None
    nights: int | None = None
    next_check_in: date | None = None
    perk_code: str | None = None


class CardRatingIn(RatingIn):
    """A card-page rating: the stay token, stars and an optional comment."""

    stay_token: Annotated[str, Field(min_length=1, max_length=64)]


class FeedbackIn(BaseModel):
    """A private note to the owner. Plain text, 1 to 500 characters."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    message: Message


def last4(number: str | None) -> str | None:
    """The last 4 digits of a stored number, or None without one."""
    digits = re.sub(r"\D", "", number or "")
    return digits[-PHONE_DIGITS:] if len(digits) >= PHONE_DIGITS else None


def number_on_file(session: Session, booking_id: int) -> str | None:
    """The last 4 digits of the Desk consent number for this stay, if any
    (an erased consent keeps no number)."""
    numbers = session.scalars(
        select(Consent.whatsapp_number)
        .where(Consent.booking_id == booking_id, Consent.erased_at.is_(None))
        .order_by(Consent.id.desc())
    )
    return next((d for d in map(last4, numbers) if d), None)


@dataclass(frozen=True, slots=True)
class Match:
    """The stay a reference (and phone digits) point at, or a state."""

    state: VerifyState
    booking: Booking | None = None


def match_stay(session: Session, property_id: int, ref: str, phone: str | None) -> Match:
    """The hotel's stay with this reference (any case). A stay with a number
    on file needs its last 4 digits; wrong digits look like no stay at all."""
    stays = list(
        session.scalars(
            select(Booking)
            .where(
                Booking.property_id == property_id,
                Booking.status == "stay",
                func.lower(Booking.external_ref) == ref.lower(),
            )
            .order_by(Booking.id)
        )
    )
    needs_phone = False
    for stay in stays:
        on_file = number_on_file(session, stay.id)
        if on_file is None or (phone is not None and secrets.compare_digest(on_file, phone)):
            return Match("verified", stay)
        needs_phone = needs_phone or phone is None
    return Match("needs_phone" if needs_phone else "not_found")


def stay_token_for(session: Session, booking: Booking, now: datetime) -> str:
    """A fresh 30-minute token in the stay's 'card' row (made or reissued)."""
    token = secrets.token_urlsafe(TOKEN_BYTES)
    values = {"token_hash": token_hash(token), "created_at": now}
    where = (SiteRating.source == "card") & (SiteRating.source_ref == booking.id)
    if session.scalar(select(SiteRating.id).where(where)) is None:
        try:
            with session.begin_nested():
                session.add(SiteRating(property_id=booking.property_id, source="card",
                                       source_ref=booking.id,
                                       opens_on=stay_end(booking.check_in, booking.nights),
                                       **values))  # fmt: skip
            return token
        except IntegrityError:  # made at the same moment by another request
            pass
    session.execute(
        update(SiteRating)
        .where(where, SiteRating.used_at.is_(None))
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    return token


def open_perk(session: Session, booking: Booking) -> str | None:
    """The guest's newest unredeemed perk code for this stay or guest."""
    owner = PerkCode.origin_booking_id == booking.id
    if booking.guest_id is not None:
        owner = owner | (PerkCode.guest_id == booking.guest_id)
    return session.scalar(
        select(PerkCode.code)
        .where(owner, PerkCode.redeemed_at.is_(None))
        .order_by(PerkCode.created_at.desc(), PerkCode.id.desc())
        .limit(1)
    )


def room_type_of(session: Session, booking: Booking) -> str | None:
    """The stay's room type, when the booking names its room."""
    room = session.get(Room, booking.room_id) if booking.room_id is not None else None
    return room.room_type if room is not None else None


def verify(
    session: Session, property_id: int, body: VerifyIn, today: date, now: datetime
) -> VerifyOut:
    """Verify a stay for the card page (see the module docstring)."""
    found = match_stay(session, property_id, body.booking_ref, body.phone_last4)
    booking = found.booking
    if booking is None:
        return VerifyOut(state=found.state)
    if stay_end(booking.check_in, booking.nights) > today:
        return VerifyOut(state="not_ended")
    if stay_rated(session, booking.id):
        return VerifyOut(state="already_rated")
    # Fields not set are left out of the answer; perk_code is always set (null
    # without a perk), room_type only when the booking names its room.
    room_type = room_type_of(session, booking)
    return VerifyOut(
        state="verified",
        stay_token=stay_token_for(session, booking, now),
        nights=booking.nights,
        next_check_in=today + timedelta(days=NEXT_STAY_DAYS),
        perk_code=open_perk(session, booking),
        **({"room_type": room_type} if room_type else {}),
    )


RateResult = Literal["ok", "invalid", "already_rated"]


def rate(session: Session, property_id: int, body: CardRatingIn, now: datetime) -> RateResult:
    """Use a stay token once: invalid when unknown, another hotel's or older
    than 30 minutes; already_rated when the stay has a rating already."""
    row = find_token(session, body.stay_token, card=True)
    if row is None or row.property_id != property_id:
        return "invalid"
    if row.used_at is not None or stay_rated(session, row.source_ref):
        return "already_rated"
    if as_utc(row.created_at) + TOKEN_LIFETIME < now:
        return "invalid"
    result = session.execute(
        update(SiteRating)
        .where(SiteRating.id == row.id, SiteRating.used_at.is_(None),
               SiteRating.token_hash == row.token_hash)
        .values(used_at=now, stars=body.stars, comment=body.comment)
        .execution_options(synchronize_session=False)
    )  # fmt: skip
    session.expire(row)
    return "ok" if getattr(result, "rowcount", 0) else "already_rated"


def add_feedback(session: Session, property_id: int, message: str, now: datetime) -> None:
    """Store a private note for the owner."""
    session.add(SiteFeedback(property_id=property_id, message=message, created_at=now))
    session.flush()


def feedback_list(session: Session, property_id: int) -> list[SiteFeedback]:
    """The hotel's private notes, newest first."""
    return list(
        session.scalars(
            select(SiteFeedback)
            .where(SiteFeedback.property_id == property_id)
            .order_by(SiteFeedback.created_at.desc(), SiteFeedback.id.desc())
        )
    )


def mark_read(
    session: Session, property_id: int, feedback_id: int, read: bool, now: datetime
) -> SiteFeedback | None:
    """Mark a note read or unread. None when it is not this hotel's."""
    row = session.get(SiteFeedback, feedback_id)
    if row is None or row.property_id != property_id:
        return None
    if not read:
        row.read_at = None
    elif row.read_at is None:
        row.read_at = now
    session.flush()
    return row


def unread_notes(session: Session, property_id: int) -> tuple[int, datetime | None]:
    """How many private notes are unread, and when the newest came."""
    count, latest = session.execute(
        select(func.count(SiteFeedback.id), func.max(SiteFeedback.created_at)).where(
            SiteFeedback.property_id == property_id, SiteFeedback.read_at.is_(None)
        )
    ).one()
    return int(count or 0), latest


def recent_ratings(
    session: Session, property_id: int, now: datetime
) -> tuple[int, datetime | None]:
    """How many ratings guests gave in the last 7 days, and the newest time."""
    count, latest = session.execute(
        select(func.count(SiteRating.id), func.max(SiteRating.used_at)).where(
            SiteRating.property_id == property_id,
            SiteRating.stars.is_not(None),
            SiteRating.used_at >= now - timedelta(days=RECENT_RATING_DAYS),
        )
    ).one()
    return int(count or 0), latest
