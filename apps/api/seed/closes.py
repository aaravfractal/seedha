"""Six earlier desk closes for the sample hotel (POLISH_BUILD section A).

The Overview room board has a night scrubber over the last 7 nights. The base
seed only has tonight's in-house register (DEMO_DATE), so these fixed,
fictional one-night stays fill DEMO_DATE-6 to DEMO_DATE-1. Each is a Desk
register stay that has already checked out.

They all fall after 30 Sep 2026, so the Apr to Sep ledger, the repeat-guest
scan and every locked total never see them (decision D). Money comes from each
channel's stored contract through the same line rules as every other booking
(ruling 1): commission on the amount after the hotel-funded discount, 18% GST
on commission where the channel charges it, UPI fee on direct payments, TDS
withheld by OTAs as a credit (never subtracted from net kept).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, ChannelContract, Guest, Property, Room
from app.money import bps_of, line_items_for_booking
from seed.spec import CHANNEL_BY_KEY, TDS_BPS

# Room -> channel letter for each earlier night, oldest first (offset days
# before DEMO_DATE). Not every room sells; occupancy moves through the week.
CHANNEL_LETTERS = {
    "m": "mmt",
    "b": "bcom",
    "a": "agoda",
    "t": "ta",
    "w": "walkin",
    "d": "direct",
}
NIGHT_PLANS: tuple[tuple[int, str], ...] = (
    (6, "101m 102m 103b 105m 106b 108d 111w 201a 202t 203m 207m 209b"),
    (5, "101m 102b 103m 104m 105b 106m 107d 109d 111m 112w 201a 204t 205m 207m 208b"),
    (4, "101m 102m 103m 104b 105b 106m 107m 108d 110d 111w 112w 201m 202t 203b 207m 208m "
        "210b"),
    (3, "101m 102m 103b 104m 105m 106b 107m 108d 109d 110m 111a 112w 201m 202t 203b 204m "
        "207m 208b 209a"),
    (2, "101m 102b 104m 105d 106m 108b 111w 112m 201a 205t 207m 208d 210m"),
    (1, "101m 102m 103b 104m 105b 106m 107d 109m 111a 112w 201m 202t 204b 207m 208b 209a"),
)  # fmt: skip

# Hotel-funded promotion on the list rate, in basis points (sample terms).
PROMO_BPS = {"mmt": 1_200, "bcom": 1_000}

# Fictional guests: name i is FIRST[i % 23] + LAST[i % 19] (unique for 437).
FIRST = (
    "Aditi", "Bharat", "Charu", "Deepak", "Esha", "Farhan", "Gauri", "Harsh", "Isha",
    "Jatin", "Kavya", "Lalit", "Meera", "Nikhil", "Ojas", "Pooja", "Rohan", "Sakshi",
    "Tarun", "Uma", "Vikram", "Yamini", "Zoya",
)  # fmt: skip
LAST = (
    "Ahuja", "Bansal", "Chauhan", "Dixit", "Grover", "Jain", "Khanna", "Malhotra", "Negi",
    "Oberoi", "Pandey", "Rana", "Saxena", "Thapar", "Uniyal", "Verma", "Walia", "Yadav",
    "Zutshi",
)  # fmt: skip
CITIES = (
    "Delhi", "Noida", "Gurugram", "Chandigarh", "Lucknow", "Jaipur", "Meerut", "Dehradun",
    "Ambala", "Pune", "Ludhiana",
)  # fmt: skip
CHECKOUT_UTC = time(5, 30)  # 11:00 IST, the hotel's checkout time


@dataclass(frozen=True, slots=True)
class CloseStay:
    """One earlier one-night stay on the Desk register."""

    offset: int  # days before DEMO_DATE
    room: int
    channel: str
    guest: str
    city: str


def close_stays() -> list[CloseStay]:
    """Every stay in NIGHT_PLANS, with its fixed fictional guest."""
    stays: list[CloseStay] = []
    for offset, plan in NIGHT_PLANS:
        for token in plan.split():
            i = len(stays)
            stays.append(
                CloseStay(
                    offset=offset,
                    room=int(token[:-1]),
                    channel=CHANNEL_LETTERS[token[-1]],
                    guest=f"{FIRST[i % len(FIRST)]} {LAST[i % len(LAST)]}",
                    city=CITIES[i % len(CITIES)],
                )
            )
    return stays


CLOSE_STAYS: tuple[CloseStay, ...] = tuple(close_stays())


def _terms(session: Session, prop: Property) -> dict[str, tuple[Channel, ChannelContract]]:
    """Each channel with its latest contract."""
    terms: dict[str, tuple[Channel, ChannelContract]] = {}
    for channel in session.scalars(select(Channel).where(Channel.property_id == prop.id)):
        contract = session.scalar(
            select(ChannelContract)
            .where(ChannelContract.channel_id == channel.id)
            .order_by(ChannelContract.valid_from.desc())
        )
        if contract is None:
            raise LookupError(f"contract for {channel.key} missing")
        terms[channel.key] = (channel, contract)
    return terms


def load_closes(session: Session, prop: Property, demo_date: date) -> int:
    """Add the earlier closes; returns how many stays were added."""
    terms = _terms(session, prop)
    rooms = {r.number: r for r in session.scalars(select(Room).where(Room.property_id == prop.id))}
    for stay in CLOSE_STAYS:
        channel, contract = terms[stay.channel]
        room = rooms[stay.room]
        check_in = demo_date - timedelta(days=stay.offset)
        discount = bps_of(room.rack_rate, PROMO_BPS.get(stay.channel, 0))
        lines = line_items_for_booking(
            room.rack_rate, discount, contract.commission_bps, contract.gst_applies,
            contract.upi_fee_applies,
        )  # fmt: skip
        base = lines.list_amount - lines.discount
        tds = bps_of(base, TDS_BPS) if CHANNEL_BY_KEY[stay.channel].tds_applies else 0
        guest = Guest(property_id=prop.id, display_name=stay.guest,
                      short_name=f"{stay.guest.split()[0]} ji", city=stay.city)  # fmt: skip
        session.add(guest)
        session.flush()
        session.add(
            Booking(
                property_id=prop.id, channel_id=channel.id, room_id=room.id, guest_id=guest.id,
                external_ref=f"CL{stay.offset}{stay.room}", source="desk", status="stay",
                check_in=check_in, nights=1, guest_name=stay.guest, guest_city=stay.city,
                list_amount=lines.list_amount, discount=lines.discount,
                commission=lines.commission, gst_on_commission=lines.gst_on_commission,
                fees=lines.fees, net_kept=lines.net_kept, tds=tds, gst_tcs=0,
                payout_reported=lines.net_kept - tds, math_check_passed=True,
                checked_out_at=datetime.combine(check_in + timedelta(days=1), CHECKOUT_UTC, UTC),
            )
        )  # fmt: skip
    session.flush()
    return len(CLOSE_STAYS)
