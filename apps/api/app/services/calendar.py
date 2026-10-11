"""Seedha Pulse calendar: sample town events, each with one channel decision.

Pulse is a channel decision, never a demand prediction (handoff README rule
7). The events are sample data (D10): dates other than the Winter Line
Carnival are illustrative and labelled "Sample" on screen. The only rupee
figure is computed from the ledger: what each room night keeps on direct
versus the OTA that leaves the least (the same sum as the Saturday move).

Owner events (Event Radar Lite, D-097) sit beside the samples under the key
"own-<id>". Their decision is fixed wording chosen by code from the demand
read from the owner's own source: never a number of rooms, never a rate.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import OwnerEvent, PlanEntry
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
OWN_PREFIX = "own-"
OWN_KEY = re.compile(r"own-([1-9]\d{0,9})")

# Owner events: demand (from the owner's source) -> action. Rooms are never
# chosen by Seedha for these; the wording says "some rooms".
OWNER_ACTIONS = {"high": "no_discount", "medium": "hold", "low": "keep"}
CATEGORY_TAGS = {
    "festival": "Festival",
    "fair": "Fair",
    "religious": "Religious",
    "sports": "Sports",
    "music": "Music",
    "conference": "Conference",
    "holiday": "Holiday",
    "other": "Town event",
}


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


def owner_key(event_id: int) -> str:
    """The plan key of an owner event."""
    return f"{OWN_PREFIX}{event_id}"


def owner_decision_text(demand: str, channel_name: str | None) -> str:
    """The fixed one-line decision for an owner event (no numbers, no rates)."""
    action = OWNER_ACTIONS.get(demand, "keep")
    if action == "no_discount":
        return "Stop OTA discounts for these dates and keep some rooms for direct guests."
    if action == "hold":
        source = channel_name or "your lowest paying OTA"
        return f"Hold some rooms off {source} for these dates. Sell them direct and at the desk."
    return "Keep your usual channel mix for these dates."


def owner_decision_hindi(demand: str, channel_name: str | None) -> str:
    """The same decision in Hindi, for the morning preview."""
    action = OWNER_ACTIONS.get(demand, "keep")
    if action == "no_discount":
        return "इन तारीख़ों में OTA छूट बंद करें और कुछ कमरे सीधे आने वाले मेहमानों के लिए रखें।"
    if action == "hold":
        source = channel_name or "सबसे कम देने वाले OTA"
        return f"इन तारीख़ों में कुछ कमरे {source} से हटाकर रखें। उन्हें सीधे और डेस्क पर बेचें।"
    return "इन तारीख़ों में अपना सामान्य चैनल मिक्स रखें।"


def owner_events(session: Session, property_id: int) -> list[OwnerEvent]:
    """The property's own events, earliest first."""
    return list(
        session.scalars(
            select(OwnerEvent)
            .where(OwnerEvent.property_id == property_id)
            .order_by(OwnerEvent.start_date, OwnerEvent.id)
        )
    )


def is_known_key(session: Session, property_id: int, key: str) -> bool:
    """A sample event key, or "own-<id>" of this property's own event."""
    if key in EVENT_KEYS:
        return True
    match = OWN_KEY.fullmatch(key)
    if match is None:
        return False
    event = session.get(OwnerEvent, int(match.group(1)))
    return event is not None and event.property_id == property_id


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
