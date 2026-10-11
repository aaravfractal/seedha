"""Seedha Pro mini views: discount split, floor by channel, group
displacement, agent khata and the two-property rollup.

Every rupee here is computed by code from stored rows or fixed sample
numbers (rule 1). Money is integer paise; line items reuse app.money so each
is rounded half-up to the rupee (ruling 1). Where the data does not exist
(the OTA-funded part of a promotion, agent names, a second property) the
figures are fixed sample numbers and the result says so (rule 11).

Formulas
* Discount split: hotel-funded = the stored discount per OTA channel in the
  ledger range (counted rows only). OTA-funded = a fixed sample share of the
  channel's list revenue, flagged sample.
* Floor: kept(rate) = rate - commission - 18% GST on commission - fees, with
  the channel's contract (app.money.line_items_for_booking, no discount).
  The floor is the lowest whole-rupee rate whose kept amount reaches the
  owner's target net per room night. Default target: a fixed sample Rs 2,500.
* Displacement: rooms pushed out per night = group rooms minus the rooms
  that were free on an average night (last 7 desk nights). Displaced net =
  rooms pushed out x nights x the average net per room night of the stays
  on those nights. The group books direct: net = rooms x nights x rate.
* Khata: travel-agent rows in the ledger range, grouped under fictional
  agent names (sample) by a fixed rule on the statement reference.
* Rollup: the sample hotel's ledger totals plus a fictional second property
  built from fixed sample line items.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from fractions import Fraction
from typing import Final

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, ChannelContract, Property
from app.money import (
    PAISE_PER_RUPEE,
    ZERO_LINES,
    LineItems,
    MoneyError,
    bps_of,
    gst_on_commission,
    line_items_for_booking,
    per_unit_rounded,
    rupees,
    share_tenths_of_percent,
)
from app.services.desk import in_house
from app.services.ledger import DEFAULT_END, DEFAULT_START, booking_lines, load_ledger
from app.services.rooms import board_nights

ILLUSTRATION: Final = "Illustration"
SAMPLE: Final = "Sample"

# Sample share of each OTA's list revenue that the OTA itself funded as a
# promotion discount. Statements do not carry this split (rule 11: sample).
SAMPLE_OTA_FUNDED_BPS: Final[dict[str, int]] = {"mmt": 400, "bcom": 300, "agoda": 500}
SAMPLE_PROMOTION: Final[dict[str, str]] = {
    "mmt": "Holiday sale",
    "bcom": "Member deal",
    "agoda": "Flash sale",
}
DEFAULT_PROMOTION: Final = "Promotions"

SAMPLE_FLOOR_TARGET: Final = rupees(2500)
SAMPLE_RATE: Final = rupees(4000)
MAX_RATE: Final = rupees(100_000)

SAMPLE_AGENTS: Final = (
    # Invented names so no real agency is shown next to a commission figure.
    "Brindhar Trips",
    "Kelvaro Tours",
    "Oskenta Holidays",
    "Tazimor Travels",
)


class ProViewError(ValueError):
    """An input the mini views cannot use (shown to the owner as 422 or 404)."""


# --------------------------------------------------------------------------
# Who paid the discount
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class DiscountSplit:
    """One OTA's promotions: who funded the discount, in paise."""

    channel_key: str
    channel_name: str
    promotion: str
    list_amount: int
    hotel_funded: int
    ota_funded: int
    hotel_share_tenths: int | None


def discount_split(session: Session, property_id: int) -> list[DiscountSplit]:
    """Per OTA: stored hotel-funded discount and the sample OTA-funded part."""
    ledger = load_ledger(session, property_id)
    out: list[DiscountSplit] = []
    for summary in ledger.channels:
        info = summary.channel
        if info.kind != "ota":
            continue
        hotel = summary.lines.discount
        ota = bps_of(summary.lines.list_amount, SAMPLE_OTA_FUNDED_BPS.get(info.key, 0))
        out.append(
            DiscountSplit(
                channel_key=info.key,
                channel_name=info.name,
                promotion=SAMPLE_PROMOTION.get(info.key, DEFAULT_PROMOTION),
                list_amount=summary.lines.list_amount,
                hotel_funded=hotel,
                ota_funded=ota,
                hotel_share_tenths=(
                    share_tenths_of_percent(hotel, hotel + ota) if hotel + ota else None
                ),
            )
        )
    return out


# --------------------------------------------------------------------------
# Floor by channel
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Terms:
    """A channel and its latest contract terms."""

    key: str
    name: str
    kind: str
    commission_bps: int
    gst_applies: bool
    upi_fee_applies: bool


def channel_terms(session: Session, property_id: int) -> list[Terms]:
    """Every channel with its latest contract (no contract: commission-free)."""
    channels = session.scalars(
        select(Channel).where(Channel.property_id == property_id).order_by(Channel.sort_order)
    ).all()
    out: list[Terms] = []
    for c in channels:
        contract = session.scalar(
            select(ChannelContract)
            .where(ChannelContract.channel_id == c.id)
            .order_by(ChannelContract.valid_from.desc())
        )
        if contract is None:
            out.append(Terms(c.key, c.name, c.kind, 0, False, False))
        else:
            out.append(
                Terms(
                    c.key,
                    c.name,
                    c.kind,
                    contract.commission_bps,
                    contract.gst_applies,
                    contract.upi_fee_applies,
                )
            )
    return out


def lines_at(rate: int, terms: Terms) -> LineItems:
    """One room night sold at `rate` paise on this channel, no discount."""
    return line_items_for_booking(
        list_amount=rate,
        discount=0,
        commission_bps=terms.commission_bps,
        gst_applies=terms.gst_applies,
        upi_payment=terms.upi_fee_applies,
    )


def _require_rupees(name: str, value: int) -> None:
    if value <= 0 or value % PAISE_PER_RUPEE:
        raise ProViewError(f"Enter the {name} in whole rupees.")


ROUNDING_SLACK: Final = 2 * PAISE_PER_RUPEE
GST_SHARE: Final = Fraction(118, 100)


def _scan_start(target: int, terms: Terms) -> int:
    """A whole-rupee rate strictly below any rate that keeps `target`."""
    share = Fraction(terms.commission_bps, 10_000)
    if terms.gst_applies:
        share *= GST_SHARE
    if share >= 1:
        raise ProViewError(f"{terms.name} leaves nothing at any rate.")
    bound = Fraction(max(target - ROUNDING_SLACK, 0)) / (1 - share)
    start = int(bound // PAISE_PER_RUPEE) * PAISE_PER_RUPEE - PAISE_PER_RUPEE
    return max(start, PAISE_PER_RUPEE)


def floor_rate(target: int, terms: Terms) -> int:
    """The lowest whole-rupee rate whose kept amount reaches `target` paise.

    Deductions never fall as the rate rises, so kept grows by at most Rs 1 per
    Rs 1 of rate. Rounding lets kept exceed rate x (1 - commission share) by
    under Rs 2, so no rate below `_scan_start` can reach the target; scanning
    up from there finds the first rate that does, and with a whole-rupee
    target, kept at the floor equals the target exactly.
    """
    _require_rupees("minimum kept", target)
    rate = _scan_start(target, terms)
    while lines_at(rate, terms).net_kept < target:
        rate += PAISE_PER_RUPEE
        if rate > MAX_RATE:
            raise ProViewError("No rate up to Rs 1,00,000 keeps that much.")
    return rate


@dataclass(frozen=True, slots=True)
class FloorRow:
    """One channel's floor and what it keeps at the chosen rate (paise)."""

    terms: Terms
    floor_rate: int
    at_rate: LineItems

    @property
    def worth_taking(self) -> bool:
        """True when the chosen rate keeps at least the target."""
        return self.at_rate.list_amount >= self.floor_rate


def floor_rows(
    session: Session, property_id: int, target: int, rate: int, channel: str | None
) -> list[FloorRow]:
    """Floor and kept-at-rate for every channel, or the one named."""
    _require_rupees("room rate", rate)
    if rate > MAX_RATE or target > MAX_RATE:
        raise ProViewError("Enter amounts up to Rs 1,00,000.")
    terms = channel_terms(session, property_id)
    if channel is not None:
        terms = [t for t in terms if t.key == channel]
        if not terms:
            raise LookupError(channel)
    return [FloorRow(t, floor_rate(target, t), lines_at(rate, t)) for t in terms]


# --------------------------------------------------------------------------
# Group displacement
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Displacement:
    """A group against the rooms it pushes out, in paise."""

    rooms_count: int
    nights_sampled: int
    average_rooms_sold: int
    average_net_per_room_night: int
    free_rooms: int
    rooms_pushed_out: int
    group_net: int
    displaced_net: int

    @property
    def difference(self) -> int:
        """Net from the group minus the net it pushes out."""
        return self.group_net - self.displaced_net


@dataclass(frozen=True, slots=True)
class RecentNights:
    """Average occupancy and net per room night over the board's nights."""

    nights: int
    average_rooms_sold: int
    average_net_per_room_night: int


def recent_nights(session: Session, prop: Property, business_day: date) -> RecentNights:
    """From the desk register's last 7 nights (the room board's nights).

    Average rooms sold is rounded half-up to a whole room. Net per room night
    is each in-house booking's stored net over its own nights, booking once.
    """
    days = board_nights(business_day)
    sold = 0
    seen: dict[int, Booking] = {}
    for day in days:
        stays = in_house(session, prop.id, day)
        sold += len(stays)
        for stay in stays:
            seen[stay.booking.id] = stay.booking
    net = sum(booking_lines(b).net_kept for b in seen.values())
    room_nights = sum(b.nights for b in seen.values())
    average_sold = int((Fraction(sold, len(days)) + Fraction(1, 2)) // 1)
    per_night = per_unit_rounded(net, room_nights) if room_nights else 0
    return RecentNights(len(days), average_sold, per_night)


def displacement(
    recent: RecentNights, rooms_count: int, group_rooms: int, group_rate: int, nights: int
) -> Displacement:
    """Group net minus the net of the regular rooms it pushes out."""
    _require_rupees("group rate", group_rate)
    if not 1 <= group_rooms <= rooms_count:
        raise ProViewError(f"Enter 1 to {rooms_count} group rooms.")
    if nights < 1:
        raise ProViewError("Enter at least 1 night.")
    free = max(rooms_count - recent.average_rooms_sold, 0)
    pushed = max(group_rooms - free, 0)
    return Displacement(
        rooms_count=rooms_count,
        nights_sampled=recent.nights,
        average_rooms_sold=recent.average_rooms_sold,
        average_net_per_room_night=recent.average_net_per_room_night,
        free_rooms=free,
        rooms_pushed_out=pushed,
        group_net=group_rooms * nights * group_rate,
        displaced_net=pushed * nights * recent.average_net_per_room_night,
    )


# --------------------------------------------------------------------------
# Agent khata
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class AgentRow:
    """One sample agent's line in the khata (paise)."""

    agent: str
    bookings: int
    room_nights: int
    lines: LineItems


def agent_for(external_ref: str) -> str:
    """A fixed fictional agent for a statement reference (sample grouping)."""
    digits = "".join(ch for ch in external_ref if ch.isdigit())
    return SAMPLE_AGENTS[int(digits or "0") % len(SAMPLE_AGENTS)]


def counted_agent_bookings(
    session: Session, property_id: int, start: date = DEFAULT_START, end: date = DEFAULT_END
) -> Sequence[Booking]:
    """Travel-agent rows the ledger counts (same filter as load_ledger)."""
    return session.scalars(
        select(Booking)
        .join(Channel, Channel.id == Booking.channel_id)
        .where(
            Booking.property_id == property_id,
            Channel.kind == "agent",
            Booking.check_in >= start,
            Booking.check_in <= end,
            or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
        )
        .order_by(Booking.id)
    ).all()


def khata(session: Session, property_id: int) -> list[AgentRow]:
    """Per sample agent: stays, room nights and summed stored lines."""
    rows = {name: AgentRow(name, 0, 0, ZERO_LINES) for name in SAMPLE_AGENTS}
    for b in counted_agent_bookings(session, property_id):
        row = rows[agent_for(b.external_ref)]
        is_stay = b.status == "stay"
        rows[row.agent] = AgentRow(
            agent=row.agent,
            bookings=row.bookings + int(is_stay),
            room_nights=row.room_nights + (b.nights if is_stay else 0),
            lines=row.lines + booking_lines(b),
        )
    return [rows[name] for name in SAMPLE_AGENTS]


# --------------------------------------------------------------------------
# Two-property rollup
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PropertyTotals:
    """One property's six-month totals (paise)."""

    key: str
    name: str
    city: str
    rooms_count: int
    is_sample: bool
    room_nights: int
    direct_room_nights: int
    lines: LineItems

    @property
    def net_adr(self) -> int | None:
        """Net kept per room night, rounded to the rupee."""
        return per_unit_rounded(self.lines.net_kept, self.room_nights) if self.room_nights else None

    @property
    def direct_bookings_tenths(self) -> int | None:
        """Direct room nights share (ruling 3, direct only)."""
        if not self.room_nights:
            return None
        return share_tenths_of_percent(self.direct_room_nights, self.room_nights)


def _second_property_lines() -> LineItems:
    commission = rupees(3_40_800)
    return LineItems(
        list_amount=rupees(28_40_000),
        discount=rupees(2_13_000),
        commission=commission,
        gst_on_commission=gst_on_commission(commission),
        fees=rupees(1_900),
    )


SECOND_PROPERTY: Final = PropertyTotals(
    key="b",
    name="Vellorin Cottages",  # invented name, sample data
    city="Nainital",
    rooms_count=14,
    is_sample=True,
    room_nights=820,
    direct_room_nights=120,
    lines=_second_property_lines(),
)


def first_property(session: Session, prop: Property) -> PropertyTotals:
    """The hotel's own ledger totals for the default range."""
    ledger = load_ledger(session, prop.id)
    direct = sum(s.room_nights for s in ledger.channels if s.channel.kind == "direct")
    return PropertyTotals(
        key="a",
        name=prop.short_name,
        city=prop.city,
        rooms_count=prop.rooms_count,
        is_sample=prop.is_sample,
        room_nights=ledger.room_nights,
        direct_room_nights=direct,
        lines=ledger.totals,
    )


def combine(parts: Sequence[PropertyTotals]) -> PropertyTotals:
    """Both properties summed; the result is sample if any part is."""
    if not parts:
        raise MoneyError("nothing to combine")
    lines = ZERO_LINES
    for part in parts:
        lines = lines + part.lines
    return PropertyTotals(
        key="all",
        name="Both properties",
        city=", ".join(p.city for p in parts),
        rooms_count=sum(p.rooms_count for p in parts),
        is_sample=any(p.is_sample for p in parts),
        room_nights=sum(p.room_nights for p in parts),
        direct_room_nights=sum(p.direct_room_nights for p in parts),
        lines=lines,
    )
