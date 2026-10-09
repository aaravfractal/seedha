"""Desk consent: one-booking links, the guest's yes, and its fingerprint.

Rules:
* Consent is opt-in: the guest must tick the box (rule 5); the API refuses
  anything but an explicit agreement.
* The WhatsApp number lives only on the consent row (rule 4) and is never
  logged.
* Each consent gets a random salt; the fingerprint is SHA-256 over the salt
  and the consent facts. Only fingerprints are ever published (rule 9).
  Erasing the salt and number later makes the fingerprint unlinkable.
* A link works once and expires 10 minutes after check-in.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Booking, Consent, ConsentToken

TOKEN_TTL = timedelta(minutes=10)
WORDING_VERSION = "consent-v1"
CONSENT_WORDING = "Send me direct-booking offers on WhatsApp. I can reply STOP anytime."
INDIAN_MOBILE = re.compile(r"^(?:\+?91)?([6-9]\d{9})$")


class ConsentError(ValueError):
    """A consent link or submission problem, with a guest-facing message."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def hash_token(token: str) -> str:
    """Tokens are stored only as SHA-256 hashes."""
    return hashlib.sha256(token.encode()).hexdigest()


def as_utc(moment: datetime) -> datetime:
    """SQLite returns naive datetimes; treat stored times as UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def issue_token(session: Session, booking: Booking, now: datetime) -> tuple[str, ConsentToken]:
    """A fresh link for this booking. Earlier unused links are revoked."""
    session.execute(
        update(ConsentToken)
        .where(
            ConsentToken.booking_id == booking.id,
            ConsentToken.used_at.is_(None),
            ConsentToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    token = secrets.token_urlsafe(32)
    record = ConsentToken(booking_id=booking.id, token_hash=hash_token(token),
                          created_at=now, expires_at=now + TOKEN_TTL)  # fmt: skip
    session.add(record)
    session.flush()
    return token, record


def resolve_token(session: Session, token: str, now: datetime) -> ConsentToken:
    """A usable link, or a ConsentError saying why not."""
    if not 20 <= len(token) <= 100:  # noqa: PLR2004  (token_urlsafe(32) is 43 chars)
        raise ConsentError("invalid_link", "This link is not valid.")
    record = session.scalar(
        select(ConsentToken).where(ConsentToken.token_hash == hash_token(token))
    )
    if record is None:
        raise ConsentError("invalid_link", "This link is not valid.")
    if record.used_at is not None:
        raise ConsentError("link_used", "This link was already used. Thank you.")
    if record.revoked_at is not None or as_utc(record.expires_at) <= now:
        raise ConsentError("link_expired", "This link has expired. Ask the desk for a new QR.")
    return record


def normalise_mobile(raw: str) -> str:
    """'+91 98765 43210' -> '+919876543210'. Indian mobiles only."""
    digits = re.sub(r"[\s\-()]", "", raw)
    match = INDIAN_MOBILE.match(digits)
    if match is None:
        raise ConsentError("invalid_number", "Enter a 10-digit Indian mobile number.")
    return f"+91{match.group(1)}"


def fingerprint(salt: str, booking_id: int, given_at: datetime, wording: str) -> str:
    """Salted SHA-256 of the consent facts. Holds no personal data."""
    material = f"{salt}|booking:{booking_id}|{given_at.isoformat()}|{wording}"
    return hashlib.sha256(material.encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class ConsentResult:
    """A saved consent and whether it was created just now."""

    consent: Consent
    created: bool


def active_consent(session: Session, guest_id: int) -> Consent | None:
    """The guest's consent that is neither withdrawn nor erased, if any."""
    return session.scalar(
        select(Consent).where(
            Consent.guest_id == guest_id,
            Consent.withdrawn_at.is_(None),
            Consent.erased_at.is_(None),
        )
    )


def record_consent(
    session: Session, record: ConsentToken, agree: bool, whatsapp: str, now: datetime
) -> ConsentResult:
    """Save the guest's yes from a valid link (rule 5: only an explicit yes)."""
    if agree is not True:
        raise ConsentError("not_agreed", "Tick the box to say yes, or simply close this page.")
    number = normalise_mobile(whatsapp)
    booking = record.booking
    if booking.guest_id is None:
        raise ConsentError("invalid_link", "This link is not valid.")
    record.used_at = now
    existing = active_consent(session, booking.guest_id)
    if existing is not None:
        existing.whatsapp_number = number
        session.flush()
        return ConsentResult(existing, created=False)
    salt = secrets.token_hex(32)
    consent = Consent(
        guest_id=booking.guest_id,
        booking_id=booking.id,
        wording_version=WORDING_VERSION,
        given_at=now,
        salt=salt,
        fingerprint=fingerprint(salt, booking.id, now, WORDING_VERSION),
        whatsapp_number=number,
        proof_status="pending",
    )
    session.add(consent)
    session.flush()
    return ConsentResult(consent, created=True)
