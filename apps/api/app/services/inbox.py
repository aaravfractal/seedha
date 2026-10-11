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
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal, Protocol

import anthropic
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Consent,
    DirectBooking,
    GuestMemory,
    InboxAway,
    InboxMessage,
    Message,
    PerkCode,
    ProofBundle,
    ProofBundleItem,
    Property,
    StayInvoice,
)
from app.money import format_inr
from app.services.consent import WORDING_VERSION, as_utc, fingerprint, normalise_mobile
from app.services.drafter import MONEY_PATTERN, STOP_LINE, WEB_ADDRESS
from app.services.link import room_rates
from app.services.proof import erase_consent, merkle_root
from app.services.whatsapp import CloudApiSender, Sender, SimulatedSender, is_stop

logger = logging.getLogger("seedha.inbox")

WINDOW = timedelta(hours=24)
AWAY_EVERY = timedelta(hours=24)
MAX_BODY = 1_000
MAX_AWAY = 300
MAX_DRAFT = 400
STOP_PHRASE = "reply stop to opt out"


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
    return MONEY_PATTERN.search(text) is None


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
    session: Session,
    from_number: str,
    text: str,
    sender: Sender,
    now: datetime,
    transport: str = "whatsapp",
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
                           created_at=now, sent_by="guest", transport=transport)  # fmt: skip
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
    """DPDP erasure via the proof service (which also deletes the thread's texts)."""
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


# --- topics and fixed reply templates (no AI, no money, no 3+ digit numbers) ----

Language = Literal["en", "hi", "hinglish"]
DEVANAGARI = re.compile(r"[\u0900-\u097F]")
HINGLISH = re.compile(
    r"\b(hai|hain|kya|kaise|hum|aap|ji|nahi|chahiye|mil|sakta|sakte|jayega|jayenge|"
    r"rahe|raha|wala|wale|kal|subah|saath|aana|aane|pe|toh|bhi|sabse|zyada|kaafi|thik)\b",
    re.IGNORECASE,
)
HINGLISH_MIN = 2

# Checked in this order; the first topic whose pattern matches wins.
TOPIC_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("invoice", re.compile(r"invoice|\bbill\b|receipt|बिल|इनवॉइस|रसीद", re.IGNORECASE)),
    ("refund", re.compile(r"refund|money back|paise wapas|रिफंड|पैसे वापस", re.IGNORECASE)),
    ("wifi", re.compile(r"wi-?fi|internet|वाई-?फाई|इंटरनेट", re.IGNORECASE)),
    ("late_checkout", re.compile(r"late check-?\s?out|लेट चेक ?आउट|देर से चेक", re.IGNORECASE)),
    ("early_checkin", re.compile(r"early check-?\s?in|अर्ली चेक|जल्दी चेक", re.IGNORECASE)),
    ("parking", re.compile(r"parking|\bcars?\b|gaadi|गाड़ी|गाड़ियों|पार्किंग", re.IGNORECASE)),
    (
        "directions",
        re.compile(
            r"direction|route|ras?ta\b|raasta|how to reach|pahunch|रास्ता|पहुँच|पहुंच",
            re.IGNORECASE,
        ),
    ),
    (
        "booking",
        re.compile(
            r"diwali|\bbook|availab|free on|rooms? chahiye|दिवाली|बुक|खाली|कमरे चाहिए",
            re.IGNORECASE,
        ),
    ),
)

# {name} is the guest's short name, {owner} the owner's first name, {hotel}
# the hotel's short name and {address} its address. Written by people, so a
# fixed template is always a safe draft (D6 holds for every one, tested).
TEMPLATES: dict[str, dict[str, str]] = {
    "invoice": {
        "en": "Namaste {name}, thank you for staying with us at {hotel}. Your stay invoice is "
        "attached to this message. Tell us if anything on it needs a change.",
        "hi": "नमस्ते {name}, {hotel} में ठहरने के लिए धन्यवाद। आपकी स्टे इनवॉइस इस संदेश के "
        "साथ है। कुछ बदलना हो तो बताइए।",
    },
    "late_checkout": {
        "en": "Namaste {name}, happy to help. A late checkout depends on the next arrival for "
        "your room, so {owner} ji will confirm it the day before.",
        "hi": "नमस्ते {name}, लेट चेकआउट अगली बुकिंग पर निर्भर करता है। {owner} जी एक दिन पहले पक्का बता देंगे।",
    },
    "early_checkin": {
        "en": "Namaste {name}, we will try to have your room ready early. If it is not ready "
        "yet, relax in the lobby with tea and leave your bags with us.",
        "hi": "नमस्ते {name}, हम कोशिश करेंगे कि आपका कमरा जल्दी तैयार हो। तब तक लॉबी में चाय "
        "लीजिए और सामान हमारे पास रख दीजिए।",
    },
    "parking": {
        "en": "Namaste {name}, we will check parking for your cars. Please share your arrival "
        "time so we can keep space.",
        "hi": "नमस्ते {name}, हम आपकी गाड़ियों के लिए पार्किंग देख लेंगे। कृपया पहुँचने का समय "
        "बता दीजिए ताकि जगह रखी जा सके।",
    },
    "booking": {
        "en": "Namaste {name}, thank you for thinking of us again. {owner} ji will check the "
        "rooms for your dates and come back to you shortly.",
        "hi": "नमस्ते {name}, हमें फिर याद करने के लिए धन्यवाद। {owner} जी आपकी तारीखों के लिए "
        "कमरे देखकर जल्द ही बताएँगे।",
    },
    "wifi": {
        "en": "Namaste {name}, sorry about the Wi-Fi trouble, and thank you for telling us. "
        "If there is anything we can help with, please write to us here.",
        "hi": "नमस्ते {name}, वाई-फाई की परेशानी के लिए माफ़ी, और बताने के लिए धन्यवाद। किसी भी "
        "मदद के लिए हमें यहाँ लिख दीजिए।",
    },
    "refund": {
        "en": "Namaste {name}, thank you for writing. {owner} ji is checking the refund for the "
        "cancelled night and will update you soon.",
        "hi": "नमस्ते {name}, संदेश के लिए धन्यवाद। {owner} जी रद्द हुई रात के रिफंड की स्थिति "
        "देखकर जल्द ही बताएँगे।",
    },
    "directions": {
        "en": "Namaste {name}, a cab is easiest; ask the driver for {hotel}, {address}. Share "
        "your arrival time and our staff will meet you and help with the luggage.",
        "hi": "नमस्ते {name}, टैक्सी सबसे आसान है; ड्राइवर को {hotel}, {address} बताइए। पहुँचने "
        "का समय बता दीजिए, हमारा स्टाफ़ सामान में मदद करेगा।",
    },
    "other": {
        "en": "Namaste {name}, thank you for your message. {owner} ji will reply shortly from "
        "{hotel}.",
        "hi": "नमस्ते {name}, संदेश के लिए धन्यवाद। {owner} जी {hotel} से जल्द ही जवाब देंगे।",
    },
}
LANGUAGE_LABEL = {"en": "English", "hi": "Hindi", "hinglish": "Hinglish"}


def language_of(text: str) -> Language:
    """Hindi (Devanagari script), Hinglish (Hindi in Latin script) or English."""
    if DEVANAGARI.search(text):
        return "hi"
    return "hinglish" if len(HINGLISH.findall(text)) >= HINGLISH_MIN else "en"


def topic_of(text: str) -> str:
    """What the guest asks about, from fixed keywords; 'other' if none match."""
    return next((topic for topic, pattern in TOPIC_PATTERNS if pattern.search(text)), "other")


def template_reply(prop: Property, consent: Consent, topic: str, language: Language) -> str:
    """The fixed reply for a topic, in Hindi for Devanagari messages else English."""
    texts = TEMPLATES.get(topic, TEMPLATES["other"])
    text = texts["hi" if language == "hi" else "en"]
    return text.format(name=consent.guest.short_name, owner=prop.owner_name,
                       hotel=prop.short_name, address=prop.address)  # fmt: skip


@dataclass(frozen=True, slots=True)
class Draft:
    """A suggestion for the owner's composer. Never sent by Seedha.

    `attach_invoice` asks the owner's screen to offer the stay invoice: the
    invoice itself is built by code from the booking row, never by the AI.
    """

    text: str
    source: str
    topic: str = "other"
    attach_invoice: bool = False


def draft_reply(
    session: Session, prop: Property, consent: Consent, wording: ReplyWording | None
) -> Draft:
    """Claude's suggestion when it passes D6, else a fixed template.

    With no guest message yet the canned reply is used. A guest text in
    Devanagari gets a Hindi template; Latin script gets the English one.
    """
    inbound = [e for e in thread_entries(session, consent) if e.direction == "in"]
    if not inbound:
        return Draft(canned_reply(prop, consent), "template")
    last = inbound[-1].body
    topic = topic_of(last)
    invoice = topic == "invoice"
    if wording is not None:
        candidate = (wording.reply(consent.guest.short_name, prop.short_name, last) or "").strip()
        if candidate and len(candidate) <= MAX_DRAFT and d6_ok(candidate):
            return Draft(candidate, "ai", topic, invoice)
        logger.info("Inbox draft rejected or unavailable; using the fixed template")
    if topic == "other" and language_of(last) != "hi":
        return Draft(canned_reply(prop, consent), "template", topic, invoice)
    return Draft(template_reply(prop, consent, topic, language_of(last)), "template", topic,
                 invoice)  # fmt: skip


REPLY_SYSTEM = (
    "You suggest one short, warm WhatsApp reply from a small Indian hill hotel owner to a "
    "returning guest who wrote to them. The owner will read and edit it before sending. "
    "Never mention prices, amounts, rupees, discounts, percentages, phone numbers or any "
    "number with three or more digits; if the guest asks about price or availability, say "
    "the owner will confirm. If the guest asks for a bill or invoice, say their stay invoice is "
    "attached, without any figure or invoice number. Reply in the guest's language (Hindi in "
    "Devanagari if they wrote in Devanagari). Plain text, no emojis, at most 50 words. Return "
    "only the reply."
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


# --- profile: what Seedha remembers -------------------------------------------


def memories(session: Session, consent: Consent, kind: str) -> list[str]:
    """The guest's stored preferences or notes, oldest first (no money, no documents)."""
    return list(
        session.scalars(
            select(GuestMemory.text)
            .where(GuestMemory.guest_id == consent.guest_id, GuestMemory.kind == kind)
            .order_by(GuestMemory.created_at, GuestMemory.id)
        )
    )


def last_invoice_number(session: Session, consent: Consent) -> str | None:
    """The newest stay invoice number issued for any of the guest's stays."""
    return session.scalar(
        select(StayInvoice.number)
        .join(Booking, Booking.id == StayInvoice.booking_id)
        .where(Booking.guest_id == consent.guest_id)
        .order_by(StayInvoice.created_at.desc(), StayInvoice.id.desc())
        .limit(1)
    )


def guest_language(session: Session, consent: Consent) -> str | None:
    """The language of the guest's latest message, or None before they write."""
    rows = [m for m in inbox_rows(session, consent.id) if m.direction == "in"]
    return LANGUAGE_LABEL[language_of(rows[-1].body)] if rows else None


# --- sample hotel: seeded threads and "Simulate incoming message" -------------

# Fictional numbers for the sample hotel's seeded guests: +91 90000 001NN.
SEEDED_NUMBER_PREFIX = "+91900000"
SEEDED_NUMBER_FIRST = 101

# A rotating set of realistic guest texts. Never STOP and never a money
# figure, so a demo click can only ever add one ordinary message.
SIMULATE_TEXTS: tuple[str, ...] = (
    "Hi, could you please send the bill for my last stay? I need it for the office.",
    "Namaste ji, kya kal subah early check-in ho sakta hai? Train jaldi aa rahi hai.",
    "क्या दिवाली वाले हफ़्ते में दो कमरे खाली हैं? परिवार के साथ आना है।",
    "The Wi-Fi is very slow in our room since the morning, can someone check?",
    "Parking milegi kya? Hum apni gaadi se aa rahe hain, do log hain.",
    "Is a late checkout possible tomorrow? Our cab comes only in the afternoon.",
    "मेरी एक रात की बुकिंग रद्द हुई थी, उसका रिफंड कब तक आएगा?",
    "Dehradun se aane ka sabse aasaan rasta kya hai? Saamaan kaafi zyada hai.",
    "Thank you for the warm stay, the kids loved the view from the balcony.",
    "कृपया मेरे पिछले स्टे का बिल भेज दीजिए।",
)


def seeded_number(index: int) -> str:
    """The index-th fictional sample number, normalised like a real consent."""
    return f"{SEEDED_NUMBER_PREFIX}{SEEDED_NUMBER_FIRST + index:04d}"


def add_seeded_consent(
    session: Session, booking: Booking, number: str, given_at: datetime
) -> Consent:
    """A sample Desk consent, salted and fingerprinted exactly like the real flow."""
    if booking.guest_id is None:
        raise InboxError(409, "no_guest", "This stay has no guest record")
    salt = secrets.token_hex(32)
    consent = Consent(guest_id=booking.guest_id, booking_id=booking.id,
                      wording_version=WORDING_VERSION, given_at=given_at, salt=salt,
                      fingerprint=fingerprint(salt, booking.id, given_at, WORDING_VERSION),
                      whatsapp_number=normalise_mobile(number), proof_status="pending",
                      seeded=True)  # fmt: skip
    session.add(consent)
    session.flush()
    return consent


def seal_seeded(session: Session, property_id: int, consents: list[Consent], at: datetime) -> None:
    """Seal only these sample consents under their own local root (never real
    pending ones, which wait for the owner's own proof write)."""
    bundle = ProofBundle(property_id=property_id, created_at=at,
                         merkle_root=merkle_root([c.fingerprint for c in consents]),
                         item_count=len(consents), chain_status="stored")  # fmt: skip
    session.add(bundle)
    session.flush()
    for index, consent in enumerate(consents):
        session.add(ProofBundleItem(bundle_id=bundle.id, consent_id=consent.id,
                                    leaf_index=index, fingerprint=consent.fingerprint))  # fmt: skip
        consent.proof_status = "verified"
    session.flush()


def seeded_threads(session: Session, property_id: int) -> list[Consent]:
    """The sample hotel's seeded threads still in the inbox, oldest first."""
    return sorted(
        (c for c in active_consents(session, property_id) if c.seeded), key=lambda c: c.id
    )


def _new_seeded_guest(session: Session, prop: Property, now: datetime) -> Consent:
    """A fresh sample thread on the newest checked-out Desk stay with no consent."""
    consented = select(Consent.guest_id)
    booking = session.scalar(
        select(Booking)
        .where(
            Booking.property_id == prop.id,
            Booking.source == "desk",
            Booking.checked_out_at.is_not(None),
            Booking.guest_id.is_not(None),
            Booking.guest_id.not_in(consented),
        )
        .order_by(Booking.check_in.desc(), Booking.id)
        .limit(1)
    )
    if booking is None:
        raise InboxError(409, "no_sample_guest", "Every sample guest already has a thread")
    used = session.scalar(select(func.count(Consent.id)).where(Consent.seeded.is_(True))) or 0
    consent = add_seeded_consent(session, booking, seeded_number(int(used)), now)
    seal_seeded(session, prop.id, [consent], now)
    return consent


def simulate_target(session: Session, prop: Property, now: datetime) -> tuple[Consent, str]:
    """The next seeded thread and text, rotating through both fixed lists."""
    if not prop.is_sample:
        raise InboxError(403, "not_sample", "Simulated messages are only for the sample hotel")
    threads = seeded_threads(session, prop.id)
    if not threads:
        threads = [_new_seeded_guest(session, prop, now)]
    sent = session.scalar(
        select(func.count(InboxMessage.id))
        .join(Consent, Consent.id == InboxMessage.consent_id)
        .where(Consent.seeded.is_(True), InboxMessage.direction == "in")
    )
    turn = int(sent or 0)
    return threads[turn % len(threads)], SIMULATE_TEXTS[turn % len(SIMULATE_TEXTS)]
