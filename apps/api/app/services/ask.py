"""Ask on WhatsApp: six fixed questions answered from the owner's own data.

Every number comes from the same code the screens use (ledger, repeats,
savings, close slip), never from Claude (rule 1). Claude may only reword the
Hindi sentence, and its wording is used only if it contains exactly the same
numbers as the computed answer; otherwise the template sentence is returned.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol

import anthropic
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, DirectBooking, Property, Saving
from app.money import ZERO_LINES, LineItems, format_inr, share_tenths_of_percent
from app.services.desk import in_house, month_start, saved_this_month
from app.services.ledger import DEFAULT_END, DEFAULT_START, booking_lines, load_ledger
from app.services.repeats import list_matches, scan

MONTHS_EN = ("January", "February", "March", "April", "May", "June", "July", "August",
             "September", "October", "November", "December")  # fmt: skip
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
MAX_PHRASE_LENGTH = 300


@dataclass(frozen=True, slots=True)
class Question:
    """A fixed question as the owner taps it."""

    key: str
    hi: str
    en: str


QUESTIONS: tuple[Question, ...] = (
    Question("paid_last_month", "Pichle mahine MakeMyTrip ko kitna diya?",
             "How much did I pay MakeMyTrip last month?"),
    Question("best_channel", "Sabse accha channel kaunsa?", "Which channel is best?"),
    Question("repeat_guests", "Kitne guest do baar commission dekar aaye?",
             "How many guests came back and cost commission twice?"),
    Question("payouts_this_week", "Is hafte ka payment kab aayega?",
             "When do this week's payouts arrive?"),
    Question("saved_direct", "Direct se kitna bacha?", "How much did direct bookings save?"),
    Question("todays_close", "Aaj ka close", "Today's close"),
)  # fmt: skip
QUESTION_BY_KEY = {q.key: q for q in QUESTIONS}

# Sample payout terms used to describe when money arrives (not money values).
PAYOUT_TERMS_HI = {
    "mmt": "{day} ko",
    "bcom": "ka virtual card abhi charge karna baaki hai",
    "agoda": "mahine ke end mein",
    "ta": "agent se seedha",
}
PAYOUT_TERMS_EN = {
    "mmt": "on {day}",
    "bcom": "as a virtual card still to be charged",
    "agoda": "at month end",
    "ta": "directly from the agent",
}


@dataclass(frozen=True, slots=True)
class Answer:
    """A computed answer in Hindi and English, with the figures it states."""

    hi: str
    en: str
    figures: tuple[str, ...]


class Phraser(Protocol):
    """Rewords a Hindi answer (Claude); None when it cannot."""

    def phrase(self, question: str, answer: str) -> str | None:
        """A candidate sentence."""


def previous_month(day: date) -> tuple[date, date]:
    """First and last day of the month before `day`."""
    last = day.replace(day=1) - timedelta(days=1)
    return last.replace(day=1), last


def next_friday(day: date) -> date:
    """The coming Friday (today if it is Friday)."""
    return day + timedelta(days=(4 - day.weekday()) % 7)


def answer_paid_last_month(session: Session, prop: Property, day: date) -> Answer:
    """Commission + GST + fees paid to MakeMyTrip in the previous month."""
    start, end = previous_month(day)
    ledger = load_ledger(session, prop.id, start, end)
    mmt = next((c for c in ledger.channels if c.channel.key == "mmt"), None)
    if mmt is None or mmt.room_nights == 0:
        return Answer("Pichle mahine ka MakeMyTrip data abhi nahi hai.",
                      "There is no MakeMyTrip data for last month yet.", ())  # fmt: skip
    paid = format_inr(mmt.lines.paid_to_channels)
    month = MONTHS_EN[start.month - 1]
    return Answer(
        hi=f"{month} mein MakeMyTrip ko {paid} diye. Commission plus GST on commission.",
        en=f"In {month} you paid MakeMyTrip {paid}: commission plus GST on commission.",
        figures=(paid,),
    )


def answer_best_channel(session: Session, prop: Property) -> Answer:
    """Best net per room overall, and best among online channels."""
    ledger = load_ledger(session, prop.id, DEFAULT_START, DEFAULT_END)
    by_key = {c.channel.key: c for c in ledger.channels}
    if ledger.room_nights == 0:
        return Answer("Abhi statements nahi aaye. Pehle upload kijiye.",
                      "No statements yet. Upload them first.", ())  # fmt: skip
    best = by_key[ledger.rank_by_money_kept[0]]
    online = next(by_key[k] for k in ledger.rank_by_money_kept
                  if by_key[k].channel.kind in {"ota", "direct"})  # fmt: skip
    best_adr, online_adr = format_inr(best.net_adr or 0), format_inr(online.net_adr or 0)
    return Answer(
        hi=(f"{best.channel.name}: har room par {best_adr} bache. Online mein "
            f"{online.channel.name} sabse accha: {online_adr} har room."),
        en=(f"{best.channel.name}: {best_adr} kept per room. Online, {online.channel.name} is "
            f"best: {online_adr} per room."),
        figures=(best_adr, online_adr),
    )  # fmt: skip


def answer_repeat_guests(session: Session, prop: Property) -> Answer:
    """Repeat guests and the commission paid twice on them (decision C)."""
    scan(session, prop.id, None)
    rows = list_matches(session, prop.id)
    total = format_inr(sum(r.paid_twice for r in rows))
    return Answer(
        hi=f"{len(rows)} guests. Unpar {total} commission dobara diya.",
        en=f"{len(rows)} guests. You paid {total} commission on them a second time.",
        figures=(str(len(rows)), total),
    )


def answer_payouts(session: Session, prop: Property, day: date) -> Answer:
    """OTA payouts due for stays from the last 7 days, by channel."""
    rows = session.execute(
        select(Channel.key, Channel.name, func.sum(Booking.payout_reported))
        .join(Channel, Channel.id == Booking.channel_id)
        .where(
            Booking.property_id == prop.id,
            Channel.kind.in_(("ota", "agent")),
            Booking.status == "stay",
            Booking.check_in <= day,
            Booking.check_in > day - timedelta(days=7),
        )
        .group_by(Channel.key, Channel.name)
        .order_by(Channel.sort_order)
    ).all()
    if not rows:
        return Answer("Is hafte koi OTA payment baaki nahi.", "No OTA payouts due this week.", ())
    friday = next_friday(day).strftime("%A")
    hi_parts, en_parts, figures = [], [], []
    for key, name, amount in rows:
        money = format_inr(int(amount or 0))
        figures.append(money)
        hi_parts.append(
            f"{name}: {money} {PAYOUT_TERMS_HI.get(key, '').format(day=friday)}".strip()
        )
        en_parts.append(
            f"{name}: {money} {PAYOUT_TERMS_EN.get(key, '').format(day=friday)}".strip()
        )
    return Answer(". ".join(hi_parts) + ".", ". ".join(en_parts) + ".", tuple(figures))


def answer_saved_direct(session: Session, prop: Property, day: date) -> Answer:
    """Net saving from coded direct bookings this month."""
    total = saved_this_month(session, prop.id, day)
    count = (
        session.scalar(
            select(func.count(Saving.id))
            .join(DirectBooking, DirectBooking.id == Saving.direct_booking_id)
            .where(
                DirectBooking.property_id == prop.id, DirectBooking.created_at >= month_start(day)
            )
        )
        or 0
    )
    if not count:
        return Answer(
            "Abhi tak koi coded direct booking nahi. Desk par guests ka consent lijiye.",
            "No coded direct bookings yet. Ask guests for consent at the Desk.",
            (),
        )
    money = format_inr(total)
    plural = "booking" if count == 1 else "bookings"
    return Answer(
        hi=f"Is mahine {money} bache, {count} coded direct booking se.",
        en=f"This month you saved {money} from {count} coded direct {plural}.",
        figures=(money, str(count)),
    )


def close_lines(session: Session, prop: Property, day: date) -> tuple[int, LineItems]:
    """Rooms sold on `day` and the sum of their line items."""
    stays = in_house(session, prop.id, day)
    lines = ZERO_LINES
    for stay in stays:
        lines = lines + booking_lines(stay.booking)
    return len(stays), lines


def morning_line(session: Session, prop: Property, day: date) -> Answer:
    """The 8 AM line: last close's rooms and what the hotel kept on them."""
    rooms, lines = close_lines(session, prop, day)
    owner = prop.owner_name
    if rooms == 0:
        return Answer(f"Suprabhat {owner} ji. Kal koi room nahi bika.",
                      f"Good morning, {owner} ji. No rooms sold yesterday.", ())  # fmt: skip
    net = format_inr(lines.net_kept)
    return Answer(
        hi=f"Suprabhat {owner} ji. Kal {rooms} room bike, aapke paas {net} bache.",
        en=f"Good morning, {owner} ji. Yesterday {rooms} rooms sold and you kept {net}.",
        figures=(str(rooms), net),
    )


def answer_close(session: Session, prop: Property, day: date) -> Answer:
    """Tonight's rooms, gross, what channels took, net and direct bookings."""
    stays = in_house(session, prop.id, day)
    lines = ZERO_LINES
    for stay in stays:
        lines = lines + booking_lines(stay.booking)
    direct = sum(1 for s in stays if s.channel.kind == "direct")
    share = (share_tenths_of_percent(direct, len(stays)) + 5) // 10 if stays else 0
    gross, net = format_inr(lines.list_amount), format_inr(lines.net_kept)
    paid = format_inr(lines.commission + lines.gst_on_commission)
    return Answer(
        hi=(f"Aaj: {len(stays)} rooms. Gross {gross}. Net {net}. Commission plus GST {paid}. "
            f"Direct bookings {share}%."),
        en=(f"Today: {len(stays)} rooms. Gross {gross}. Net {net}. Commission plus GST {paid}. "
            f"Direct bookings {share}%."),
        figures=(str(len(stays)), gross, net, paid, f"{share}%"),
    )  # fmt: skip


def compute_answer(session: Session, prop: Property, key: str, day: date) -> Answer:
    """The computed answer for one of the six questions."""
    handlers = {
        "paid_last_month": lambda: answer_paid_last_month(session, prop, day),
        "best_channel": lambda: answer_best_channel(session, prop),
        "repeat_guests": lambda: answer_repeat_guests(session, prop),
        "payouts_this_week": lambda: answer_payouts(session, prop, day),
        "saved_direct": lambda: answer_saved_direct(session, prop, day),
        "todays_close": lambda: answer_close(session, prop, day),
    }
    return handlers[key]()


def numbers_in(text: str) -> list[str]:
    """Every number written in a sentence, in order, commas kept."""
    return sorted(NUMBER.findall(text))


def phrased(answer: Answer, question: str, phraser: Phraser | None) -> str:
    """Claude's wording only if it carries exactly the computed numbers and
    the same number of rupee amounts; otherwise the template sentence."""
    if phraser is None:
        return answer.hi
    candidate = (phraser.phrase(question, answer.hi) or "").strip()
    acceptable = (
        bool(candidate)
        and len(candidate) <= MAX_PHRASE_LENGTH
        and numbers_in(candidate) == numbers_in(answer.hi)
        and candidate.count("₹") == answer.hi.count("₹")
    )
    return candidate if acceptable else answer.hi


PHRASE_SYSTEM = (
    "You reword one short answer for a hotel owner in simple Hinglish (Hindi in Latin script). "
    "Keep every number and every rupee amount exactly as written. Do not add, remove, round or "
    "change any number. One or two sentences. Return only the sentence."
)


class ClaudePhraser:
    """Claude rewording; any failure returns None so the template is used."""

    def __init__(self, api_key: str, model: str, client: anthropic.Anthropic | None = None) -> None:
        self._client = client or anthropic.Anthropic(api_key=api_key, timeout=30.0, max_retries=1)
        self._model = model

    def phrase(self, question: str, answer: str) -> str | None:
        """One candidate sentence, or None."""
        try:
            message = self._client.messages.create(
                model=self._model,
                max_tokens=500,
                system=PHRASE_SYSTEM,
                messages=[{"role": "user", "content": f"Question: {question}\nAnswer: {answer}"}],
            )
        except anthropic.APIError:
            return None
        if message.stop_reason != "end_turn":
            return None
        return next((b.text for b in message.content if b.type == "text"), None)
