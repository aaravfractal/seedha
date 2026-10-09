"""The front desk: in-house guests, check-in QR, checkout slips, the Desk box.

The Desk box never receives guest contact data. It gets display text, a
consent URL and slip text through a command queue it polls with its device
key (only the key's SHA-256 is stored).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Channel,
    DeskCommand,
    DeskDevice,
    DirectBooking,
    Guest,
    PerkCode,
    Property,
    Room,
    Saving,
)
from app.money import ZERO_LINES
from app.services.consent import active_consent, as_utc, issue_token
from app.services.ledger import booking_lines
from app.services.perks import issue_perk
from app.services.slips import CheckoutInput, CloseInput, Slip, checkout_slip, close_slip

ONLINE_WINDOW = timedelta(seconds=10)
MAX_COMMANDS_PER_POLL = 20


def hash_device_key(key: str) -> str:
    """Device keys are stored only as SHA-256 hashes."""
    return hashlib.sha256(key.encode()).hexdigest()


def device_for_key(session: Session, key: str) -> DeskDevice | None:
    """The device whose key this is, if any."""
    if not key:
        return None
    return session.scalar(
        select(DeskDevice).where(DeskDevice.device_key_hash == hash_device_key(key))
    )


def property_device(session: Session, property_id: int) -> DeskDevice | None:
    """The property's Desk box (one per property in this build)."""
    return session.scalar(
        select(DeskDevice).where(DeskDevice.property_id == property_id).order_by(DeskDevice.id)
    )


def enqueue(
    session: Session, device: DeskDevice | None, kind: str, payload: dict[str, object]
) -> None:
    """Queue a command; silently skipped when no device is registered."""
    if device is None:
        return
    session.add(DeskCommand(device_id=device.id, kind=kind, payload=json.dumps(payload)))
    session.flush()


def poll(session: Session, device: DeskDevice, now: datetime) -> list[DeskCommand]:
    """Unacknowledged commands, oldest first. Marks the device as seen."""
    device.last_seen = now
    return list(
        session.scalars(
            select(DeskCommand)
            .where(DeskCommand.device_id == device.id, DeskCommand.acked_at.is_(None))
            .order_by(DeskCommand.id)
            .limit(MAX_COMMANDS_PER_POLL)
        )
    )


def ack(session: Session, device: DeskDevice, ids: list[int], now: datetime) -> int:
    """Acknowledge this device's commands; returns how many were updated."""
    commands = session.scalars(
        select(DeskCommand).where(
            DeskCommand.device_id == device.id,
            DeskCommand.id.in_(ids),
            DeskCommand.acked_at.is_(None),
        )
    ).all()
    for command in commands:
        command.acked_at = now
    return len(commands)


def is_online(device: DeskDevice | None, now: datetime) -> bool:
    """Seen within the last 10 seconds (it polls every 2 seconds)."""
    return (
        device is not None
        and device.last_seen is not None
        and (now - as_utc(device.last_seen) <= ONLINE_WINDOW)
    )


def business_date(session: Session, property_id: int, today: date) -> date:
    """The front desk's day: the latest Desk check-in date, else today."""
    latest = session.scalar(
        select(func.max(Booking.check_in)).where(
            Booking.property_id == property_id, Booking.source == "desk"
        )
    )
    return latest or today


@dataclass(frozen=True, slots=True)
class InHouse:
    """A guest staying tonight, as the desk screen lists them."""

    booking: Booking
    guest: Guest
    room: Room | None
    channel: Channel


def in_house(session: Session, property_id: int, day: date) -> list[InHouse]:
    """Desk-register stays covering `day`, in register order."""
    rows = session.execute(
        select(Booking, Guest, Room, Channel)
        .join(Guest, Guest.id == Booking.guest_id)
        .join(Channel, Channel.id == Booking.channel_id)
        .outerjoin(Room, Room.id == Booking.room_id)
        .where(
            Booking.property_id == property_id,
            Booking.source == "desk",
            Booking.status == "stay",
            Booking.check_in <= day,
        )
        .order_by(Booking.id)
    ).all()
    return [
        InHouse(b, g, r, c) for b, g, r, c in rows if b.check_in + timedelta(days=b.nights) > day
    ]


def find_in_house(session: Session, property_id: int, day: date, booking_id: int) -> InHouse | None:
    """One in-house stay by booking id."""
    return next(
        (s for s in in_house(session, property_id, day) if s.booking.id == booking_id), None
    )


def check_in(
    session: Session, prop: Property, stay: InHouse, web_origin: str, now: datetime
) -> tuple[str, datetime]:
    """Issue the consent link and show it as a QR on the Desk."""
    token, record = issue_token(session, stay.booking, now)
    url = f"{web_origin.rstrip('/')}/consent/{token}"
    room = stay.room.number if stay.room else None
    device = property_device(session, prop.id)
    enqueue(session, device, "set_ring", {"color": "off"})
    enqueue(session, device, "show_qr", {
        "url": url,
        "text": f"Room {room} · Scan for your perk" if room else "Scan for your perk",
        "expires_at": record.expires_at.isoformat(),
    })  # fmt: skip
    return url, record.expires_at


def check_out(
    session: Session, prop: Property, stay: InHouse, now: datetime
) -> tuple[Slip, PerkCode]:
    """Issue the perk code, mark the stay checked out and print the slip."""
    perk = issue_perk(session, prop.code_prefix, prop.perk_text, stay.guest, stay.booking, now)
    stay.booking.checked_out_at = stay.booking.checked_out_at or now
    slip = checkout_slip(
        CheckoutInput(
            hotel=f"{prop.short_name}, {prop.city}",
            guest_name=stay.guest.display_name,
            room=stay.room.number if stay.room else None,
            channel_name=stay.channel.name,
            channel_kind=stay.channel.kind,
            lines=booking_lines(stay.booking),
            perk_text=prop.perk_text.split(" on ")[0],
            perk_code=perk.code,
        )
    )
    device = property_device(session, prop.id)
    enqueue(
        session, device, "show_text", {"text": "Printing slip", "sub": "Please take your receipt"}
    )
    enqueue(session, device, "print_slip", {"text": slip.as_text()})
    enqueue(session, device, "show_idle", {})
    session.flush()
    return slip, perk


def has_consent(session: Session, stay: InHouse) -> bool:
    """Whether this guest has an active consent (for the desk list)."""
    return active_consent(session, stay.guest.id) is not None


def month_start(day: date) -> datetime:
    """Midnight UTC on the first of the day's month."""
    return datetime(day.year, day.month, 1, tzinfo=UTC)


def saved_this_month(session: Session, property_id: int, day: date) -> int:
    """Net saving from coded direct bookings made this month (paise)."""
    total = session.scalar(
        select(func.coalesce(func.sum(Saving.net_saving), 0))
        .join(DirectBooking, DirectBooking.id == Saving.direct_booking_id)
        .where(
            DirectBooking.property_id == property_id,
            DirectBooking.created_at >= month_start(day),
        )
    )
    return int(total or 0)


def tonight_close(session: Session, prop: Property, day: date) -> Slip:
    """The 9 PM close slip for one business day, from stored booking lines."""
    stays = in_house(session, prop.id, day)
    lines = ZERO_LINES
    for stay in stays:
        lines = lines + booking_lines(stay.booking)
    return close_slip(
        CloseInput(
            hotel=prop.short_name,
            day=day,
            rooms_sold=len(stays),
            direct_rooms=sum(1 for s in stays if s.channel.kind == "direct"),
            lines=lines,
            saved_this_month=saved_this_month(session, prop.id, day),
        )
    )


def utc_now() -> datetime:
    """Current time in UTC."""
    return datetime.now(UTC)
