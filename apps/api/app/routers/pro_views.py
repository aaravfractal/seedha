"""Seedha Pro mini views (owner session). Every amount is integer paise,
computed by services/pro_views.py; the browser only formats it.

Labels: "Illustration" on computed what-ifs (floor, displacement), and
sample: true wherever a figure is a fixed sample (rule 11).
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.money import LineItems
from app.routers.desk import today
from app.services.pro_views import (
    ILLUSTRATION,
    MAX_RATE,
    SAMPLE,
    SAMPLE_FLOOR_TARGET,
    SAMPLE_RATE,
    SECOND_PROPERTY,
    PropertyTotals,
    ProViewError,
    combine,
    discount_split,
    displacement,
    first_property,
    floor_rows,
    khata,
    recent_nights,
)

router = APIRouter(prefix="/pro", tags=["pro"])

Paise = Annotated[int, Query(ge=100, le=MAX_RATE)]


def bad_input(exc: ProViewError) -> ApiError:
    """A 422 the card can show next to its inputs."""
    return ApiError(422, "invalid_input", str(exc))


class LinesOut(BaseModel):
    """Summed money lines, in paise."""

    list_amount: int
    discount: int
    commission: int
    gst_on_commission: int
    fees: int
    net_kept: int


def lines_out(lines: LineItems) -> LinesOut:
    """LineItems as API data (net from the money module, never recomputed)."""
    return LinesOut(
        list_amount=lines.list_amount,
        discount=lines.discount,
        commission=lines.commission,
        gst_on_commission=lines.gst_on_commission,
        fees=lines.fees,
        net_kept=lines.net_kept,
    )


# Who paid the discount ---------------------------------------------------------


class DiscountRowOut(BaseModel):
    """One OTA's promotions. hotel_funded is stored data; ota_funded is sample."""

    channel_key: str
    channel_name: str
    promotion: str
    list_amount: int
    hotel_funded: int
    ota_funded: int
    hotel_share_tenths: int | None
    ota_funded_sample: Literal[True]


class DiscountSplitOut(BaseModel):
    """Per OTA, who funded the promotion discount (paise)."""

    rows: list[DiscountRowOut]
    total_hotel_funded: int
    total_ota_funded: int
    sample: Literal[True]
    label: Literal["Sample"]


@router.get("/discount-split", response_model=DiscountSplitOut)
def get_discount_split(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> DiscountSplitOut:
    """Hotel-funded from the ledger; the OTA-funded part is a sample figure."""
    rows = discount_split(session, prop.id)
    return DiscountSplitOut(
        rows=[
            DiscountRowOut(
                channel_key=r.channel_key,
                channel_name=r.channel_name,
                promotion=r.promotion,
                list_amount=r.list_amount,
                hotel_funded=r.hotel_funded,
                ota_funded=r.ota_funded,
                hotel_share_tenths=r.hotel_share_tenths,
                ota_funded_sample=True,
            )
            for r in rows
        ],
        total_hotel_funded=sum(r.hotel_funded for r in rows),
        total_ota_funded=sum(r.ota_funded for r in rows),
        sample=True,
        label=SAMPLE,
    )


# Floor by channel ----------------------------------------------------------------


class FloorRowOut(BaseModel):
    """One channel: its floor rate and what one room night at `rate` keeps."""

    channel_key: str
    channel_name: str
    commission_bps: int
    gst_applies: bool
    floor_rate: int
    at_rate: LinesOut
    worth_taking: bool


class FloorOut(BaseModel):
    """Floor rates per channel for a target net per room night (paise)."""

    target: int
    target_is_sample: bool
    rate: int
    rows: list[FloorRowOut]
    label: Literal["Illustration"]


@router.get("/floor", response_model=FloorOut)
def get_floor(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    rate: Paise = SAMPLE_RATE,
    target: Annotated[int | None, Query(ge=100, le=MAX_RATE)] = None,
    channel: Annotated[str | None, Query(min_length=1, max_length=20)] = None,
) -> FloorOut:
    """The lowest rate worth taking per channel, and what `rate` keeps."""
    goal = SAMPLE_FLOOR_TARGET if target is None else target
    try:
        rows = floor_rows(session, prop.id, goal, rate, channel)
    except ProViewError as exc:
        raise bad_input(exc) from exc
    except LookupError as exc:
        raise ApiError(404, "unknown_channel", "No channel with that key") from exc
    return FloorOut(
        target=goal,
        target_is_sample=target is None,
        rate=rate,
        rows=[
            FloorRowOut(
                channel_key=r.terms.key,
                channel_name=r.terms.name,
                commission_bps=r.terms.commission_bps,
                gst_applies=r.terms.gst_applies,
                floor_rate=r.floor_rate,
                at_rate=lines_out(r.at_rate),
                worth_taking=r.worth_taking,
            )
            for r in rows
        ],
        label=ILLUSTRATION,
    )


# Group displacement --------------------------------------------------------------


class DisplacementOut(BaseModel):
    """A direct group booking against the regular rooms it pushes out (paise)."""

    group_rooms: int
    group_rate: int
    nights: int
    rooms_count: int
    nights_sampled: int
    average_rooms_sold: int
    average_net_per_room_night: int
    free_rooms: int
    rooms_pushed_out: int
    group_net: int
    displaced_net: int
    difference: int
    label: Literal["Illustration"]


@router.get("/displacement", response_model=DisplacementOut)
def get_displacement(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    group_rooms: Annotated[int, Query(ge=1, le=200)],
    group_rate: Paise,
    nights: Annotated[int, Query(ge=1, le=30)],
) -> DisplacementOut:
    """Group net minus the net of the rooms it displaces, from recent nights."""
    recent = recent_nights(session, prop, today(session, prop))
    try:
        d = displacement(recent, prop.rooms_count, group_rooms, group_rate, nights)
    except ProViewError as exc:
        raise bad_input(exc) from exc
    return DisplacementOut(
        group_rooms=group_rooms,
        group_rate=group_rate,
        nights=nights,
        rooms_count=d.rooms_count,
        nights_sampled=d.nights_sampled,
        average_rooms_sold=d.average_rooms_sold,
        average_net_per_room_night=d.average_net_per_room_night,
        free_rooms=d.free_rooms,
        rooms_pushed_out=d.rooms_pushed_out,
        group_net=d.group_net,
        displaced_net=d.displaced_net,
        difference=d.difference,
        label=ILLUSTRATION,
    )


# Agent khata -------------------------------------------------------------------


class AgentRowOut(BaseModel):
    """One sample agent: stays, room nights and money lines (paise)."""

    agent: str
    bookings: int
    room_nights: int
    lines: LinesOut


class KhataOut(BaseModel):
    """Travel-agent rows grouped under sample agent names."""

    rows: list[AgentRowOut]
    totals: AgentRowOut
    sample: Literal[True]
    label: Literal["Sample"]


@router.get("/khata", response_model=KhataOut)
def get_khata(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> KhataOut:
    """Agent ledger: real travel-agent rows, sample agent names."""
    rows = [
        AgentRowOut(agent=r.agent, bookings=r.bookings, room_nights=r.room_nights,
                    lines=lines_out(r.lines))
        for r in khata(session, prop.id)
    ]  # fmt: skip
    total_lines = LineItems(
        list_amount=sum(r.lines.list_amount for r in rows),
        discount=sum(r.lines.discount for r in rows),
        commission=sum(r.lines.commission for r in rows),
        gst_on_commission=sum(r.lines.gst_on_commission for r in rows),
        fees=sum(r.lines.fees for r in rows),
    )
    totals = AgentRowOut(
        agent="All agents",
        bookings=sum(r.bookings for r in rows),
        room_nights=sum(r.room_nights for r in rows),
        lines=lines_out(total_lines),
    )
    return KhataOut(rows=rows, totals=totals, sample=True, label=SAMPLE)


# Two-property rollup -----------------------------------------------------------


class PropertyOut(BaseModel):
    """One property's six-month totals (paise)."""

    key: str
    name: str
    city: str
    rooms_count: int
    sample: bool
    room_nights: int
    lines: LinesOut
    paid_to_channels: int
    net_adr: int | None
    direct_bookings_tenths: int | None


class RollupOut(BaseModel):
    """Both properties, their sum, and the one the toggle selects."""

    selected: Literal["a", "b", "all"]
    view: PropertyOut
    properties: list[PropertyOut]
    combined: PropertyOut
    sample: Literal[True]
    label: Literal["Sample"]


def property_out(p: PropertyTotals) -> PropertyOut:
    """A property's totals as API data."""
    return PropertyOut(
        key=p.key,
        name=p.name,
        city=p.city,
        rooms_count=p.rooms_count,
        sample=p.is_sample,
        room_nights=p.room_nights,
        lines=lines_out(p.lines),
        paid_to_channels=p.lines.paid_to_channels,
        net_adr=p.net_adr,
        direct_bookings_tenths=p.direct_bookings_tenths,
    )


@router.get("/rollup", response_model=RollupOut)
def get_rollup(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    property: Annotated[  # pylint: disable=redefined-builtin
        Literal["a", "b", "all"], Query()
    ] = "all",
) -> RollupOut:
    """This hotel's ledger beside a fictional second property (sample)."""
    parts = [first_property(session, prop), SECOND_PROPERTY]
    combined = combine(parts)
    by_key = {p.key: p for p in [*parts, combined]}
    return RollupOut(
        selected=property,
        view=property_out(by_key[property]),
        properties=[property_out(p) for p in parts],
        combined=property_out(combined),
        sample=True,
        label=SAMPLE,
    )
