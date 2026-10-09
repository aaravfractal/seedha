"""The ledger: what each channel really leaves the hotel, for a date range.

Business rules (CLAUDE.md section 2, rulings 1 to 3):

* Only rows that passed the checks, or that the owner accepted on review,
  count (rule 3). Flagged rows stay out of the flip.
* Room nights count only for stays; cancellation and adjustment lines still
  carry their money (for example commission charged on a cancelled stay).
* "Paid to channels" = commission + GST on commission + fees.
* "Lost vs list price" = discount + paid to channels.
* "Direct bookings" share = direct room nights / all room nights (D6 metric).
* "Commission-free share" = (direct + walk-in) room nights / all room nights.
* RevPAR = revenue / (rooms x days in the range), list and net.
* The range is explicit and defaults to 1 Apr to 30 Sep 2026, so bookings
  outside it (2025 history, October Desk stays) never move the totals.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, Property
from app.money import (
    ZERO_LINES,
    LineItems,
    per_unit_rounded,
    share_tenths_of_percent,
)

DEFAULT_START = date(2026, 4, 1)
DEFAULT_END = date(2026, 9, 30)
COMMISSION_FREE_KINDS = frozenset({"direct", "walkin"})


class LedgerError(ValueError):
    """Raised for an invalid ledger request, such as an inverted date range."""


@dataclass(frozen=True, slots=True)
class ChannelInfo:
    """Identity of a channel as the ledger needs it."""

    key: str
    name: str
    kind: str
    sort_order: int


@dataclass(frozen=True, slots=True)
class LedgerRow:
    """One counted booking line reduced to what the ledger aggregates."""

    channel_key: str
    is_stay: bool
    nights: int
    lines: LineItems


@dataclass(frozen=True, slots=True)
class ChannelSummary:
    """Money and volume for one channel in the range."""

    channel: ChannelInfo
    room_nights: int
    stays: int
    lines: LineItems
    list_adr: int | None
    net_adr: int | None
    kept_share_tenths: int | None


@dataclass(frozen=True, slots=True)
class LedgerSummary:
    """Every figure on the flip screen for one date range."""

    start: date
    end: date
    rooms_count: int
    days: int
    channels: tuple[ChannelSummary, ...]
    totals: LineItems
    room_nights: int
    paid_to_channels_share_tenths: int | None
    direct_bookings_tenths: int | None
    commission_free_share_tenths: int | None
    revpar_list: int
    revpar_net: int
    rank_by_bookings: tuple[str, ...]
    rank_by_money_kept: tuple[str, ...]


def days_in_range(start: date, end: date) -> int:
    """Inclusive number of days from start to end."""
    if end < start:
        raise LedgerError("end date is before start date")
    return (end - start).days + 1


def _summarise_channel(info: ChannelInfo, rows: Sequence[LedgerRow]) -> ChannelSummary:
    lines = ZERO_LINES
    room_nights = 0
    stays = 0
    for row in rows:
        lines = lines + row.lines
        if row.is_stay:
            room_nights += row.nights
            stays += 1
    return ChannelSummary(
        channel=info,
        room_nights=room_nights,
        stays=stays,
        lines=lines,
        list_adr=per_unit_rounded(lines.list_amount, room_nights) if room_nights else None,
        net_adr=per_unit_rounded(lines.net_kept, room_nights) if room_nights else None,
        kept_share_tenths=(
            share_tenths_of_percent(max(lines.net_kept, 0), lines.list_amount)
            if lines.list_amount
            else None
        ),
    )


def _nights(summaries: Iterable[ChannelSummary], kinds: frozenset[str] | set[str] | None) -> int:
    """Room nights across channels, optionally only of the given kinds."""
    return sum(s.room_nights for s in summaries if kinds is None or s.channel.kind in kinds)


def _share(part: int, whole: int) -> int | None:
    return share_tenths_of_percent(part, whole) if whole else None


def _rank(channels: Iterable[ChannelSummary], by_money_kept: bool) -> tuple[str, ...]:
    """Rank channels. Ties fall back to the channel's fixed sort order."""

    def key(summary: ChannelSummary) -> tuple[bool, int, int]:
        value = summary.net_adr if by_money_kept else summary.room_nights
        return (value is None, -(value or 0), summary.channel.sort_order)

    return tuple(summary.channel.key for summary in sorted(channels, key=key))


def summarise(
    channels: Sequence[ChannelInfo],
    rows: Iterable[LedgerRow],
    rooms_count: int,
    start: date = DEFAULT_START,
    end: date = DEFAULT_END,
) -> LedgerSummary:
    """Aggregate counted rows into the full flip-screen summary."""
    if rooms_count <= 0:
        raise LedgerError("rooms_count must be positive")
    days = days_in_range(start, end)
    by_channel: dict[str, list[LedgerRow]] = {info.key: [] for info in channels}
    for row in rows:
        if row.channel_key not in by_channel:
            raise LedgerError(f"unknown channel {row.channel_key}")
        by_channel[row.channel_key].append(row)
    ordered = sorted(channels, key=lambda info: info.sort_order)
    summaries = tuple(_summarise_channel(info, by_channel[info.key]) for info in ordered)

    totals = ZERO_LINES
    for summary in summaries:
        totals = totals + summary.lines
    room_nights = _nights(summaries, None)
    room_days = rooms_count * days
    return LedgerSummary(
        start=start,
        end=end,
        rooms_count=rooms_count,
        days=days,
        channels=summaries,
        totals=totals,
        room_nights=room_nights,
        paid_to_channels_share_tenths=_share(totals.paid_to_channels, totals.list_amount),
        direct_bookings_tenths=_share(_nights(summaries, {"direct"}), room_nights),
        commission_free_share_tenths=_share(_nights(summaries, COMMISSION_FREE_KINDS), room_nights),
        revpar_list=per_unit_rounded(totals.list_amount, room_days),
        revpar_net=per_unit_rounded(totals.net_kept, room_days),
        rank_by_bookings=_rank(summaries, by_money_kept=False),
        rank_by_money_kept=_rank(summaries, by_money_kept=True),
    )


def booking_lines(booking: Booking) -> LineItems:
    """The stored, already-rounded line items of a booking."""
    return LineItems(
        list_amount=booking.list_amount,
        discount=booking.discount,
        commission=booking.commission,
        gst_on_commission=booking.gst_on_commission,
        fees=booking.fees,
    )


def load_ledger(
    session: Session,
    property_id: int,
    start: date = DEFAULT_START,
    end: date = DEFAULT_END,
) -> LedgerSummary:
    """Read counted bookings for a property and range, then summarise them."""
    days_in_range(start, end)
    prop = session.get(Property, property_id)
    if prop is None:
        raise LedgerError(f"property {property_id} not found")
    channel_rows = session.scalars(select(Channel).where(Channel.property_id == property_id)).all()
    infos = [ChannelInfo(c.key, c.name, c.kind, c.sort_order) for c in channel_rows]
    key_by_id = {c.id: c.key for c in channel_rows}
    bookings = session.scalars(
        select(Booking).where(
            Booking.property_id == property_id,
            Booking.check_in >= start,
            Booking.check_in <= end,
            or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
        )
    ).all()
    rows = [
        LedgerRow(
            channel_key=key_by_id[b.channel_id],
            is_stay=b.status == "stay",
            nights=b.nights,
            lines=booking_lines(b),
        )
        for b in bookings
    ]
    return summarise(infos, rows, prop.rooms_count, start, end)
