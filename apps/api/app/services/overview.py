"""The owner's Overview: one read that gathers what the home screen shows.

Every figure is computed from stored rows by the existing services (the
ledger, the desk, savings, scenario, pipeline). This module only composes
them; it never repeats the ledger arithmetic (rule 1). Money is integer paise.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Consent,
    DirectBooking,
    Message,
    PerkCode,
    Property,
    Room,
    Saving,
    StatementFile,
)
from app.money import per_unit_rounded, share_tenths_of_percent
from app.routers.pipeline import STEP_KEYS, compute_steps
from app.routers.scenario import DEFAULT_ROOMS, current_answer
from app.services.consent import as_utc
from app.services.desk import business_date, in_house, utc_now
from app.services.insight import build_insight
from app.services.ledger import LedgerSummary, booking_lines, load_ledger
from app.services.repeats import list_matches
from app.services.scenario import ScenarioError, saturday_move

# Short room-tile codes as printed on the Last night grid.
CHANNEL_CODES = {
    "mmt": "MMT",
    "bcom": "BDC",
    "agoda": "AGO",
    "ta": "AGT",
    "walkin": "WLK",
    "direct": "DIR",
}


def channel_code(key: str) -> str:
    """Three-letter tile code for a channel key."""
    return CHANNEL_CODES.get(key, key[:3].upper())


AUTO_CONFIRM_PCT = 80  # repeat matches below 80% need the owner (DATA.md)
VOWELS = frozenset("AEIOU")


@dataclass(frozen=True, slots=True)
class Owner:
    """How the shell greets the owner."""

    name: str
    short_name: str
    initials: str


def owner_initials(name: str) -> str:
    """Two-letter avatar initials.

    Several words: first letters of the first and last word ("Rajesh Rawat"
    -> "RR"). One word: its first letter plus its next consonant ("Rajesh"
    -> "RJ"), so a single first name still gives two letters.
    """
    words = [w for w in name.split() if w and w[0].isalpha()]
    if not words:
        return "?"
    if len(words) > 1:
        return (words[0][0] + words[-1][0]).upper()
    word = words[0].upper()
    rest = next((ch for ch in word[1:] if ch.isalpha() and ch not in VOWELS), "")
    return word[0] + rest


def owner_for(prop: Property) -> Owner:
    """The owner's display name, short name and initials."""
    name = prop.owner_name.strip()
    short = name.split()[0] if name else ""
    return Owner(name=name, short_name=short, initials=owner_initials(name))


@dataclass(frozen=True, slots=True)
class Kpis:
    """The six tiles. Money in paise; shares in tenths of a percent."""

    list_revenue: int
    net_kept: int
    net_kept_share_tenths: int
    net_adr: int
    list_adr: int
    revpar_net: int
    revpar_list: int
    paid_to_channels: int
    paid_to_channels_share_tenths: int | None
    commission_free_share_tenths: int | None
    direct_bookings_tenths: int | None
    room_nights: int
    available_room_nights: int
    occupancy_tenths: int


def kpis_for(ledger: LedgerSummary) -> Kpis:
    """Headline tiles from a non-empty ledger summary."""
    t = ledger.totals
    available = ledger.rooms_count * ledger.days
    return Kpis(
        list_revenue=t.list_amount,
        net_kept=t.net_kept,
        net_kept_share_tenths=share_tenths_of_percent(max(t.net_kept, 0), t.list_amount)
        if t.list_amount
        else 0,
        net_adr=per_unit_rounded(t.net_kept, ledger.room_nights),
        list_adr=per_unit_rounded(t.list_amount, ledger.room_nights),
        revpar_net=ledger.revpar_net,
        revpar_list=ledger.revpar_list,
        paid_to_channels=t.paid_to_channels,
        paid_to_channels_share_tenths=ledger.paid_to_channels_share_tenths,
        commission_free_share_tenths=ledger.commission_free_share_tenths,
        direct_bookings_tenths=ledger.direct_bookings_tenths,
        room_nights=ledger.room_nights,
        available_room_nights=available,
        occupancy_tenths=share_tenths_of_percent(ledger.room_nights, available),
    )


@dataclass(frozen=True, slots=True)
class WaterfallStep:
    """One bar: list revenue and net kept are positive, the drops negative."""

    key: str
    label: str
    amount: int


def waterfall_for(ledger: LedgerSummary) -> list[WaterfallStep]:
    """List revenue down to net kept, using the ledger's own totals."""
    t = ledger.totals
    return [
        WaterfallStep("list_revenue", "List revenue", t.list_amount),
        WaterfallStep("discount", "Discount", -t.discount),
        WaterfallStep("commission", "Commission", -t.commission),
        WaterfallStep("gst_on_commission", "GST on comm.", -t.gst_on_commission),
        WaterfallStep("fees", "Fees", -t.fees),
        WaterfallStep("net_kept", "Net kept", t.net_kept),
    ]


@dataclass(frozen=True, slots=True)
class MixSlice:
    """One channel's room nights and share of all room nights."""

    key: str
    name: str
    room_nights: int
    share_tenths: int


def mix_for(ledger: LedgerSummary) -> list[MixSlice]:
    """Room nights by channel in the ledger's fixed channel order."""
    return [
        MixSlice(
            key=c.channel.key,
            name=c.channel.name,
            room_nights=c.room_nights,
            share_tenths=share_tenths_of_percent(c.room_nights, ledger.room_nights),
        )
        for c in ledger.channels
    ]


@dataclass(frozen=True, slots=True)
class RoomTile:
    """A room on the Last night grid; channel fields are None when empty."""

    number: int
    channel_key: str | None
    code: str | None


@dataclass(frozen=True, slots=True)
class LastNight:
    """The in-house night on the desk register (the 9 PM close figures)."""

    day: date
    rooms_count: int
    sold: int
    net_kept: int
    direct_share_pct: int | None
    is_sample: bool
    rooms: list[RoomTile]


def last_night_for(session: Session, prop: Property, day: date) -> LastNight:
    """Rooms sold on the business day, from the desk register's own rows."""
    stays = in_house(session, prop.id, day)
    by_room = {s.room.number: s.channel.key for s in stays if s.room is not None}
    numbers = session.scalars(
        select(Room.number).where(Room.property_id == prop.id).order_by(Room.number)
    ).all()
    net = sum(booking_lines(s.booking).net_kept for s in stays)
    direct = sum(1 for s in stays if s.channel.kind == "direct")
    share = (share_tenths_of_percent(direct, len(stays)) + 5) // 10 if stays else None
    return LastNight(
        day=day,
        rooms_count=prop.rooms_count,
        sold=len(stays),
        net_kept=net,
        direct_share_pct=share,
        is_sample=prop.is_sample,
        rooms=[
            RoomTile(
                number=n,
                channel_key=by_room.get(n),
                code=channel_code(by_room[n]) if n in by_room else None,
            )
            for n in numbers
        ],
    )


@dataclass(frozen=True, slots=True)
class Savings:
    """Coded direct bookings and what they saved (paise)."""

    total_net_saving: int
    count: int


def savings_for(session: Session, property_id: int) -> Savings:
    """Totals over stored savings rows (no code, no saving claimed)."""
    total, count = session.execute(
        select(func.coalesce(func.sum(Saving.net_saving), 0), func.count(Saving.id))
        .join(DirectBooking, DirectBooking.id == Saving.direct_booking_id)
        .where(DirectBooking.property_id == property_id)
    ).one()
    return Savings(total_net_saving=int(total or 0), count=int(count or 0))


@dataclass(frozen=True, slots=True)
class Item:
    """A Needs-you row or a notification. `at` is when it happened, if known."""

    key: str
    title: str
    detail: str
    href: str
    icon: str
    at: datetime | None = None
    amount: int | None = None  # paise, shown after the title (a gain)


def _drafts(session: Session, property_id: int) -> list[Message]:
    return list(
        session.scalars(
            select(Message)
            .join(Consent, Consent.id == Message.consent_id)
            .join(Booking, Booking.id == Consent.booking_id)
            .where(Booking.property_id == property_id, Message.status == "draft")
            .order_by(Message.created_at.desc(), Message.id.desc())
        )
    )


def _pending_review(session: Session, property_id: int) -> tuple[int, datetime | None]:
    count = session.scalar(
        select(func.count(Booking.id)).where(
            Booking.property_id == property_id,
            Booking.source == "statement",
            Booking.math_check_passed.is_(False),
            Booking.review_status == "pending",
        )
    )
    latest = session.scalar(
        select(func.max(StatementFile.uploaded_at)).where(StatementFile.property_id == property_id)
    )
    return int(count or 0), latest


def _pending_proof(session: Session, property_id: int) -> tuple[int, datetime | None]:
    count, latest = session.execute(
        select(func.count(Consent.id), func.max(Consent.given_at))
        .join(Booking, Booking.id == Consent.booking_id)
        .where(
            Booking.property_id == property_id,
            Consent.proof_status == "pending",
            Consent.erased_at.is_(None),
        )
    ).one()
    return int(count or 0), latest


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def needs_you(
    session: Session, prop: Property, ledger: LedgerSummary | None
) -> tuple[list[Item], int]:
    """Things only the owner can do, most urgent first, and the draft count."""
    items: list[Item] = []
    drafts = _drafts(session, prop.id)
    if drafts:
        first = drafts[0]
        given = as_utc(first.consent.given_at)
        title = (
            f"Approve {first.consent.guest.display_name}'s thank-you"
            if len(drafts) == 1
            else f"Approve {_plural(len(drafts), 'win-back message')}"
        )
        items.append(
            Item("approvals", title, "Consent given at the Desk", "/approvals", "check", given)
        )
    review, uploaded = _pending_review(session, prop.id)
    if review:
        items.append(
            Item(
                "flagged",
                f"Check {_plural(review, 'statement row')}",
                "Kept out of your totals until you review",
                "/upload",
                "upload",
                uploaded,
            )  # fmt: skip
        )
    to_confirm = [
        r
        for r in list_matches(session, prop.id)
        if r.match.status == "suggested" and r.match.confidence < AUTO_CONFIRM_PCT
    ]
    if to_confirm:
        least = to_confirm[0]
        items.append(
            Item(
                "repeat",
                f"Confirm {_plural(len(to_confirm), 'repeat-guest match')}",
                f"{least.returned.guest_name} · {least.match.confidence}% sure",
                "/repeat",
                "repeat",
            )
        )
    if ledger is not None and current_answer(session, prop.id) is None:
        try:
            move = saturday_move(ledger, min(DEFAULT_ROOMS, prop.rooms_count))
        except ScenarioError:
            move = None
        if move is not None and move.extra_per_saturday > 0:
            items.append(
                Item(
                    "scenario",
                    "Saturday move",
                    f"Hold {_plural(move.rooms, 'room')} off {move.channel_name}",
                    "/scenario",
                    "half",
                    amount=move.extra_per_saturday,
                )
            )
    proof, latest_consent = _pending_proof(session, prop.id)
    if proof:
        items.append(
            Item(
                "proof",
                f"Write tonight's proof for {_plural(proof, 'consent')}",
                "Pending proof until the nightly bundle",
                "/proof",
                "diamond",
                as_utc(latest_consent) if latest_consent else None,
            )
        )
    return items, len(drafts)


def notifications(session: Session, prop: Property, needs: list[Item]) -> list[Item]:
    """Recent events from stored rows, newest first. Read state stays on the
    owner's device, so ids are stable for the same underlying rows."""
    events: list[Item] = [
        Item(
            f"draft-{m.id}",
            f"Win-back draft for {m.consent.guest.short_name} is ready",
            "Approve it before anything is sent",
            "/approvals",
            "check",
            as_utc(m.created_at),
        )
        for m in _drafts(session, prop.id)[:5]
    ]
    for item in needs:
        if item.key in {"flagged", "proof"}:
            events.append(
                Item(
                    f"{item.key}-{item.title}",
                    item.title,
                    item.detail,
                    item.href,
                    item.icon,
                    as_utc(item.at) if item.at else None,
                )
            )
    coded = session.execute(
        select(DirectBooking, PerkCode.code)
        .join(PerkCode, PerkCode.id == DirectBooking.perk_code_id)
        .join(Saving, Saving.direct_booking_id == DirectBooking.id)
        .where(DirectBooking.property_id == prop.id)
        .order_by(DirectBooking.created_at.desc(), DirectBooking.id.desc())
        .limit(3)
    ).all()
    events.extend(
        Item(
            f"saving-{d.id}",
            f"{d.booking.guest_name} booked direct with {code}",
            "Saving counted in Savings",
            "/savings",
            "rupee",
            as_utc(d.created_at),
        )
        for d, code in coded
    )
    floor = datetime.min.replace(tzinfo=utc_now().tzinfo)
    return sorted(events, key=lambda e: e.at or floor, reverse=True)


@dataclass(frozen=True, slots=True)
class Overview:
    """Everything the Overview screen and the app shell read."""

    business_date: date
    owner: Owner
    prop: Property
    start: date
    end: date
    days: int
    has_statements: bool
    kpis: Kpis | None
    insight_en: str | None
    insight_hi: str | None
    waterfall: list[WaterfallStep]
    mix: list[MixSlice]
    last_night: LastNight
    savings: Savings
    needs_you: list[Item]
    pending_approvals: int
    steps: dict[str, bool]
    notifications: list[Item]


def build_overview(session: Session, prop: Property) -> Overview:
    """Compose the Overview from the existing services."""
    day = business_date(session, prop.id, utc_now().date())
    ledger = load_ledger(session, prop.id)
    has_rows = ledger.room_nights > 0
    insight = build_insight(ledger) if has_rows else None
    counted = ledger if has_rows else None
    needs, pending = needs_you(session, prop, counted)
    steps = compute_steps(session, prop.id)
    return Overview(
        business_date=day,
        owner=owner_for(prop),
        prop=prop,
        start=ledger.start,
        end=ledger.end,
        days=ledger.days,
        has_statements=has_rows,
        kpis=kpis_for(ledger) if has_rows else None,
        insight_en=insight.en if insight else None,
        insight_hi=insight.hi if insight else None,
        waterfall=waterfall_for(ledger) if has_rows else [],
        mix=mix_for(ledger) if has_rows else [],
        last_night=last_night_for(session, prop, day),
        savings=savings_for(session, prop.id),
        needs_you=needs,
        pending_approvals=pending,
        steps={k: steps[k] for k in STEP_KEYS},
        notifications=notifications(session, prop, needs),
    )
