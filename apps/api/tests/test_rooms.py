"""The Overview room board API: /rooms/nights, /rooms/{night}/{room}, the slip."""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, DeskCommand, Guest, Message, PerkCode, Property
from app.money import rupees
from app.services.desk import in_house
from app.services.overview import last_night_for
from app.services.rooms import board_nights, contract_terms
from app.services.savings import compute_saving
from seed.closes import CLOSE_STAYS, NIGHT_PLANS
from tests.conftest import DEMO_DATE
from tests.test_winback_flow import consent_and_checkout

FIRST_NIGHT = DEMO_DATE - timedelta(days=6)


def nights(client: TestClient, owner: dict[str, str]) -> dict[str, Any]:
    res = client.get("/rooms/nights", headers=owner)
    assert res.status_code == 200
    body: dict[str, Any] = res.json()
    return body


def detail(client: TestClient, owner: dict[str, str], night: str, room: int) -> dict[str, Any]:
    res = client.get(f"/rooms/{night}/{room}", headers=owner)
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


def stored(session: Session, night: str, room: int) -> Booking:
    prop = session.scalars(select(Property)).one()
    day = DEMO_DATE.fromisoformat(night)
    return next(
        s.booking for s in in_house(session, prop.id, day) if s.room and s.room.number == room
    )


def test_board_nights_are_the_last_seven() -> None:
    days = board_nights(DEMO_DATE)
    assert (len(days), days[0], days[-1]) == (7, FIRST_NIGHT, DEMO_DATE)


def test_nights_equal_last_night_for_on_each_night(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    body = nights(client, owner)
    assert (body["business_date"], body["is_sample"]) == (DEMO_DATE.isoformat(), True)
    assert [n["night"] for n in body["nights"]] == [d.isoformat() for d in board_nights(DEMO_DATE)]
    prop = sample.scalars(select(Property)).one()
    for night in body["nights"]:
        ref = last_night_for(sample, prop, DEMO_DATE.fromisoformat(night["night"]))
        assert night["rooms_sold"] == ref.sold
        assert night["rooms_total"] == ref.rooms_count == 22
        assert night["net_kept"] == ref.net_kept
        assert night["direct_bookings_pct"] == ref.direct_share_pct
        assert [(t["room"], t["channel_key"], t["sold"]) for t in night["tiles"]] == [
            (r.number, r.channel_key, r.channel_key is not None) for r in ref.rooms
        ]
        assert sum(c["rooms"] for c in night["by_channel"]) == night["rooms_sold"]
        for count in night["by_channel"]:
            keys = [t["channel_key"] for t in night["tiles"]]
            assert count["rooms"] == keys.count(count["channel_key"])


@pytest.mark.usefixtures("sample")
def test_tonight_is_unchanged_and_earlier_nights_are_the_closes(
    client: TestClient, owner: dict[str, str]
) -> None:
    body = nights(client, owner)["nights"]
    tonight = body[-1]
    assert (tonight["rooms_sold"], tonight["rooms_total"], tonight["direct_bookings_pct"]) == (
        14,
        22,
        21,
    )
    plans = dict(NIGHT_PLANS)
    for night in body[:-1]:
        offset = (DEMO_DATE - DEMO_DATE.fromisoformat(night["night"])).days
        assert night["rooms_sold"] == len(plans[offset].split()) < 22
    assert sum(n["rooms_sold"] for n in body[:-1]) == len(CLOSE_STAYS)


def test_detail_money_is_the_stored_row(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    neha = detail(client, owner, DEMO_DATE.isoformat(), 104)
    assert neha["net_kept"] == rupees(2_678)  # ruling 4
    for night, room in ((DEMO_DATE.isoformat(), 104), (FIRST_NIGHT.isoformat(), 207)):
        body = detail(client, owner, night, room)
        row = stored(sample, night, room)
        assert (body["night"], body["room"], body["booking_id"]) == (night, room, row.id)
        assert (body["channel_key"], body["channel_name"]) == (row.channel.key, row.channel.name)
        for field in ("list_amount", "discount", "commission", "gst_on_commission", "fees",
                      "net_kept", "nights"):  # fmt: skip
            assert body[field] == getattr(row, field), field


def test_guest_appears_as_initials_only(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    for night, room in ((DEMO_DATE.isoformat(), 104), (FIRST_NIGHT.isoformat(), 101)):
        res = client.get(f"/rooms/{night}/{room}", headers=owner)
        guest = sample.get(Guest, stored(sample, night, room).guest_id)
        assert guest is not None
        assert guest.display_name not in res.text
        assert guest.display_name.split()[0] not in res.text
        assert guest.short_name not in res.text
    assert detail(client, owner, DEMO_DATE.isoformat(), 104)["guest_initials"] == "NG"


@pytest.mark.usefixtures("sample")
def test_consent_id_only_while_active(client: TestClient, owner: dict[str, str]) -> None:
    night = DEMO_DATE.isoformat()
    before = detail(client, owner, night, 207)
    assert (before["consent_status"], before["consent_id"]) == ("not_consented", None)
    consent_and_checkout(client, owner, 207, "9876543210")
    after = detail(client, owner, night, 207)
    assert after["consent_status"] == "consented_at_desk"
    assert isinstance(after["consent_id"], int)
    assert after["checked_out"] is True


def test_withdrawn_consent_hides_the_id(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    night = DEMO_DATE.isoformat()
    consent_and_checkout(client, owner, 207, "9876543210")
    consent = sample.scalars(select(Consent)).one()
    consent.withdrawn_at = consent.given_at
    sample.commit()
    body = detail(client, owner, night, 207)
    assert (body["consent_status"], body["consent_id"]) == ("not_consented", None)


def test_if_direct_is_ruling_5(client: TestClient, owner: dict[str, str], sample: Session) -> None:
    for night, room in ((DEMO_DATE.isoformat(), 207), (FIRST_NIGHT.isoformat(), 201)):
        body = detail(client, owner, night, room)
        row = stored(sample, night, room)
        bps, gst = contract_terms(sample, row.channel_id)
        saving = compute_saving(row.list_amount - row.discount, bps, gst)
        assert saving is not None
        assert body["if_direct"] == {
            "extra_kept": saving.net_saving,
            "commission_avoided": saving.commission_avoided,
            "gst_avoided": saving.gst_avoided,
            "upi_fee": saving.upi_fee,
            "commission_rate_bps": bps,
            "label": "Illustration",
        }
    rahul = detail(client, owner, DEMO_DATE.isoformat(), 207)["if_direct"]
    assert rahul["commission_rate_bps"] == 2_200  # MakeMyTrip contract, never a flat rate


@pytest.mark.usefixtures("sample")
def test_walk_in_and_direct_have_no_illustration(client: TestClient, owner: dict[str, str]) -> None:
    night = DEMO_DATE.isoformat()
    assert detail(client, owner, night, 112)["if_direct"] is None  # walk-in
    assert detail(client, owner, night, 108)["if_direct"] is None  # direct


def test_contract_terms_without_a_contract(session: Session) -> None:
    assert contract_terms(session, 9_999) == (0, False)


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    ("path", "status", "code"),
    [
        (f"/rooms/{DEMO_DATE.isoformat()}/111", 404, "room_empty"),
        (f"/rooms/{DEMO_DATE.isoformat()}/999", 404, "room_empty"),
        (f"/rooms/{(FIRST_NIGHT - timedelta(days=1)).isoformat()}/101", 404, "night_not_on_board"),
        (f"/rooms/{(DEMO_DATE + timedelta(days=1)).isoformat()}/101", 404, "night_not_on_board"),
        ("/rooms/2026-13-01/101", 422, "invalid_input"),
        ("/rooms/yesterday/101", 422, "invalid_input"),
        (f"/rooms/{DEMO_DATE.isoformat()}/0", 422, "invalid_input"),
    ],
)
def test_not_found_and_bad_input(
    client: TestClient, owner: dict[str, str], path: str, status: int, code: str
) -> None:
    for res in (client.get(path, headers=owner), client.post(f"{path}/slip", headers=owner)):
        assert res.status_code == status
        assert res.json()["error"]["code"] == code


@pytest.mark.usefixtures("sample")
def test_owner_only(client: TestClient, device: dict[str, str]) -> None:
    night = DEMO_DATE.isoformat()
    for headers in ({}, {"Authorization": "Bearer wrong"}, device):
        assert client.get("/rooms/nights", headers=headers).status_code == 401
        assert client.get(f"/rooms/{night}/104", headers=headers).status_code == 401
        assert client.post(f"/rooms/{night}/104/slip", headers=headers).status_code == 401


def counts(session: Session) -> tuple[int, int, int, int]:
    session.expire_all()
    out = (
        session.scalar(select(func.count()).select_from(PerkCode)),
        session.scalar(select(func.count()).select_from(Message)),
        session.scalar(select(func.count()).where(Booking.checked_out_at.is_not(None))),
        session.scalar(select(func.count()).select_from(Consent)),
    )
    return tuple(int(n or 0) for n in out)  # type: ignore[return-value]


def queued(session: Session) -> list[DeskCommand]:
    session.expire_all()
    return list(session.scalars(select(DeskCommand).order_by(DeskCommand.id)))


def test_slip_only_queues_a_print(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    night = DEMO_DATE.isoformat()
    before, commands = counts(sample), len(queued(sample))
    res = client.post(f"/rooms/{night}/104/slip", headers=owner)
    assert res.status_code == 200
    slip = res.json()
    assert counts(sample) == before
    new = queued(sample)[commands:]
    assert [c.kind for c in new] == ["show_text", "print_slip", "show_idle"]
    assert json.loads(new[1].payload)["text"] == slip["text"]
    labels = {line["label"]: line["amount"] for line in slip["lines"]}
    assert labels["Hotel kept"] == rupees(2_678)
    assert labels["Commission"] == -rupees(612)
    assert "Neha" not in res.text
    assert slip["subtitle"].startswith("NG")


@pytest.mark.usefixtures("sample")
def test_walk_in_slip_has_no_commission_lines(client: TestClient, owner: dict[str, str]) -> None:
    slip = client.post(f"/rooms/{DEMO_DATE.isoformat()}/112/slip", headers=owner).json()
    labels = [line["label"] for line in slip["lines"]]
    assert "Commission" not in labels
    assert "Booked directly. Hotel kept" in labels


def test_slip_reuses_an_existing_perk_code(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    night = DEMO_DATE.isoformat()
    client.post("/desk/checkout", headers=owner, json={"room": 207})
    rahul = stored(sample, night, 207)
    code = sample.scalars(select(PerkCode).where(PerkCode.origin_booking_id == rahul.id)).one().code
    before = counts(sample)
    slip = client.post(f"/rooms/{night}/207/slip", headers=owner).json()
    assert code in slip["footer"]
    assert counts(sample) == before
    earlier = client.post(f"/rooms/{FIRST_NIGHT.isoformat()}/101/slip", headers=owner).json()
    assert not any(line.startswith("DEODAR-") for line in earlier["footer"])
    assert counts(sample) == before


def test_reset_restores_the_closes(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    first = nights(client, owner)
    assert client.post("/demo/reset", headers=owner).json()["ok"] is True
    sample.expire_all()
    assert sample.scalar(select(func.count()).where(Booking.external_ref.like("CL%"))) == len(
        CLOSE_STAYS
    )
    again = nights(client, owner)
    assert [(n["night"], n["rooms_sold"], n["net_kept"]) for n in again["nights"]] == [
        (n["night"], n["rooms_sold"], n["net_kept"]) for n in first["nights"]
    ]
