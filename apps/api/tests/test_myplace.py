"""GET /my-place: the room-by-room illustration from the statements mix."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import OwnerAccount
from app.money import rupees
from app.services.myplace import (
    Costs,
    MixEntry,
    MyPlaceError,
    RoomSpec,
    break_even_rooms,
    build_place,
    find_month,
    month_options,
    nights_per_room,
    resolve_costs,
    rooms_by_channel,
    split_fixed,
    spread,
    synthetic_rooms,
)

MIX = (
    MixEntry("mmt", "MakeMyTrip", 620, rupees(2_737), 1),
    MixEntry("bcom", "Booking.com", 310, rupees(3_119), 2),
    MixEntry("direct", "Direct", 160, rupees(4_283), 6),
)


def _get(client: TestClient, owner: dict[str, str], query: str = "") -> dict[str, Any]:
    res = client.get(f"/my-place{query}", headers=owner)
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


# --- model units --------------------------------------------------------------


def test_nights_per_room_is_thirty_times_occupancy_half_up() -> None:
    assert nights_per_room(1_500, 22, 183) == 11  # 37.3% -> 11.18
    assert nights_per_room(1, 2, 60) == 0  # 0.25 rounds down
    assert nights_per_room(1, 1, 60) == 1  # 0.5 rounds up
    assert nights_per_room(500, 10, 30) == 30  # never more than 30
    with pytest.raises(MyPlaceError):
        nights_per_room(1, 0, 30)


def test_rooms_follow_the_mix_by_largest_remainder() -> None:
    counts = rooms_by_channel(MIX, 22)
    assert counts == {"mmt": 13, "bcom": 6, "direct": 3}
    assert sum(counts.values()) == 22
    assert rooms_by_channel((), 22) == {}


def test_spread_keeps_counts_and_mixes_floors() -> None:
    counts = rooms_by_channel(MIX, 22)
    slots = spread(MIX, counts)
    assert len(slots) == 22
    assert {k: slots.count(k) for k in counts} == counts
    assert len(set(slots[:10])) == 3  # the first floor is not one channel


def test_fixed_split_adds_up_exactly() -> None:
    shares = split_fixed(rupees(4_50_000), 22)
    assert sum(shares) == rupees(4_50_000)
    assert shares[0] == rupees(20_455) and shares[-1] == rupees(20_454)
    assert all(share % 100 == 0 for share in shares)


def test_break_even_rooms() -> None:
    assert break_even_rooms(rupees(100), [rupees(30), rupees(30), rupees(30)]) == 4
    assert break_even_rooms(rupees(90), [rupees(30), rupees(30), rupees(30)]) == 3
    assert break_even_rooms(0, [rupees(10)]) == 0
    assert break_even_rooms(rupees(100), [rupees(-5), rupees(5)]) is None
    assert break_even_rooms(rupees(100), []) is None


def test_build_place_room_maths() -> None:
    rooms = [RoomSpec(101, "Standard"), RoomSpec(102, "Standard"), RoomSpec(201, "Suite")]
    costs = Costs(rupees(900), "owner", rupees(30_001), "owner")
    place = build_place(rooms, MIX, room_nights=37, days=30, costs=costs)
    assert place.nights_per_room == 12  # 30 x 37/90 = 12.33
    first = place.rooms[0]
    assert first.net == 12 * rupees(2_737)
    assert first.variable_cost == 12 * rupees(900)
    assert first.fixed_share == rupees(10_001)
    assert first.profit == first.net - first.variable_cost - first.fixed_share
    assert place.profit == sum(r.profit for r in place.rooms)
    assert place.fixed_costs == sum(r.fixed_share for r in place.rooms)
    assert [f.floor for f in place.floors] == [1, 2]
    assert sum(f.profit for f in place.floors) == place.profit
    with pytest.raises(MyPlaceError):
        build_place([], MIX, 1, 30, costs)


def test_costs_prefer_owner_then_onboarding_then_sample() -> None:
    assert resolve_costs(1_000, 2_00_000, rupees(700)).cost_source == "owner"
    onboarding = resolve_costs(None, None, rupees(700))
    assert (onboarding.cost_per_night, onboarding.cost_source) == (rupees(700), "onboarding")
    sample = resolve_costs(None, None, None)
    assert (sample.cost_source, sample.fixed_source) == ("sample", "sample")
    assert (sample.cost_per_night, sample.fixed_monthly) == (rupees(900), rupees(4_50_000))


def test_months_and_synthetic_rooms() -> None:
    options = month_options()
    assert [o.key for o in options][:2] == ["season", "2026-04"]
    assert options[-1].key == "2026-09" and options[-1].end.day == 30
    assert find_month(None).key == "season"
    with pytest.raises(MyPlaceError):
        find_month("2025-01")
    assert [r.number for r in synthetic_rooms(12)][9:] == [110, 201, 202]


# --- endpoint -----------------------------------------------------------------


def test_sample_hotel_season(client: TestClient, owner: dict[str, str], sample: object) -> None:
    _ = sample
    body = _get(client, owner)
    assert body["available"] is True
    assert body["label"] == "Illustration from your statements mix"
    assert body["is_sample"] is True
    assert body["sample_note"] is not None
    assert body["inputs"]["cost_per_night_source"] == "sample"
    summary = body["summary"]
    assert summary["occupancy_tenths"] == 373
    assert summary["nights_per_room"] == 11
    channels = {c["key"]: c for c in body["channels"]}
    assert channels["mmt"]["net_adr"] == rupees(2_737)
    assert channels["direct"]["net_adr"] == rupees(4_283)
    assert sum(c["rooms"] for c in body["channels"]) == 22
    assert channels["mmt"]["rooms"] == 9  # 41.3% of 22 rooms
    rooms = body["rooms"]
    assert len(rooms) == 22
    mmt_room = next(r for r in rooms if r["channel_key"] == "mmt")
    assert mmt_room["net"] == 11 * rupees(2_737)
    k = body["kpis"]
    assert k["net_kept"] == sum(r["net"] for r in rooms)
    assert k["profit"] == sum(r["profit"] for r in rooms)
    assert k["profit"] == summary["net_kept"] - summary["variable_costs"] - summary["fixed_costs"]
    assert k["rooms_in_profit"] == sum(1 for r in rooms if r["profit"] > 0)
    assert (k["rooms_in_profit"], k["break_even_rooms"]) == (11, 19)
    assert sum(f["profit"] for f in body["floors"]) == k["profit"]


def test_owner_inputs_and_month(client: TestClient, owner: dict[str, str], sample: object) -> None:
    _ = sample
    body = _get(client, owner, "?month=2026-09&cost_per_night=500&fixed_monthly=100000")
    assert body["month"]["key"] == "2026-09" and body["month"]["days"] == 30
    assert body["inputs"]["cost_per_night"] == rupees(500)
    assert body["inputs"]["fixed_monthly_source"] == "owner"
    assert body["sample_note"] is None
    assert body["summary"]["fixed_costs"] == rupees(1_00_000)
    room = body["rooms"][0]
    assert room["variable_cost"] == room["nights"] * rupees(500)


def test_onboarding_cost_is_used(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    now = datetime(2026, 10, 1, tzinfo=UTC)
    account = OwnerAccount(
        name="Test Owner",
        hotel_name="Test Hotel",
        phone="9811111111",
        terms_accepted_at=now,
        verified_at=now,
        cost_per_room=rupees(650),
    )
    sample.add(account)
    sample.commit()
    body = _get(client, {**owner, "X-Seedha-Subject": f"a{account.id}"})
    assert body["inputs"]["cost_per_night"] == rupees(650)
    assert body["inputs"]["cost_per_night_source"] == "onboarding"
    demo = _get(client, {**owner, "X-Seedha-Subject": "demo"})
    assert demo["inputs"]["cost_per_night_source"] == "sample"


@pytest.mark.parametrize(
    "query",
    [
        "?cost_per_night=-1",
        "?cost_per_night=100001",
        "?fixed_monthly=abc",
        "?month=2025-01",
        "?month=sept",
    ],  # fmt: skip
)
def test_bad_inputs_are_refused(
    client: TestClient, owner: dict[str, str], sample: object, query: str
) -> None:
    _ = sample
    res = client.get(f"/my-place{query}", headers=owner)
    assert res.status_code == 422
    assert "error" in res.json()


def test_before_statements(client: TestClient, owner: dict[str, str], base_sample: object) -> None:
    _ = base_sample
    body = _get(client, owner)
    assert body["available"] is False
    assert body["rooms"] == [] and body["kpis"] is None


def test_owner_only(client: TestClient, sample: object) -> None:
    _ = sample
    assert client.get("/my-place").status_code == 401
