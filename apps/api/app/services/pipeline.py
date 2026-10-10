"""The 8-step demo loop: which steps are done.

Steps backed by data are derived from the database (statements uploaded, a
consent saved, a message sent, a coded booking). Steps that are only "seen"
(the flip, repeat guests, the checkout slip) are recorded when they happen.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import (
    SAMPLE_HISTORY_PAYMENT,
    Booking,
    Consent,
    DirectBooking,
    Message,
    PipelineStep,
    Saving,
    StatementFile,
)

STEP_KEYS = ("up", "ai", "flip", "rep", "desk", "slip", "msg", "book")


def _has(session: Session, statement: Select[Any]) -> bool:
    return bool(session.scalar(select(statement.exists())))


def compute_steps(session: Session, property_id: int) -> dict[str, bool]:
    """Derive each step from stored data or recorded events."""
    recorded = set(session.scalars(select(PipelineStep.key)).all())
    statements = _has(
        session,
        select(StatementFile.id).where(
            StatementFile.property_id == property_id,
            StatementFile.parse_method != "seed",
        ),
    ) or _has(session, select(Booking.id).where(Booking.source == "statement"))
    return {
        "up": statements,
        "ai": _has(session, select(Booking.id).where(Booking.source == "statement")),
        "flip": "flip" in recorded,
        "rep": "rep" in recorded,
        "desk": _has(session, select(Consent.id)),
        "slip": "slip" in recorded,
        "msg": _has(session, select(Message.id).where(Message.status == "sent")),
        # The sample hotel's earlier coded bookings (seed, D-080) do not count:
        # this step is the demo loop's own guest booking with a code.
        "book": _has(
            session,
            select(Saving.id)
            .join(DirectBooking, DirectBooking.id == Saving.direct_booking_id)
            .where(DirectBooking.payment_method != SAMPLE_HISTORY_PAYMENT),
        ),
    }


def record_step(session: Session, key: str) -> None:
    """Mark a seen-only step done (idempotent)."""
    if session.get(PipelineStep, key) is None:
        session.add(PipelineStep(key=key))
