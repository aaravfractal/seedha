"""GET /my-place: what each room keeps in a month (an illustration).

Owner only. Computed from the ledger (channel mix, occupancy, net ADR by
channel), the property's rooms and the owner's cost inputs. Inputs come as
whole-rupee query parameters; without them the owner's onboarding "cost per
occupied room" is used, then labelled sample defaults (D10). Nothing is saved.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal, TypeVar

from fastapi import APIRouter, Header, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.models import OwnerAccount, Room
from app.money import rupees
from app.routers.auth import MAX_COST_RUPEES
from app.services.ledger import load_ledger
from app.services.myplace import (
    NIGHTS_BASIS,
    MyPlaceError,
    Place,
    RoomSpec,
    build_place,
    find_month,
    mix_from_ledger,
    month_options,
    resolve_costs,
    synthetic_rooms,
)

router = APIRouter(prefix="/my-place", tags=["my-place"])

MAX_FIXED_RUPEES = 1_00_00_000
LABEL = "Illustration from your statements mix"
SAMPLE_COST_NOTE = "Sample cost. Enter your own to see your numbers."

Source = Literal["owner", "onboarding", "sample"]
OutT = TypeVar("OutT", bound=BaseModel)


class MonthOut(BaseModel):
    key: str
    label: str
    start: date
    end: date
    days: int


class InputsOut(BaseModel):
    """Cost inputs in paise and where each came from."""

    cost_per_night: int
    cost_per_night_source: Source
    fixed_monthly: int
    fixed_monthly_source: Source
    max_cost_per_night: int
    max_fixed_monthly: int


class KpisOut(BaseModel):
    net_kept: int
    profit: int
    rooms_in_profit: int
    rooms_count: int
    break_even_rooms: int | None


class SummaryOut(BaseModel):
    """The month in one card. Money in paise."""

    occupancy_tenths: int
    nights_basis: int
    nights_per_room: int
    room_nights: int
    net_kept: int
    variable_costs: int
    fixed_costs: int
    profit: int


class ChannelOut(BaseModel):
    key: str
    name: str
    rooms: int
    net_adr: int
    nights_share_tenths: int


class RoomOut(BaseModel):
    number: int
    floor: int
    room_type: str
    channel_key: str
    channel_name: str
    nights: int
    net: int
    variable_cost: int
    fixed_share: int
    profit: int


class FloorOut(BaseModel):
    floor: int
    rooms: int
    rooms_in_profit: int
    profit: int


class MyPlaceOut(BaseModel):
    """Everything the My Place screen shows. `available` is false before
    any statement has been read."""

    available: bool
    reason: str | None
    label: str
    is_sample: bool
    sample_note: str | None
    month: MonthOut
    months: list[MonthOut]
    inputs: InputsOut
    kpis: KpisOut | None
    summary: SummaryOut | None
    channels: list[ChannelOut]
    rooms: list[RoomOut]
    floors: list[FloorOut]


def _month_out(key: str, label: str, start: date, end: date) -> MonthOut:
    return MonthOut(key=key, label=label, start=start, end=end, days=(end - start).days + 1)


def _onboarding_cost(session: SessionDep, subject: str | None) -> int | None:
    """The signed-in owner's own cost per occupied room, if they gave one."""
    subject = (subject or "").strip()
    if not subject.startswith("a") or not subject[1:].isdigit():
        return None
    account = session.get(OwnerAccount, int(subject[1:]))
    if account is None or account.verified_at is None:
        return None
    return account.cost_per_room


@router.get("", response_model=MyPlaceOut)
def get_my_place(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    month: Annotated[str | None, Query(pattern=r"^(season|\d{4}-\d{2})$")] = None,
    cost_per_night: Annotated[int | None, Query(ge=0, le=MAX_COST_RUPEES)] = None,
    fixed_monthly: Annotated[int | None, Query(ge=0, le=MAX_FIXED_RUPEES)] = None,
    x_seedha_subject: Annotated[str | None, Header()] = None,
) -> MyPlaceOut:
    try:
        option = find_month(month)
    except MyPlaceError as exc:
        raise ApiError(422, "bad_month", str(exc)) from exc
    costs = resolve_costs(
        cost_per_night, fixed_monthly, _onboarding_cost(session, x_seedha_subject)
    )
    summary = load_ledger(session, prop.id, option.start, option.end)
    room_rows = session.scalars(
        select(Room).where(Room.property_id == prop.id).order_by(Room.number)
    ).all()
    rooms = [RoomSpec(r.number, r.room_type) for r in room_rows] or synthetic_rooms(
        prop.rooms_count
    )
    mix = mix_from_ledger(summary)
    month_out = _month_out(option.key, option.label, option.start, option.end)
    inputs = InputsOut(
        cost_per_night=costs.cost_per_night,
        cost_per_night_source=costs.cost_source,
        fixed_monthly=costs.fixed_monthly,
        fixed_monthly_source=costs.fixed_source,
        max_cost_per_night=rupees(MAX_COST_RUPEES),
        max_fixed_monthly=rupees(MAX_FIXED_RUPEES),
    )
    sample_note = SAMPLE_COST_NOTE if "sample" in (costs.cost_source, costs.fixed_source) else None
    place = build_place(rooms, mix, summary.room_nights, summary.days, costs) if mix else None
    return MyPlaceOut(
        available=place is not None,
        reason=None if place is not None else "No statement rows yet",
        label=LABEL,
        is_sample=prop.is_sample,
        sample_note=sample_note,
        month=month_out,
        months=[_month_out(o.key, o.label, o.start, o.end) for o in month_options()],
        inputs=inputs,
        kpis=None if place is None else _kpis(place),
        summary=None if place is None else _summary(place),
        channels=[] if place is None else [_out(ChannelOut, c) for c in place.channels],
        rooms=[] if place is None else [_out(RoomOut, r) for r in place.rooms],
        floors=[] if place is None else [_out(FloorOut, f) for f in place.floors],
    )


def _out(model: type[OutT], value: object) -> OutT:
    return model.model_validate(value, from_attributes=True)


def _kpis(place: Place) -> KpisOut:
    return KpisOut(
        net_kept=place.net_kept,
        profit=place.profit,
        rooms_in_profit=place.rooms_in_profit,
        rooms_count=len(place.rooms),
        break_even_rooms=place.break_even_rooms,
    )


def _summary(place: Place) -> SummaryOut:
    return SummaryOut(
        occupancy_tenths=place.occupancy_tenths,
        nights_basis=NIGHTS_BASIS,
        nights_per_room=place.nights_per_room,
        room_nights=place.nights_per_room * len(place.rooms),
        net_kept=place.net_kept,
        variable_costs=place.variable_costs,
        fixed_costs=place.fixed_costs,
        profit=place.profit,
    )
