"""Fixed facts about the fictional sample hotel, Hotel Deodar View (rule 11).

All names, numbers and places of guests are invented sample data.
"""

from __future__ import annotations

from dataclasses import dataclass

PROPERTY = {
    "name": "Hotel Deodar View",
    "short_name": "Deodar View",
    "city": "Mussoorie",
    "address": "Mall Road, Mussoorie",
    "rooms_count": 22,
    "owner_name": "Rajesh",
    "perk_text": "Free breakfast on your next direct stay",
    "code_prefix": "DEODAR",
}

ROOM_TYPES = {
    "Deluxe Valley View": 4300,
    "Standard": 3400,
    "Family Suite": 6200,
}

ROOMS: list[tuple[int, str]] = (
    [(n, "Deluxe Valley View") for n in range(101, 111)]
    + [(n, "Standard") for n in (111, 112, 201, 202, 203, 204, 205, 206)]
    + [(n, "Family Suite") for n in range(207, 211)]
)


@dataclass(frozen=True, slots=True)
class ChannelSpec:
    """A channel's identity, contract terms and locked 6-month totals (rupees)."""

    key: str
    name: str
    kind: str
    sort_order: int
    commission_bps: int
    gst_applies: bool
    upi_fee_applies: bool
    tds_applies: bool
    room_nights: int
    list_amount: int
    discount: int
    commission: int
    gst: int
    fees: int


CHANNELS: tuple[ChannelSpec, ...] = (
    ChannelSpec("mmt", "MakeMyTrip", "ota", 1, 2200, True, False, True,
                620, 2_604_000, 312_480, 504_134, 90_744, 0),
    ChannelSpec("bcom", "Booking.com", "ota", 2, 1800, True, False, True,
                310, 1_364_000, 136_400, 220_968, 39_774, 0),
    ChannelSpec("agoda", "Agoda", "ota", 3, 2000, True, False, True,
                140, 560_000, 84_000, 95_200, 17_136, 0),
    ChannelSpec("ta", "Travel agents", "agent", 4, 1000, False, False, False,
                180, 684_000, 0, 68_400, 0, 0),
    ChannelSpec("walkin", "Walk-in", "walkin", 5, 0, False, False, False,
                90, 405_000, 0, 0, 0, 0),
    ChannelSpec("direct", "Direct", "direct", 6, 0, False, True, False,
                160, 688_000, 0, 0, 0, 2_752),
)  # fmt: skip

CHANNEL_BY_KEY = {c.key: c for c in CHANNELS}

TDS_BPS = 10  # Income-tax TDS u/s 194-O withheld by OTAs: a credit, never a cost.

WINDOW_YEAR = 2026
MONTH_ROOM_NIGHTS = {4: 270, 5: 330, 6: 330, 7: 150, 8: 140, 9: 280}

HISTORY_FILE = "Past stays 2025 (sample)"
