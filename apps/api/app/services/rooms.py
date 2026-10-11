"""The Overview room board: the last 7 desk nights and one room's stay.

Every figure comes from stored booking rows (ruling 1); nothing is recomputed
here except the "if this room had been direct" illustration, which uses the
ruling 5 saving formula (services/savings.compute_saving) with the stay's own
channel contract. Guests appear as initials only. A consent id is returned
only while that consent is active (rule 4, ruling 7).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Final

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Channel, ChannelContract, PerkCode, Property
from app.services.consent import active_consent
from app.services.desk import InHouse, in_house
from app.services.ledger import booking_lines
from app.services.overview import LastNight, last_night_for, owner_initials
from app.services.savings import compute_saving
from app.services.slips import COMMISSION_FREE_KINDS, CheckoutInput, Slip, checkout_slip

NIGHTS_SHOWN = 7
ILLUSTRATION: Final = "Illustration"
CONSENTED: Final = "consented_at_desk"
NOT_CONSENTED: Final = "not_consented"


class RoomNotFoundError(LookupError):
    """The night is outside the board's window, or nobody stayed in the room."""


@dataclass(frozen=True, slots=True)
class ChannelCount:
    """Rooms one channel sold on a night."""

    key: str
    name: str
    rooms: int


@dataclass(frozen=True, slots=True)
class NightBoard:
    """One night on the board: the close figures plus per-channel counts."""

    summary: LastNight
    by_channel: list[ChannelCount]


@dataclass(frozen=True, slots=True)
class IfDirect:
    """What the hotel would also have kept had the stay been booked direct (paise)."""

    commission_rate_bps: int
    commission_avoided: int
    gst_avoided: int
    upi_fee: int
    extra_kept: int


@dataclass(frozen=True, slots=True)
class RoomStay:
    """One room on one night, with its stored lines and the illustration."""

    night: date
    room: int
    stay: InHouse
    guest_initials: str
    consent_id: int | None
    if_direct: IfDirect | None


def board_nights(business_day: date) -> list[date]:
    """The 7 nights ending at the business date, oldest first."""
    return [business_day - timedelta(days=n) for n in range(NIGHTS_SHOWN - 1, -1, -1)]


def _channels(session: Session, prop: Property) -> list[Channel]:
    return list(
        session.scalars(
            select(Channel).where(Channel.property_id == prop.id).order_by(Channel.sort_order)
        )
    )


def nights_board(session: Session, prop: Property, business_day: date) -> list[NightBoard]:
    """Each of the last 7 nights, from the desk register (last_night_for)."""
    channels = _channels(session, prop)
    boards: list[NightBoard] = []
    for night in board_nights(business_day):
        summary = last_night_for(session, prop, night)
        keys = [r.channel_key for r in summary.rooms if r.channel_key is not None]
        boards.append(
            NightBoard(
                summary=summary,
                by_channel=[ChannelCount(c.key, c.name, keys.count(c.key)) for c in channels],
            )
        )
    return boards


def contract_terms(session: Session, channel_id: int) -> tuple[int, bool]:
    """(commission bps, GST applies) of the channel's latest contract.

    The same query as services/link.original_terms, keyed by channel."""
    contract = session.scalar(
        select(ChannelContract)
        .where(ChannelContract.channel_id == channel_id)
        .order_by(ChannelContract.valid_from.desc())
    )
    if contract is None:
        return 0, False
    return contract.commission_bps, contract.gst_applies


def if_direct(session: Session, stay: InHouse) -> IfDirect | None:
    """Ruling 5 on the stay's commission base; None for walk-in and direct."""
    if stay.channel.kind in COMMISSION_FREE_KINDS:
        return None
    bps, gst_applies = contract_terms(session, stay.channel.id)
    saving = compute_saving(stay.booking.list_amount - stay.booking.discount, bps, gst_applies)
    if saving is None:
        return None
    return IfDirect(
        commission_rate_bps=saving.commission_rate_used,
        commission_avoided=saving.commission_avoided,
        gst_avoided=saving.gst_avoided,
        upi_fee=saving.upi_fee,
        extra_kept=saving.net_saving,
    )


def room_stay(
    session: Session, prop: Property, business_day: date, night: date, room: int
) -> RoomStay:
    """The stay in `room` on `night`, or RoomNotFoundError."""
    if night not in board_nights(business_day):
        raise RoomNotFoundError("night")
    stay = next(
        (s for s in in_house(session, prop.id, night) if s.room and s.room.number == room), None
    )
    if stay is None:
        raise RoomNotFoundError("room")
    consent = active_consent(session, stay.guest.id)
    return RoomStay(
        night=night,
        room=room,
        stay=stay,
        guest_initials=owner_initials(stay.guest.display_name),
        consent_id=consent.id if consent is not None else None,
        if_direct=if_direct(session, stay),
    )


def room_slip(session: Session, prop: Property, found: RoomStay) -> Slip:
    """The stay's checkout slip from its stored lines (ruling 4).

    Uses the stay's existing perk code if one was issued; never issues one.
    The guest appears as initials, as everywhere on the board."""
    stay = found.stay
    perk = session.scalar(select(PerkCode).where(PerkCode.origin_booking_id == stay.booking.id))
    return checkout_slip(
        CheckoutInput(
            hotel=f"{prop.short_name}, {prop.city}",
            guest_name=found.guest_initials,
            room=found.room,
            channel_name=stay.channel.name,
            channel_kind=stay.channel.kind,
            lines=booking_lines(stay.booking),
            perk_text=prop.perk_text.split(" on ")[0],
            perk_code=perk.code if perk is not None else None,
        )
    )
