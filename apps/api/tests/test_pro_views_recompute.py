"""Pro mini views against independent recomputation (POLISH_BUILD T1).

Discount split and khata are summed here straight from booking rows with
plain integer arithmetic; the floor is checked by round trip through the
stored contracts; displacement is rebuilt from the room board API."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from fractions import Fraction
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, ChannelContract
from app.money import line_items_for_booking, rupees
from app.services.pro_views import SAMPLE_AGENTS

START, END = date(2026, 4, 1), date(2026, 9, 30)
SAMPLE_OTA_BPS = {"mmt": 400, "bcom": 300, "agoda": 500}
AGENTS = SAMPLE_AGENTS  # the service's fictional names; rows are checked against them in order
TARGETS = (rupees(1_000), rupees(2_500), rupees(3_001), rupees(4_283), rupees(7_777))


def get(client: TestClient, owner: dict[str, str], path: str) -> dict[str, Any]:
    res = client.get(path, headers=owner)
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


def counted(session: Session, kind: str) -> list[tuple[Booking, str]]:
    """Rows the ledger counts for one channel kind, with the channel key."""
    rows = session.execute(
        select(Booking, Channel.key)
        .join(Channel, Channel.id == Booking.channel_id)
        .where(
            Channel.kind == kind,
            Booking.check_in >= START,
            Booking.check_in <= END,
            or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
        )
    ).all()
    return [(row[0], row[1]) for row in rows]


def rupee_half_up(value: Fraction) -> int:
    """Paise rounded half-up to whole rupees."""
    return int((value / 100 + Fraction(1, 2)) // 1) * 100


def test_discount_split_equals_the_booking_rows(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    discount: dict[str, int] = defaultdict(int)
    listed: dict[str, int] = defaultdict(int)
    for b, key in counted(sample, "ota"):
        discount[key] += b.discount
        listed[key] += b.list_amount
    body = get(client, owner, "/pro/discount-split")
    rows = {r["channel_key"]: r for r in body["rows"]}
    assert set(rows) == set(discount) == {"mmt", "bcom", "agoda"}
    for key, row in rows.items():
        assert row["hotel_funded"] == discount[key], key
        assert row["list_amount"] == listed[key], key
        ota = rupee_half_up(Fraction(listed[key] * SAMPLE_OTA_BPS[key], 10_000))
        assert row["ota_funded"] == ota, key
        share = Fraction(discount[key] * 1000, discount[key] + ota)
        assert row["hotel_share_tenths"] == int((share + Fraction(1, 2)) // 1), key
    assert body["total_hotel_funded"] == sum(discount.values())
    assert body["total_ota_funded"] == sum(r["ota_funded"] for r in rows.values())


def test_khata_rows_equal_the_travel_agent_rows(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    fields = ("list_amount", "discount", "commission", "gst_on_commission", "fees", "net_kept")
    expected: dict[str, dict[str, int]] = {a: defaultdict(int) for a in AGENTS}
    for b, _key in counted(sample, "agent"):
        digits = "".join(ch for ch in b.external_ref if ch.isdigit())
        agent = expected[AGENTS[int(digits or "0") % 4]]
        for f in fields:
            agent[f] += getattr(b, f)
        if b.status == "stay":
            agent["bookings"] += 1
            agent["room_nights"] += b.nights
    body = get(client, owner, "/pro/khata")
    assert [r["agent"] for r in body["rows"]] == list(AGENTS)
    for row in body["rows"]:
        want = expected[row["agent"]]
        assert (row["bookings"], row["room_nights"]) == (want["bookings"], want["room_nights"])
        for f in fields:
            assert row["lines"][f] == want[f], (row["agent"], f)
        lines = row["lines"]
        assert lines["net_kept"] == (lines["list_amount"] - lines["discount"] - lines["commission"]
                                     - lines["gst_on_commission"] - lines["fees"])  # fmt: skip
    totals = body["totals"]
    for f in fields:
        assert totals["lines"][f] == sum(e[f] for e in expected.values()), f
    assert totals["bookings"] == sum(e["bookings"] for e in expected.values()) == 165


@pytest.mark.parametrize("target", TARGETS)
def test_floor_round_trip_through_the_stored_contracts(
    client: TestClient, owner: dict[str, str], sample: Session, target: int
) -> None:
    rate = rupees(4_000)
    body = get(client, owner, f"/pro/floor?target={target}&rate={rate}")
    assert body["target"] == target and len(body["rows"]) == 6
    for row in body["rows"]:
        channel = sample.scalars(select(Channel).where(Channel.key == row["channel_key"])).one()
        contract = sample.scalars(
            select(ChannelContract)
            .where(ChannelContract.channel_id == channel.id)
            .order_by(ChannelContract.valid_from.desc())
        ).first()
        bps = contract.commission_bps if contract else 0
        gst = contract.gst_applies if contract else False
        upi = contract.upi_fee_applies if contract else False

        def kept(amount: int, bps: int = bps, gst: bool = gst, upi: bool = upi) -> int:
            return line_items_for_booking(list_amount=amount, discount=0, commission_bps=bps,
                                          gst_applies=gst, upi_payment=upi).net_kept  # fmt: skip

        floor = row["floor_rate"]
        assert floor % 100 == 0
        assert kept(floor) == target, (row["channel_key"], target)
        assert kept(floor - rupees(1)) < target, (row["channel_key"], target)
        assert row["worth_taking"] is (rate >= floor)
        assert row["at_rate"]["net_kept"] == kept(rate)
        assert row["commission_bps"] == bps


def board_averages(client: TestClient, owner: dict[str, str]) -> tuple[int, int]:
    """Average rooms sold (half-up) and net per room night, from the room board."""
    nights = get(client, owner, "/rooms/nights")["nights"]
    sold = sum(n["rooms_sold"] for n in nights)
    stays: dict[int, tuple[int, int]] = {}
    for n in nights:
        for tile in n["tiles"]:
            if tile["sold"]:
                d = get(client, owner, f"/rooms/{n['night']}/{tile['room']}")
                stays[d["booking_id"]] = (d["net_kept"], d["nights"])
    net = sum(v[0] for v in stays.values())
    room_nights = sum(v[1] for v in stays.values())
    average = int((Fraction(sold, len(nights)) + Fraction(1, 2)) // 1)
    return average, rupee_half_up(Fraction(net, room_nights))


@pytest.mark.usefixtures("sample")
def test_displacement_edges_rebuilt_from_the_board(
    client: TestClient, owner: dict[str, str]
) -> None:
    average, per_night = board_averages(client, owner)
    free = 22 - average
    rate = rupees(3_500)
    for group, nights in ((22, 3), (free + 1, 1), (free, 2), (1, 30)):
        query = f"group_rooms={group}&group_rate={rate}&nights={nights}"
        body = get(client, owner, f"/pro/displacement?{query}")
        pushed = max(group - free, 0)
        assert (body["average_rooms_sold"], body["free_rooms"]) == (average, free)
        assert body["average_net_per_room_night"] == per_night
        assert body["rooms_pushed_out"] == pushed
        assert body["group_net"] == group * nights * rate
        assert body["displaced_net"] == pushed * nights * per_night
        assert body["difference"] == body["group_net"] - body["displaced_net"]
    for query in ("group_rooms=23&group_rate=350000&nights=1",
                  "group_rooms=4&group_rate=350000&nights=0",
                  "group_rooms=4&group_rate=350000&nights=31",
                  "group_rooms=4&group_rate=0&nights=1",
                  "group_rooms=-1&group_rate=350000&nights=1"):  # fmt: skip
        res = client.get(f"/pro/displacement?{query}", headers=owner)
        assert (res.status_code, res.json()["error"]["code"]) == (422, "invalid_input"), query
