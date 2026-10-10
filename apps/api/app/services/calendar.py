"""Seedha Pulse calendar: sample town events, each with one channel decision.

Pulse is a channel decision, never a demand prediction (handoff README rule
7). The events are sample data (D10): dates other than the Winter Line
Carnival are illustrative and labelled "Sample" on screen. The only rupee
figure is computed from the ledger: what each room night keeps on direct
versus the OTA that leaves the least (the same sum as the Saturday move).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import PlanEntry
from app.services.ledger import LedgerSummary
from app.services.scenario import ScenarioError, direct_channel, lowest_ota

FIRST_MONTH = date(2026, 10, 1)
LAST_MONTH = date(2027, 1, 1)


@dataclass(frozen=True, slots=True)
class SampleEvent:
    """One sample event. `action` is "no_discount" or "hold"."""

    key: str
    title: str
    tag: str
    start: date
    end: date
    action: str
    rooms: int


EVENTS: tuple[SampleEvent, ...] = (
    SampleEvent("autumn-food-walk", "Mall Road food walk", "Town event",
                date(2026, 10, 24), date(2026, 10, 25), "hold", 3),
    SampleEvent("diwali-weekend", "Diwali weekend", "Festival",
                date(2026, 11, 7), date(2026, 11, 9), "hold", 4),
    SampleEvent("winter-line-carnival", "Winter Line Carnival", "Town event",
                date(2026, 12, 25), date(2026, 12, 30), "no_discount", 6),
    SampleEvent("new-year", "New Year long weekend", "Long weekend",
                date(2026, 12, 31), date(2027, 1, 3), "hold", 6),
    SampleEvent("republic-day", "Republic Day weekend", "Long weekend",
                date(2027, 1, 23), date(2027, 1, 26), "hold", 4),
)  # fmt: skip
EVENT_KEYS = frozenset(e.key for e in EVENTS)


@dataclass(frozen=True, slots=True)
class ChannelFacts:
    """Ledger facts every decision uses (paise). None when there is no ledger yet."""

    channel_key: str
    channel_name: str
    channel_net_adr: int
    direct_net_adr: int
    extra_per_room_night: int


def channel_facts(ledger: LedgerSummary) -> ChannelFacts | None:
    """The lowest net-per-room OTA and what direct keeps instead."""
    try:
        ota, direct = lowest_ota(ledger), direct_channel(ledger)
    except ScenarioError:
        return None
    assert ota.net_adr is not None and direct.net_adr is not None  # noqa: S101 (filtered)
    return ChannelFacts(
        channel_key=ota.channel.key,
        channel_name=ota.channel.name,
        channel_net_adr=ota.net_adr,
        direct_net_adr=direct.net_adr,
        extra_per_room_night=direct.net_adr - ota.net_adr,
    )


def decision_text(event: SampleEvent, channel_name: str | None) -> str:
    """The one-line channel decision (no numbers from any model)."""
    rooms = f"{event.rooms} rooms"
    if event.action == "no_discount":
        return f"Stop OTA discounts for these dates and keep {rooms} for direct guests."
    source = channel_name or "your lowest paying OTA"
    return f"Hold {rooms} off {source} for these dates. Sell them direct and at the desk."


def planned_keys(session: Session, property_id: int) -> set[str]:
    """Events the owner added to their plan."""
    return set(
        session.scalars(select(PlanEntry.event_key).where(PlanEntry.property_id == property_id))
    )


def add_to_plan(session: Session, property_id: int, key: str, now: datetime) -> None:
    """Add an event to the plan (adding twice is harmless)."""
    if key in planned_keys(session, property_id):
        return
    try:
        with session.begin_nested():
            session.add(PlanEntry(property_id=property_id, event_key=key, added_at=now))
    except IntegrityError:
        return  # a racing request added it first


def remove_from_plan(session: Session, property_id: int, key: str) -> None:
    """Take an event off the plan."""
    session.execute(
        delete(PlanEntry).where(PlanEntry.property_id == property_id, PlanEntry.event_key == key)
    )
