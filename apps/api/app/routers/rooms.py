"""The Overview room board (owner session): last 7 nights and one room's stay.

Money is integer paise straight from stored booking rows. Guests appear as
initials only; a consent id is sent only while that consent is active.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Path
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.routers.desk import SlipOut, slip_out, today
from app.services.desk import enqueue, property_device
from app.services.rooms import (
    CONSENTED,
    ILLUSTRATION,
    NOT_CONSENTED,
    NightBoard,
    RoomNotFoundError,
    RoomStay,
    nights_board,
    room_slip,
    room_stay,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])

RoomNumber = Annotated[int, Path(ge=1, le=9999)]


class ChannelCountOut(BaseModel):
    """Rooms one channel sold that night (every channel, zero included)."""

    channel_key: str
    channel_name: str
    rooms: int


class TileOut(BaseModel):
    """One room on the board; channel fields are null when unsold."""

    room: int
    channel_key: str | None
    code: str | None
    sold: bool


class NightOut(BaseModel):
    """One night's close. net_kept in paise; direct_bookings_pct is direct
    only (ruling 3), null when nothing sold."""

    night: date
    rooms_sold: int
    rooms_total: int
    net_kept: int
    direct_bookings_pct: int | None
    by_channel: list[ChannelCountOut]
    tiles: list[TileOut]


class NightsOut(BaseModel):
    """The last 7 nights, oldest first; the last is the business date."""

    business_date: date
    is_sample: bool
    nights: list[NightOut]


class IfDirectOut(BaseModel):
    """Ruling 5 illustration, in paise: what the hotel would also have kept."""

    extra_kept: int
    commission_avoided: int
    gst_avoided: int
    upi_fee: int
    commission_rate_bps: int
    label: Literal["Illustration"]


class RoomDetailOut(BaseModel):
    """One room's stay on one night. Money is the stored booking row."""

    night: date
    room: int
    booking_id: int
    channel_key: str
    channel_name: str
    channel_kind: str
    nights: int
    list_amount: int
    discount: int
    commission: int
    gst_on_commission: int
    fees: int
    net_kept: int
    guest_initials: str
    consent_status: Literal["consented_at_desk", "not_consented"]
    consent_id: int | None
    checked_out: bool
    if_direct: IfDirectOut | None


def night_out(board: NightBoard) -> NightOut:
    """A night's board as API data."""
    s = board.summary
    return NightOut(
        night=s.day,
        rooms_sold=s.sold,
        rooms_total=s.rooms_count,
        net_kept=s.net_kept,
        direct_bookings_pct=s.direct_share_pct,
        by_channel=[
            ChannelCountOut(channel_key=c.key, channel_name=c.name, rooms=c.rooms)
            for c in board.by_channel
        ],  # fmt: skip
        tiles=[
            TileOut(
                room=r.number,
                channel_key=r.channel_key,
                code=r.code,
                sold=r.channel_key is not None,
            )
            for r in s.rooms
        ],  # fmt: skip
    )


def detail_out(found: RoomStay) -> RoomDetailOut:
    """A room's stay as API data."""
    b, channel, extra = found.stay.booking, found.stay.channel, found.if_direct
    return RoomDetailOut(
        night=found.night,
        room=found.room,
        booking_id=b.id,
        channel_key=channel.key,
        channel_name=channel.name,
        channel_kind=channel.kind,
        nights=b.nights,
        list_amount=b.list_amount,
        discount=b.discount,
        commission=b.commission,
        gst_on_commission=b.gst_on_commission,
        fees=b.fees,
        net_kept=b.net_kept,
        guest_initials=found.guest_initials,
        consent_status=CONSENTED if found.consent_id is not None else NOT_CONSENTED,
        consent_id=found.consent_id,
        checked_out=b.checked_out_at is not None,
        if_direct=None
        if extra is None
        else IfDirectOut(
            extra_kept=extra.extra_kept,
            commission_avoided=extra.commission_avoided,
            gst_avoided=extra.gst_avoided,
            upi_fee=extra.upi_fee,
            commission_rate_bps=extra.commission_rate_bps,
            label=ILLUSTRATION,
        ),
    )


def find_stay(session: SessionDep, prop: PropertyDep, night: date, room: int) -> RoomStay:
    """The stay, or a 404 the board can show."""
    try:
        return room_stay(session, prop, today(session, prop), night, room)
    except RoomNotFoundError as exc:
        if str(exc) == "night":
            raise ApiError(404, "night_not_on_board", "That night is not on the board") from exc
        raise ApiError(404, "room_empty", f"Room {room} was empty that night") from exc


@router.get("/nights", response_model=NightsOut)
def get_nights(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> NightsOut:
    """The last 7 nights' closes, from the desk register."""
    day = today(session, prop)
    return NightsOut(
        business_date=day,
        is_sample=prop.is_sample,
        nights=[night_out(b) for b in nights_board(session, prop, day)],
    )


@router.get("/{night}/{room}", response_model=RoomDetailOut)
def get_room(
    night: date,
    room: RoomNumber,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
) -> RoomDetailOut:
    """One room's stay: stored lines, initials, consent, the direct illustration."""
    return detail_out(find_stay(session, prop, night, room))


@router.post("/{night}/{room}/slip", response_model=SlipOut)
def print_room_slip(
    night: date,
    room: RoomNumber,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
) -> SlipOut:
    """Reprint the stay's slip on the Desk. Never checks out, never issues a
    perk code, never drafts a message."""
    slip = room_slip(session, prop, find_stay(session, prop, night, room))
    device = property_device(session, prop.id)
    enqueue(session, device, "show_text", {"text": "Printing slip", "sub": f"Room {room}"})
    enqueue(session, device, "print_slip", {"text": slip.as_text()})
    enqueue(session, device, "show_idle", {})
    return slip_out(slip)
