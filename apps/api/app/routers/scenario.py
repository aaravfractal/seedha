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
UNDONE = "undone"


class SaturdayOut(BaseModel):
    """The Saturday move for N rooms. Money in paise.

    `available` is false (with a reason) until there are OTA and direct sales
    to compare; the numbers are then null.
    """

    available: bool
    reason: str | None = None
    rooms: int
    max_rooms: int
    channel_key: str | None = None
    channel_name: str | None = None
    channel_net_adr: int | None = None
    direct_net_adr: int | None = None
    extra_per_room: int | None = None
    extra_per_saturday: int | None = None
    before_per_saturday: int | None = None
    after_per_saturday: int | None = None
    decision: str | None = None
    decided_at: datetime | None = None


class DecisionIn(BaseModel):
    """Accept the move for N rooms, or put it off."""

    decision: Literal["accepted", "later"]
    rooms: int = Field(ge=1, le=100)


def check_rooms(rooms: int, max_rooms: int) -> None:
    """Rooms to hold must be within the hotel's room count."""
    if not 1 <= rooms <= max_rooms:
        raise ApiError(422, "invalid_rooms", f"Rooms must be between 1 and {max_rooms}")


def compute(session: SessionDep, property_id: int, rooms: int) -> SaturdayMove:
    """The move for the default ledger range; ScenarioError if not computable."""
    return saturday_move(load_ledger(session, property_id), rooms)


def current_answer(session: SessionDep, property_id: int) -> ScenarioDecision | None:
    """The owner's standing answer: the latest one, unless it was undone."""
    last = latest_decision(session, property_id)
    return None if last is None or last.decision == UNDONE else last


def latest_decision(session: SessionDep, property_id: int) -> ScenarioDecision | None:
    """The owner's most recent answer to the Saturday move."""
    return session.scalar(
        select(ScenarioDecision)
        .where(ScenarioDecision.property_id == property_id, ScenarioDecision.kind == "saturday")
        .order_by(ScenarioDecision.id.desc())
        .limit(1)
    )


def saturday_out(move: SaturdayMove, max_rooms: int, last: ScenarioDecision | None) -> SaturdayOut:
    """Shape the card. An undone answer reads as no answer."""
    if last is not None and last.decision == UNDONE:
        last = None
    return SaturdayOut(
        available=True, rooms=move.rooms, max_rooms=max_rooms, channel_key=move.channel_key,
        channel_name=move.channel_name, channel_net_adr=move.channel_net_adr,
        direct_net_adr=move.direct_net_adr, extra_per_room=move.extra_per_room,
        extra_per_saturday=move.extra_per_saturday,
        before_per_saturday=move.before_per_saturday, after_per_saturday=move.after_per_saturday,
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
    check_rooms(count, prop.rooms_count)
    try:
        move = compute(session, prop.id, count)
    except ScenarioError as exc:
        return SaturdayOut(
            available=False, reason=str(exc), rooms=count, max_rooms=prop.rooms_count
        )
    return saturday_out(move, prop.rooms_count, last)


@router.post("/saturday", response_model=SaturdayOut)
def decide_saturday(
    body: DecisionIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> SaturdayOut:
    """Record Accept or Not now. Seedha does not change OTA settings itself."""
    check_rooms(body.rooms, prop.rooms_count)
    try:
        move = compute(session, prop.id, body.rooms)
    except ScenarioError as exc:
        raise ApiError(422, "no_saturday_move", str(exc)) from exc
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


@router.post("/saturday/undo", response_model=SaturdayOut)
def undo_saturday(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> SaturdayOut:
    """Take back the owner's last answer. The log keeps it, marked undone."""
    last = latest_decision(session, prop.id)
    if last is None or last.decision == UNDONE:
        raise ApiError(409, "nothing_to_undo", "There is no answer to undo")
    session.add(
        ScenarioDecision(
            property_id=prop.id,
            kind="saturday",
            rooms=last.rooms,
            channel_key=last.channel_key,
            decision=UNDONE,
        )  # fmt: skip
    )
    session.flush()
    try:
        move = compute(session, prop.id, last.rooms)
    except ScenarioError as exc:
        raise ApiError(422, "no_saturday_move", str(exc)) from exc
    return saturday_out(move, prop.rooms_count, latest_decision(session, prop.id))
