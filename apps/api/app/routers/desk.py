"""Front desk (owner session) and Desk box (device key) endpoints."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.deps import DeviceDep, OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import PerkCode, Property
from app.routers.pipeline import record_step
from app.services.desk import (
    InHouse,
    ack,
    business_date,
    check_in,
    check_out,
    enqueue,
    has_consent,
    in_house,
    is_online,
    poll,
    property_device,
    tonight_close,
    utc_now,
)
from app.services.slips import Slip

router = APIRouter(prefix="/desk", tags=["desk"])


class GuestOut(BaseModel):
    """An in-house guest on the desk screen. No contact data."""

    booking_id: int
    name: str
    short_name: str
    room: int | None
    channel: str
    consent: bool
    checked_out: bool
    perk_code: str | None


class DeviceOut(BaseModel):
    """The Desk box status."""

    registered: bool
    name: str | None
    online: bool
    last_seen: datetime | None


class DeskStateOut(BaseModel):
    """Everything the desk simulator shows."""

    business_date: date
    device: DeviceOut
    guests: list[GuestOut]


class RoomIn(BaseModel):
    """A room number on tonight's register."""

    room: int = Field(ge=1, le=9999)


class CheckinOut(BaseModel):
    """The consent link shown as the Desk QR."""

    booking_id: int
    url: str
    expires_at: datetime


class SlipLineOut(BaseModel):
    """One slip line. Amount in paise, null for text-only lines."""

    label: str
    amount: int | None
    bold: bool


class SlipOut(BaseModel):
    """A slip as data and as printer text."""

    title: str
    subtitle: str
    lines: list[SlipLineOut]
    footer: list[str]
    text: str


class CheckoutOut(BaseModel):
    """The checkout slip and the guest's perk code."""

    booking_id: int
    perk_code: str
    slip: SlipOut


class CommandOut(BaseModel):
    """A queued command for the Desk box."""

    id: int
    kind: str
    payload: dict[str, object]


class PollOut(BaseModel):
    """Commands to run, oldest first."""

    commands: list[CommandOut]
    server_time: datetime


class AckIn(BaseModel):
    """Ids of commands the device has run."""

    ids: list[int] = Field(min_length=1, max_length=50)


def slip_out(slip: Slip) -> SlipOut:
    """Slip as API data."""
    return SlipOut(
        title=slip.title,
        subtitle=slip.subtitle,
        lines=[SlipLineOut(label=x.label, amount=x.amount, bold=x.bold) for x in slip.lines],
        footer=slip.footer,
        text=slip.as_text(),
    )


def today(session: SessionDep, prop: Property) -> date:
    """The desk's business date."""
    return business_date(session, prop.id, utc_now().date())


def stay_for_room(session: SessionDep, prop: Property, room: int) -> InHouse:
    """The in-house stay in a room tonight, or 404."""
    for stay in in_house(session, prop.id, today(session, prop)):
        if stay.room is not None and stay.room.number == room:
            return stay
    raise ApiError(404, "room_not_in_house", f"No guest is staying in room {room} tonight")


@router.get("/state", response_model=DeskStateOut)
def desk_state(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> DeskStateOut:
    """Tonight's guests, their consent and checkout state, and the box status."""
    day = today(session, prop)
    device = property_device(session, prop.id)
    perks = {
        p.origin_booking_id: p.code
        for p in session.scalars(select(PerkCode).where(PerkCode.guest.has(property_id=prop.id)))
    }
    return DeskStateOut(
        business_date=day,
        device=DeviceOut(
            registered=device is not None,
            name=device.name if device else None,
            online=is_online(device, utc_now()),
            last_seen=device.last_seen if device else None,
        ),
        guests=[
            GuestOut(
                booking_id=s.booking.id,
                name=s.guest.display_name,
                short_name=s.guest.short_name,
                room=s.room.number if s.room else None,
                channel=s.channel.name,
                consent=has_consent(session, s),
                checked_out=s.booking.checked_out_at is not None,
                perk_code=perks.get(s.booking.id),
            )
            for s in in_house(session, prop.id, day)
        ],
    )


@router.post("/checkin", response_model=CheckinOut)
def desk_checkin(
    body: RoomIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> CheckinOut:
    """Show a one-booking consent QR for the room; expires in 10 minutes."""
    stay = stay_for_room(session, prop, body.room)
    if stay.booking.checked_out_at is not None:
        raise ApiError(409, "already_checked_out", "This guest has already checked out")
    url, expires = check_in(session, prop, stay, settings.web_origin, utc_now())
    return CheckinOut(booking_id=stay.booking.id, url=url, expires_at=expires)


@router.post("/checkout", response_model=CheckoutOut)
def desk_checkout(
    body: RoomIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> CheckoutOut:
    """Print the checkout slip from the guest's own booking (ruling 4)."""
    stay = stay_for_room(session, prop, body.room)
    slip, perk = check_out(session, prop, stay, utc_now())
    record_step(session, "slip")
    return CheckoutOut(booking_id=stay.booking.id, perk_code=perk.code, slip=slip_out(slip))


@router.get("/close-slip", response_model=SlipOut)
def get_close_slip(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> SlipOut:
    """Tonight's 9 PM close slip."""
    return slip_out(tonight_close(session, prop, today(session, prop)))


@router.post("/close-slip", response_model=SlipOut)
def print_close_slip(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> SlipOut:
    """Print tonight's close slip on the Desk."""
    slip = tonight_close(session, prop, today(session, prop))
    device = property_device(session, prop.id)
    enqueue(session, device, "show_text", {"text": "Printing slip", "sub": "Close of day"})
    enqueue(session, device, "print_slip", {"text": slip.as_text()})
    enqueue(session, device, "show_idle", {})
    return slip_out(slip)


@router.get("/poll", response_model=PollOut)
def device_poll(device: DeviceDep, session: SessionDep) -> PollOut:
    """Device: fetch commands (every 2 s). Marks the box online."""
    now = utc_now()
    commands = poll(session, device, now)
    return PollOut(
        commands=[
            CommandOut(id=c.id, kind=c.kind, payload=json.loads(c.payload)) for c in commands
        ],
        server_time=now,
    )


@router.post("/ack")
def device_ack(
    device: DeviceDep, session: SessionDep, body: Annotated[AckIn, Body()]
) -> dict[str, int]:
    """Device: confirm commands ran."""
    return {"acked": ack(session, device, body.ids, utc_now())}
