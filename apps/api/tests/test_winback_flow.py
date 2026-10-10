"""Approve -> send -> book with code -> correct saving (CLAUDE.md M6 check).

Also ruling 7: OTA matching never makes a guest messageable, and STOP works.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import replace
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app
from app.models import Consent, Message, OptOutEvent
from app.money import rupees
from app.routers.webhooks import MAX_WEBHOOK_BYTES
from app.services.whatsapp import SendResult
from seed.coded_history import CODED_STAYS, TOTAL_NET_SAVING

APP_SECRET = "app-secret"  # pragma: allowlist secret (test value)


def consent_and_checkout(client: TestClient, owner: dict[str, str], room: int, number: str) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": room}).json()["url"]
    token = url.rsplit("/", 1)[-1]
    res = client.post(f"/public/consent/{token}", json={"agree": True, "whatsapp": number})
    assert res.status_code == 200
    client.post("/desk/checkout", headers=owner, json={"room": room})


@pytest.mark.usefixtures("sample")
def test_matched_but_unconsented_guests_get_no_draft_or_send_ruling_7(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    assert client.get("/repeat", headers=owner).json()["count"] == 12
    client.post("/desk/checkout", headers=owner, json={"room": 104})  # Neha: matched, no consent
    client.post("/desk/checkout", headers=owner, json={"room": 207})  # Rahul: matched, no consent
    body = client.get("/messages", headers=owner).json()
    assert (body["pending"], body["messages"]) == (0, [])
    assert sample.scalar(select(func.count()).select_from(Message)) == 0
    assert client.post("/messages/1/approve", headers=owner).status_code == 404


@pytest.mark.usefixtures("sample")
def test_full_winback_loop(client: TestClient, owner: dict[str, str]) -> None:
    savings_before = client.get("/savings", headers=owner).json()
    consent_and_checkout(client, owner, 207, "9876543210")
    body = client.get("/messages", headers=owner).json()
    assert (body["pending"], body["simulated"]) == (1, True)
    draft = body["messages"][0]
    assert draft["perk_code"] == "DEODAR-RS26"
    assert draft["body"].startswith("Namaste Rahul ji")
    assert "http://localhost:3000/link/DEODAR-RS26" in draft["body"]
    assert draft["body"].endswith("Reply STOP to opt out.")
    assert "whatsapp" not in json.dumps(body).lower().replace('"simulated"', "")
    assert client.get("/messages", headers=owner).json()["pending"] == 1  # no duplicate draft

    sent = client.post(f"/messages/{draft['id']}/approve", headers=owner).json()
    assert sent["messages"][0]["status"] == "sent"
    assert sent["messages"][0]["transport"] == "simulated"
    again = client.post(f"/messages/{draft['id']}/approve", headers=owner)
    assert (again.status_code, again.json()["error"]["code"]) == (409, "not_a_draft")

    page = client.get("/public/link?code=deodar-rs26").json()
    assert page["code_status"] == "valid"
    assert "Rahul" not in json.dumps(page), "no name until the code is accepted (D-076)"
    deluxe = next(r for r in page["rooms"] if r["room_type"] == "Deluxe Valley View")
    assert deluxe["nightly_rate"] == rupees(4_300)
    first = page["dates"][0]
    assert first["nights"] == 2 and " · 2 nights" in first["label"]

    booked = client.post("/public/link/book", json={
        "code": "DEODAR-RS26", "check_in": first["check_in"], "nights": 2,
        "room_type": "Deluxe Valley View",
    })  # fmt: skip
    assert booked.status_code == 200, booked.text
    assert (booked.json()["amount"], booked.json()["perk_applied"]) == (rupees(8_600), True)
    assert booked.json()["guest_short_name"] == "Rahul ji"
    assert "saving" not in json.dumps(booked.json()).lower()

    savings = client.get("/savings", headers=owner).json()
    assert savings["count"] == len(CODED_STAYS) + 1  # plus the seeded history (D-080)
    item = next(i for i in savings["items"] if i["code"] == "DEODAR-RS26")
    assert (item["commission_avoided"], item["gst_avoided"]) == (rupees(1_892), rupees(341))
    assert savings["total_avoided"] - savings_before["total_avoided"] == rupees(2_233)
    assert savings["total_net_saving"] == TOTAL_NET_SAVING + rupees(2_199)
    assert (item["upi_fee"], item["net_saving"]) == (rupees(34), rupees(2_199))
    assert (item["original_channel"], item["commission_rate_used"]) == ("MakeMyTrip", 2_200)

    twice = client.post("/public/link/book", json={
        "code": "DEODAR-RS26", "check_in": first["check_in"], "nights": 2,
        "room_type": "Deluxe Valley View",
    })  # fmt: skip
    assert (twice.status_code, twice.json()["error"]["code"]) == (409, "code_used")
    assert client.get("/public/link?code=DEODAR-RS26").json()["code_status"] == "used"
    assert client.get("/savings", headers=owner).json()["count"] == len(CODED_STAYS) + 1

    steps = {s["key"] for s in client.get("/pipeline", headers=owner).json()["steps"] if s["done"]}
    assert {"desk", "slip", "msg", "book"} <= steps


@pytest.mark.usefixtures("sample")
def test_stop_blocks_pending_and_future_sends(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_and_checkout(client, owner, 104, "9876543210")
    draft = client.get("/messages", headers=owner).json()["messages"][0]
    body = client.post(f"/messages/{draft['id']}/simulate-reply", headers=owner,
                       json={"text": "STOP"}).json()  # fmt: skip
    assert body["messages"][0]["status"] == "blocked"
    assert body["messages"][0]["consent_active"] is False
    res = client.post(f"/messages/{draft['id']}/approve", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (409, "not_a_draft")
    consent = sample.scalars(select(Consent)).one()
    assert consent.withdrawn_at is not None
    assert sample.scalars(select(OptOutEvent)).one().source == "simulated"
    assert client.get("/messages", headers=owner).json()["pending"] == 0
    not_stop = client.post(f"/messages/{draft['id']}/simulate-reply", headers=owner,
                           json={"text": "Thanks!"})  # fmt: skip
    assert not_stop.status_code == 200


@pytest.mark.usefixtures("sample")
def test_withdrawn_after_draft_cannot_be_sent(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_and_checkout(client, owner, 104, "9876543210")
    draft = client.get("/messages", headers=owner).json()["messages"][0]
    consent = sample.scalars(select(Consent)).one()
    consent.withdrawn_at = consent.given_at
    sample.commit()
    res = client.post(f"/messages/{draft['id']}/approve", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (409, "consent_withdrawn")


@pytest.mark.usefixtures("sample")
def test_reject_draft(client: TestClient, owner: dict[str, str]) -> None:
    consent_and_checkout(client, owner, 104, "9876543210")
    draft = client.get("/messages", headers=owner).json()["messages"][0]
    body = client.post(f"/messages/{draft['id']}/reject", headers=owner).json()
    assert body["messages"][0]["status"] == "rejected"
    assert client.post(f"/messages/{draft['id']}/reject", headers=owner).status_code == 409
    assert client.post("/messages/999/reject", headers=owner).status_code == 404
    assert client.post("/messages/999/simulate-reply", headers=owner,
                       json={"text": "STOP"}).status_code == 404  # fmt: skip


class FailingSender:
    """WhatsApp refuses."""

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        _ = (to, body, message_id)
        return SendResult(ok=False, transport="whatsapp", error="WhatsApp refused the message")


@pytest.mark.usefixtures("sample")
def test_failed_send_leaves_a_draft(client: TestClient, owner: dict[str, str]) -> None:
    consent_and_checkout(client, owner, 104, "9876543210")
    client.app.state.sender = FailingSender()  # type: ignore[attr-defined]
    draft = client.get("/messages", headers=owner).json()["messages"][0]
    res = client.post(f"/messages/{draft['id']}/approve", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (502, "send_failed")
    assert client.get("/messages", headers=owner).json()["messages"][0]["status"] == "draft"


@pytest.mark.usefixtures("sample")
def test_booking_without_code_claims_no_saving(client: TestClient, owner: dict[str, str]) -> None:
    page = client.get("/public/link").json()
    assert page["code_status"] == "none"
    res = client.post("/public/link/book", json={
        "check_in": page["dates"][1]["check_in"], "nights": 2, "room_type": "Standard",
    })  # fmt: skip
    assert (res.json()["amount"], res.json()["perk_applied"]) == (rupees(6_800), False)
    # An uncoded booking claims no saving: the ledger holds only the seeded history.
    savings = client.get("/savings", headers=owner).json()
    assert (savings["count"], savings["total_net_saving"]) == (len(CODED_STAYS), TOTAL_NET_SAVING)
    assert {i["code"] for i in savings["items"]} == {s.code for s in CODED_STAYS}


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    ("change", "status", "code"),
    [
        ({"code": "NOPE-XX26"}, 422, "unknown_code"),
        ({"room_type": "Penthouse"}, 422, "unknown_room"),
        ({"check_in": "2026-10-01"}, 422, "invalid_dates"),
        ({"check_in": "2028-01-01"}, 422, "invalid_dates"),
        ({"nights": 0}, 422, "invalid_input"),
        ({"payment": "cash"}, 422, "invalid_input"),
    ],
)
def test_booking_bad_input(
    client: TestClient, change: dict[str, object], status: int, code: str
) -> None:
    body: dict[str, object] = {"check_in": "2026-11-20", "nights": 2, "room_type": "Standard"}
    body.update(change)
    res = client.post("/public/link/book", json=body)
    assert (res.status_code, res.json()["error"]["code"]) == (status, code)


@pytest.mark.usefixtures("sample")
def test_sold_out(client: TestClient) -> None:
    body = {"check_in": "2026-11-20", "nights": 1, "room_type": "Family Suite"}
    codes = [client.post("/public/link/book", json=body).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 200, 409]


def test_unknown_code_status(client: TestClient, sample: Session) -> None:
    _ = sample
    assert client.get("/public/link?code=ZZZ").json()["code_status"] == "unknown"
    assert client.get("/savings").status_code == 401
    assert client.get("/messages").status_code == 401
    assert (
        date.fromisoformat(client.get("/public/link").json()["dates"][0]["check_in"]).weekday() == 4
    )


# --- webhook -----------------------------------------------------------------------


@pytest.fixture(name="hooked")
def fixture_hooked(settings: Settings, factory: sessionmaker[Session]) -> TestClient:
    configured = replace(
        settings, whatsapp_verify_token="verify-me", whatsapp_app_secret=APP_SECRET
    )
    return TestClient(create_app(configured, factory))


def signed(body: bytes, secret: str = APP_SECRET) -> dict[str, str]:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return {"X-Hub-Signature-256": f"sha256={digest}", "content-type": "application/json"}


@pytest.mark.usefixtures("sample")
def test_webhook_verification(hooked: TestClient, client: TestClient) -> None:
    ok = hooked.get(
        "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42"
    )
    assert (ok.status_code, ok.text) == (200, "42")
    assert (
        hooked.get("/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=no").status_code == 403
    )
    assert client.get("/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=").status_code == 403


@pytest.mark.usefixtures("sample")
def test_webhook_stop(
    hooked: TestClient, client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_and_checkout(client, owner, 104, "9876543210")
    payload = {"entry": [{"changes": [{"value": {"messages": [
        {"from": "919876543210", "text": {"body": "STOP"}}]}}]}]}  # fmt: skip
    raw = json.dumps(payload).encode()
    assert client.post("/webhooks/whatsapp", content=raw).status_code == 503
    assert (
        hooked.post("/webhooks/whatsapp", content=raw, headers=signed(raw, "wrong")).status_code
        == 401
    )
    assert hooked.post("/webhooks/whatsapp", content=b"{", headers=signed(b"{")).status_code == 422
    res = hooked.post("/webhooks/whatsapp", content=raw, headers=signed(raw))
    assert res.json() == {"withdrawn": 1}
    sample.expire_all()
    assert sample.scalars(select(Consent)).one().withdrawn_at is not None
    again = hooked.post("/webhooks/whatsapp", content=raw, headers=signed(raw))
    assert again.json() == {"withdrawn": 0}
    junk = json.dumps({"entry": [{"changes": [{"value": {"messages": [
        {"from": "12", "text": {"body": "STOP"}}]}}]}]}).encode()  # fmt: skip
    assert hooked.post("/webhooks/whatsapp", content=junk, headers=signed(junk)).json() == {
        "withdrawn": 0
    }


@pytest.mark.usefixtures("sample")
def test_consent_after_checkout_still_drafts_once(
    client: TestClient, owner: dict[str, str]
) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": 104}).json()["url"]
    client.post("/desk/checkout", headers=owner, json={"room": 104})
    assert client.get("/messages", headers=owner).json()["pending"] == 0
    token = url.rsplit("/", 1)[-1]
    client.post(f"/public/consent/{token}", json={"agree": True, "whatsapp": "9876543210"})
    client.post("/desk/checkout", headers=owner, json={"room": 104})
    body = client.get("/messages", headers=owner).json()
    assert body["pending"] == 1
    assert len(body["messages"]) == 1


def test_webhook_refuses_an_oversized_body_before_checking_it(hooked: TestClient) -> None:
    raw = b'{"x": "' + b"a" * (MAX_WEBHOOK_BYTES + 1) + b'"}'
    res = hooked.post("/webhooks/whatsapp", content=raw, headers=signed(raw))
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "body_too_large"
