"""Seedha Link: a returning guest books directly with the hotel.

* The price is the public (rack) rate times nights. A perk code adds the perk;
  it never lowers the price (rule 6).
* A code can be redeemed once. Redemption is a single conditional UPDATE, so
  two payments racing with the same code cannot both claim it.
* A saving is recorded only for a redeemed code, using the original channel's
  contract (ruling 5). No code, no saving.
* A card-page feedback reward code (D-106) for 5% or Rs 100 off is the one
  exception to "never lower": a private, one-time, hotel-funded discount on
  the public rate, recorded as the booking's discount line and on its saving
  row. It is valid for 12 months; one code per booking, so never stacked.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Channel,
    ChannelContract,
    DirectBooking,
    GuestFeedback,
    PerkCode,
    Property,
    Room,
    Saving,
)
from app.money import LineItems, upi_fee
from app.services.consent import as_utc
from app.services.savings import SavingLines, compute_saving, reward_discount

MAX_NIGHTS = 14
BOOKING_HORIZON_DAYS = 365
DATE_OPTIONS = 2
FIRST_OPTION_AFTER_DAYS = 30
REWARD_VALID_DAYS = 365
DISCOUNT_REWARDS = frozenset({"pct5", "flat100"})


class LinkError(ValueError):
    """A booking problem with a guest-facing message."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class CodeStatus:
    """What a perk code means for the booking page."""

    status: str  # "valid", "used", "unknown" or "none"
    perk: PerkCode | None


def code_status(session: Session, raw: str | None) -> CodeStatus:
    """Look a code up case-insensitively."""
    code = (raw or "").strip().upper()
    if not code:
        return CodeStatus("none", None)
    perk = session.scalar(select(PerkCode).where(PerkCode.code == code))
    if perk is None:
        return CodeStatus("unknown", None)
    return CodeStatus("used" if perk.redeemed_at else "valid", perk)


def room_rates(session: Session, property_id: int) -> dict[str, int]:
    """Public nightly rate per room type (paise), highest first."""
    rows = session.execute(
        select(Room.room_type, Room.rack_rate).where(Room.property_id == property_id).distinct()
    ).all()
    return dict(sorted(((t, r) for t, r in rows), key=lambda x: -x[1]))


def date_options(business_day: date) -> list[tuple[date, int]]:
    """Two upcoming Friday-to-Sunday weekends, about a month out."""
    first = business_day + timedelta(days=FIRST_OPTION_AFTER_DAYS)
    friday = first + timedelta(days=(4 - first.weekday()) % 7)
    return [(friday + timedelta(weeks=i), 2) for i in range(DATE_OPTIONS)]


def free_room(
    session: Session, property_id: int, room_type: str, start: date, nights: int
) -> Room | None:
    """A room of the type with no stay on any of the nights."""
    end = start + timedelta(days=nights)
    rooms = session.scalars(
        select(Room).where(Room.property_id == property_id, Room.room_type == room_type)
    ).all()
    taken = session.execute(
        select(Booking.room_id, Booking.check_in, Booking.nights).where(
            Booking.property_id == property_id,
            Booking.status == "stay",
            Booking.room_id.in_([r.id for r in rooms]),
            Booking.check_in < end,
        )
    ).all()
    busy = {rid for rid, ci, n in taken if ci + timedelta(days=n) > start}
    return next((r for r in rooms if r.id not in busy), None)


@dataclass(frozen=True, slots=True)
class BookingRequest:
    """A guest's booking from Seedha Link."""

    code: str | None
    check_in: date
    nights: int
    room_type: str


@dataclass(frozen=True, slots=True)
class BookingDone:
    """A completed direct booking and its saving, if a code was redeemed."""

    direct: DirectBooking
    booking: Booking
    perk_applied: bool
    saving: SavingLines | None


def validate(req: BookingRequest, business_day: date, rates: dict[str, int]) -> int:
    """Check dates and room type; return the nightly rate."""
    if req.room_type not in rates:
        raise LinkError(422, "unknown_room", "Choose one of the listed rooms")
    if not 1 <= req.nights <= MAX_NIGHTS:
        raise LinkError(422, "invalid_nights", f"Stays can be 1 to {MAX_NIGHTS} nights")
    if not business_day < req.check_in <= business_day + timedelta(days=BOOKING_HORIZON_DAYS):
        raise LinkError(422, "invalid_dates", "Choose a date from tomorrow up to a year ahead")
    return rates[req.room_type]


def redeem(session: Session, perk: PerkCode, now: datetime) -> bool:
    """Atomically mark the code used. False if someone used it first."""
    result = session.execute(
        update(PerkCode)
        .where(PerkCode.id == perk.id, PerkCode.redeemed_at.is_(None))
        .values(redeemed_at=now)
    )
    return bool(getattr(result, "rowcount", 0))


def feedback_reward(session: Session, perk: PerkCode | None) -> str | None:
    """The feedback reward ('breakfast', 'pct5', 'flat100') a code was issued
    for, or None for any other perk code."""
    if perk is None:
        return None
    return session.scalar(select(GuestFeedback.reward).where(GuestFeedback.perk_code_id == perk.id))


def reward_expired(session: Session, perk: PerkCode, now: datetime) -> bool:
    """A discount reward code lasts 12 months from when the owner sent it."""
    return feedback_reward(session, perk) in DISCOUNT_REWARDS and (
        as_utc(perk.created_at) + timedelta(days=REWARD_VALID_DAYS) < now
    )


def original_terms(session: Session, perk: PerkCode) -> tuple[int, int, bool] | None:
    """(channel id, commission bps, GST applies) of the stay that earned the
    perk; None for a reward code given without a verified stay."""
    if perk.origin_booking is None:
        return None
    channel_id = perk.origin_booking.channel_id
    contract = session.scalar(
        select(ChannelContract)
        .where(ChannelContract.channel_id == channel_id)
        .order_by(ChannelContract.valid_from.desc())
    )
    if contract is None:
        return channel_id, 0, False
    return channel_id, contract.commission_bps, contract.gst_applies


def claim_perk(session: Session, req: BookingRequest, now: datetime) -> PerkCode | None:
    """The redeemed perk for this booking, or None when no code was given."""
    status = code_status(session, req.code)
    if status.status == "unknown":
        raise LinkError(422, "unknown_code", "That code is not right. Check your slip or WhatsApp.")
    if status.status == "valid" and status.perk and reward_expired(session, status.perk, now):
        raise LinkError(422, "code_expired", "This code has expired.")
    if status.status == "used" or (
        status.perk is not None and not redeem(session, status.perk, now)
    ):
        raise LinkError(409, "code_used", "This code was already used.")
    return status.perk


def direct_stay(
    session: Session, prop: Property, req: BookingRequest, room: Room, amount: int,
    perk: PerkCode | None, discount: int = 0,
) -> Booking:  # fmt: skip
    """The ledger row for a Seedha Link booking: direct channel, UPI fee on
    what the guest paid, and a reward code's hotel-funded discount line."""
    channel = session.scalar(
        select(Channel).where(Channel.property_id == prop.id, Channel.kind == "direct")
    )
    if channel is None:
        raise LinkError(500, "no_direct_channel", "Direct booking is not set up")
    lines = LineItems(list_amount=amount, discount=discount, fees=upi_fee(amount - discount))
    guest = perk.guest if perk else None
    booking = Booking(
        property_id=prop.id, channel_id=channel.id, room_id=room.id,
        guest_id=guest.id if guest else None,
        external_ref=f"SL{secrets.token_hex(4).upper()}", source="direct_link", status="stay",
        check_in=req.check_in, nights=req.nights,
        guest_name=guest.display_name if guest else "Direct guest",
        guest_city=guest.city if guest else None, list_amount=amount, discount=discount,
        commission=0, gst_on_commission=0, fees=lines.fees, net_kept=lines.net_kept,
        payout_reported=lines.net_kept, math_check_passed=True,
    )  # fmt: skip
    session.add(booking)
    session.flush()
    return booking


def record_saving(
    session: Session, direct: DirectBooking, perk: PerkCode, amount: int, discount: int = 0
) -> SavingLines | None:
    """Store the saving at the original channel's contract rate (ruling 5),
    with a reward code's hotel-funded discount as its own line."""
    terms = original_terms(session, perk)
    if terms is None:
        return None
    channel_id, bps, gst = terms
    saving = compute_saving(amount, bps, gst, discount)
    if saving is None:
        return None
    session.add(
        Saving(
            direct_booking_id=direct.id,
            original_channel_id=channel_id,
            commission_rate_used=saving.commission_rate_used,
            commission_avoided=saving.commission_avoided,
            gst_avoided=saving.gst_avoided,
            upi_fee=saving.upi_fee,
            hotel_discount=saving.hotel_discount,
            net_saving=saving.net_saving,
        )
    )
    session.flush()
    return saving


def book(
    session: Session, prop: Property, req: BookingRequest, business_day: date,
    payment_ref: str, now: datetime,
) -> BookingDone:  # fmt: skip
    """Create the direct booking, redeem the code and record the saving."""
    nightly = validate(req, business_day, room_rates(session, prop.id))
    room = free_room(session, prop.id, req.room_type, req.check_in, req.nights)
    if room is None:
        raise LinkError(409, "sold_out", "That room is full on those dates. Try other dates.")
    perk = claim_perk(session, req, now)
    amount = nightly * req.nights
    discount = reward_discount(amount, feedback_reward(session, perk))
    booking = direct_stay(session, prop, req, room, amount, perk, discount)
    direct = DirectBooking(property_id=prop.id, perk_code_id=perk.id if perk else None,
                           booking_id=booking.id, amount=amount - discount,
                           payment_method="upi_simulated", payment_ref=payment_ref,
                           created_at=now)  # fmt: skip
    session.add(direct)
    session.flush()
    saving = record_saving(session, direct, perk, amount, discount) if perk else None
    return BookingDone(direct, booking, perk is not None, saving)
