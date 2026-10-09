"""GET /ledger/channels and /ledger/monthly (CLAUDE.md M3 check)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.money import LineItems, rupees
from app.services.insight import build_insight, ordinal
from app.services.ledger import ChannelInfo, LedgerRow, summarise


@pytest.fixture(name="flip")
def fixture_flip(client: TestClient, owner: dict[str, str], sample: object) -> dict[str, Any]:
    _ = sample
    res = client.get("/ledger/channels", headers=owner)
    assert res.status_code == 200
    body: dict[str, Any] = res.json()
    return body


def by_key(flip: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {c["key"]: c for c in flip["channels"]}


def test_totals_match_the_locked_numbers(flip: dict[str, Any]) -> None:
    t = flip["totals"]
    assert t["paid_to_channels"] == rupees(10_39_108)
    assert t["lost_vs_list_price"] == rupees(15_71_988)
    assert t["net_kept"] == rupees(47_33_012)
    assert t["list_revenue"] == rupees(63_05_000)
    assert t["room_nights"] == 1_500
    assert (flip["counted_rows"], flip["excluded_rows"]) == (1_497, 3)
    assert (flip["start"], flip["end"], flip["days"]) == ("2026-04-01", "2026-09-30", 183)


def test_channels_and_rankings(flip: dict[str, Any]) -> None:
    c = by_key(flip)
    assert c["mmt"]["net_adr"] == rupees(2_737)
    assert c["direct"]["net_adr"] == rupees(4_283)
    assert c["mmt"]["net_kept"] == rupees(16_96_642)
    assert c["direct"]["paid_to_channels"] == rupees(2_752)
    assert c["walkin"]["lost_vs_list_price"] == 0
    assert flip["rank_by_bookings"][0] == "mmt"
    assert flip["rank_by_money_kept"].index("mmt") + 1 == 5


def test_shares_and_revpar(flip: dict[str, Any]) -> None:
    assert flip["direct_bookings_tenths"] == 107
    assert flip["commission_free_share_tenths"] == 167
    assert flip["paid_to_channels_share_tenths"] == 165
    assert (flip["revpar_list"], flip["revpar_net"]) == (rupees(1_566), rupees(1_176))


def test_insight_is_true_for_the_data(flip: dict[str, Any]) -> None:
    insight = flip["insight"]
    assert (
        insight["en"]
        == "MakeMyTrip brought the most bookings, but 4 channels left you more per room."
    )
    assert insight["hi"].startswith("MakeMyTrip ne sabse zyada bookings di")
    assert insight["move_en"] == "MakeMyTrip drops from 1st to 5th"
    assert "₹" not in insight["en"]


def test_no_api_field_uses_the_bare_word_lost(flip: dict[str, Any]) -> None:
    keys = set(flip) | set(flip["totals"]) | set(flip["channels"][0])
    assert {k for k in keys if "lost" in k} == {"lost_vs_list_price"}


def test_monthly_sums_to_the_totals(
    client: TestClient, owner: dict[str, str], flip: dict[str, Any]
) -> None:
    months = client.get("/ledger/monthly", headers=owner).json()
    assert sum(m["paid_to_channels"] for m in months) == flip["totals"]["paid_to_channels"]
    assert sum(m["net_kept"] for m in months) == flip["totals"]["net_kept"]
    nights: dict[str, int] = {}
    for m in months:
        nights[m["month"]] = nights.get(m["month"], 0) + m["room_nights"]
    assert nights == {"2026-04": 270, "2026-05": 330, "2026-06": 330, "2026-07": 150,
                      "2026-08": 140, "2026-09": 280}  # fmt: skip
    sept_mmt = next(m for m in months if m["month"] == "2026-09" and m["channel"] == "mmt")
    assert sept_mmt["paid_to_channels"] == rupees(1_09_542)


@pytest.mark.usefixtures("sample")
def test_custom_range(client: TestClient, owner: dict[str, str]) -> None:
    july = client.get("/ledger/channels?start=2026-07-01&end=2026-07-31", headers=owner).json()
    assert july["totals"]["room_nights"] == 150
    assert july["days"] == 31


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    "query",
    ["start=2026-09-30&end=2026-04-01", "start=2025-01-01&end=2026-09-30", "start=yesterday"],
)
def test_bad_ranges(client: TestClient, owner: dict[str, str], query: str) -> None:
    res = client.get(f"/ledger/channels?{query}", headers=owner)
    assert res.status_code == 422
    assert client.get(f"/ledger/monthly?{query}", headers=owner).status_code == 422


@pytest.mark.usefixtures("base_sample")
def test_empty_ledger_before_upload(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/ledger/channels", headers=owner).json()
    assert body["totals"]["room_nights"] == 0
    assert body["insight"] is None
    assert body["direct_bookings_tenths"] is None
    assert client.get("/ledger/monthly", headers=owner).json() == []


@pytest.mark.usefixtures("sample")
def test_ledger_needs_owner(client: TestClient) -> None:
    assert client.get("/ledger/channels").status_code == 401
    assert client.get("/ledger/monthly").status_code == 401


def _ledger(rows: list[LedgerRow]) -> Any:
    infos = [ChannelInfo("a", "Alpha", "ota", 1), ChannelInfo("b", "Beta", "direct", 2),
             ChannelInfo("c", "Gamma", "ota", 3)]  # fmt: skip
    return summarise(infos, rows, rooms_count=10)


def stay(key: str, nights: int, list_rupees: int, commission: int) -> LedgerRow:
    return LedgerRow(key, True, nights, LineItems(rupees(list_rupees), 0, rupees(commission)))


def test_insight_variants() -> None:
    top_and_best = build_insight(_ledger([stay("a", 5, 5000, 0), stay("b", 1, 100, 0)]))
    assert top_and_best is not None
    assert top_and_best.en == "Alpha brought the most bookings and also left you the most per room."
    assert top_and_best.move_en == ""
    worst = build_insight(_ledger([stay("a", 5, 500, 0), stay("b", 1, 1000, 0)]))
    assert worst is not None
    assert worst.en == "Alpha brought the most bookings but left you the least per room."
    middle = build_insight(
        _ledger([stay("a", 5, 1000, 0), stay("b", 1, 2000, 0), stay("c", 1, 100, 0)])
    )
    assert middle is not None
    assert middle.en == "Alpha brought the most bookings, but 1 channel left you more per room."
    assert build_insight(_ledger([])) is None
    assert ordinal(2) == "2nd"
    assert ordinal(11) == "#11"
