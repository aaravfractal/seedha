"""Guest inbox: WhatsApp threads with Desk-consented guests (D5).

Rules enforced here:
* A thread is an active Desk consent (rule 4). Inbound texts are stored only
  for numbers with an active consent; any other number gets no thread.
* The owner's own sends go out only for an active consent and only inside
  WhatsApp's customer-service window: the guest wrote within 24 hours.
  Outside it a pre-approved template is needed, so the send is refused.
* Every outgoing text ends with "Reply STOP to opt out." (rule 5).
* AI drafts are suggestions returned to the owner, never sent (rule 7). A
  draft holding ₹, "rs" plus digits or any number of 3+ digits is rejected
  and a canned template is used instead (D6).
* The away reply is the owner's own text, saved only with explicit approval,
  sent only to a consented guest who just wrote, at most once a day per
  thread, and never contains AI text.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

import anthropic
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Consent,
    DirectBooking,
    InboxAway,
    InboxMessage,
    Message,
    PerkCode,
    Property,
)
from app.money import format_inr
from app.services.consent import as_utc, normalise_mobile
from app.services.drafter import MONEY_PATTERN, STOP_LINE
from app.services.link import room_rates
from app.services.proof import erase_consent
from app.services.whatsapp import CloudApiSender, Sender, SimulatedSender, is_stop

logger = logging.getLogger("seedha.inbox")

WINDOW = timedelta(hours=24)
AWAY_EVERY = timedelta(hours=24)
MAX_BODY = 1_000
MAX_AWAY = 300
MAX_DRAFT = 400
STOP_PHRASE = "reply stop to opt out"
# D6 adds "any number with three or more digits" to the drafter's MONEY_PATTERN
# (which covers ₹, rs + digits, INR, rupees and %). Once drafter.MONEY_PATTERN
# carries the 3+ digit rule itself this second check is redundant but harmless.
THREE_DIGITS = re.compile(r"\d[\d,]*\d[\d,]*\d")
# Any web address. Owner text may carry only the guest's own perk link.
WEB_ADDRESS = re.compile(
    r"(https?://\S+|www\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|co|io|app|me|"
    r"link|info|biz|xyz|ly|gl)\b\S*)",
    re.IGNORECASE,
)


class InboxError(ValueError):
    """A refused inbox action with an owner-facing message."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def with_stop(body: str) -> str:
    """Append the opt-out line unless the text already carries it (rule 5)."""
    text = body.strip()
    if STOP_PHRASE in text.lower():
        return text
    return f"{text} {STOP_LINE}"


def d6_ok(text: str, link: str = "", code: str = "") -> bool:
    """True when an AI text holds no money and no 3+ digit number (D6).

    Code-inserted strings are removed first: the link before the code, since
    the link contains the code (removing the code first would leave ':3000').
    """
    if link:
        text = text.replace(link, "")
    if code:
        text = text.replace(code, "")
    return MONEY_PATTERN.search(text) is None and THREE_DIGITS.search(text) is None


def has_other_link(text: str, allowed_link: str = "") -> bool:
    """True when owner text carries a web address other than the perk link."""
    if allowed_link:
        text = text.replace(allowed_link, "")
    return WEB_ADDRESS.search(text) is not None


def sender_for_property(prop: Property, sender: Sender) -> Sender:
    """The sample hotel never uses the live WhatsApp sender, whatever keys are
    set (same rule as routers/messages.get_sender)."""
    if prop.is_sample and isinstance(sender, CloudApiSender):
        return SimulatedSender()
    return sender


# --- threads -----------------------------------------------------------------


def active_consents(session: Session, property_id: int) -> list[Consent]:
    """Every messageable consent of the property, newest first."""
    return list(
        session.scalars(
            select(Consent)
            .join(Booking, Booking.id == Consent.booking_id)
            .where(
                Booking.property_id == property_id,
                Consent.withdrawn_at.is_(None),
                Consent.erased_at.is_(None),
                Consent.whatsapp_number.is_not(None),
            )
            .order_by(Consent.given_at.desc())
        )
    )


def get_thread(session: Session, property_id: int, consent_id: int) -> Consent:
    """An active consent of this property, or 404 (withdrawn guests are hidden)."""
    consent = session.get(Consent, consent_id)
    if (
        consent is None
        or consent.booking.property_id != property_id
        or not consent.is_active
        or not consent.whatsapp_number
    ):
        raise InboxError(404, "no_such_thread", "This guest is not in your inbox")
    return consent


def inbox_rows(session: Session, consent_id: int) -> list[InboxMessage]:
    """Stored inbox texts of one thread, oldest first."""
    return list(
        session.scalars(
            select(InboxMessage)
            .where(InboxMessage.consent_id == consent_id)
            .order_by(InboxMessage.created_at, InboxMessage.id)
        )
    )


@dataclass(frozen=True, slots=True)
class Entry:
    """One bubble in a thread: an inbox text or a sent win-back message."""

    key: str
    direction: str
    sent_by: str
    kind: str
    body: str
    at: datetime
    transport: str | None


def thread_entries(session: Session, consent: Consent) -> list[Entry]:
    """Inbox texts plus the approved win-back messages that were sent."""
    entries = [
        Entry(
            f"i{m.id}", m.direction, m.sent_by, "text", m.body, as_utc(m.created_at), m.transport
        )  # fmt: skip
        for m in inbox_rows(session, consent.id)
    ]
    for m in session.scalars(
        select(Message).where(Message.consent_id == consent.id, Message.status == "sent")
    ):
        at = as_utc(m.sent_at or m.created_at)
        entries.append(Entry(f"w{m.id}", "out", "owner", "winback", m.body, at, m.transport))
    return sorted(entries, key=lambda e: (e.at, e.key))


def last_inbound_at(session: Session, consent_id: int) -> datetime | None:
    """When the guest last wrote."""
    at = session.scalar(
        select(func.max(InboxMessage.created_at)).where(
            InboxMessage.consent_id == consent_id, InboxMessage.direction == "in"
        )
    )
    return as_utc(at) if at is not None else None


def window_closes_at(session: Session, consent_id: int) -> datetime | None:
    """End of the 24-hour customer-service window, or None if never opened."""
    last = last_inbound_at(session, consent_id)
    return last + WINDOW if last is not None else None


def window_open(session: Session, consent_id: int, now: datetime) -> bool:
    """The guest wrote within the last 24 hours."""
    closes = window_closes_at(session, consent_id)
    return closes is not None and now < closes


@dataclass(frozen=True, slots=True)
class ThreadSummary:
    """A row in the guest list."""

    consent: Consent
    last: Entry | None
    unread: int
    auto_replied: bool
    window_open: bool
    window_closes_at: datetime | None
    stays: int


def stays_of(session: Session, consent: Consent) -> list[Booking]:
    """The guest's stays we hold (statement, history, desk, direct), newest first."""
    return list(
        session.scalars(
            select(Booking)
            .where(Booking.guest_id == consent.guest_id, Booking.status == "stay")
            .order_by(Booking.check_in.desc())
        )
    )


def summarise(session: Session, consent: Consent, now: datetime) -> ThreadSummary:
    """The list row for one thread."""
    entries = thread_entries(session, consent)
    rows = inbox_rows(session, consent.id)
    closes = window_closes_at(session, consent.id)
    return ThreadSummary(
        consent=consent,
        last=entries[-1] if entries else None,
        unread=sum(1 for m in rows if m.direction == "in" and m.read_at is None),
        auto_replied=any(m.sent_by == "away" for m in rows),
        window_open=closes is not None and now < closes,
        window_closes_at=closes,
        stays=len(stays_of(session, consent)),
    )


def list_threads(
    session: Session, property_id: int, now: datetime, kind: str = "all", query: str = ""
) -> tuple[list[ThreadSummary], dict[str, int]]:
    """Threads matching the filter and search, plus the count per filter."""
    summaries = [summarise(session, c, now) for c in active_consents(session, property_id)]
    needle = query.strip().lower()
    if needle:
        summaries = [s for s in summaries if needle in s.consent.guest.display_name.lower()]
    counts = {
        "all": len(summaries),
        "unread": sum(1 for s in summaries if s.unread),
        "auto": sum(1 for s in summaries if s.auto_replied),
        "open": sum(1 for s in summaries if s.window_open),
    }
    chosen = [s for s in summaries if kind == "all" or _keeps(s, kind)]
    chosen.sort(key=lambda s: s.last.at if s.last else as_utc(s.consent.given_at), reverse=True)
    return chosen, counts


def _keeps(summary: ThreadSummary, kind: str) -> bool:
    """Whether a thread passes the unread, auto-replied or open-window filter."""
    if kind == "unread":
        return summary.unread > 0
    if kind == "auto":
        return summary.auto_replied
    return kind == "open" and summary.window_open


def mark_read(session: Session, consent: Consent, now: datetime) -> int:
    """Mark the guest's texts read. Returns how many changed."""
    changed = 0
    for m in inbox_rows(session, consent.id):
        if m.direction == "in" and m.read_at is None:
            m.read_at = now
            changed += 1
    session.flush()
    return changed


# --- inbound and sending -------------------------------------------------------


def get_away(session: Session, property_id: int) -> InboxAway | None:
    """The approved away text of the property, if any."""
    return session.scalar(select(InboxAway).where(InboxAway.property_id == property_id))


def _send(
    session: Session, consent: Consent, body: str, sent_by: str, sender: Sender, now: datetime
) -> InboxMessage:
    """Store and send one outgoing text. A failed send raises (rolls back)."""
    number = consent.whatsapp_number
    if not consent.is_active or not number:
        raise InboxError(409, "consent_withdrawn", "The guest has opted out. Nothing was sent.")
    row = InboxMessage(consent_id=consent.id, direction="out", body=with_stop(body),
                       created_at=now, sent_by=sent_by)  # fmt: skip
    session.add(row)
    session.flush()
    prop = session.get(Property, consent.booking.property_id)
    chosen = sender_for_property(prop, sender) if prop is not None else SimulatedSender()
    result = chosen.send(number, row.body, row.id)
    row.transport = result.transport
    row.provider_message_id = result.provider_id
    if not result.ok:
        raise InboxError(502, "send_failed", result.error or "Sending failed. Try again.")
    return row


def maybe_away_reply(
    session: Session, consent: Consent, sender: Sender, now: datetime
) -> InboxMessage | None:
    """Send the approved away text if it is on and none went out in 24 hours.

    Called only right after the guest wrote, so the guest always wrote first.
    """
    away = get_away(session, consent.booking.property_id)
    if away is None or not away.enabled or not consent.is_active:
        return None
    recent = session.scalar(
        select(func.count(InboxMessage.id)).where(
            InboxMessage.consent_id == consent.id,
            InboxMessage.sent_by == "away",
            InboxMessage.created_at > now - AWAY_EVERY,
        )
    )
    if recent:
        return None
    try:
        return _send(session, consent, away.body, "away", sender, now)
    except InboxError:
        logger.warning("Away reply for consent %s was not sent", consent.id)
        return None


def record_inbound(
    session: Session, from_number: str, text: str, sender: Sender, now: datetime
) -> int:
    """Store an inbound text for each active consent with this number.

    STOP is not stored (it already withdrew the consent). Numbers without an
    active Desk consent get nothing: no thread, no row. Returns rows stored.
    """
    body = text.strip()
    if not body or is_stop(body):
        return 0
    try:
        number = normalise_mobile(from_number)
    except ValueError:
        return 0
    consents = session.scalars(
        select(Consent).where(
            Consent.whatsapp_number == number,
            Consent.withdrawn_at.is_(None),
            Consent.erased_at.is_(None),
        )
    ).all()
    for consent in consents:
        row = InboxMessage(consent_id=consent.id, direction="in", body=body[:MAX_BODY],
                           created_at=now, sent_by="guest", transport="whatsapp")  # fmt: skip
        session.add(row)
        session.flush()
        maybe_away_reply(session, consent, sender, now)
    return len(consents)


def owner_send(  # noqa: PLR0913  (each argument is a distinct input)
    session: Session,
    consent: Consent,
    body: str,
    sender: Sender,
    now: datetime,
    perk_link: str = "",
) -> InboxMessage:
    """The owner's own message, inside the 24-hour window only."""
    text = body.strip()
    if not text:
        raise InboxError(422, "empty_message", "Write a message first")
    if len(text) > MAX_BODY:
        raise InboxError(422, "message_too_long", "Keep the message under 1,000 characters")
    if has_other_link(text, perk_link):
        raise InboxError(
            422,
            "other_link",
            "Only the guest's Seedha Link can be sent. Remove other web addresses.",
        )
    if not window_open(session, consent.id, now):
        raise InboxError(
            409,
            "window_closed",
            "The guest has not written in the last 24 hours. WhatsApp allows only an "
            "approved template now, so use Approvals for a win-back message.",
        )
    return _send(session, consent, text, "owner", sender, now)


def set_away(
    session: Session,
    prop: Property,
    now: datetime,
    *,
    text: str | None,
    approved: bool,
    enabled: bool | None,
) -> InboxAway | None:
    """Save the owner's away text (only with approval) and switch it on or off."""
    away = get_away(session, prop.id)
    if text is not None:
        body = text.strip()
        if not body:
            raise InboxError(422, "empty_away", "Write the away message first")
        if len(body) > MAX_AWAY:
            raise InboxError(422, "away_too_long", "Keep the away message under 300 characters")
        if has_other_link(body):
            raise InboxError(422, "other_link", "The away message cannot contain web addresses")
        if approved is not True:
            raise InboxError(422, "approval_required",
                             "Approve the away message before it is saved")  # fmt: skip
        if away is None:
            away = InboxAway(property_id=prop.id, body=with_stop(body), approved_at=now,
                             enabled=False)  # fmt: skip
            session.add(away)
        else:
            away.body = with_stop(body)
            away.approved_at = now
    if enabled is not None:
        if enabled and away is None:
            raise InboxError(409, "away_text_missing",
                             "Write and approve an away message first")  # fmt: skip
        if away is not None:
            away.enabled = enabled
    session.flush()
    return away


def forget(session: Session, consent: Consent, now: datetime) -> None:
    """DPDP erasure via the proof service, and the thread's texts are deleted."""
    session.execute(delete(InboxMessage).where(InboxMessage.consent_id == consent.id))
    erase_consent(session, consent, now)


# --- what the owner sees about the guest --------------------------------------


def perk_of(session: Session, consent: Consent) -> PerkCode | None:
    """The perk code issued for the consented stay (after checkout)."""
    return session.scalar(
        select(PerkCode).where(PerkCode.origin_booking_id == consent.booking_id).limit(1)
    )


def latest_direct(session: Session, consent: Consent) -> DirectBooking | None:
    """The guest's latest Seedha Link booking, if any."""
    return session.scalar(
        select(DirectBooking)
        .join(Booking, Booking.id == DirectBooking.booking_id)
        .where(Booking.guest_id == consent.guest_id)
        .order_by(DirectBooking.created_at.desc())
        .limit(1)
    )


@dataclass(frozen=True, slots=True)
class RateLine:
    """A rate card line, written by code from the room table."""

    room_type: str
    nightly_rate: int
    line: str


def rate_card(session: Session, property_id: int) -> list[RateLine]:
    """Public nightly rates per room type, as insertable lines."""
    return [
        RateLine(room_type, rate, f"{room_type}: {format_inr(rate)} a night.")
        for room_type, rate in room_rates(session, property_id).items()
    ]


def suggestions(prop: Property, consent: Consent, perk: PerkCode | None, link: str) -> list[str]:
    """Canned replies the owner may tap; fixed text, no AI and no prices."""
    name = consent.guest.short_name
    items = [f"Namaste {name}, thank you for writing. Let me check and reply in a few minutes."]
    if perk is not None:
        promise = prop.perk_promise[:1].upper() + prop.perk_promise[1:]
        items.append(f"{promise} with your code {perk.code} on your next direct stay.")
        items.append(f"You can book directly with us here: {link}")
    items.append(f"Thank you {name}. We look forward to having you back at {prop.short_name}.")
    return items


class ReplyWording(Protocol):
    """Claude suggesting a reply; None when it cannot."""

    def reply(self, guest: str, hotel: str, last_message: str) -> str | None:
        """A candidate reply."""


def canned_reply(prop: Property, consent: Consent) -> str:
    """The fallback draft when Claude is off or its text fails D6."""
    return (
        f"Namaste {consent.guest.short_name}, thank you for your message. "
        f"{prop.owner_name} ji will reply shortly from {prop.short_name}."
    )


@dataclass(frozen=True, slots=True)
class Draft:
    """A suggestion for the owner's composer. Never sent by Seedha."""

    text: str
    source: str


def draft_reply(
    session: Session, prop: Property, consent: Consent, wording: ReplyWording | None
) -> Draft:
    """Claude's suggestion when it passes D6, else the canned reply."""
    inbound = [e for e in thread_entries(session, consent) if e.direction == "in"]
    if wording is not None and inbound:
        candidate = (
            wording.reply(consent.guest.short_name, prop.short_name, inbound[-1].body) or ""
        ).strip()
        if candidate and len(candidate) <= MAX_DRAFT and d6_ok(candidate):
            return Draft(candidate, "ai")
        logger.info("Inbox draft rejected or unavailable; using the canned reply")
    return Draft(canned_reply(prop, consent), "template")


REPLY_SYSTEM = (
    "You suggest one short, warm WhatsApp reply from a small Indian hill hotel owner to a "
    "returning guest who wrote to them. The owner will read and edit it before sending. "
    "Never mention prices, amounts, rupees, discounts, percentages, phone numbers or any "
    "number with three or more digits; if the guest asks about price or availability, say "
    "the owner will confirm. Plain text, no emojis, at most 50 words. Return only the reply."
)


class ClaudeReplyWording:
    """Claude suggestion; any failure returns None so the canned reply is used."""

    def __init__(self, api_key: str, model: str, client: anthropic.Anthropic | None = None) -> None:
        self._client = client or anthropic.Anthropic(api_key=api_key, timeout=30.0, max_retries=1)
        self._model = model

    def reply(self, guest: str, hotel: str, last_message: str) -> str | None:
        """One candidate reply, or None."""
        prompt = f"Hotel: {hotel}\nGuest: {guest}\nGuest wrote: {last_message[:500]}"
        try:
            message = self._client.messages.create(
                model=self._model,
                max_tokens=400,
                system=REPLY_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.APIError:
            logger.warning("Claude reply suggestion unavailable")
            return None
        if message.stop_reason != "end_turn":
            return None
        return next((b.text for b in message.content if b.type == "text"), None)
