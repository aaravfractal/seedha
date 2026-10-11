"""Seedha Pulse calendar (owner routes): sample events and the owner's own
events (Event Radar Lite) with one channel decision each, and the owner's
plan. Pulse never predicts demand; the only rupee figures come from the
ledger. Owner events carry no rooms and no rates (D-097)."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import PropertyDep, SessionDep
from app.errors import ApiError
from app.routers.auth import NowDep, SubjectDep, account_of
from app.services.calendar import (
    CATEGORY_TAGS,
    EVENTS,
    FIRST_MONTH,
    LAST_MONTH,
    OWNER_ACTIONS,
    add_to_plan,
    channel_facts,
    decision_text,
    is_known_key,
    owner_decision_text,
    owner_events,
    owner_key,
    planned_keys,
    remove_from_plan,
)
from app.services.ledger import load_ledger

router = APIRouter(prefix="/calendar", tags=["calendar"])


class EventOut(BaseModel):
    """One event and its channel decision. `origin` "sample" for the sample
    events; owner events have rooms 0, action "keep" for low demand, and the
    owner's own source address."""

    key: str
    title: str
    tag: str
    start: date
    end: date
    action: str
    rooms: int
    decision: str
    in_plan: bool
    origin: Literal["sample", "owner_source", "sample_extraction"]
    source_url: str | None
    town: str | None
    demand: Literal["low", "medium", "high"] | None


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


def _events(session: SessionDep, prop: PropertyDep, channel: str | None) -> list[EventOut]:
    planned = planned_keys(session, prop.id)
    samples = [EventOut(key=e.key, title=e.title, tag=e.tag, start=e.start, end=e.end,
                        action=e.action, rooms=e.rooms, decision=decision_text(e, channel),
                        in_plan=e.key in planned, origin="sample", source_url=None, town=None,
                        demand=None) for e in EVENTS]  # fmt: skip
    own = [
        EventOut.model_validate({
            "key": owner_key(e.id), "title": e.name,
            "tag": CATEGORY_TAGS.get(e.category, "Town event"), "start": e.start_date,
            "end": e.end_date, "action": OWNER_ACTIONS.get(e.demand, "keep"), "rooms": 0,
            "decision": owner_decision_text(e.demand, channel),
            "in_plan": owner_key(e.id) in planned, "origin": e.origin,
            "source_url": e.source_url, "town": e.town, "demand": e.demand,
        })
        for e in owner_events(session, prop.id)
    ]  # fmt: skip
    return sorted(samples + own, key=lambda e: e.start)


def _calendar(session: SessionDep, prop: PropertyDep) -> CalendarOut:
    facts = channel_facts(load_ledger(session, prop.id))
    name = facts.channel_name if facts else None
    return CalendarOut(
        first_month=FIRST_MONTH,
        last_month=LAST_MONTH,
        sample=True,
        events=_events(session, prop, name),
        facts=None if facts is None else FactsOut(
            channel_key=facts.channel_key, channel_name=facts.channel_name,
            channel_net_adr=facts.channel_net_adr, direct_net_adr=facts.direct_net_adr,
            extra_per_room_night=facts.extra_per_room_night),
    )  # fmt: skip


def _known(session: SessionDep, prop: PropertyDep, key: str) -> str:
    if not is_known_key(session, prop.id, key):
        raise ApiError(404, "not_found", "No such event on the calendar.")
    return key


@router.get("", response_model=CalendarOut)
def get_calendar(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> CalendarOut:
    """Sample events Oct 2026 to Jan 2027 and the owner's own events, with decisions."""
    account_of(session, subject)
    return _calendar(session, prop)


@router.post("/plan", response_model=CalendarOut)
def post_plan(
    body: PlanIn, subject: SubjectDep, session: SessionDep, prop: PropertyDep, now: NowDep
) -> CalendarOut:
    """Add an event's channel decision to the plan."""
    account_of(session, subject)
    add_to_plan(session, prop.id, _known(session, prop, body.event_key), now)
    session.flush()
    return _calendar(session, prop)


@router.delete("/plan/{event_key}", response_model=CalendarOut)
def delete_plan(
    event_key: str, subject: SubjectDep, session: SessionDep, prop: PropertyDep
) -> CalendarOut:
    """Take an event off the plan."""
    account_of(session, subject)
    remove_from_plan(session, prop.id, _known(session, prop, event_key))
    session.flush()
    return _calendar(session, prop)
