"""Seedha Pro mini views: discount split, floor, displacement, khata, rollup."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Channel, Property
from app.money import LineItems, MoneyError, bps_of, gst_on_commission, rupees, upi_fee
from app.services.ledger import load_ledger
from app.services.pro_views import (
    MAX_RATE,
    SAMPLE_AGENTS,
    PropertyTotals,
    ProViewError,
    RecentNights,
    Terms,
    agent_for,
    combine,
    displacement,
    floor_rate,
    floor_rows,
    lines_at,
    recent_nights,
)
from tests.conftest import DEMO_DATE

MMT = Terms("mmt", "MakeMyTrip", "ota", 2200, True, False)
TA = Terms("ta", "Travel agents", "agent", 1000, False, False)
DIRECT = Terms("direct", "Direct", "direct", 0, False, True)
WALKIN = Terms("walkin", "Walk-in", "walkin", 0, False, False)
ALL_OF_IT = Terms("x", "Greedy", "ota", 10_000, False, False)


def get(client: TestClient, owner: dict[str, str], path: str) -> dict[str, Any]:
    res = client.get(path, headers=owner)
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


def prop_of(session: Session) -> Property:
    return session.scalars(select(Property)).one()


# Auth and validation ----------------------------------------------------------

PATHS = (
    "/pro/discount-split",
    "/pro/floor",
    "/pro/displacement?group_rooms=4&group_rate=300000&nights=2",
    "/pro/khata",
    "/pro/rollup",
)


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize("path", PATHS)
def test_owner_only(client: TestClient, owner: dict[str, str], path: str) -> None:
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get(path, headers=owner).status_code == 200


@pytest.mark.parametrize("path", PATHS)
def test_real_hotel_refuses_a_demo_session(
    sample: Session, client: TestClient, owner: dict[str, str], path: str
) -> None:
    prop_of(sample).is_sample = False
    sample.commit()
    res = client.get(path, headers=owner | {"X-Seedha-Subject": "demo"})
    assert res.status_code == 403


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    "path",
    [
        "/pro/floor?rate=0",
        "/pro/floor?rate=abc",
        f"/pro/floor?rate={MAX_RATE + 100}",
        "/pro/floor?target=50",
        "/pro/floor?rate=400050",
        "/pro/floor?target=250050",
        "/pro/displacement?group_rooms=4&group_rate=300000",
        "/pro/displacement?group_rooms=0&group_rate=300000&nights=2",
        "/pro/displacement?group_rooms=23&group_rate=300000&nights=2",
        "/pro/displacement?group_rooms=4&group_rate=300000&nights=0",
        "/pro/displacement?group_rooms=4&group_rate=300001&nights=2",
        "/pro/rollup?property=c",
    ],
)
def test_bad_inputs_are_422(client: TestClient, owner: dict[str, str], path: str) -> None:
    res = client.get(path, headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (422, "invalid_input")


@pytest.mark.usefixtures("sample")
def test_unknown_channel_is_404(client: TestClient, owner: dict[str, str]) -> None:
    res = client.get("/pro/floor?channel=nope", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (404, "unknown_channel")


# Who paid the discount ----------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_discount_split_hotel_part_is_the_ledger_discount(
    client: TestClient, owner: dict[str, str]
) -> None:
    body = get(client, owner, "/pro/discount-split")
    assert (body["sample"], body["label"]) == (True, "Sample")
    rows = {r["channel_key"]: r for r in body["rows"]}
    assert list(rows) == ["mmt", "bcom", "agoda"]
    assert {k: r["hotel_funded"] for k, r in rows.items()} == {
        "mmt": rupees(312_480),
        "bcom": rupees(136_400),
        "agoda": rupees(84_000),
    }
    assert {k: r["ota_funded"] for k, r in rows.items()} == {
        "mmt": bps_of(rupees(2_604_000), 400),
        "bcom": bps_of(rupees(1_364_000), 300),
        "agoda": bps_of(rupees(560_000), 500),
    }
    assert rows["mmt"]["ota_funded"] == rupees(104_160)
    assert rows["mmt"]["hotel_share_tenths"] == 750
    assert all(r["ota_funded_sample"] is True for r in rows.values())
    assert body["total_hotel_funded"] == rupees(532_880)
    assert body["total_ota_funded"] == sum(r["ota_funded"] for r in rows.values())


# Floor by channel -----------------------------------------------------------------


@pytest.mark.parametrize("terms", [MMT, TA, DIRECT, WALKIN])
@pytest.mark.parametrize("target", [rupees(1), rupees(1_990), rupees(2_000), rupees(2_500),
                                    rupees(4_283), rupees(60_001)])  # fmt: skip
def test_floor_round_trip(terms: Terms, target: int) -> None:
    rate = floor_rate(target, terms)
    assert lines_at(rate, terms).net_kept == target
    below = rate - rupees(1)
    assert below == 0 or lines_at(below, terms).net_kept < target


def test_floor_known_values() -> None:
    assert floor_rate(rupees(2_500), MMT) == rupees(3_377)
    kept = lines_at(rupees(3_377), MMT)
    assert (kept.commission, kept.gst_on_commission) == (rupees(743), rupees(134))
    assert floor_rate(rupees(2_500), TA) == rupees(2_778)
    assert floor_rate(rupees(2_500), WALKIN) == rupees(2_500)
    assert floor_rate(rupees(2_500), DIRECT) == rupees(2_510)
    assert upi_fee(rupees(2_510)) == rupees(10)


def test_floor_errors() -> None:
    with pytest.raises(ProViewError):
        floor_rate(rupees(100), ALL_OF_IT)
    with pytest.raises(ProViewError):
        floor_rate(150, MMT)
    with pytest.raises(ProViewError):
        floor_rate(MAX_RATE, MMT)


@pytest.mark.usefixtures("sample")
def test_floor_endpoint(client: TestClient, owner: dict[str, str]) -> None:
    body = get(client, owner, "/pro/floor")
    assert (body["label"], body["target"], body["target_is_sample"], body["rate"]) == (
        "Illustration", rupees(2_500), True, rupees(4_000))  # fmt: skip
    rows = {r["channel_key"]: r for r in body["rows"]}
    assert list(rows) == ["mmt", "bcom", "agoda", "ta", "walkin", "direct"]
    mmt = rows["mmt"]
    assert (mmt["floor_rate"], mmt["commission_bps"], mmt["worth_taking"]) == (
        rupees(3_377), 2200, True)  # fmt: skip
    commission = bps_of(rupees(4_000), 2200)
    gst = gst_on_commission(commission)
    assert mmt["at_rate"] == {
        "list_amount": rupees(4_000), "discount": 0, "commission": commission,
        "gst_on_commission": gst, "fees": 0, "net_kept": rupees(4_000) - commission - gst,
    }  # fmt: skip
    assert mmt["at_rate"]["net_kept"] == rupees(2_962)
    assert rows["direct"]["at_rate"]["fees"] == upi_fee(rupees(4_000)) == rupees(16)

    one = get(client, owner, "/pro/floor?channel=ta&rate=250000&target=300000")
    assert one["target_is_sample"] is False
    (ta,) = one["rows"]
    assert (ta["channel_key"], ta["worth_taking"]) == ("ta", False)
    assert ta["at_rate"]["net_kept"] == rupees(2_250)
    assert ta["floor_rate"] == rupees(3_333)


# Group displacement ---------------------------------------------------------------


def test_displacement_arithmetic() -> None:
    recent = RecentNights(nights=7, average_rooms_sold=15, average_net_per_room_night=rupees(3_252))
    d = displacement(recent, 22, 10, rupees(3_000), 2)
    assert (d.free_rooms, d.rooms_pushed_out) == (7, 3)
    assert d.group_net == 10 * 2 * rupees(3_000) == rupees(60_000)
    assert d.displaced_net == 3 * 2 * rupees(3_252) == rupees(19_512)
    assert d.difference == rupees(40_488)
    small = displacement(recent, 22, 5, rupees(3_000), 1)
    assert (small.rooms_pushed_out, small.displaced_net, small.difference) == (
        0, 0, rupees(15_000))  # fmt: skip
    full = RecentNights(7, 30, rupees(1_000))
    assert displacement(full, 22, 2, rupees(500), 1).difference == rupees(-1_000)
    for bad in ((0, rupees(3_000), 1), (23, rupees(3_000), 1), (1, rupees(3_000), 0)):
        with pytest.raises(ProViewError):
            displacement(recent, 22, *bad)


def test_recent_nights_from_the_board(sample: Session) -> None:
    recent = recent_nights(sample, prop_of(sample), DEMO_DATE)
    assert (recent.nights, recent.average_rooms_sold) == (7, 15)
    assert recent.average_net_per_room_night == rupees(3_252)


def test_recent_nights_with_no_stays(base_sample: Session) -> None:
    far = recent_nights(base_sample, prop_of(base_sample), DEMO_DATE.replace(year=2030))
    assert (far.average_rooms_sold, far.average_net_per_room_night) == (0, 0)


@pytest.mark.usefixtures("sample")
def test_displacement_endpoint(client: TestClient, owner: dict[str, str]) -> None:
    body = get(client, owner, "/pro/displacement?group_rooms=15&group_rate=300000&nights=2")
    assert body["label"] == "Illustration"
    assert (body["rooms_count"], body["free_rooms"], body["rooms_pushed_out"]) == (22, 7, 8)
    assert body["average_net_per_room_night"] == rupees(3_252)
    assert body["group_net"] == rupees(90_000)
    assert body["displaced_net"] == 8 * 2 * rupees(3_252) == rupees(52_032)
    assert body["difference"] == body["group_net"] - body["displaced_net"] == rupees(37_968)


# Agent khata ----------------------------------------------------------------------


def test_agent_names_are_fixed_and_sample() -> None:
    assert agent_for("TA5304") == SAMPLE_AGENTS[5304 % 4]
    assert agent_for("TA") == SAMPLE_AGENTS[0]


@pytest.mark.usefixtures("sample")
def test_khata_sums_to_the_travel_agent_ledger(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    body = get(client, owner, "/pro/khata")
    assert (body["sample"], body["label"]) == (True, "Sample")
    assert [r["agent"] for r in body["rows"]] == list(SAMPLE_AGENTS)
    ta = next(s for s in load_ledger(sample, prop_of(sample).id).channels if s.channel.key == "ta")
    totals = body["totals"]
    assert (totals["bookings"], totals["room_nights"]) == (165, 180) == (ta.stays, ta.room_nights)
    assert totals["lines"]["list_amount"] == rupees(684_000)
    assert totals["lines"]["commission"] == rupees(68_400)
    assert totals["lines"]["net_kept"] == ta.lines.net_kept == rupees(615_600)
    for key in ("list_amount", "commission", "net_kept"):
        assert sum(r["lines"][key] for r in body["rows"]) == totals["lines"][key]
    assert sum(r["bookings"] for r in body["rows"]) == 165


# Two-property rollup -------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_rollup(client: TestClient, owner: dict[str, str]) -> None:
    body = get(client, owner, "/pro/rollup")
    assert (body["selected"], body["sample"], body["label"]) == ("all", True, "Sample")
    a, b = body["properties"]
    assert (a["key"], a["name"], a["room_nights"]) == ("a", "Deodar View", 1500)
    assert a["lines"]["net_kept"] == rupees(4_733_012)
    assert a["paid_to_channels"] == rupees(1_039_108)
    assert (a["net_adr"], a["direct_bookings_tenths"]) == (rupees(3_155), 107)
    assert (b["key"], b["sample"], b["rooms_count"]) == ("b", True, 14)
    assert b["lines"]["gst_on_commission"] == gst_on_commission(rupees(340_800))
    assert b["lines"]["net_kept"] == rupees(2_222_956)
    both = body["combined"]
    assert body["view"] == both
    for key in ("list_amount", "discount", "commission", "gst_on_commission", "fees", "net_kept"):
        assert both["lines"][key] == a["lines"][key] + b["lines"][key]
    assert both["room_nights"] == 2320
    assert both["net_adr"] == rupees(2_998)
    assert get(client, owner, "/pro/rollup?property=a")["view"] == a
    assert get(client, owner, "/pro/rollup?property=b")["view"] == b


def test_combine_rules() -> None:
    with pytest.raises(MoneyError):
        combine([])
    empty = PropertyTotals("z", "Empty", "Nowhere", 1, True, 0, 0, LineItems(list_amount=0))
    assert (empty.net_adr, empty.direct_bookings_tenths) == (None, None)


def test_floor_rows_guards_and_missing_contract(sample: Session) -> None:
    prop = prop_of(sample)
    with pytest.raises(ProViewError):
        floor_rows(sample, prop.id, rupees(2_500), MAX_RATE + rupees(1), None)
    walkin = sample.scalars(select(Channel).where(Channel.key == "walkin")).one()
    for contract in walkin.contracts:
        sample.delete(contract)
    sample.flush()
    (row,) = floor_rows(sample, prop.id, rupees(2_500), rupees(3_000), "walkin")
    assert (row.terms.commission_bps, row.floor_rate) == (0, rupees(2_500))
    assert row.at_rate.net_kept == rupees(3_000)
