"""GET /public/sample: the public website's figures (P7)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Property, RepeatMatch
from app.money import rupees
from app.ratelimit import LIMITS


@pytest.fixture(name="body")
def fixture_body(client: TestClient, sample: Session) -> dict[str, Any]:
    _ = sample
    res = client.get("/public/sample")
    assert res.status_code == 200
    data: dict[str, Any] = res.json()
    return data


def test_headline_figures_match_the_locked_totals(body: dict[str, Any]) -> None:
    assert body["is_sample"] is True
    assert body["hotel"] == "Hotel Deodar View"
    assert body["paid_to_channels"] == rupees(10_39_108)
    assert body["paid_to_channels_share_tenths"] == 165
    assert body["net_kept"] == rupees(47_33_012)
    assert body["list_revenue"] == rupees(63_05_000)
    assert body["commission_free_share_tenths"] == 167
    assert (body["revpar_list"], body["revpar_net"]) == (rupees(1_566), rupees(1_176))
    assert (body["list_adr"], body["net_adr"]) == (rupees(4_203), rupees(3_155))


def test_flip_ranks_and_net_adrs(body: dict[str, Any]) -> None:
    by_key = {c["key"]: c for c in body["channels"]}
    names = {c["key"]: c["name"] for c in body["channels"]}
    assert names[body["rank_by_bookings"][0]] == "MakeMyTrip"
    assert names[body["rank_by_money_kept"][4]] == "MakeMyTrip"
    mmt = next(c for c in by_key.values() if c["name"] == "MakeMyTrip")
    assert (mmt["net_adr"], mmt["room_nights"]) == (rupees(2_737), 620)


def test_repeat_saturday_and_growth(body: dict[str, Any]) -> None:
    assert (body["repeat_guests"], body["paid_twice"]) == (12, rupees(41_800))
    assert body["saturday"]["channel_name"] == "Agoda"
    assert body["saturday"]["extra_per_saturday"] == rupees(10_110)
    growth = body["growth"]
    assert growth["from_channel"] == "MakeMyTrip"
    assert growth["per_room_night"] == rupees(1_546)


def test_no_guest_names_or_contacts(body: dict[str, Any]) -> None:
    assert set(body["guest_cities"][0]) == {"city", "stays"}
    text = str(body).lower()
    for word in ("guest_name", "whatsapp", "phone", "email", "verma", "gupta"):
        assert word not in text


def test_public_request_stores_nothing(client: TestClient, sample: Session) -> None:
    assert client.get("/public/sample").status_code == 200
    assert sample.scalar(select(func.count()).select_from(RepeatMatch)) == 0


def test_owner_dismissals_count_once_matches_exist(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    matches = client.get("/repeat", headers=owner).json()["matches"]
    verma = next(m for m in matches if "Verma" in m["guest_name"])
    client.post(f"/repeat/{verma['id']}", headers=owner, json={"decision": "dismiss"})
    body = client.get("/public/sample").json()
    assert body["repeat_guests"] == 11
    assert body["paid_twice"] == rupees(41_800) - verma["paid_twice"]
    _ = sample


def test_only_served_for_the_sample_hotel(client: TestClient, sample: Session) -> None:
    prop = sample.scalars(select(Property)).one()
    prop.is_sample = False
    sample.commit()
    res = client.get("/public/sample")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "no_sample"


@pytest.mark.usefixtures("base_sample")
def test_without_statements_it_says_so(client: TestClient) -> None:
    res = client.get("/public/sample")
    assert res.status_code == 409


@pytest.mark.usefixtures("sample")
def test_rate_limited(client: TestClient) -> None:
    limit = LIMITS["public_sample"].count
    codes = [client.get("/public/sample").status_code for _ in range(limit + 1)]
    assert codes[:limit] == [200] * limit
    assert codes[-1] == 429
