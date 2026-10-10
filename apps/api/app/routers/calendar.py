"""Seedha Pulse calendar (owner routes): sample events with one channel
decision each, and the owner's plan. Pulse never predicts demand; the only
rupee figures come from the ledger."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import PropertyDep, SessionDep
from app.errors import ApiError
from app.routers.auth import NowDep, SubjectDep, account_of
from app.services.calendar import (
    EVENT_KEYS,
    EVENTS,
    FIRST_MONTH,
    LAST_MONTH,
    add_to_plan,
    channel_facts,
    decision_text,
    planned_keys,
    remove_from_plan,
)
from app.services.ledger import load_ledger

router = APIRouter(prefix="/calendar", tags=["calendar"])


class EventOut(BaseModel):
    """One sample event and its channel decision."""

    key: str
    title: str
    tag: str
    start: date
    end: date
    action: str
    rooms: int
    decision: str
    in_plan: bool


class FactsOut(BaseModel):
    """Ledger figures behind every decision (paise), from the statements."""

    channel_key: str
    channel_name: str
    channel_net_adr: int
    direct_net_adr: int
    extra_per_room_night: int


class CalendarOut(BaseModel):
    """Months shown, events (sample) and the ledger facts (None before statements)."""

    first_month: date
    last_month: date
    sample: bool
    events: list[EventOut]
    facts: FactsOut | None


class PlanIn(BaseModel):
    """Which event to add."""

    event_key: str


def _calendar(session: SessionDep, prop: PropertyDep) -> CalendarOut:
    facts = channel_facts(load_ledger(session, prop.id))
    planned = planned_keys(session, prop.id)
    name = facts.channel_name if facts else None
    return CalendarOut(
        first_month=FIRST_MONTH,
        last_month=LAST_MONTH,
        sample=True,
        events=[EventOut(key=e.key, title=e.title, tag=e.tag, start=e.start, end=e.end,
                         action=e.action, rooms=e.rooms, decision=decision_text(e, name),
                         in_plan=e.key in planned) for e in EVENTS],
        facts=None if facts is None else FactsOut(
            channel_key=facts.channel_key, channel_name=facts.channel_name,
            channel_net_adr=facts.channel_net_adr, direct_net_adr=facts.direct_net_adr,
            extra_per_room_night=facts.extra_per_room_night),
    )  # fmt: skip


def _known(key: str) -> str:
    if key not in EVENT_KEYS:
        raise ApiError(404, "not_found", "No such event on the calendar.")
    return key


@router.get("", response_model=CalendarOut)
def get_calendar(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> CalendarOut:
    """Events Oct 2026 to Jan 2027 with channel decisions (sample events)."""
    account_of(session, subject)
    return _calendar(session, prop)


@router.post("/plan", response_model=CalendarOut)
def post_plan(
    body: PlanIn, subject: SubjectDep, session: SessionDep, prop: PropertyDep, now: NowDep
) -> CalendarOut:
    """Add an event's channel decision to the plan."""
    account_of(session, subject)
    add_to_plan(session, prop.id, _known(body.event_key), now)
    session.flush()
    return _calendar(session, prop)


@router.delete("/plan/{event_key}", response_model=CalendarOut)
def delete_plan(
    event_key: str, subject: SubjectDep, session: SessionDep, prop: PropertyDep
) -> CalendarOut:
    """Take an event off the plan."""
    account_of(session, subject)
    remove_from_plan(session, prop.id, _known(event_key))
    session.flush()
    return _calendar(session, prop)
