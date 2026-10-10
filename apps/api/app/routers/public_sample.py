"""The public website's figures: the sample hotel's computed summary.

Served without a login, only while the hotel is the fictional sample hotel
(rule 11), rate limited, and with no guest names or contacts: only totals,
channel rows and city counts. Every figure comes from the same services the
owner screens use (rule 1). The only sum here is the growth calculator's
difference of two net ADRs, the same step the Saturday move takes.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.deps import PropertyDep, SessionDep
from app.errors import ApiError
from app.models import Booking, RepeatMatch
from app.ratelimit import rate_limited
from app.routers.ledger import ChannelOut, channel_out
from app.services.ledger import DEFAULT_END, DEFAULT_START, LedgerSummary, load_ledger
from app.services.matcher import GuestKey, StayRef, find_candidates
from app.services.overview import kpis_for
from app.services.repeats import RepeatRow, earlier_bookings, list_matches, return_bookings
from app.services.scenario import ScenarioError, saturday_move

router = APIRouter(prefix="/public", tags=["public"])

SATURDAY_ROOMS = 6
TOP_CITIES = 8


class SampleSaturdayOut(BaseModel):
    """The Saturday move for the sample hotel. Money in paise."""

    rooms: int
    channel_name: str
    channel_net_adr: int
    direct_net_adr: int
    extra_per_saturday: int


class SampleGrowthOut(BaseModel):
    """Extra kept per room night moved from the biggest OTA to direct. Paise."""

    from_channel: str
    from_net_adr: int
    direct_net_adr: int
    per_room_night: int


class SampleCityOut(BaseModel):
    """How many counted stays came from one city. No names, no contacts."""

    city: str
    stays: int


class SampleOut(BaseModel):
    """Everything the public website shows. Money in paise, shares in tenths of a percent."""

    is_sample: bool
    hotel: str
    city: str
    rooms_count: int
    start: date
    end: date
    room_nights: int
    list_revenue: int
    net_kept: int
    paid_to_channels: int
    paid_to_channels_share_tenths: int | None
    commission_free_share_tenths: int | None
    direct_bookings_tenths: int | None
    list_adr: int
    net_adr: int
    revpar_list: int
    revpar_net: int
    channels: list[ChannelOut]
    rank_by_bookings: list[str]
    rank_by_money_kept: list[str]
    repeat_guests: int
    paid_twice: int
    saturday: SampleSaturdayOut | None
    growth: SampleGrowthOut | None
    guest_cities: list[SampleCityOut]


def repeat_rows(session: Session, property_id: int) -> list[RepeatRow]:
    """The owner's stored matches (their decisions count). Before the owner has
    opened Repeat guests, the same matcher runs read-only: nothing is stored
    and no tie-break is asked for, so a public request never writes."""
    stored = session.scalar(
        select(func.count()).select_from(RepeatMatch).where(RepeatMatch.property_id == property_id)
    )
    if stored:
        return list_matches(session, property_id)
    returns = return_bookings(session, property_id, DEFAULT_START, DEFAULT_END)
    earlier = earlier_bookings(session, property_id, DEFAULT_END)
    by_id = {b.id: b for b in [*returns, *earlier]}

    def ref(b: Booking) -> StayRef:
        return StayRef(b.id, b.check_in, GuestKey(b.guest_name, b.guest_city))

    found = find_candidates([ref(b) for b in returns], [ref(b) for b in earlier], None)
    rows: list[RepeatRow] = []
    for c in found:
        ret, early = by_id[c.return_booking_id], by_id[c.earlier_booking_id]
        unsaved = RepeatMatch(return_booking_id=ret.id, earlier_booking_id=early.id)
        rows.append(RepeatRow(unsaved, ret, early, ret.channel.name, early.channel.name))
    return rows


def saturday_for(ledger: LedgerSummary) -> SampleSaturdayOut | None:
    """The default Saturday move, or None while it cannot be computed."""
    try:
        move = saturday_move(ledger, SATURDAY_ROOMS)
    except ScenarioError:
        return None
    return SampleSaturdayOut(
        rooms=move.rooms,
        channel_name=move.channel_name,
        channel_net_adr=move.channel_net_adr,
        direct_net_adr=move.direct_net_adr,
        extra_per_saturday=move.extra_per_saturday,
    )


def growth_for(ledger: LedgerSummary) -> SampleGrowthOut | None:
    """Direct net ADR against the channel that brings the most bookings."""
    by_key = {c.channel.key: c for c in ledger.channels}
    biggest = next(
        (by_key[k] for k in ledger.rank_by_bookings if by_key[k].channel.kind == "ota"), None
    )
    direct = next((c for c in ledger.channels if c.channel.kind == "direct"), None)
    if biggest is None or direct is None or biggest.net_adr is None or direct.net_adr is None:
        return None
    return SampleGrowthOut(
        from_channel=biggest.channel.name,
        from_net_adr=biggest.net_adr,
        direct_net_adr=direct.net_adr,
        per_room_night=direct.net_adr - biggest.net_adr,
    )


def guest_cities(session: Session, property_id: int) -> list[SampleCityOut]:
    """Top guest home cities by counted stays in the ledger range."""
    stays = func.count(Booking.id)
    rows = session.execute(
        select(Booking.guest_city, stays)
        .where(
            Booking.property_id == property_id,
            Booking.status == "stay",
            Booking.guest_city.is_not(None),
            Booking.check_in >= DEFAULT_START,
            Booking.check_in <= DEFAULT_END,
            or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
        )
        .group_by(Booking.guest_city)
        .order_by(stays.desc(), Booking.guest_city)
        .limit(TOP_CITIES)
    ).all()
    return [SampleCityOut(city=city, stays=n) for city, n in rows if city]


@router.get(
    "/sample",
    response_model=SampleOut,
    dependencies=[Depends(rate_limited("public_sample"))],
)
def get_sample(session: SessionDep, prop: PropertyDep) -> SampleOut:
    """The sample hotel's computed summary for the public website."""
    if not prop.is_sample:
        raise ApiError(404, "no_sample", "The public sample is only served for the sample hotel")
    ledger = load_ledger(session, prop.id)
    if ledger.room_nights == 0:
        raise ApiError(409, "no_statements", "The sample statements are not loaded yet")
    kpis = kpis_for(ledger)
    repeats = repeat_rows(session, prop.id)
    return SampleOut(
        is_sample=True,
        hotel=prop.name,
        city=prop.city,
        rooms_count=prop.rooms_count,
        start=ledger.start,
        end=ledger.end,
        room_nights=kpis.room_nights,
        list_revenue=kpis.list_revenue,
        net_kept=kpis.net_kept,
        paid_to_channels=kpis.paid_to_channels,
        paid_to_channels_share_tenths=kpis.paid_to_channels_share_tenths,
        commission_free_share_tenths=kpis.commission_free_share_tenths,
        direct_bookings_tenths=kpis.direct_bookings_tenths,
        list_adr=kpis.list_adr,
        net_adr=kpis.net_adr,
        revpar_list=kpis.revpar_list,
        revpar_net=kpis.revpar_net,
        channels=[channel_out(c) for c in ledger.channels],
        rank_by_bookings=list(ledger.rank_by_bookings),
        rank_by_money_kept=list(ledger.rank_by_money_kept),
        repeat_guests=len(repeats),
        paid_twice=sum(r.paid_twice for r in repeats),
        saturday=saturday_for(ledger),
        growth=growth_for(ledger),
        guest_cities=guest_cities(session, prop.id),
    )
