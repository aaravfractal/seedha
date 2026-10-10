"""GET /overview: the Overview screen equals the ledger's locked totals."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.money import rupees
from app.services.overview import owner_initials
from tests.test_winback_flow import consent_and_checkout


@pytest.fixture(name="ov")
def fixture_ov(client: TestClient, owner: dict[str, str], sample: object) -> dict[str, Any]:
    _ = sample
    res = client.get("/overview", headers=owner)
    assert res.status_code == 200
    body: dict[str, Any] = res.json()
    return body


def test_kpis_equal_the_locked_totals(ov: dict[str, Any]) -> None:
    k = ov["kpis"]
    assert ov["has_statements"] is True
    assert k["list_revenue"] == rupees(63_05_000)
    assert k["net_kept"] == rupees(47_33_012)
    assert k["paid_to_channels"] == rupees(10_39_108)
    assert k["paid_to_channels_share_tenths"] == 165
    assert k["commission_free_share_tenths"] == 167
    assert k["direct_bookings_tenths"] == 107
    assert (k["revpar_list"], k["revpar_net"]) == (rupees(1_566), rupees(1_176))
    assert (k["list_adr"], k["net_adr"]) == (rupees(4_203), rupees(3_155))
    assert k["room_nights"] == 1_500
    assert k["occupancy_tenths"] == 373  # 1,500 of 4,026 room nights, shown as 37%
    assert k["net_kept_share_tenths"] == 751


def test_period_line(ov: dict[str, Any]) -> None:
    assert ov["period"] == {
        "start": "2026-04-01",
        "end": "2026-09-30",
        "days": 183,
        "available_room_nights": 4_026,
    }


def test_owner_and_hotel_come_from_the_property(ov: dict[str, Any]) -> None:
    assert ov["owner"] == {"name": "Rajesh", "short_name": "Rajesh", "initials": "RJ"}
    assert ov["hotel"]["name"] == "Hotel Deodar View"
    assert ov["hotel"]["rooms_count"] == 22
    assert ov["hotel"]["is_sample"] is True
    assert ov["business_date"] == "2026-10-13"


def test_waterfall_runs_from_list_revenue_to_net_kept(
    ov: dict[str, Any], client: TestClient, owner: dict[str, str]
) -> None:
    steps = {w["key"]: w["amount"] for w in ov["waterfall"]}
    assert list(steps) == [
        "list_revenue", "discount", "commission", "gst_on_commission", "fees", "net_kept",
    ]  # fmt: skip
    assert steps["list_revenue"] == rupees(63_05_000)
    assert steps["net_kept"] == rupees(47_33_012)
    assert sum(v for k, v in steps.items() if k != "net_kept") == steps["net_kept"]
    totals = client.get("/ledger/channels", headers=owner).json()["totals"]
    assert -steps["commission"] == totals["commission"]
    assert -steps["fees"] == totals["fees"]


def test_channel_mix(ov: dict[str, Any]) -> None:
    mix = {m["key"]: (m["room_nights"], m["share_tenths"]) for m in ov["channel_mix"]}
    assert mix["mmt"] == (620, 413)
    assert mix["direct"] == (160, 107)
    assert sum(n for n, _ in mix.values()) == 1_500


def test_insight_matches_the_ledger(
    ov: dict[str, Any], client: TestClient, owner: dict[str, str]
) -> None:
    ledger = client.get("/ledger/channels", headers=owner).json()["insight"]
    assert ov["insight"] == {"en": ledger["en"], "hi": ledger["hi"]}


def test_last_night_rooms(ov: dict[str, Any]) -> None:
    n = ov["last_night"]
    assert (n["sold"], n["rooms_count"], n["direct_share_pct"]) == (14, 22, 21)
    assert len(n["rooms"]) == 22
    assert sum(1 for r in n["rooms"] if r["channel_key"]) == 14
    codes = {r["code"] for r in n["rooms"] if r["code"]}
    assert codes <= {"MMT", "BDC", "AGO", "AGT", "WLK", "DIR"}
    assert n["net_kept"] > 0


def test_savings_and_needs_you(
    ov: dict[str, Any], client: TestClient, owner: dict[str, str]
) -> None:
    savings = client.get("/savings", headers=owner).json()
    assert ov["savings"] == {
        "total_net_saving": savings["total_net_saving"],
        "count": savings["count"],
    }
    keys = [i["id"] for i in ov["needs_you"]]
    assert "flagged" in keys  # three flagged rows wait for review
    move = next(i for i in ov["needs_you"] if i["id"] == "scenario")
    assert move["amount"] == rupees(10_110)
    assert "Agoda" in move["detail"]
    assert all("₹" not in i["title"] + i["detail"] for i in ov["needs_you"])


def test_checklist_follows_the_pipeline(
    ov: dict[str, Any], client: TestClient, owner: dict[str, str]
) -> None:
    pipeline = client.get("/pipeline", headers=owner).json()
    assert ov["checklist"]["steps"] == pipeline["steps"]
    assert ov["checklist"]["done_count"] == pipeline["done_count"]
    assert ov["checklist"]["total"] == 8


def test_notifications_are_newest_first(ov: dict[str, Any]) -> None:
    times = [n["at"] for n in ov["notifications"] if n["at"]]
    assert times == sorted(times, reverse=True)
    assert any(n["id"].startswith("flagged-") for n in ov["notifications"])


@pytest.mark.usefixtures("base_sample")
def test_empty_before_statements(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/overview", headers=owner).json()
    assert body["has_statements"] is False
    assert body["kpis"] is None
    assert body["insight"] is None
    assert body["waterfall"] == []
    assert body["channel_mix"] == []
    assert body["checklist"]["done_count"] == 0
    assert body["owner"]["initials"] == "RJ"


@pytest.mark.usefixtures("sample")
def test_owner_token_required(client: TestClient, device: dict[str, str]) -> None:
    for headers in ({}, {"Authorization": "Bearer wrong"}, device):
        assert client.get("/overview", headers=headers).status_code == 401


def test_owner_initials() -> None:
    assert owner_initials("Rajesh") == "RJ"
    assert owner_initials("Pooja Negi") == "PN"
    assert owner_initials("Ira") == "IR"
    assert owner_initials("A") == "A"
    assert owner_initials("") == "?"


@pytest.mark.usefixtures("sample")
def test_drafts_coded_bookings_and_proof_show_up(client: TestClient, owner: dict[str, str]) -> None:
    consent_and_checkout(client, owner, 207, "9876543210")
    body = client.get("/overview", headers=owner).json()
    assert body["pending_approvals"] == 1
    first = body["needs_you"][0]
    assert (first["id"], first["href"]) == ("approvals", "/approvals")
    assert any(i["id"] == "proof" for i in body["needs_you"])
    assert any(n["id"].startswith("draft-") for n in body["notifications"])

    draft = client.get("/messages", headers=owner).json()["messages"][0]
    client.post(f"/messages/{draft['id']}/approve", headers=owner)
    page = client.get("/public/link?code=DEODAR-RS26").json()
    client.post("/public/link/book", json={
        "code": "DEODAR-RS26", "check_in": page["dates"][0]["check_in"], "nights": 2,
        "room_type": "Deluxe Valley View",
    })  # fmt: skip
    after = client.get("/overview", headers=owner).json()
    assert after["pending_approvals"] == 0
    assert after["savings"]["count"] >= 1
    assert any(n["id"].startswith("saving-") for n in after["notifications"])


@pytest.mark.usefixtures("sample")
def test_saturday_move_returns_to_needs_you_after_undo(
    client: TestClient, owner: dict[str, str]
) -> None:
    def scenario_listed() -> bool:
        items = client.get("/overview", headers=owner).json()["needs_you"]
        return any(i["id"] == "scenario" for i in items)

    assert scenario_listed()
    accepted = {"decision": "accepted", "rooms": 6}
    assert client.post("/scenario/saturday", headers=owner, json=accepted).status_code == 200
    assert not scenario_listed(), "answered"
    assert client.post("/scenario/saturday/undo", headers=owner).status_code == 200
    assert scenario_listed(), "undone: the card and Overview agree again (review Q1)"
