"""Ledger endpoints: the flip (gross vs net by channel) and monthly figures."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import or_, select

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.models import Booking, Channel
from app.services.insight import build_insight
from app.services.ledger import (
    DEFAULT_END,
    DEFAULT_START,
    ChannelSummary,
    LedgerError,
    LedgerSummary,
    booking_lines,
    load_ledger,
)

router = APIRouter(prefix="/ledger", tags=["ledger"])
MAX_RANGE_DAYS = 366


class ChannelOut(BaseModel):
    """One channel row on the flip. Money in paise."""

    key: str
    name: str
    kind: str
    room_nights: int
    stays: int
    list_revenue: int
    discount: int
    commission: int
    gst_on_commission: int
    fees: int
    net_kept: int
    paid_to_channels: int
    lost_vs_list_price: int
    list_adr: int | None
    net_adr: int | None
    kept_share_tenths: int | None


class TotalsOut(BaseModel):
    """Totals across channels. Money in paise."""

    room_nights: int
    list_revenue: int
    discount: int
    commission: int
    gst_on_commission: int
    fees: int
    net_kept: int
    paid_to_channels: int
    lost_vs_list_price: int


class InsightOut(BaseModel):
    """The one-line insight in English and Hindi."""

    en: str
    hi: str
    channel: str
    rank_by_money_kept: int
    move_en: str


class LedgerOut(BaseModel):
    """Everything on the flip screen for one date range."""

    start: date
    end: date
    days: int
    rooms_count: int
    counted_rows: int
    excluded_rows: int
    channels: list[ChannelOut]
    totals: TotalsOut
    paid_to_channels_share_tenths: int | None
    direct_bookings_tenths: int | None
    commission_free_share_tenths: int | None
    revpar_list: int
    revpar_net: int
    rank_by_bookings: list[str]
    rank_by_money_kept: list[str]
    insight: InsightOut | None


class MonthOut(BaseModel):
    """One month for one channel (by check-in month). Money in paise."""

    month: str
    channel: str
    room_nights: int
    list_revenue: int
    paid_to_channels: int
    net_kept: int


def channel_out(summary: ChannelSummary) -> ChannelOut:
    """Flatten a channel summary into the response shape."""
    lines = summary.lines
    return ChannelOut(
        key=summary.channel.key,
        name=summary.channel.name,
        kind=summary.channel.kind,
        room_nights=summary.room_nights,
        stays=summary.stays,
        list_revenue=lines.list_amount,
        discount=lines.discount,
        commission=lines.commission,
        gst_on_commission=lines.gst_on_commission,
        fees=lines.fees,
        net_kept=lines.net_kept,
        paid_to_channels=lines.paid_to_channels,
        lost_vs_list_price=lines.lost_vs_list_price,
        list_adr=summary.list_adr,
        net_adr=summary.net_adr,
        kept_share_tenths=summary.kept_share_tenths,
    )


def ledger_out(ledger: LedgerSummary, counted: int, excluded: int) -> LedgerOut:
    """Build the flip response from a ledger summary."""
    t = ledger.totals
    insight = build_insight(ledger)
    return LedgerOut(
        start=ledger.start,
        end=ledger.end,
        days=ledger.days,
        rooms_count=ledger.rooms_count,
        counted_rows=counted,
        excluded_rows=excluded,
        channels=[channel_out(c) for c in ledger.channels],
        totals=TotalsOut(
            room_nights=ledger.room_nights,
            list_revenue=t.list_amount,
            discount=t.discount,
            commission=t.commission,
            gst_on_commission=t.gst_on_commission,
            fees=t.fees,
            net_kept=t.net_kept,
            paid_to_channels=t.paid_to_channels,
            lost_vs_list_price=t.lost_vs_list_price,
        ),  # fmt: skip
        paid_to_channels_share_tenths=ledger.paid_to_channels_share_tenths,
        direct_bookings_tenths=ledger.direct_bookings_tenths,
        commission_free_share_tenths=ledger.commission_free_share_tenths,
        revpar_list=ledger.revpar_list,
        revpar_net=ledger.revpar_net,
        rank_by_bookings=list(ledger.rank_by_bookings),
        rank_by_money_kept=list(ledger.rank_by_money_kept),
        insight=(
            InsightOut(
                en=insight.en,
                hi=insight.hi,
                channel=insight.channel,
                rank_by_money_kept=insight.rank_by_money_kept,
                move_en=insight.move_en,
            )
            if insight
            else None
        ),  # fmt: skip
    )


def validated_range(start: date, end: date) -> tuple[date, date]:
    """Reject inverted or overly long ranges with a clear message."""
    if end < start:
        raise ApiError(422, "invalid_range", "End date is before start date")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise ApiError(422, "invalid_range", "Choose a range of one year or less")
    return start, end


StartQuery = Annotated[date, Query(description="First check-in date (inclusive)")]
EndQuery = Annotated[date, Query(description="Last check-in date (inclusive)")]


@router.get("/channels", response_model=LedgerOut)
def get_channels(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    start: StartQuery = DEFAULT_START,
    end: EndQuery = DEFAULT_END,
) -> LedgerOut:
    """Gross vs net by channel for the range (default 1 Apr to 30 Sep 2026)."""
    start, end = validated_range(start, end)
    try:
        ledger = load_ledger(session, prop.id, start, end)
    except LedgerError as exc:
        raise ApiError(422, "invalid_range", str(exc)) from exc
    in_range = select(Booking.math_check_passed, Booking.review_status).where(
        Booking.property_id == prop.id, Booking.check_in >= start, Booking.check_in <= end
    )
    rows = session.execute(in_range).all()
    counted = sum(1 for passed, review in rows if passed or review == "accepted")
    return ledger_out(ledger, counted, len(rows) - counted)


@router.get("/monthly", response_model=list[MonthOut])
def get_monthly(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    start: StartQuery = DEFAULT_START,
    end: EndQuery = DEFAULT_END,
) -> list[MonthOut]:
    """Month-by-month figures per channel, by check-in month (D-006)."""
    start, end = validated_range(start, end)
    result = session.execute(
        select(Booking, Channel.key)
        .join(Channel, Channel.id == Booking.channel_id)
        .where(
            Booking.property_id == prop.id,
            Booking.check_in >= start,
            Booking.check_in <= end,
            or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
        )
    ).all()
    buckets: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    for booking, key in result:
        bucket = buckets[(booking.check_in.strftime("%Y-%m"), key)]
        bucket[0] += booking.nights if booking.status == "stay" else 0
        bucket[1] += booking.list_amount
        bucket[2] += booking_lines(booking).paid_to_channels
        bucket[3] += booking.net_kept
    return [
        MonthOut(
            month=month,
            channel=key,
            room_nights=v[0],
            list_revenue=v[1],
            paid_to_channels=v[2],
            net_kept=v[3],
        )  # fmt: skip
        for (month, key), v in sorted(buckets.items())
    ]
