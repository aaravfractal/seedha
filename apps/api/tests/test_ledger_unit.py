"""Ledger aggregation on small hand-built inputs."""

from __future__ import annotations

from dataclasses import fields
from datetime import date

import pytest

from app.money import LineItems, rupees
from app.services.ledger import (
    ChannelInfo,
    ChannelSummary,
    LedgerError,
    LedgerRow,
    LedgerSummary,
    days_in_range,
    summarise,
)

OTA = ChannelInfo("ota", "OTA", "ota", 1)
DIRECT = ChannelInfo("direct", "Direct", "direct", 2)
WALKIN = ChannelInfo("walkin", "Walk-in", "walkin", 3)
EMPTY = ChannelInfo("ta", "Agents", "agent", 4)


def stay(key: str, nights: int, list_rupees: int, commission: int = 0) -> LedgerRow:
    return LedgerRow(key, True, nights, LineItems(rupees(list_rupees), 0, rupees(commission)))


def test_summary_shares_and_ranks() -> None:
    rows = [
        stay("ota", 3, 12_000, 2_000),
        stay("direct", 1, 4_000),
        stay("walkin", 1, 4_500),
        LedgerRow("ota", False, 1, LineItems(0, 0, rupees(100))),  # cancellation line
    ]
    s = summarise([OTA, DIRECT, WALKIN, EMPTY], rows, rooms_count=2,
                  start=date(2026, 4, 1), end=date(2026, 4, 2))  # fmt: skip
    ota = s.channels[0]
    assert ota.room_nights == 3
    assert ota.stays == 1
    assert ota.lines.commission == rupees(2_100)
    assert ota.net_adr == rupees(3_300)
    assert s.room_nights == 5
    assert s.direct_bookings_tenths == 200
    assert s.commission_free_share_tenths == 400
    assert s.revpar_list == rupees(5_125)
    assert s.rank_by_bookings == ("ota", "direct", "walkin", "ta")
    assert s.rank_by_money_kept == ("walkin", "direct", "ota", "ta")
    empty = s.channels[3]
    assert empty.net_adr is None
    assert empty.kept_share_tenths is None


def test_no_rows_gives_none_shares() -> None:
    s = summarise([OTA], [], rooms_count=1, start=date(2026, 4, 1), end=date(2026, 4, 1))
    assert s.direct_bookings_tenths is None
    assert s.paid_to_channels_share_tenths is None
    assert s.revpar_net == 0


def test_errors() -> None:
    with pytest.raises(LedgerError):
        days_in_range(date(2026, 4, 2), date(2026, 4, 1))
    with pytest.raises(LedgerError):
        summarise([OTA], [], rooms_count=0)
    with pytest.raises(LedgerError):
        summarise([OTA], [stay("nope", 1, 100)], rooms_count=1)


def test_default_range_is_apr_to_sep_2026() -> None:
    s = summarise([OTA], [], rooms_count=22)
    assert (s.start, s.end, s.days) == (date(2026, 4, 1), date(2026, 9, 30), 183)


def test_no_field_uses_the_bare_word_lost_ruling_2() -> None:
    for cls in (LedgerSummary, ChannelSummary, LineItems):
        for f in fields(cls):
            assert "lost" not in f.name or f.name == "lost_vs_list_price"
