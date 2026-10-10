"""The owner's answers to the Saturday move (accepted, later, or undone)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ScenarioDecision

DEFAULT_ROOMS = 6
UNDONE = "undone"


def current_answer(session: Session, property_id: int) -> ScenarioDecision | None:
    """The owner's standing answer: the latest one, unless it was undone."""
    last = latest_decision(session, property_id)
    return None if last is None or last.decision == UNDONE else last


def latest_decision(session: Session, property_id: int) -> ScenarioDecision | None:
    """The owner's most recent answer to the Saturday move."""
    return session.scalar(
        select(ScenarioDecision)
        .where(ScenarioDecision.property_id == property_id, ScenarioDecision.kind == "saturday")
        .order_by(ScenarioDecision.id.desc())
        .limit(1)
    )
