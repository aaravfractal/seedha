"""Win-back messages: drafts, owner approval, sending, and STOP.

Rules enforced here:
* A draft exists only for a guest with an active consent (not withdrawn, not
  erased) who has checked out (rule 4, ruling 7). OTA matching plays no part.
* Nothing is sent without the owner approving that exact message (rule 7);
  consent is checked again at the moment of sending.
* STOP withdraws the consent, blocks every unsent draft and every future send.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, Message, OptOutEvent, PerkCode, Property
from app.services.consent import normalise_mobile
from app.services.drafter import (
    MAX_LENGTH,
    MONEY_PATTERN,
    STOP_LINE,
    WEB_ADDRESS,
    DraftFacts,
    Wording,
    draft_body,
)
from app.services.proof import record_intact
from app.services.whatsapp import Sender, is_stop


class MessageError(ValueError):
    """An approval or send that is not allowed, with an owner-facing message."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class Eligible:
    """A consented, checked-out stay with its perk code."""

    consent: Consent
    booking: Booking
    perk: PerkCode


def eligible_stays(session: Session, property_id: int) -> list[Eligible]:
    """Active consents whose stay has checked out and has a perk code."""
    rows = session.execute(
        select(Consent, Booking, PerkCode)
        .join(Booking, Booking.id == Consent.booking_id)
        .join(PerkCode, PerkCode.origin_booking_id == Booking.id)
        .where(
            Booking.property_id == property_id,
            Booking.checked_out_at.is_not(None),
            Consent.withdrawn_at.is_(None),
            Consent.erased_at.is_(None),
        )
        .order_by(Consent.given_at)
    ).all()
    return [Eligible(c, b, p) for c, b, p in rows]


def draft_for_booking(
    session: Session, prop: Property, booking_id: int, web_origin: str, wording: Wording | None
) -> Message | None:
    """Create the draft for this stay if it is eligible and has none yet.

    Called when a guest checks out and when consent arrives after checkout.
    The unique perk code per message makes this safe to call twice.
    """
    item = next((e for e in eligible_stays(session, prop.id) if e.booking.id == booking_id), None)
    if item is None:
        return None
    existing = session.scalar(select(Message).where(Message.perk_code_id == item.perk.id))
    if existing is not None:
        return existing
    guest = item.consent.guest
    facts = DraftFacts(
        short_name=guest.short_name,
        hotel=prop.short_name,
        perk_promise=prop.perk_promise,
        code=item.perk.code,
        link=perk_link(web_origin, item.perk.code),
    )
    message = Message(consent_id=item.consent.id, perk_code_id=item.perk.id,
                      body=draft_body(facts, wording), status="draft")  # fmt: skip
    session.add(message)
    session.flush()
    return message


def list_messages(session: Session, property_id: int) -> list[Message]:
    """Every message of the property, newest first."""
    return list(
        session.scalars(
            select(Message)
            .join(Consent, Consent.id == Message.consent_id)
            .join(Booking, Booking.id == Consent.booking_id)
            .where(Booking.property_id == property_id)
            .order_by(Message.id.desc())
        )
    )


def get_message(session: Session, property_id: int, message_id: int) -> Message:
    """One of this property's messages, or 404."""
    message = session.get(Message, message_id)
    if message is None or message.consent.booking.property_id != property_id:
        raise MessageError(404, "no_such_message", "No message with that id")
    return message


def approve_and_send(message: Message, sender: Sender, now: datetime) -> Message:
    """Owner approval, then send. Refused if consent is no longer active.

    On any refusal the request rolls back, so the draft stays a draft (or is
    already blocked by STOP) and can be retried.
    """
    if message.status != "draft":
        raise MessageError(409, "not_a_draft", f"This message is already {message.status}")
    consent = message.consent
    if not consent.is_active or not consent.whatsapp_number:
        raise MessageError(409, "consent_withdrawn", "The guest has opted out. Nothing was sent.")
    if not record_intact(consent):
        raise MessageError(
            409,
            "consent_mismatch",
            "This consent record changed after it was saved. Nothing was sent.",
        )
    message.status = "approved"
    message.approved_at = now
    result = sender.send(consent.whatsapp_number, message.body, message.id)
    message.transport = result.transport
    message.provider_message_id = result.provider_id
    if not result.ok:
        raise MessageError(502, "send_failed", result.error or "Sending failed. Try again.")
    message.status = "sent"
    message.sent_at = now
    return message


def perk_link(web_origin: str, code: str) -> str:
    """The guest's Seedha Link for a perk code, as every draft carries it."""
    return f"{web_origin.rstrip('/')}/link/{code}"


def edit_problem(text: str, code: str, link: str) -> str | None:
    """Why an owner's edit cannot be saved, or None when it keeps every rule.

    The edited text must still carry the STOP line (rule 5), the perk code and
    the link, fit one WhatsApp message, and name no amount or percentage
    (perks, never a lower rate: rule 6). Checks run in this order.
    """
    checks = (
        (not text, "The message cannot be empty."),
        (len(text) > MAX_LENGTH, f"Keep the message under {MAX_LENGTH} characters."),
        (STOP_LINE not in text, f'Keep "{STOP_LINE}" in the message.'),
        (link not in text, f"Keep the booking link {link} in the message."),
        (code not in text.replace(link, ""), f"Keep the code {code} in the message."),
        (
            MONEY_PATTERN.search(text.replace(link, "").replace(code, "")) is not None,
            "Offer a perk, not a price. Remove amounts, percentages and long numbers.",
        ),
        (
            WEB_ADDRESS.search(text.replace(link, "")) is not None,
            "Keep only the booking link. Other links are not allowed.",
        ),
    )
    return next((problem for failed, problem in checks if failed), None)


def edit_draft(message: Message, text: str, web_origin: str) -> Message:
    """Owner rewords a draft. Editing never sends (rule 7)."""
    if message.status != "draft":
        raise MessageError(409, "not_a_draft", f"This message is already {message.status}")
    cleaned = text.strip()
    code = message.perk_code.code
    problem = edit_problem(cleaned, code, perk_link(web_origin, code))
    if problem is not None:
        raise MessageError(422, "invalid_edit", problem)
    message.body = cleaned
    return message


def reject(message: Message) -> Message:
    """Owner rejects a draft; it is never sent."""
    if message.status != "draft":
        raise MessageError(409, "not_a_draft", f"This message is already {message.status}")
    message.status = "rejected"
    return message


def withdraw(session: Session, consent: Consent, source: str, now: datetime) -> None:
    """STOP: withdraw consent and block unsent drafts. Idempotent."""
    if consent.withdrawn_at is None:
        consent.withdrawn_at = now
        session.add(OptOutEvent(consent_id=consent.id, source=source, received_at=now))
    for message in session.scalars(
        select(Message).where(Message.consent_id == consent.id, Message.status == "draft")
    ):
        message.status = "blocked"
    session.flush()


def handle_inbound(
    session: Session, from_number: str, text: str, source: str, now: datetime
) -> int:
    """Apply an inbound message. Returns how many consents STOP withdrew."""
    if not is_stop(text):
        return 0
    try:
        number = normalise_mobile(from_number)
    except ValueError:
        return 0
    consents = session.scalars(
        select(Consent).where(Consent.whatsapp_number == number, Consent.withdrawn_at.is_(None))
    ).all()
    for consent in consents:
        withdraw(session, consent, source, now)
    return len(consents)
