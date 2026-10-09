"""The Saturday move card: compute, then record the owner's answer."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.models import ScenarioDecision
from app.services.ledger import load_ledger
from app.services.scenario import SaturdayMove, ScenarioError, saturday_move

router = APIRouter(prefix="/scenario", tags=["scenario"])
DEFAULT_ROOMS = 6


class SaturdayOut(BaseModel):
    """The Saturday move for N rooms. Money in paise."""

    rooms: int
    max_rooms: int
    channel_key: str
    channel_name: str
    channel_net_adr: int
    direct_net_adr: int
    extra_per_room: int
    extra_per_saturday: int
    decision: str | None
    decided_at: datetime | None


class DecisionIn(BaseModel):
    """Accept the move for N rooms, or put it off."""

    decision: Literal["accepted", "later"]
    rooms: int = Field(ge=1, le=100)


def compute(session: SessionDep, property_id: int, rooms: int) -> SaturdayMove:
    """The move for the default ledger range, with clear errors."""
    ledger = load_ledger(session, property_id)
    try:
        return saturday_move(ledger, rooms)
    except ScenarioError as exc:
        raise ApiError(422, "no_saturday_move", str(exc)) from exc


def latest_decision(session: SessionDep, property_id: int) -> ScenarioDecision | None:
    """The owner's most recent answer to the Saturday move."""
    return session.scalar(
        select(ScenarioDecision)
        .where(ScenarioDecision.property_id == property_id, ScenarioDecision.kind == "saturday")
        .order_by(ScenarioDecision.id.desc())
        .limit(1)
    )


def saturday_out(move: SaturdayMove, max_rooms: int, last: ScenarioDecision | None) -> SaturdayOut:
    """Shape the card."""
    return SaturdayOut(
        rooms=move.rooms, max_rooms=max_rooms, channel_key=move.channel_key,
        channel_name=move.channel_name, channel_net_adr=move.channel_net_adr,
        direct_net_adr=move.direct_net_adr, extra_per_room=move.extra_per_room,
        extra_per_saturday=move.extra_per_saturday,
        decision=last.decision if last else None, decided_at=last.decided_at if last else None,
    )  # fmt: skip


@router.get("/saturday", response_model=SaturdayOut)
def get_saturday(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    rooms: Annotated[int | None, Query(ge=1, le=100)] = None,
) -> SaturdayOut:
    """Extra kept per Saturday if N rooms sell direct instead of the lowest OTA."""
    last = latest_decision(session, prop.id)
    count = rooms or (last.rooms if last else DEFAULT_ROOMS)
    return saturday_out(compute(session, prop.id, count), prop.rooms_count, last)


@router.post("/saturday", response_model=SaturdayOut)
def decide_saturday(
    body: DecisionIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> SaturdayOut:
    """Record Accept or Not now. Seedha does not change OTA settings itself."""
    move = compute(session, prop.id, body.rooms)
    session.add(
        ScenarioDecision(
            property_id=prop.id,
            kind="saturday",
            rooms=body.rooms,
            channel_key=move.channel_key,
            decision=body.decision,
        )  # fmt: skip
    )
    session.flush()
    return saturday_out(move, prop.rooms_count, latest_decision(session, prop.id))
