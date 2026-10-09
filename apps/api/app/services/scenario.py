"""The Saturday move: hold some rooms off the channel that leaves the least.

Pure computation on the ledger (D6 is computation, not prediction): for each
room that sells direct instead of on the lowest net-per-room OTA, the hotel
keeps the difference in net ADR. Whether those rooms do sell direct is the
owner's call; the card says so.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.ledger import ChannelSummary, LedgerSummary


class ScenarioError(ValueError):
    """The move cannot be computed (no OTA or no direct sales yet)."""


@dataclass(frozen=True, slots=True)
class SaturdayMove:
    """Before/after per room and the difference for N rooms. Money in paise."""

    rooms: int
    channel_key: str
    channel_name: str
    channel_net_adr: int
    direct_net_adr: int
    extra_per_room: int
    extra_per_saturday: int


def lowest_ota(ledger: LedgerSummary) -> ChannelSummary:
    """The OTA that leaves the least per room night."""
    otas = [c for c in ledger.channels if c.channel.kind == "ota" and c.net_adr is not None]
    if not otas:
        raise ScenarioError("No OTA sales in this period yet")
    return min(otas, key=lambda c: (c.net_adr or 0, c.channel.sort_order))


def direct_channel(ledger: LedgerSummary) -> ChannelSummary:
    """The direct channel with at least one room night."""
    for c in ledger.channels:
        if c.channel.kind == "direct" and c.net_adr is not None:
            return c
    raise ScenarioError("No direct sales in this period yet")


def saturday_move(ledger: LedgerSummary, rooms: int) -> SaturdayMove:
    """Extra kept if `rooms` rooms sell direct instead of on the lowest OTA."""
    if not 1 <= rooms <= ledger.rooms_count:
        raise ScenarioError(f"Rooms must be between 1 and {ledger.rooms_count}")
    ota, direct = lowest_ota(ledger), direct_channel(ledger)
    assert ota.net_adr is not None and direct.net_adr is not None  # noqa: S101 (filtered above)
    per_room = direct.net_adr - ota.net_adr
    return SaturdayMove(
        rooms=rooms,
        channel_key=ota.channel.key,
        channel_name=ota.channel.name,
        channel_net_adr=ota.net_adr,
        direct_net_adr=direct.net_adr,
        extra_per_room=per_room,
        extra_per_saturday=per_room * rooms,
    )
