"""Seedha Assistant: owner questions answered only from computed figures.

A question is matched to one of a fixed set of intents by keywords. Each
intent is answered by code: the six Ask answers come from services/ask.py and
the rest from the ledger, savings and Saturday move services, so there is no
second copy of any money calculation (rule 1). Claude may only reword the
sentence, and its wording is kept only if it carries exactly the same numbers
(ask.phrased). A question that matches nothing gets an honest list of what
the Assistant can answer.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

import anthropic
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Booking, Property
from app.money import format_inr
from app.services.ask import Answer, Phraser, compute_answer, phrased
from app.services.ledger import DEFAULT_END, DEFAULT_START, LedgerSummary, load_ledger
from app.services.overview import savings_for
from app.services.scenario import ScenarioError, saturday_move

PERIOD = f"{DEFAULT_START.day} {DEFAULT_START:%b} to {DEFAULT_END.day} {DEFAULT_END:%b %Y}"


@dataclass(frozen=True, slots=True)
class Source:
    """Where an answer's figures come from, with the screen that shows them."""

    label: str
    href: str


@dataclass(frozen=True, slots=True)
class Intent:
    """A fixed question type: keywords and its suggestion chip."""

    key: str
    chip: str
    keywords: tuple[str, ...]


INTENTS: tuple[Intent, ...] = (
    Intent("net_kept", "What did I keep after commission?",
           ("after commission", "keep", "kept", "net", "take home", "in hand", "earn",
            "revenue", "total")),
    Intent("paid_to_channels", "How much did channels take?",
           ("paid to channels", "commission", "channels take", "ota fees", "fees", "gst",
            "lost", "cost me")),
    Intent("channel_adr", "Which channel leaves me the most per room?",
           ("per room", "adr", "rank", "each channel", "worst", "lowest", "most per", "channel",
            "best")),
    Intent("paid_last_month", "How much did I pay MakeMyTrip last month?",
           ("last month", "pichle mahine", "previous month", "makemytrip", "mmt")),
    Intent("direct_share", "What share of bookings is direct?",
           ("direct share", "direct bookings", "commission-free", "commission free", "share",
            "how many direct")),
    Intent("repeat_guests", "How many repeat guests paid commission twice?",
           ("repeat guests", "repeat", "twice", "came back", "returning", "do baar", "again")),
    Intent("savings", "How much have coded direct bookings saved?",
           ("save", "saved", "saving", "coded", "code", "bacha", "avoided")),
    Intent("saturday_move", "What if I hold Saturday rooms off the lowest channel?",
           ("saturday", "hold", "rooms off", "scenario", "weekend", "move")),
    Intent("payouts_this_week", "When do this week's payouts arrive?",
           ("payout", "payment", "arrive", "paid out", "when")),
    Intent("todays_close", "How did today close?",
           ("today", "close", "tonight", "aaj", "in house", "rooms sold")),
)  # fmt: skip
INTENT_BY_KEY = {i.key: i for i in INTENTS}
ASK_KEYS = frozenset({"paid_last_month", "repeat_guests", "payouts_this_week", "todays_close"})
UNKNOWN_TEXT = (
    "I can answer questions about money kept, what channels took, net per room by channel, "
    "direct bookings, repeat guests, savings from codes, payouts this week, today's close and "
    "the Saturday move. Try one of the suggestions."
)
WORD = re.compile(r"[a-z0-9-]+")


def match_intent(question: str) -> Intent | None:
    """The intent whose keywords best match, or None. Longer phrases weigh more."""
    text = " ".join(WORD.findall(question.lower()))
    padded = f" {text} "
    best: tuple[int, Intent] | None = None
    for intent in INTENTS:
        score = sum(len(k) for k in intent.keywords if f" {k}" in padded)
        if score and (best is None or score > best[0]):
            best = (score, intent)
    return best[1] if best else None


def tenths(value: int | None) -> str:
    """107 -> '10.7%'."""
    return "0%" if value is None else f"{value // 10}.{value % 10}%"


def statements_source(session: Session, property_id: int) -> Source:
    """How many statement files and lines of the ledger period the answer reads."""
    files, rows, flagged = session.execute(
        select(
            func.count(func.distinct(Booking.statement_file_id)),
            func.count(Booking.id),
            func.coalesce(func.sum(case((Booking.math_check_passed.is_(False), 1), else_=0)), 0),
        ).where(
            Booking.property_id == property_id,
            Booking.statement_file_id.is_not(None),
            Booking.check_in >= DEFAULT_START,
            Booking.check_in <= DEFAULT_END,
        )
    ).one()
    flag_text = f", {int(flagged)} flagged and left out" if flagged else ""
    return Source(f"{int(files)} statements, {int(rows):,} rows{flag_text}", "/upload")


def answer_net_kept(ledger: LedgerSummary) -> Answer:
    """Net kept against list revenue, with both named lost figures (ruling 2)."""
    t = ledger.totals
    net, gross = format_inr(t.net_kept), format_inr(t.list_amount)
    paid, lost = format_inr(t.paid_to_channels), format_inr(t.lost_vs_list_price)
    text = (f"From {PERIOD} you kept {net} of {gross} at list price. Paid to channels {paid}. "
            f"Lost vs list price {lost}.")  # fmt: skip
    return Answer(text, text, (net, gross, paid, lost))


def answer_paid_to_channels(ledger: LedgerSummary) -> Answer:
    """Commission + GST on commission + fees, and lost vs list price."""
    t = ledger.totals
    paid, lost = format_inr(t.paid_to_channels), format_inr(t.lost_vs_list_price)
    text = (f"From {PERIOD} channels took {paid} in commission, GST on commission and fees. "
            f"With discounts counted, lost vs list price is {lost}.")  # fmt: skip
    return Answer(text, text, (paid, lost))


def answer_channel_adr(ledger: LedgerSummary) -> Answer:
    """Net kept per room night for every channel, best first."""
    by_key = {c.channel.key: c for c in ledger.channels}
    ranked = [by_key[k] for k in ledger.rank_by_money_kept if by_key[k].net_adr is not None]
    if not ranked:
        text = "No statements yet. Upload them first."
        return Answer(text, text, ())
    parts = [f"{c.channel.name} {format_inr(c.net_adr or 0)}" for c in ranked]
    text = f"Net kept per room night, best first: {', '.join(parts)}."
    return Answer(text, text, tuple(format_inr(c.net_adr or 0) for c in ranked))


def answer_direct_share(ledger: LedgerSummary) -> Answer:
    """Direct bookings and commission-free share, both named (ruling 3)."""
    direct = tenths(ledger.direct_bookings_tenths)
    free = tenths(ledger.commission_free_share_tenths)
    text = (f"Direct bookings are {direct} of your bookings. Commission-free share, direct plus "
            f"walk-in, is {free}.")  # fmt: skip
    return Answer(text, text, (direct, free))


def answer_savings(session: Session, property_id: int) -> Answer:
    """Every coded direct booking's stored net saving (ruling 5)."""
    totals = savings_for(session, property_id)
    if not totals.count:
        text = "No coded direct bookings yet. No code, no saving claimed."
        return Answer(text, text, ())
    money = format_inr(totals.total_net_saving)
    noun = "booking" if totals.count == 1 else "bookings"
    text = (f"{totals.count} coded direct {noun} saved {money} after the UPI fee. "
            "No code, no saving claimed.")  # fmt: skip
    return Answer(text, text, (str(totals.count), money))


def answer_saturday(ledger: LedgerSummary, rooms: int) -> Answer:
    """The Saturday move for N rooms, from the scenario service."""
    try:
        move = saturday_move(ledger, rooms)
    except ScenarioError as exc:
        return Answer(str(exc) + ".", str(exc) + ".", ())
    extra = format_inr(move.extra_per_saturday)
    direct, ota = format_inr(move.direct_net_adr), format_inr(move.channel_net_adr)
    text = (f"Hold {move.rooms} Saturday rooms off {move.channel_name}. Expected extra kept: "
            f"{extra} per Saturday if they sell direct ({direct} a room direct vs {ota} on "
            f"{move.channel_name}).")  # fmt: skip
    return Answer(text, text, (str(move.rooms), extra, direct, ota))


@dataclass(frozen=True, slots=True)
class Reply:
    """What the Assistant says, where it came from and what to ask next."""

    intent: str
    answer: str
    figures: tuple[str, ...]
    sources: tuple[Source, ...]
    suggestions: tuple[str, ...]
    worded_by: str


def sources_for(session: Session, property_id: int, key: str) -> tuple[Source, ...]:
    """Which data an intent reads."""
    ledger = Source(f"Ledger, {PERIOD}", "/flip")
    files = statements_source(session, property_id)
    return {
        "net_kept": (ledger, files),
        "paid_to_channels": (ledger, files),
        "channel_adr": (ledger, files),
        "direct_share": (ledger, files),
        "paid_last_month": (Source("Ledger, last calendar month", "/flip"), files),
        "repeat_guests": (Source("Repeat guests list", "/repeat"), files),
        "savings": (Source("Savings ledger, coded bookings only", "/savings"),),
        "saturday_move": (Source("Saturday move", "/scenario"), ledger),
        "payouts_this_week": (Source("Statement payouts, last 7 days", "/flip"), files),
        "todays_close": (Source("Desk, guests in house today", "/desk"),),
    }.get(key, ())


def chips_after(key: str | None) -> tuple[str, ...]:
    """Suggestion chips, leaving out the one just answered."""
    return tuple(i.chip for i in INTENTS if i.key != key)[:6]


def compute(session: Session, prop: Property, key: str, day: date, saturday_rooms: int) -> Answer:
    """The computed answer for one intent."""
    if key in ASK_KEYS:
        return compute_answer(session, prop, key, day)
    if key == "savings":
        return answer_savings(session, prop.id)
    ledger = load_ledger(session, prop.id, DEFAULT_START, DEFAULT_END)
    by_ledger = {
        "net_kept": answer_net_kept,
        "paid_to_channels": answer_paid_to_channels,
        "channel_adr": answer_channel_adr,
        "direct_share": answer_direct_share,
    }
    if key in by_ledger:
        return by_ledger[key](ledger)
    return answer_saturday(ledger, saturday_rooms)


def english(answer: Answer) -> Answer:
    """The English sentence as the text Claude may reword."""
    return Answer(answer.en, answer.en, answer.figures)


def ask_assistant(  # noqa: PLR0913  (each argument is a distinct input)
    session: Session,
    prop: Property,
    question: str,
    day: date,
    saturday_rooms: int,
    phraser: Phraser | None,
) -> Reply:
    """Answer one question from computed figures, or say what can be answered."""
    intent = match_intent(question)
    if intent is None:
        return Reply("unknown", UNKNOWN_TEXT, (), (), chips_after(None), "code")
    computed = english(compute(session, prop, intent.key, day, saturday_rooms))
    text = phrased(computed, question, phraser)
    return Reply(
        intent=intent.key,
        answer=text,
        figures=computed.figures,
        sources=sources_for(session, prop.id, intent.key),
        suggestions=chips_after(intent.key),
        worded_by="code" if text == computed.en else "claude",
    )


ASSISTANT_SYSTEM = (
    "You reword one short answer for a hotel owner in plain, warm English. Keep every number "
    "and every rupee amount exactly as written. Do not add, remove, round or change any number. "
    "At most two sentences. Return only the sentence."
)


class ClaudeAssistantPhraser:
    """Claude rewording in English; any failure returns None (template kept)."""

    def __init__(self, api_key: str, model: str, client: anthropic.Anthropic | None = None) -> None:
        self._client = client or anthropic.Anthropic(api_key=api_key, timeout=30.0, max_retries=1)
        self._model = model

    def phrase(self, question: str, answer: str) -> str | None:
        """One candidate sentence, or None."""
        try:
            message = self._client.messages.create(
                model=self._model,
                max_tokens=500,
                system=ASSISTANT_SYSTEM,
                messages=[{"role": "user", "content": f"Question: {question}\nAnswer: {answer}"}],
            )
        except anthropic.APIError:
            return None
        if message.stop_reason != "end_turn":
            return None
        return next((b.text for b in message.content if b.type == "text"), None)
