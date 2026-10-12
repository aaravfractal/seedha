"""The 8-step demo loop on the Pipeline home.

Steps backed by data are derived from the database (statements uploaded, a
consent saved, a message sent, a coded booking). Steps that are only "seen"
(the flip, repeat guests, the checkout slip) are recorded when they happen.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.services.pipeline import STEP_KEYS, compute_steps, record_step

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# "slip" is recorded only by a Desk checkout of the loop's own guest
# (services/pipeline.record_slip), never marked seen from the browser.
RecordedStep = Literal["flip", "rep"]


class StepOut(BaseModel):
    """One pipeline step and whether it is done."""

    key: str
    done: bool


class PipelineOut(BaseModel):
    """All eight steps in order."""

    steps: list[StepOut]
    done_count: int


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
    """Record that the owner saw the flip or the repeat guests."""
    record_step(session, key)
    session.flush()
    return get_pipeline(None, session, prop)
