"""Find, store and summarise repeat guests for a property.

Scanning is idempotent: new suggestions are added, owner decisions on earlier
suggestions are kept. Nothing here reads or writes consent (ruling 7).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy import ColumnElement, or_, select
from sqlalchemy.orm import Session, aliased

from app.models import Booking, Channel, RepeatMatch
from app.services.ledger import DEFAULT_END, DEFAULT_START
from app.services.matcher import (
    Candidate,
    GuestKey,
    StayRef,
    TieBreaker,
    as_percent,
    find_candidates,
)


def _counted() -> ColumnElement[bool]:
    return or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted")


def _stay_ref(booking: Booking) -> StayRef:
    return StayRef(booking.id, booking.check_in, GuestKey(booking.guest_name, booking.guest_city))


def return_bookings(session: Session, property_id: int, start: date, end: date) -> list[Booking]:
    """OTA stays in the range that passed their checks."""
    return list(
        session.scalars(
            select(Booking)
            .join(Channel, Channel.id == Booking.channel_id)
            .where(
                Booking.property_id == property_id,
                Channel.kind == "ota",
                Booking.status == "stay",
                Booking.check_in >= start,
                Booking.check_in <= end,
                _counted(),
            )
        )
    )


def earlier_bookings(session: Session, property_id: int, end: date) -> list[Booking]:
    """Every stay that could be someone's earlier visit (any channel)."""
    return list(
        session.scalars(
            select(Booking).where(
                Booking.property_id == property_id,
                Booking.status == "stay",
                Booking.check_in <= end,
            )
        )
    )


def scan(
    session: Session,
    property_id: int,
    tie_breaker: TieBreaker | None,
    start: date = DEFAULT_START,
    end: date = DEFAULT_END,
) -> int:
    """Store new suggestions; return how many were added."""
    candidates: list[Candidate] = find_candidates(
        [_stay_ref(b) for b in return_bookings(session, property_id, start, end)],
        [_stay_ref(b) for b in earlier_bookings(session, property_id, end)],
        tie_breaker,
    )
    known = {
        (m.return_booking_id, m.earlier_booking_id)
        for m in session.scalars(select(RepeatMatch).where(RepeatMatch.property_id == property_id))
    }
    added = 0
    for c in candidates:
        if (c.return_booking_id, c.earlier_booking_id) in known:
            continue
        session.add(
            RepeatMatch(
                property_id=property_id,
                return_booking_id=c.return_booking_id,
                earlier_booking_id=c.earlier_booking_id,
                confidence=as_percent(c.confidence),
                llm_opinion=c.llm_opinion,
            )  # fmt: skip
        )
        added += 1
    session.flush()
    return added


@dataclass(frozen=True, slots=True)
class RepeatRow:
    """One repeat guest as the owner sees it. Money in paise."""

    match: RepeatMatch
    returned: Booking
    earlier: Booking
    returned_channel: str
    earlier_channel: str

    @property
    def paid_twice(self) -> int:
        """Commission + GST on commission of the return booking (decision C)."""
        return self.returned.commission + self.returned.gst_on_commission


def list_matches(session: Session, property_id: int) -> list[RepeatRow]:
    """Suggested before confirmed, least certain first, so the matches that
    need the owner's judgement come to the top."""
    ret_b, early_b = aliased(Booking), aliased(Booking)
    ret_c, early_c = aliased(Channel), aliased(Channel)
    rows = session.execute(
        select(RepeatMatch, ret_b, early_b, ret_c.name, early_c.name)
        .join(ret_b, ret_b.id == RepeatMatch.return_booking_id)
        .join(early_b, early_b.id == RepeatMatch.earlier_booking_id)
        .join(ret_c, ret_c.id == ret_b.channel_id)
        .join(early_c, early_c.id == early_b.channel_id)
        .where(RepeatMatch.property_id == property_id, RepeatMatch.status != "dismissed")
        .order_by(
            (RepeatMatch.status == "confirmed").asc(),
            RepeatMatch.confidence.asc(),
            ret_b.check_in.desc(),
            RepeatMatch.id,
        )
    ).all()
    return [RepeatRow(m, r, e, rc, ec) for m, r, e, rc, ec in rows]


def decide(session: Session, property_id: int, match_id: int, decision: str) -> RepeatMatch | None:
    """Owner confirms or dismisses a suggestion. Returns None if not found."""
    match = session.get(RepeatMatch, match_id)
    if match is None or match.property_id != property_id:
        return None
    match.status = "confirmed" if decision == "confirm" else "dismissed"
    match.decided_at = datetime.now(UTC)
    session.flush()
    return match
