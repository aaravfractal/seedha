"""Guest inbox (D5, D6): consent-only threads, the 24-hour window, STOP,
away text approval and limits, the AI draft guard, and Forget."""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass, field, replace
from datetime import timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app
from app.models import Consent, InboxMessage, OptOutEvent
from app.services.drafter import STOP_LINE
from app.services.inbox import d6_ok, with_stop
from app.services.whatsapp import CloudApiSender, SendResult

APP_SECRET = "inbox-secret"  # pragma: allowlist secret (test value)
NUMBER = "9876543210"


@dataclass
class RecordingSender:
    """Records every send; nothing leaves the test."""

    sent: list[str] = field(default_factory=list)

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        _ = (to, message_id)
        self.sent.append(body)
        return SendResult(ok=True, transport="simulated", provider_id=f"t-{len(self.sent)}")


@dataclass
class FixedWording:
    """An AI suggestion with fixed text."""

    text: str
    calls: int = 0

    def reply(self, guest: str, hotel: str, last_message: str) -> str | None:
        _ = (guest, hotel, last_message)
        self.calls += 1
        return self.text


@pytest.fixture(name="sender")
def fixture_sender(client: TestClient) -> RecordingSender:
    recorder = RecordingSender()
    client.app.state.sender = recorder  # type: ignore[attr-defined]
    return recorder


def consent(
    client: TestClient, owner: dict[str, str], room: int = 104, number: str = NUMBER
) -> int:
    """Desk check-in and the guest's yes. Returns the thread (consent) id."""
    url = client.post("/desk/checkin", headers=owner, json={"room": room}).json()["url"]
    token = url.rsplit("/", 1)[-1]
    res = client.post(f"/public/consent/{token}", json={"agree": True, "whatsapp": number})
    assert res.status_code == 200, res.text
    threads = client.get("/inbox/threads", headers=owner).json()["threads"]
    return int(threads[0]["consent_id"])


def guest_writes(client: TestClient, owner: dict[str, str], cid: int, text: str) -> TestClient:
    res = client.post(f"/inbox/threads/{cid}/simulate", headers=owner, json={"text": text})
    assert res.status_code == 200, res.text
    return client


def inbox_count(session: Session) -> int:
    session.expire_all()
    return int(session.scalar(select(func.count()).select_from(InboxMessage)) or 0)


# --- threads are consented guests only ---------------------------------------------


@pytest.mark.usefixtures("sample")
def test_inbox_is_empty_until_a_guest_consents_at_the_desk(
    client: TestClient, owner: dict[str, str]
) -> None:
    assert client.get("/repeat", headers=owner).json()["count"] == 12  # matched, not consented
    body = client.get("/inbox/threads", headers=owner).json()
    assert body["threads"] == []
    assert body["counts"] == {"all": 0, "unread": 0, "auto": 0, "open": 0}
    assert body["away"] == {"text": None, "approved_at": None, "enabled": False}
    assert body["simulated"] is True
    lines = [r["line"] for r in body["rate_card"]]
    assert "Deluxe Valley View: ₹4,300 a night." in lines

    cid = consent(client, owner)
    threads = client.get("/inbox/threads", headers=owner).json()["threads"]
    assert [t["guest_name"] for t in threads] == ["Neha Gupta"]
    assert threads[0]["consent_id"] == cid
    assert threads[0]["last"] is None and threads[0]["window_open"] is False
    assert NUMBER not in json.dumps(threads)
    detail = client.get(f"/inbox/threads/{cid}/messages", headers=owner).json()
    assert detail["can_reply"] is False
    assert detail["profile"]["guest_name"] == "Neha Gupta"
    assert detail["profile"]["stays"], "stays come from bookings linked to the guest"
    assert detail["booking"]["kind"] == "stay"
    assert NUMBER not in json.dumps(detail)


@pytest.mark.usefixtures("sample")
def test_unconsented_number_gets_no_thread_via_webhook(
    settings: Settings, factory: sessionmaker[Session], client: TestClient,
    owner: dict[str, str], sample: Session,
) -> None:  # fmt: skip
    hooked = TestClient(create_app(replace(settings, whatsapp_app_secret=APP_SECRET), factory))
    hooked.app.state.sender = RecordingSender()  # type: ignore[attr-defined]
    cid = consent(client, owner)

    def post(number: str, text: str) -> dict[str, int]:
        raw = json.dumps({"entry": [{"changes": [{"value": {"messages": [
            {"from": number, "text": {"body": text}}]}}]}]}).encode()  # fmt: skip
        digest = hmac.new(APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
        headers = {"X-Hub-Signature-256": f"sha256={digest}", "content-type": "application/json"}
        res = hooked.post("/webhooks/whatsapp", content=raw, headers=headers)
        assert res.status_code == 200
        return dict(res.json())

    assert post("919811111111", "Hello, is a room free?") == {"withdrawn": 0}
    assert inbox_count(sample) == 0, "a number without Desk consent never gets a thread"
    assert post("919876543210", "Is a valley view room free on 7 Nov?") == {"withdrawn": 0}
    assert inbox_count(sample) == 1
    thread = client.get("/inbox/threads", headers=owner).json()["threads"][0]
    assert (thread["consent_id"], thread["unread"], thread["window_open"]) == (cid, 1, True)
    assert post("919876543210", "STOP") == {"withdrawn": 1}, "STOP works exactly as before"
    assert inbox_count(sample) == 1, "STOP itself is not stored"
    assert client.get("/inbox/threads", headers=owner).json()["threads"] == []


# --- owner sends ----------------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_owner_send_only_inside_the_24_hour_window(
    client: TestClient, owner: dict[str, str], sender: RecordingSender, sample: Session
) -> None:
    cid = consent(client, owner)
    res = client.post(f"/inbox/threads/{cid}/messages", headers=owner, json={"body": "Hello"})
    assert (res.status_code, res.json()["error"]["code"]) == (409, "window_closed")
    assert "template" in res.json()["error"]["message"]
    assert sender.sent == []

    guest_writes(client, owner, cid, "Hi, planning Diwali with the kids.")
    assert client.get("/inbox/threads?filter=unread", headers=owner).json()["counts"]["unread"] == 1
    res = client.post(f"/inbox/threads/{cid}/messages", headers=owner,
                      json={"body": "Yes, a valley view room is free."})  # fmt: skip
    assert res.status_code == 200, res.text
    assert sender.sent == [f"Yes, a valley view room is free. {STOP_LINE}"]
    detail = res.json()
    assert [m["direction"] for m in detail["messages"]] == ["in", "out"]
    assert detail["messages"][-1]["sent_by"] == "owner"
    assert detail["thread"]["unread"] == 0

    # The window closes 24 hours after the guest last wrote.
    sample.expire_all()
    for row in sample.scalars(select(InboxMessage)):
        row.created_at = row.created_at - timedelta(hours=25)
    sample.commit()
    late = client.post(f"/inbox/threads/{cid}/messages", headers=owner, json={"body": "Hi"})
    assert (late.status_code, late.json()["error"]["code"]) == (409, "window_closed")
    assert len(sender.sent) == 1


def test_stop_line_is_added_once() -> None:
    assert with_stop("See you soon.") == f"See you soon. {STOP_LINE}"
    assert with_stop(f"Code X. {STOP_LINE}") == f"Code X. {STOP_LINE}"
    assert with_stop("reply stop to opt out") == "reply stop to opt out"


@pytest.mark.usefixtures("sample")
def test_stop_hides_the_thread_and_blocks_every_send(
    client: TestClient, owner: dict[str, str], sender: RecordingSender, sample: Session
) -> None:
    cid = consent(client, owner)
    guest_writes(client, owner, cid, "Hello")
    res = client.post(f"/inbox/threads/{cid}/simulate", headers=owner, json={"text": "Stop"})
    assert (res.status_code, res.json()) == (200, None)
    sample.expire_all()
    assert sample.scalars(select(Consent)).one().withdrawn_at is not None
    assert sample.scalars(select(OptOutEvent)).one().source == "simulated"
    assert client.get("/inbox/threads", headers=owner).json()["threads"] == []
    for method, path, body in (
        ("GET", f"/inbox/threads/{cid}/messages", None),
        ("POST", f"/inbox/threads/{cid}/messages", {"body": "Hello"}),
        ("POST", f"/inbox/threads/{cid}/draft", None),
        ("POST", f"/inbox/threads/{cid}/simulate", {"text": "hi"}),
    ):
        r = client.request(method, path, headers=owner, json=body)
        assert (r.status_code, r.json()["error"]["code"]) == (404, "no_such_thread")
    assert sender.sent == []


@pytest.mark.usefixtures("sample")
def test_withdrawn_between_reads_cannot_be_sent(
    client: TestClient, owner: dict[str, str], sender: RecordingSender, sample: Session
) -> None:
    cid = consent(client, owner)
    guest_writes(client, owner, cid, "Hello")
    row = sample.get(Consent, cid)
    assert row is not None
    row.withdrawn_at = row.given_at
    sample.commit()
    res = client.post(f"/inbox/threads/{cid}/messages", headers=owner, json={"body": "Hi"})
    assert res.status_code == 404
    assert sender.sent == []


# --- away text --------------------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_away_text_needs_approval_and_replies_once_a_day(
    client: TestClient, owner: dict[str, str], sender: RecordingSender, sample: Session
) -> None:
    on = client.patch("/inbox/away", headers=owner, json={"enabled": True})
    assert (on.status_code, on.json()["error"]["code"]) == (409, "away_text_missing")
    unapproved = client.patch("/inbox/away", headers=owner, json={"text": "Away till 8 AM."})
    assert (unapproved.status_code, unapproved.json()["error"]["code"]) == (
        422, "approval_required")  # fmt: skip
    assert client.get("/inbox/threads", headers=owner).json()["away"]["text"] is None

    saved = client.patch("/inbox/away", headers=owner,
                         json={"text": "Rajesh ji is away and will reply by 8 AM.",
                               "approved": True})  # fmt: skip
    assert saved.status_code == 200
    assert saved.json()["text"] == f"Rajesh ji is away and will reply by 8 AM. {STOP_LINE}"
    assert saved.json()["enabled"] is False

    cid = consent(client, owner)
    guest_writes(client, owner, cid, "Hello, first message")
    assert sender.sent == [], "away is off: nothing is sent"

    assert client.patch("/inbox/away", headers=owner, json={"enabled": True}).json()["enabled"]
    guest_writes(client, owner, cid, "Are you there?")
    assert sender.sent == [f"Rajesh ji is away and will reply by 8 AM. {STOP_LINE}"]
    guest_writes(client, owner, cid, "Hello again")
    assert len(sender.sent) == 1, "at most one away reply per thread per 24 hours"
    thread = client.get("/inbox/threads?filter=auto", headers=owner).json()
    assert [t["consent_id"] for t in thread["threads"]] == [cid]
    assert thread["threads"][0]["auto_replied"] is True

    sample.expire_all()
    for row in sample.scalars(select(InboxMessage).where(InboxMessage.sent_by == "away")):
        row.created_at = row.created_at - timedelta(hours=25)
    sample.commit()
    guest_writes(client, owner, cid, "Next day")
    assert len(sender.sent) == 2

    off = client.patch("/inbox/away", headers=owner, json={"enabled": False})
    assert off.json()["enabled"] is False


@pytest.mark.usefixtures("sample")
def test_away_never_writes_to_a_guest_who_did_not_write(
    client: TestClient, owner: dict[str, str], sender: RecordingSender
) -> None:
    client.patch("/inbox/away", headers=owner,
                 json={"text": "Away now.", "approved": True, "enabled": True})  # fmt: skip
    consent(client, owner)
    consent(client, owner, room=207, number="9811111111")
    assert sender.sent == []


# --- AI drafts (D6) -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "ok"),
    [
        ("Yes, a valley view room is free for 2 nights.", True),
        ("Your code DEODAR-NG26 is saved.", True),
        ("The room is ₹4,300 a night.", False),
        ("Only Rs 4300 for you.", False),
        ("Only rs.900 tonight.", False),
        ("Room 1204 is ready.", False),
        ("We have 150 happy guests.", False),
        ("Call 9876543210.", False),
        ("Get 20% off.", False),
    ],
)
def test_d6_guard(text: str, ok: bool) -> None:
    assert d6_ok(text) is ok


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    ("ai_text", "source"),
    [
        ("Namaste Neha ji, yes we can host you for 2 nights.", "ai"),
        ("Namaste Neha ji, the Deluxe is ₹4,300.", "template"),
        ("Namaste Neha ji, only rs 4300 a night.", "template"),
        ("Namaste Neha ji, room 1204 is free.", "template"),
    ],
)
def test_draft_is_returned_never_sent_and_guarded(
    client: TestClient, owner: dict[str, str], sender: RecordingSender, sample: Session,
    ai_text: str, source: str,
) -> None:  # fmt: skip
    cid = consent(client, owner)
    guest_writes(client, owner, cid, "Is a room free on 7 Nov?")
    stored = inbox_count(sample)
    client.app.state.reply_wording = FixedWording(ai_text)  # type: ignore[attr-defined]
    res = client.post(f"/inbox/threads/{cid}/draft", headers=owner)
    assert res.status_code == 200
    body = res.json()
    assert (body["source"], body["label"]) == (source, "Bot drafts, you send.")
    if source == "ai":
        assert body["text"] == ai_text
    else:
        assert "₹" not in body["text"] and "Neha ji" in body["text"]
    assert sender.sent == [], "a draft is never sent"
    assert inbox_count(sample) == stored


@pytest.mark.usefixtures("sample")
def test_draft_without_claude_is_the_canned_reply(
    client: TestClient, owner: dict[str, str]
) -> None:
    cid = consent(client, owner)
    body = client.post(f"/inbox/threads/{cid}/draft", headers=owner).json()
    assert body["source"] == "template"
    assert body["text"].startswith("Namaste Neha ji")


# --- Forget ----------------------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_forget_erases_the_guest_and_their_texts(
    client: TestClient, owner: dict[str, str], sender: RecordingSender, sample: Session
) -> None:
    cid = consent(client, owner)
    guest_writes(client, owner, cid, "Hello")
    client.post(f"/inbox/threads/{cid}/messages", headers=owner, json={"body": "Namaste"})
    assert len(sender.sent) == 1
    no = client.post(f"/inbox/threads/{cid}/forget", headers=owner, json={"confirm": False})
    assert (no.status_code, no.json()["error"]["code"]) == (422, "confirm_required")
    res = client.post(f"/inbox/threads/{cid}/forget", headers=owner, json={"confirm": True})
    assert res.json() == {"forgotten": True}
    assert inbox_count(sample) == 0
    row = sample.get(Consent, cid)
    assert row is not None
    assert (row.whatsapp_number, row.salt, row.proof_status) == (None, None, "erased")
    assert row.erased_at is not None
    assert client.get("/inbox/threads", headers=owner).json()["threads"] == []
    assert client.get(f"/inbox/threads/{cid}/messages", headers=owner).status_code == 404


# --- search, filters, read ----------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_search_filters_and_read(client: TestClient, owner: dict[str, str]) -> None:
    neha = consent(client, owner)
    rahul = consent(client, owner, room=207, number="9811111111")
    guest_writes(client, owner, rahul, "Late checkout please")
    body = client.get("/inbox/threads", headers=owner).json()
    assert body["counts"] == {"all": 2, "unread": 1, "auto": 0, "open": 1}
    assert body["threads"][0]["consent_id"] == rahul, "newest message first"
    found = client.get("/inbox/threads?q=neha", headers=owner).json()["threads"]
    assert [t["consent_id"] for t in found] == [neha]
    opened = client.get("/inbox/threads?filter=open", headers=owner).json()["threads"]
    assert [t["consent_id"] for t in opened] == [rahul]
    assert client.get("/inbox/threads?filter=nope", headers=owner).status_code == 422
    read = client.post(f"/inbox/threads/{rahul}/read", headers=owner).json()
    assert read["unread"] == 0
    assert client.get("/inbox/threads?filter=unread", headers=owner).json()["threads"] == []


@pytest.mark.usefixtures("sample")
def test_sent_winback_message_appears_in_the_thread(
    client: TestClient, owner: dict[str, str]
) -> None:
    cid = consent(client, owner)
    client.post("/desk/checkout", headers=owner, json={"room": 104})
    draft = client.get("/messages", headers=owner).json()["messages"][0]
    client.post(f"/messages/{draft['id']}/approve", headers=owner)
    detail = client.get(f"/inbox/threads/{cid}/messages", headers=owner).json()
    assert [(m["kind"], m["direction"]) for m in detail["messages"]] == [("winback", "out")]
    assert detail["profile"]["perk_code"] == draft["perk_code"]
    assert any(draft["perk_code"] in s for s in detail["suggestions"])
    assert detail["booking"]["link"].endswith(f"/link/{draft['perk_code']}")


# --- security review rules (sample sender, other links, D6 stripping order) --------------


@pytest.mark.usefixtures("sample")
def test_sample_hotel_never_uses_the_live_sender(
    client: TestClient, owner: dict[str, str], settings: Settings
) -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return httpx.Response(200, json={"messages": [{"id": "wamid.x"}]})

    live = replace(settings, whatsapp_token="t", whatsapp_phone_number_id="1")  # noqa: S106
    client.app.state.sender = CloudApiSender(  # type: ignore[attr-defined]
        live, httpx.Client(transport=httpx.MockTransport(handler))
    )
    cid = consent(client, owner)
    client.patch("/inbox/away", headers=owner,
                 json={"text": "Away now.", "approved": True, "enabled": True})  # fmt: skip
    guest_writes(client, owner, cid, "Hello")
    res = client.post(f"/inbox/threads/{cid}/messages", headers=owner, json={"body": "Namaste"})
    assert res.status_code == 200, res.text
    assert calls == [], "the sample hotel never reaches the WhatsApp Cloud API"
    assert {m["transport"] for m in res.json()["messages"] if m["direction"] == "out"} == {
        "simulated"
    }


@pytest.mark.usefixtures("sample")
def test_owner_text_may_carry_only_the_perk_link(
    client: TestClient, owner: dict[str, str], sender: RecordingSender
) -> None:
    cid = consent(client, owner)
    client.post("/desk/checkout", headers=owner, json={"room": 104})
    guest_writes(client, owner, cid, "Hello")
    detail = client.get(f"/inbox/threads/{cid}/messages", headers=owner).json()
    link = detail["booking"]["link"]
    for text in ("Pay at https://evil.example.com now", "See www.cheap-rooms.in", "Try bookme.com"):
        res = client.post(f"/inbox/threads/{cid}/messages", headers=owner, json={"body": text})
        assert (res.status_code, res.json()["error"]["code"]) == (422, "other_link"), text
    ok = client.post(f"/inbox/threads/{cid}/messages", headers=owner,
                     json={"body": f"Book here: {link}"})  # fmt: skip
    assert ok.status_code == 200, ok.text
    assert len(sender.sent) == 1
    bad = {"text": "Away. See https://x.example.com", "approved": True}
    away = client.patch("/inbox/away", headers=owner, json=bad)
    assert (away.status_code, away.json()["error"]["code"]) == (422, "other_link")


def test_d6_strips_the_link_before_the_code() -> None:
    link, code = "http://localhost:3000/link/DEODAR-NG26", "DEODAR-NG26"
    text = f"Your code {code} works here: {link}"
    assert d6_ok(text, link=link, code=code) is True
    assert d6_ok(text) is False, "the port in the link is a 4-digit number"


def test_data_deletion_also_erases_inbox_texts(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    """Every erasure path ends in proof.erase_consent, which deletes the texts."""
    cid = consent(client, owner, room=104)  # Neha, booking BK90000
    guest_writes(client, owner, cid, "Is breakfast included?")
    assert inbox_count(sample) == 1
    res = client.post("/public/data-deletion", json={"booking_ref": "BK90000", "phone": NUMBER})
    assert res.status_code == 200
    assert inbox_count(sample) == 0
