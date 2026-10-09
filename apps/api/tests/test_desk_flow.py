"""Desk end to end: check-in QR -> guest consent -> checkout slip (M5 check)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Consent, ConsentToken, Guest
from app.money import rupees
from app.services.ledger import load_ledger
from seed.load import load_sample
from tests.conftest import DEMO_DATE


def poll(client: TestClient, device: dict[str, str]) -> list[dict[str, Any]]:
    body = client.get("/desk/poll", headers=device).json()
    commands: list[dict[str, Any]] = body["commands"]
    if commands:
        client.post("/desk/ack", headers=device, json={"ids": [c["id"] for c in commands]})
    return commands


def token_from(url: str) -> str:
    return url.rsplit("/", 1)[-1]


def give_consent(client: TestClient, device: dict[str, str], token: str) -> None:
    """Guest opens the link, tries without ticking, then says yes."""
    page = client.get(f"/public/consent/{token}").json()
    assert (page["hotel"], page["guest_short_name"]) == ("Deodar View", "Neha ji")
    assert "STOP" in page["wording"]

    unticked = client.post(
        f"/public/consent/{token}", json={"agree": False, "whatsapp": "9876543210"}
    )
    assert unticked.status_code == 422
    assert unticked.json()["error"]["code"] == "not_agreed"
    bad_phone = client.post(
        f"/public/consent/{token}", json={"agree": True, "whatsapp": "12345678901"}
    )
    assert bad_phone.json()["error"]["code"] == "invalid_number"

    yes = client.post(
        f"/public/consent/{token}", json={"agree": True, "whatsapp": "+91 98765 43210"}
    )
    assert yes.json() == {"ok": True, "guest_short_name": "Neha ji", "already_subscribed": False}
    assert [c["kind"] for c in poll(client, device)] == ["show_ok", "set_ring", "beep"]
    reuse = client.post(f"/public/consent/{token}", json={"agree": True, "whatsapp": "9876543210"})
    assert (reuse.status_code, reuse.json()["error"]["code"]) == (410, "link_used")


def check_consent_storage(sample: Session, caplog: pytest.LogCaptureFixture) -> None:
    """The number lives only on the consent row and never reaches the logs."""
    consent = sample.scalars(select(Consent)).one()
    assert consent.whatsapp_number == "+919876543210"
    assert consent.proof_status == "pending"
    assert len(consent.fingerprint) == 64 and consent.salt
    assert not hasattr(sample.get(Guest, consent.guest_id), "whatsapp_number")
    assert "9876543210" not in caplog.text


def check_in_neha(client: TestClient, owner: dict[str, str], device: dict[str, str]) -> str:
    """Front desk shows the QR for room 104; the box receives it."""
    checkin = client.post("/desk/checkin", headers=owner, json={"room": 104}).json()
    token = token_from(checkin["url"])
    assert checkin["url"].startswith("http://localhost:3000/consent/")
    commands = poll(client, device)
    assert [c["kind"] for c in commands] == ["set_ring", "show_qr"]
    assert commands[1]["payload"]["url"] == checkin["url"]
    assert commands[1]["payload"]["text"] == "Room 104 · Scan for your perk"
    assert client.get("/desk/state", headers=owner).json()["device"]["online"] is True

    return token


@pytest.mark.usefixtures("sample")
def test_full_desk_flow(
    client: TestClient,
    owner: dict[str, str],
    device: dict[str, str],
    sample: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    before = load_ledger(sample, 1).totals
    state = client.get("/desk/state", headers=owner).json()
    assert state["business_date"] == "2026-10-13"
    assert len(state["guests"]) == 14
    neha = state["guests"][0]
    assert (neha["name"], neha["room"], neha["channel"], neha["consent"]) == (
        "Neha Gupta", 104, "Booking.com", False,
    )  # fmt: skip
    assert "whatsapp" not in str(state).lower()

    token = check_in_neha(client, owner, device)
    give_consent(client, device, token)
    check_consent_storage(sample, caplog)

    out = client.post("/desk/checkout", headers=owner, json={"room": 104}).json()
    assert out["perk_code"] == "DEODAR-NG26"
    amounts = {line["label"]: line["amount"] for line in out["slip"]["lines"]}
    assert amounts == {
        "Room (via Booking.com)": rupees(4_000), "Discount": -rupees(600),
        "Commission": -rupees(612), "GST on commission": -rupees(110),
        "Hotel kept": rupees(2_678),
    }  # fmt: skip
    printed = poll(client, device)
    assert [c["kind"] for c in printed] == ["show_text", "print_slip", "show_idle"]
    assert "DEODAR-NG26" in printed[1]["payload"]["text"]

    final = client.get("/desk/state", headers=owner).json()["guests"][0]
    assert (final["consent"], final["checked_out"], final["perk_code"]) == (
        True,
        True,
        "DEODAR-NG26",
    )
    steps = {s["key"] for s in client.get("/pipeline", headers=owner).json()["steps"] if s["done"]}
    assert {"desk", "slip"} <= steps
    sample.expire_all()
    assert load_ledger(sample, 1).totals == before


@pytest.mark.usefixtures("sample")
def test_walk_in_checkout_slip(client: TestClient, owner: dict[str, str]) -> None:
    out = client.post("/desk/checkout", headers=owner, json={"room": 112}).json()
    labels = [line["label"] for line in out["slip"]["lines"]]
    assert labels == ["Room (Walk-in)", "Booked directly. Hotel kept"]
    assert out["perk_code"] == "DEODAR-AM26"
    again = client.post("/desk/checkout", headers=owner, json={"room": 112}).json()
    assert again["perk_code"] == "DEODAR-AM26"
    late = client.post("/desk/checkin", headers=owner, json={"room": 112})
    assert (late.status_code, late.json()["error"]["code"]) == (409, "already_checked_out")


@pytest.mark.usefixtures("sample")
def test_expired_and_replaced_links(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    first = token_from(
        client.post("/desk/checkin", headers=owner, json={"room": 207}).json()["url"]
    )
    second = token_from(
        client.post("/desk/checkin", headers=owner, json={"room": 207}).json()["url"]
    )
    replaced = client.get(f"/public/consent/{first}")
    assert (replaced.status_code, replaced.json()["error"]["code"]) == (410, "link_expired")
    record = sample.scalars(select(ConsentToken).where(ConsentToken.revoked_at.is_(None))).one()
    record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    sample.commit()
    expired = client.post(
        f"/public/consent/{second}", json={"agree": True, "whatsapp": "9876543210"}
    )
    assert (expired.status_code, expired.json()["error"]["code"]) == (410, "link_expired")
    for bad in ("x" * 43, "short"):
        assert client.get(f"/public/consent/{bad}").status_code == 404


@pytest.mark.usefixtures("sample")
def test_second_consent_updates_the_number(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    for number in ("9876543210", "9123456780"):
        token = token_from(
            client.post("/desk/checkin", headers=owner, json={"room": 207}).json()["url"]
        )
        client.post(f"/public/consent/{token}", json={"agree": True, "whatsapp": number})
    consents = sample.scalars(select(Consent)).all()
    assert len(consents) == 1
    assert consents[0].whatsapp_number == "+919123456780"


@pytest.mark.usefixtures("sample")
def test_device_api_needs_its_key(client: TestClient, device: dict[str, str]) -> None:
    assert client.get("/desk/poll").status_code == 401
    assert client.get("/desk/poll", headers={"X-Device-Key": "wrong"}).status_code == 401
    assert client.post("/desk/ack", json={"ids": [1]}).status_code == 401
    assert client.post("/desk/ack", headers=device, json={"ids": []}).status_code == 422
    assert client.post("/desk/ack", headers=device, json={"ids": [999]}).json() == {"acked": 0}


@pytest.mark.usefixtures("sample")
def test_owner_desk_routes(
    client: TestClient, owner: dict[str, str], device: dict[str, str]
) -> None:
    routes = (("get", "/desk/state"), ("post", "/desk/checkin"), ("post", "/desk/checkout"),
              ("get", "/desk/close-slip"), ("post", "/desk/close-slip"))  # fmt: skip
    for method, path in routes:
        assert client.request(method, path, json={"room": 104}).status_code == 401
        assert client.request(method, path, headers=device, json={"room": 104}).status_code == 401
    assert client.post("/desk/checkin", headers=owner, json={"room": 999}).status_code == 404
    assert client.post("/desk/checkin", headers=owner, json={"room": "abc"}).status_code == 422


@pytest.mark.usefixtures("sample")
def test_close_slip(client: TestClient, owner: dict[str, str], device: dict[str, str]) -> None:
    slip = client.get("/desk/close-slip", headers=owner).json()
    labels = {line["label"]: line["amount"] for line in slip["lines"]}
    assert "Rooms sold: 14" in labels
    assert labels["Gross"] == rupees(58_800)
    assert "Direct bookings: 21%" in labels
    assert slip["footer"] == ["Saved this month: ₹0"]
    client.post("/desk/close-slip", headers=owner)
    assert [c["kind"] for c in poll(client, device)] == ["show_text", "print_slip", "show_idle"]


def test_no_device_registered(client: TestClient, owner: dict[str, str], session: Session) -> None:
    load_sample(session, DEMO_DATE, with_statements=False)
    session.commit()
    state = client.get("/desk/state", headers=owner).json()
    assert state["device"] == {
        "registered": False,
        "name": None,
        "online": False,
        "last_seen": None,
    }
    assert client.post("/desk/checkin", headers=owner, json={"room": 104}).status_code == 200
