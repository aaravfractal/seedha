"""My Place: an illustration of what each room keeps in a month.

The model (design handoff, DATA "My Place model"):

* Rooms are assigned a main channel in proportion to the statement mix
  (room nights by channel), largest remainder first, then spread across the
  floors with a smooth weighted round robin so no floor is all one channel.
* Nights per room = round(30 x occupancy), half-up.
* Room net = nights x that channel's net ADR from the ledger.
* Room profit = net - nights x cost per occupied night - its share of the
  fixed monthly costs (fixed / rooms, split to whole rupees so the shares add
  up to the fixed total exactly).
* Break-even rooms = ceil(fixed / average(net - room cost)).

It is an illustration from the statements mix, not a room-by-room record:
the statements do not say which physical room each guest slept in. Costs are
owner inputs; when absent, labelled sample defaults are used (D10, rule 11).
All money is integer paise; only the ledger's rupee-rounded net ADRs and
whole-rupee inputs are multiplied, so every figure stays a whole rupee.
"""

from __future__ import annotations

import calendar
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from fractions import Fraction
from math import ceil
from typing import Literal

from app.money import PAISE_PER_RUPEE, rupees, share_tenths_of_percent
from app.services.ledger import DEFAULT_END, DEFAULT_START, LedgerSummary

NIGHTS_BASIS = 30
SAMPLE_COST_PER_NIGHT = rupees(900)
SAMPLE_FIXED_MONTHLY = rupees(4_50_000)
ROOMS_PER_SYNTHETIC_FLOOR = 10
SEASON = "season"
DECEMBER = 12

Source = Literal["owner", "onboarding", "sample"]


class MyPlaceError(ValueError):
    """Raised for an invalid My Place request, such as an unknown month."""


@dataclass(frozen=True, slots=True)
class RoomSpec:
    """A physical room as the model needs it."""

    number: int
    room_type: str

    @property
    def floor(self) -> int:
        return self.number // 100


@dataclass(frozen=True, slots=True)
class MixEntry:
    """One channel's share of the statements (stays only)."""

    key: str
    name: str
    room_nights: int
    net_adr: int | None
    sort_order: int


@dataclass(frozen=True, slots=True)
class Costs:
    """Owner cost inputs in paise, with where each came from."""

    cost_per_night: int
    cost_source: Source
    fixed_monthly: int
    fixed_source: Source


@dataclass(frozen=True, slots=True)
class RoomResult:
    """One room's month."""

    number: int
    floor: int
    room_type: str
    channel_key: str
    channel_name: str
    nights: int
    net: int
    variable_cost: int
    fixed_share: int
    profit: int


@dataclass(frozen=True, slots=True)
class ChannelResult:
    """Rooms given to one channel."""

    key: str
    name: str
    rooms: int
    net_adr: int
    nights_share_tenths: int


@dataclass(frozen=True, slots=True)
class FloorResult:
    """Profit on one floor."""

    floor: int
    rooms: int
    rooms_in_profit: int
    profit: int


@dataclass(frozen=True, slots=True)
class Place:
    """Every figure on the My Place screen for one month."""

    occupancy_tenths: int
    nights_per_room: int
    rooms: tuple[RoomResult, ...]
    channels: tuple[ChannelResult, ...]
    floors: tuple[FloorResult, ...]
    net_kept: int
    variable_costs: int
    fixed_costs: int
    profit: int
    rooms_in_profit: int
    break_even_rooms: int | None


@dataclass(frozen=True, slots=True)
class MonthOption:
    """A month the owner can pick, or the season average."""

    key: str
    label: str
    start: date
    end: date


def month_options(start: date = DEFAULT_START, end: date = DEFAULT_END) -> tuple[MonthOption, ...]:
    """The season average first, then each calendar month of the range."""
    options = [MonthOption(SEASON, _season_label(start, end), start, end)]
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        last = calendar.monthrange(year, month)[1]
        first_day = max(date(year, month, 1), start)
        last_day = min(date(year, month, last), end)
        label = f"{calendar.month_name[month]} {year}"
        options.append(MonthOption(f"{year:04d}-{month:02d}", label, first_day, last_day))
        year, month = (year + 1, 1) if month == DECEMBER else (year, month + 1)
    return tuple(options)


def _season_label(start: date, end: date) -> str:
    first = calendar.month_abbr[start.month]
    last = calendar.month_abbr[end.month]
    return f"Typical month, {first} to {last} {end.year}"


def find_month(key: str | None) -> MonthOption:
    """The option for a key; None means the season average."""
    wanted = key or SEASON
    for option in month_options():
        if option.key == wanted:
            return option
    raise MyPlaceError(f"month must be one of the statement months, got {wanted}")


def mix_from_ledger(summary: LedgerSummary) -> tuple[MixEntry, ...]:
    """Channels with stays in the range, in the ledger's fixed order."""
    return tuple(
        MixEntry(c.channel.key, c.channel.name, c.room_nights, c.net_adr, c.channel.sort_order)
        for c in summary.channels
        if c.room_nights > 0 and c.net_adr is not None
    )


def nights_per_room(room_nights: int, rooms_count: int, days: int) -> int:
    """round(30 x occupancy), half-up, where occupancy = nights / (rooms x days)."""
    if rooms_count <= 0 or days <= 0:
        raise MyPlaceError("rooms and days must be positive")
    exact = Fraction(NIGHTS_BASIS * room_nights, rooms_count * days)
    return min(int(exact + Fraction(1, 2)), NIGHTS_BASIS)


def rooms_by_channel(mix: Sequence[MixEntry], rooms_count: int) -> dict[str, int]:
    """Split the rooms in proportion to room nights (largest remainder).

    Ties on the remainder go to the channel with more nights, then the
    channel's fixed sort order, so the split is deterministic.
    """
    total = sum(m.room_nights for m in mix)
    if total <= 0 or rooms_count <= 0:
        return {}
    quotas = {m.key: Fraction(m.room_nights * rooms_count, total) for m in mix}
    counts = {key: int(q) for key, q in quotas.items()}
    left = rooms_count - sum(counts.values())
    order = sorted(
        mix, key=lambda m: (-(quotas[m.key] - counts[m.key]), -m.room_nights, m.sort_order)
    )
    for entry in order[:left]:
        counts[entry.key] += 1
    return counts


def spread(mix: Sequence[MixEntry], counts: dict[str, int]) -> list[str]:
    """A channel key per room slot: smooth weighted round robin over counts."""
    total = sum(counts.values())
    current = dict.fromkeys(counts, 0)
    rank = {m.key: (-m.room_nights, m.sort_order) for m in mix}
    out: list[str] = []
    for _ in range(total):
        for key in current:
            current[key] += counts[key]
        pick = max(current, key=lambda k: (current[k], tuple(-v for v in rank[k])))
        current[pick] -= total
        out.append(pick)
    return out


def split_fixed(fixed_paise: int, rooms_count: int) -> list[int]:
    """Fixed costs per room in whole rupees, adding up to the total exactly.

    The first rooms (lowest numbers) carry the extra rupee of any remainder.
    """
    whole_rupees = fixed_paise // PAISE_PER_RUPEE
    base, extra = divmod(whole_rupees, rooms_count)
    return [rupees(base + (1 if i < extra else 0)) for i in range(rooms_count)]


def break_even_rooms(fixed_paise: int, contributions: Sequence[int]) -> int | None:
    """ceil(fixed / average contribution); None when rooms do not cover their cost."""
    if not contributions:
        return None
    total = sum(contributions)
    if total <= 0:
        return None
    if fixed_paise == 0:
        return 0
    return ceil(Fraction(fixed_paise * len(contributions), total))


def synthetic_rooms(rooms_count: int) -> list[RoomSpec]:
    """Room numbers 101, 102 ... when a property has no room list."""
    return [
        RoomSpec(
            (1 + i // ROOMS_PER_SYNTHETIC_FLOOR) * 100 + 1 + i % ROOMS_PER_SYNTHETIC_FLOOR, "Room"
        )
        for i in range(rooms_count)
    ]


def build_place(
    rooms: Sequence[RoomSpec],
    mix: Sequence[MixEntry],
    room_nights: int,
    days: int,
    costs: Costs,
) -> Place:
    """Run the model for one period."""
    if not rooms:
        raise MyPlaceError("the property has no rooms")
    if costs.cost_per_night < 0 or costs.fixed_monthly < 0:
        raise MyPlaceError("costs must not be negative")
    ordered = sorted(rooms, key=lambda r: r.number)
    count = len(ordered)
    nights = nights_per_room(room_nights, count, days)
    counts = rooms_by_channel(mix, count)
    slots = spread(mix, counts)
    by_key = {m.key: m for m in mix}
    shares = split_fixed(costs.fixed_monthly, count)

    results: list[RoomResult] = []
    for room, key, fixed_share in zip(ordered, slots, shares, strict=True):
        entry = by_key[key]
        net_adr = entry.net_adr or 0
        net = nights * net_adr
        variable = nights * costs.cost_per_night
        results.append(
            RoomResult(
                number=room.number,
                floor=room.floor,
                room_type=room.room_type,
                channel_key=key,
                channel_name=entry.name,
                nights=nights,
                net=net,
                variable_cost=variable,
                fixed_share=fixed_share,
                profit=net - variable - fixed_share,
            )
        )

    floors: list[FloorResult] = []
    for floor in sorted({r.floor for r in results}):
        on_floor = [r for r in results if r.floor == floor]
        floors.append(
            FloorResult(
                floor=floor,
                rooms=len(on_floor),
                rooms_in_profit=sum(1 for r in on_floor if r.profit > 0),
                profit=sum(r.profit for r in on_floor),
            )
        )

    mix_nights = sum(m.room_nights for m in mix)
    channels = tuple(
        ChannelResult(
            key=m.key,
            name=m.name,
            rooms=counts.get(m.key, 0),
            net_adr=m.net_adr or 0,
            nights_share_tenths=share_tenths_of_percent(m.room_nights, mix_nights),
        )
        for m in mix
    )
    net_kept = sum(r.net for r in results)
    variable_costs = sum(r.variable_cost for r in results)
    return Place(
        occupancy_tenths=share_tenths_of_percent(room_nights, count * days),
        nights_per_room=nights,
        rooms=tuple(results),
        channels=channels,
        floors=tuple(floors),
        net_kept=net_kept,
        variable_costs=variable_costs,
        fixed_costs=costs.fixed_monthly,
        profit=net_kept - variable_costs - costs.fixed_monthly,
        rooms_in_profit=sum(1 for r in results if r.profit > 0),
        break_even_rooms=break_even_rooms(
            costs.fixed_monthly, [r.net - r.variable_cost for r in results]
        ),
    )


def resolve_costs(
    cost_per_night_rupees: int | None,
    fixed_monthly_rupees: int | None,
    onboarding_cost_paise: int | None,
) -> Costs:
    """Owner inputs first, then the onboarding answer, then sample defaults."""
    cost_source: Source = "sample"
    cost = SAMPLE_COST_PER_NIGHT
    if cost_per_night_rupees is not None:
        cost_source, cost = "owner", rupees(cost_per_night_rupees)
    elif onboarding_cost_paise is not None:
        cost_source, cost = "onboarding", onboarding_cost_paise
    fixed_source: Source = "sample"
    fixed = SAMPLE_FIXED_MONTHLY
    if fixed_monthly_rupees is not None:
        fixed_source, fixed = "owner", rupees(fixed_monthly_rupees)
    return Costs(cost, cost_source, fixed, fixed_source)
