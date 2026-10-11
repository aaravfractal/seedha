"""Event Radar Lite (owner routes): read a pasted notice, save the owner's
own events, and a simulated morning preview.

Seedha never fetches the pasted address (rule 8). Every event is checked by
plain code before it is shown or saved (services/events.guard), and no rupee
figure is ever produced or stored here (rule 1, D-097).
"""

from __future__ import annotations

import logging
import math
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.deps import PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import OwnerEvent, PlanEntry, Property
from app.ratelimit import GLOBAL_FACTOR, Limit, RateLimiter
from app.routers.auth import NowDep, SubjectDep, account_of
from app.services.calendar import (
    channel_facts,
    owner_decision_hindi,
    owner_decision_text,
    owner_events,
    owner_key,
    planned_keys,
)
from app.services.desk import business_date
from app.services.events import (
    MAX_TEXT,
    MAX_URL,
    SAMPLE_NOTE,
    EventDraft,
    EventReader,
    EventSourceError,
    ExtractUnavailableError,
    PreviewItem,
    Rejection,
    clean_source_url,
    event_reader,
    guard,
    morning_text,
    sample_extraction,
    save_drafts,
    upcoming,
)
from app.services.ledger import load_ledger

logger = logging.getLogger("seedha.events")

router = APIRouter(prefix="/events", tags=["events"])

# Per signed-in owner: each extract may call Claude once.
EXTRACT_LIMIT = Limit(5, 60)
EXTRACT_BUCKET = "events_extract"

Category = Literal[
    "festival", "fair", "religious", "sports", "music", "conference", "holiday", "other"
]
Demand = Literal["low", "medium", "high"]
Origin = Literal["owner_source", "sample_extraction"]


class EventDraftOut(BaseModel):
    """One checked event (not saved yet)."""

    name: str
    start_date: date
    end_date: date
    town: str
    category: Category
    demand: Demand
    source_url: str


class RejectedOut(BaseModel):
    """An item that was dropped, and why. `name` is null when unsafe to show."""

    index: int
    name: str | None
    reason: str


class ExtractIn(BaseModel):
    """The pasted notice and the owner's source address."""

    text: str = Field(min_length=1, max_length=MAX_TEXT)
    source_url: str = Field(min_length=1, max_length=MAX_URL)


class ExtractOut(BaseModel):
    """Checked drafts. `mode` is "sample" without a Claude key (labelled by `note`)."""

    mode: Literal["claude", "sample"]
    note: str | None
    events: list[EventDraftOut]
    rejected: list[RejectedOut]


class EventDraftIn(BaseModel):
    """A draft sent back to save. Loose types: the guard gives the reasons."""

    name: str = Field(default="", max_length=500)
    start_date: str = Field(default="", max_length=40)
    end_date: str = Field(default="", max_length=40)
    town: str = Field(default="", max_length=500)
    category: str = Field(default="", max_length=40)
    demand: str = Field(default="", max_length=40)
    source_url: str | None = Field(default=None, max_length=MAX_URL)


class SaveIn(BaseModel):
    """Drafts to save. The stored source is always `source_url` (the owner's)."""

    source_url: str = Field(min_length=1, max_length=MAX_URL)
    events: list[EventDraftIn] = Field(max_length=50)
    origin: Origin = "owner_source"


class OwnerEventOut(EventDraftOut):
    """A saved owner event."""

    id: int
    origin: Origin
    created_at: datetime
    in_plan: bool
    plan_key: str


class SaveOut(BaseModel):
    """What was saved and what was not."""

    saved: list[OwnerEventOut]
    rejected: list[RejectedOut]


class PreviewOut(BaseModel):
    """The owner's morning message for the next 14 days (not sent)."""

    en: str
    hi: str
    simulated: bool
    count: int


class PreviewSentOut(BaseModel):
    """A simulated send: nothing leaves Seedha."""

    status: Literal["simulated"]
    sent_at: datetime
    count: int
    note: str


def get_event_reader(request: Request, settings: SettingsDep) -> EventReader | None:
    """Claude reader (None without a key); tests override app.state.event_reader."""
    override: EventReader | None = getattr(request.app.state, "event_reader", None)
    if override is not None:
        return override
    return event_reader(settings)


EventReaderDep = Annotated[EventReader | None, Depends(get_event_reader)]


def extract_limited(request: Request, subject: SubjectDep) -> None:
    """429 when this owner (or every owner together) is over 5 extracts a minute."""
    limiter: RateLimiter = request.app.state.rate_limiter
    ceiling = Limit(EXTRACT_LIMIT.count * GLOBAL_FACTOR, EXTRACT_LIMIT.seconds)
    wait = limiter.check(EXTRACT_BUCKET, subject, EXTRACT_LIMIT) or limiter.check(
        EXTRACT_BUCKET, "*", ceiling
    )
    if wait > 0:
        raise ApiError(
            429,
            "too_many_requests",
            "Too many tries. Please wait a minute and try again.",
            headers={"Retry-After": str(math.ceil(wait))},
        )


def _source(raw: str) -> str:
    try:
        return clean_source_url(raw)
    except EventSourceError as exc:
        raise ApiError(422, "bad_source_url", str(exc)) from exc


def _today(session: Session, prop: Property, now: datetime) -> date:
    return business_date(session, prop.id, now.date())


def _draft_out(draft: EventDraft) -> EventDraftOut:
    return EventDraftOut.model_validate(draft, from_attributes=True)


def _rejected_out(items: list[Rejection]) -> list[RejectedOut]:
    return [RejectedOut(index=r.index, name=r.name, reason=r.reason) for r in items]


def _event_out(event: OwnerEvent, planned: set[str]) -> OwnerEventOut:
    key = owner_key(event.id)
    return OwnerEventOut.model_validate({
        "id": event.id, "name": event.name, "start_date": event.start_date,
        "end_date": event.end_date, "town": event.town, "category": event.category,
        "demand": event.demand, "source_url": event.source_url, "origin": event.origin,
        "created_at": event.created_at, "in_plan": key in planned, "plan_key": key,
    })  # fmt: skip


@router.post(
    "/extract", response_model=ExtractOut, dependencies=[Depends(extract_limited)]
)  # fmt: skip
def extract_events(
    body: ExtractIn,
    subject: SubjectDep,
    session: SessionDep,
    prop: PropertyDep,
    now: NowDep,
    reader: EventReaderDep,
) -> ExtractOut:
    """Read the pasted notice into checked drafts. Saves nothing."""
    account_of(session, subject)
    source = _source(body.source_url)
    if not body.text.strip():
        raise ApiError(422, "empty_notice", "Paste the text of the notice.")
    today = _today(session, prop, now)
    if reader is None:
        kept, rejected = guard(sample_extraction(source), source, today)
        return ExtractOut(mode="sample", note=SAMPLE_NOTE, events=[_draft_out(d) for _, d in kept],
                          rejected=_rejected_out(rejected))  # fmt: skip
    try:
        items = reader.read(body.text, source, today, prop.city)
    except ExtractUnavailableError as exc:
        raise ApiError(
            503, "extract_unavailable", "Claude could not read this notice right now. Try again."
        ) from exc
    kept, rejected = guard(items, source, today)
    return ExtractOut(mode="claude", note=None, events=[_draft_out(d) for _, d in kept],
                      rejected=_rejected_out(rejected))  # fmt: skip


@router.post("", response_model=SaveOut)
def save_events(
    body: SaveIn, subject: SubjectDep, session: SessionDep, prop: PropertyDep, now: NowDep
) -> SaveOut:
    """Check the drafts again and save the good ones for this property."""
    account_of(session, subject)
    source = _source(body.source_url)
    kept, rejected = guard([e.model_dump() for e in body.events], source,
                           _today(session, prop, now))  # fmt: skip
    saved, refused = save_drafts(session, prop.id, kept, body.origin, now)
    rejected = sorted(rejected + refused, key=lambda r: r.index)
    session.flush()
    planned = planned_keys(session, prop.id)
    return SaveOut(saved=[_event_out(e, planned) for e in saved], rejected=_rejected_out(rejected))


@router.get("", response_model=list[OwnerEventOut])
def list_events(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> list[OwnerEventOut]:
    """This property's own events, earliest first."""
    account_of(session, subject)
    planned = planned_keys(session, prop.id)
    return [_event_out(e, planned) for e in owner_events(session, prop.id)]


@router.delete("/{event_id}", response_model=list[OwnerEventOut])
def delete_event(
    event_id: int, subject: SubjectDep, session: SessionDep, prop: PropertyDep
) -> list[OwnerEventOut]:
    """Remove one of this property's events (and its plan entry)."""
    account_of(session, subject)
    event = session.get(OwnerEvent, event_id)
    if event is None or event.property_id != prop.id:
        raise ApiError(404, "not_found", "No such event.")
    session.execute(
        delete(PlanEntry).where(
            PlanEntry.property_id == prop.id, PlanEntry.event_key == owner_key(event.id)
        )
    )
    session.delete(event)
    session.flush()
    return list_events(subject, session, prop)


def _preview(session: Session, prop: Property, now: datetime) -> tuple[str, str, int]:
    today = _today(session, prop, now)
    facts = channel_facts(load_ledger(session, prop.id))
    channel = facts.channel_name if facts else None
    planned = planned_keys(session, prop.id)
    items = [
        PreviewItem(name=e.name, town=e.town, start=e.start_date, end=e.end_date,
                    decision_en=owner_decision_text(e.demand, channel),
                    decision_hi=owner_decision_hindi(e.demand, channel),
                    in_plan=owner_key(e.id) in planned)
        for e in owner_events(session, prop.id)
        if upcoming(e.start_date, e.end_date, today)
    ]  # fmt: skip
    en, hi = morning_text(prop.owner_name, items)
    return en, hi, len(items)


@router.get("/morning-preview", response_model=PreviewOut)
def morning_preview(
    subject: SubjectDep, session: SessionDep, prop: PropertyDep, now: NowDep
) -> PreviewOut:
    """The owner's morning WhatsApp text for the next 14 days (preview only)."""
    account_of(session, subject)
    en, hi, count = _preview(session, prop, now)
    return PreviewOut(en=en, hi=hi, simulated=True, count=count)


@router.post("/morning-preview/send", response_model=PreviewSentOut)
def send_morning_preview(
    subject: SubjectDep, session: SessionDep, prop: PropertyDep, now: NowDep
) -> PreviewSentOut:
    """Log a simulated send. WhatsApp is never called here, even with keys set."""
    account_of(session, subject)
    _en, _hi, count = _preview(session, prop, now)
    logger.info("Morning preview: simulated send (%d events), nothing sent", count)
    return PreviewSentOut(status="simulated", sent_at=now, count=count,
                          note="Simulated send. Nothing was sent on WhatsApp.")  # fmt: skip
