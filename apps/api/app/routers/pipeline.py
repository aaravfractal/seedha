"""The 8-step demo loop on the Pipeline home.

Steps backed by data are derived from the database (statements uploaded, a
consent saved, a message sent, a coded booking). Steps that are only "seen"
(the flip, repeat guests, the checkout slip) are recorded when they happen.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.models import Booking, Consent, Message, PipelineStep, Saving, StatementFile

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

STEP_KEYS = ("up", "ai", "flip", "rep", "desk", "slip", "msg", "book")
RecordedStep = Literal["flip", "rep", "slip"]


class StepOut(BaseModel):
    """One pipeline step and whether it is done."""

    key: str
    done: bool


class PipelineOut(BaseModel):
    """All eight steps in order."""

    steps: list[StepOut]
    done_count: int


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
        "book": _has(session, select(Saving.id)),
    }


def record_step(session: Session, key: str) -> None:
    """Mark a seen-only step done (idempotent)."""
    if session.get(PipelineStep, key) is None:
        session.add(PipelineStep(key=key))


@router.get("", response_model=PipelineOut)
def get_pipeline(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> PipelineOut:
    """Status of the 8-step loop."""
    done = compute_steps(session, prop.id)
    steps = [StepOut(key=k, done=done[k]) for k in STEP_KEYS]
    return PipelineOut(steps=steps, done_count=sum(s.done for s in steps))


@router.post("/{key}/seen", response_model=PipelineOut)
def mark_seen(
    key: RecordedStep, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> PipelineOut:
    """Record that the owner saw the flip, the repeat guests or a slip."""
    record_step(session, key)
    session.flush()
    return get_pipeline(None, session, prop)
