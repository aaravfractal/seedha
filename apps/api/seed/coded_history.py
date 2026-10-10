"""Four earlier coded direct bookings for the sample hotel (FRONTEND_MASTER D9).

The handoff's Savings and Overview show "4 coded direct bookings" worth
₹12,600. These rows reproduce that with the real saving formula (ruling 5):
each booking is at the public room rate, and its saving is computed from the
guest's original channel contract, so the total comes out at exactly ₹12,600
(the per-row split differs from the handoff's sample split; D-080).

They were booked through Seedha Link during the season (Aug and Sep 2026) for
stays after 30 Sep, so the Apr to Sep ledger and the repeat-guest scan never
see them. Their codes are already redeemed and are display-only; they are
marked `payment_method=SAMPLE_HISTORY_PAYMENT` so the demo loop's "guest booked with
code" step ignores them.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    SAMPLE_HISTORY_PAYMENT,
    Booking,
    Channel,
    ChannelContract,
    DirectBooking,
    Guest,
    PerkCode,
    Property,
    Room,
    Saving,
)
from app.money import LineItems, rupees, upi_fee
from app.services.savings import compute_saving

TOTAL_NET_SAVING = rupees(12_600)


@dataclass(frozen=True, slots=True)
class CodedStay:
    """One earlier coded booking: who, where they first came from, what they booked."""

    guest: str
    short_name: str
    city: str
    code: str
    original_channel: str
    room_type: str
    nights: int
    booked_on: date
    check_in: date


CODED_STAYS: tuple[CodedStay, ...] = (
    CodedStay("Kapoor family", "Kapoor ji", "Delhi", "DEODAR-KF26", "ta",
              "Deluxe Valley View", 6, date(2026, 8, 12), date(2026, 10, 24)),
    CodedStay("S. Bisht", "Bisht ji", "Dehradun", "DEODAR-SB26", "mmt",
              "Standard", 4, date(2026, 8, 27), date(2026, 11, 6)),
    CodedStay("Arjun Mehta", "Arjun ji", "Ludhiana", "DEODAR-AM26", "mmt",
              "Standard", 4, date(2026, 9, 9), date(2026, 11, 20)),
    CodedStay("Iyer family", "Iyer ji", "Chennai", "DEODAR-IF26", "mmt",
              "Family Suite", 2, date(2026, 9, 23), date(2026, 12, 4)),
)  # fmt: skip


def _channel(session: Session, prop: Property, key: str) -> Channel:
    channel = session.scalar(
        select(Channel).where(Channel.property_id == prop.id, Channel.key == key)
    )
    if channel is None:
        raise LookupError(f"sample channel {key} missing")
    return channel


def _contract(session: Session, channel: Channel) -> ChannelContract:
    contract = session.scalar(
        select(ChannelContract)
        .where(ChannelContract.channel_id == channel.id)
        .order_by(ChannelContract.valid_from.desc())
    )
    if contract is None:
        raise LookupError(f"contract for {channel.key} missing")
    return contract


def _room(session: Session, prop: Property, room_type: str) -> Room:
    room = session.scalar(
        select(Room)
        .where(Room.property_id == prop.id, Room.room_type == room_type)
        .order_by(Room.number)
    )
    if room is None:
        raise LookupError(f"room type {room_type} missing")
    return room


def load_coded_history(session: Session, prop: Property) -> int:
    """Add the four coded bookings; returns their total net saving in paise."""
    direct = _channel(session, prop, "direct")
    total = 0
    for index, stay in enumerate(CODED_STAYS, start=1):
        room = _room(session, prop, stay.room_type)
        amount = room.rack_rate * stay.nights
        booked_at = datetime.combine(stay.booked_on, datetime.min.time(), UTC).replace(hour=11)
        guest = Guest(property_id=prop.id, display_name=stay.guest, short_name=stay.short_name,
                      city=stay.city)  # fmt: skip
        session.add(guest)
        session.flush()
        lines = LineItems(list_amount=amount, fees=upi_fee(amount))
        booking = Booking(
            property_id=prop.id, channel_id=direct.id, room_id=room.id, guest_id=guest.id,
            external_ref=f"SLH{index:04d}", source="direct_link", status="stay",
            check_in=stay.check_in, nights=stay.nights, guest_name=stay.guest,
            guest_city=stay.city, list_amount=amount, discount=0, commission=0,
            gst_on_commission=0, fees=lines.fees, net_kept=lines.net_kept,
            payout_reported=lines.net_kept, math_check_passed=True,
        )  # fmt: skip
        session.add(booking)
        session.flush()
        perk = PerkCode(
            code=stay.code,
            guest_id=guest.id,
            origin_booking_id=booking.id,
            perk=prop.perk_text,
            created_at=booked_at,
            redeemed_at=booked_at,
        )
        session.add(perk)
        session.flush()
        coded = DirectBooking(
            property_id=prop.id,
            perk_code_id=perk.id,
            booking_id=booking.id,
            amount=amount,
            payment_method=SAMPLE_HISTORY_PAYMENT,
            payment_ref=f"sample-{stay.code.lower()}",
            created_at=booked_at,
        )
        session.add(coded)
        session.flush()
        original = _channel(session, prop, stay.original_channel)
        contract = _contract(session, original)
        saving = compute_saving(amount, contract.commission_bps, contract.gst_applies)
        if saving is None:
            raise ValueError(f"{stay.code} saves nothing")
        session.add(
            Saving(
                direct_booking_id=coded.id,
                original_channel_id=original.id,
                commission_rate_used=saving.commission_rate_used,
                commission_avoided=saving.commission_avoided,
                gst_avoided=saving.gst_avoided,
                upi_fee=saving.upi_fee,
                net_saving=saving.net_saving,
            )
        )
        session.flush()
        total += saving.net_saving
    return total
