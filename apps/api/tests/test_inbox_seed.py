"""Sample inbox threads (POLISH_BUILD B): the seed, Simulate incoming message,
topic drafts with the D6 guard, the invoice attachment hint, the profile
column and erasure of what Seedha remembers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Consent,
    DirectBooking,
    GuestMemory,
    InboxMessage,
    Message,
    PerkCode,
    Property,
    StayInvoice,
)
from app.services.consent import WORDING_VERSION, fingerprint
from app.services.drafter import MONEY_PATTERN, STOP_LINE
from app.services.inbox import (
    SIMULATE_TEXTS,
    TEMPLATES,
    d6_ok,
    language_of,
    seeded_number,
    topic_of,
)
from app.services.whatsapp import SendResult, is_stop
from seed.inbox_threads import THREADS
from seed.load import load_sample
from tests.conftest import DEMO_DATE, DEVICE_KEY

TOPICS = {"invoice", "late_checkout", "early_checkin", "parking", "booking", "wifi", "refund",
          "directions"}  # fmt: skip


@dataclass
class Recorder:
    """Records every send; nothing leaves the test."""

    sent: int = 0

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        _ = (to, body, message_id)
        self.sent += 1
        return SendResult(ok=True, transport="simulated", provider_id=f"t-{self.sent}")


@dataclass
class FixedWording:
    """An AI suggestion with fixed text."""

    text: str

    def reply(self, guest: str, hotel: str, last_message: str) -> str | None:
        _ = (guest, hotel, last_message)
        return self.text


@pytest.fixture(name="inbox")
def fixture_inbox(session: Session) -> Session:
    """The sample hotel with statements and the eight seeded inbox threads."""
    load_sample(session, DEMO_DATE, with_statements=True, device_key=DEVICE_KEY, with_inbox=True)
    session.commit()
    return session


@pytest.fixture(name="recorder")
def fixture_recorder(client: TestClient) -> Recorder:
    recorder = Recorder()
    client.app.state.sender = recorder  # type: ignore[attr-defined]
    return recorder


def threads(client: TestClient, owner: dict[str, str]) -> list[dict[str, Any]]:
    body: list[dict[str, Any]] = client.get("/inbox/threads", headers=owner).json()["threads"]
    return body


def count(session: Session, model: type[Any], *where: Any) -> int:
    session.expire_all()
    return int(session.scalar(select(func.count()).select_from(model).where(*where)) or 0)


def thread_by_topic(client: TestClient, owner: dict[str, str], topic: str) -> int:
    """The thread whose guest last wrote about `topic`."""
    for t in threads(client, owner):
        cid = int(t["consent_id"])
        msgs = client.get(f"/inbox/threads/{cid}/messages", headers=owner).json()["messages"]
        if topic_of([m["body"] for m in msgs if m["direction"] == "in"][-1]) == topic:
            return cid
    raise AssertionError(f"no thread about {topic}")


# --- the seed ------------------------------------------------------------------------


def test_eight_threads_each_on_a_desk_consent(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    listed = threads(client, owner)
    assert len(listed) == 8
    consents = inbox.scalars(select(Consent)).all()
    assert len(consents) == 8
    numbers = {c.whatsapp_number for c in consents}
    assert numbers == {seeded_number(i) for i in range(8)}
    for c in consents:
        # Rule 4: a Desk consent on a Desk register stay, never an OTA statement row.
        assert c.seeded and c.is_active and c.booking.source == "desk"
        assert c.booking.checked_out_at is not None and c.booking.check_in < DEMO_DATE
        assert c.booking.check_in > c.booking.check_in.replace(month=9, day=30)
        assert c.wording_version == WORDING_VERSION and c.salt
        given = c.given_at if c.given_at.tzinfo else c.given_at.replace(tzinfo=UTC)
        assert c.fingerprint == fingerprint(c.salt, c.booking_id, given, c.wording_version)
        assert c.proof_status == "verified"
    rooms = [(c.booking.check_in, c.booking.room_id) for c in consents]
    assert len(set(rooms)) == 8, "no two threads share a room on the same night"
    assert all(str(number) not in json.dumps(listed) for number in numbers)
    # A mix of states: unread, read and replied.
    assert sum(1 for t in listed if t["unread"]) == sum(1 for t in THREADS if t.unread) == 4
    assert any(t["last"]["direction"] == "out" for t in listed)
    assert any(t["last"]["direction"] == "in" and not t["unread"] for t in listed)
    assert all(t["window_open"] for t in listed), "the demo can reply at once"
    languages = {language_of(m.body) for m in inbox.scalars(select(InboxMessage))}
    assert languages == {"en", "hi", "hinglish"}


def test_seed_creates_no_codes_drafts_savings_or_invoices(inbox: Session) -> None:
    assert count(inbox, PerkCode, PerkCode.origin_booking_id.in_(select(Consent.booking_id))) == 0
    assert count(inbox, Message) == 0
    assert count(inbox, StayInvoice) == 0
    seeded_bookings = select(Consent.booking_id)
    assert count(inbox, DirectBooking, DirectBooking.booking_id.in_(seeded_bookings)) == 0
    out = inbox.scalars(select(InboxMessage).where(InboxMessage.direction == "out")).all()
    assert out and all(m.body.endswith(STOP_LINE) for m in out)
    guest_texts = [m.body for m in inbox.scalars(select(InboxMessage))]
    assert not any(is_stop(t) for t in guest_texts)
    assert not any("₹" in t or "Rs " in t for t in guest_texts)
    memories = inbox.scalars(select(GuestMemory)).all()
    assert len({m.guest_id for m in memories if m.kind == "preference"}) == 8
    assert all(MONEY_PATTERN.search(m.text) is None for m in memories)


@pytest.mark.usefixtures("inbox")
def test_locked_numbers_pipeline_and_proof_unchanged(
    client: TestClient, owner: dict[str, str]
) -> None:
    totals = client.get("/ledger/channels", headers=owner).json()["totals"]
    assert totals["paid_to_channels"] == 10_39_108_00
    assert totals["net_kept"] == 47_33_012_00
    repeat = client.get("/repeat", headers=owner).json()
    assert (repeat["count"], repeat["paid_twice_total"]) == (12, 41_800_00)
    steps = {s["key"]: s["done"] for s in client.get("/pipeline", headers=owner).json()["steps"]}
    assert steps["desk"] is False and steps["msg"] is False and steps["book"] is False
    proof = client.get("/proof", headers=owner).json()
    assert (proof["pending"], proof["proven"], len(proof["bundles"])) == (0, 8, 1)
    assert proof["mismatches"] == 0
    assert client.get("/messages", headers=owner).json()["messages"] == []


def test_seed_is_off_by_default(client: TestClient, owner: dict[str, str], sample: Session) -> None:
    assert threads(client, owner) == []
    assert count(sample, GuestMemory) == 0


def test_messages_follow_consent_when_demo_date_is_ahead(session: Session) -> None:
    early = datetime(2026, 10, 1, tzinfo=UTC)  # before the stays: the anchor moves later
    load_sample(session, DEMO_DATE, with_statements=False, with_inbox=True, now=early)
    for consent in session.scalars(select(Consent)):
        given = consent.given_at.replace(tzinfo=UTC)
        for m in session.scalars(select(InboxMessage).where(InboxMessage.consent_id == consent.id)):
            assert m.created_at.replace(tzinfo=UTC) > given


def test_reset_recreates_the_threads(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    cid = threads(client, owner)[0]["consent_id"]
    client.post(f"/inbox/threads/{cid}/forget", headers=owner, json={"confirm": True})
    assert len(threads(client, owner)) == 7
    assert client.post("/demo/reset", headers=owner).json()["ok"] is True
    assert len(threads(client, owner)) == 8
    assert count(inbox, Consent, Consent.seeded.is_(True)) == 8


# --- simulate incoming message -----------------------------------------------------


@pytest.mark.usefixtures("inbox")
def test_simulate_adds_one_inbound_message_and_sends_nothing(
    client: TestClient, owner: dict[str, str], inbox: Session, recorder: Recorder
) -> None:
    seen: set[str] = set()
    for _ in range(len(SIMULATE_TEXTS)):
        before_in = count(inbox, InboxMessage, InboxMessage.direction == "in")
        before_out = count(inbox, InboxMessage, InboxMessage.direction == "out")
        res = client.post("/inbox/simulate", headers=owner)
        assert res.status_code == 200, res.text
        cid = res.json()["consent_id"]
        assert count(inbox, InboxMessage, InboxMessage.direction == "in") == before_in + 1
        assert count(inbox, InboxMessage, InboxMessage.direction == "out") == before_out
        newest = inbox.scalars(select(InboxMessage).order_by(InboxMessage.id.desc()).limit(1)).one()
        assert newest.consent_id == cid and newest.read_at is None
        assert not is_stop(newest.body) and MONEY_PATTERN.search(newest.body) is None
        seen.add(newest.body)
    assert seen == set(SIMULATE_TEXTS), "the fixed set rotates"
    assert recorder.sent == 0
    assert count(inbox, Message) == 0
    assert len(threads(client, owner)) == 8, "every target was an existing seeded thread"


def test_simulate_needs_owner_and_sample_hotel(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    assert client.post("/inbox/simulate").status_code == 401
    prop = inbox.scalars(select(Property)).one()
    prop.is_sample = False
    inbox.commit()
    res = client.post("/inbox/simulate", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (403, "not_sample")


@pytest.mark.usefixtures("inbox")
def test_simulate_is_rate_limited(client: TestClient, owner: dict[str, str]) -> None:
    codes = [client.post("/inbox/simulate", headers=owner).status_code for _ in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429


@pytest.mark.usefixtures("base_sample")
def test_simulate_starts_a_new_sample_thread_when_none_is_left(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    res = client.post("/inbox/simulate", headers=owner)
    assert res.status_code == 200, res.text
    cid = res.json()["consent_id"]
    consent = session.get(Consent, cid)
    assert consent is not None and consent.seeded and consent.booking.source == "desk"
    assert consent.proof_status == "verified"
    proof = client.get("/proof", headers=owner).json()
    assert proof["pending"] == 0
    steps = {s["key"]: s["done"] for s in client.get("/pipeline", headers=owner).json()["steps"]}
    assert steps["desk"] is False
    again = client.post("/inbox/simulate", headers=owner).json()
    assert again["consent_id"] == cid


def test_simulate_when_every_desk_guest_has_a_thread(
    client: TestClient, owner: dict[str, str], base_sample: Session
) -> None:
    for stay in base_sample.scalars(select(Booking).where(Booking.source == "desk")):
        if stay.guest_id is not None:
            base_sample.add(Consent(guest_id=stay.guest_id, booking_id=stay.id,
                                    wording_version=WORDING_VERSION,
                                    given_at=datetime(2026, 10, 1, tzinfo=UTC),
                                    fingerprint=f"{stay.id:064x}", withdrawn_at=datetime.now(UTC),
                                    proof_status="pending"))  # fmt: skip
    base_sample.commit()
    res = client.post("/inbox/simulate", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (409, "no_sample_guest")


# --- drafts ----------------------------------------------------------------------------


@pytest.mark.parametrize("text", SIMULATE_TEXTS)
def test_every_simulated_text_has_a_topic_or_greeting(text: str) -> None:
    topic = topic_of(text)
    assert topic in TOPICS or text.startswith("Thank you")


def test_every_template_passes_d6() -> None:
    for topic, texts in TEMPLATES.items():
        for language, text in texts.items():
            filled = text.format(name="Asha ji", owner="Rajesh", hotel="Deodar View",
                                 address="Mall Road, Mussoorie")  # fmt: skip
            assert d6_ok(filled), (topic, language)


@pytest.mark.usefixtures("inbox")
def test_seeded_drafts_match_topic_and_language_and_pass_d6(
    client: TestClient, owner: dict[str, str], inbox: Session, recorder: Recorder
) -> None:
    found: set[str] = set()
    stored = count(inbox, InboxMessage)
    for t in threads(client, owner):
        cid = t["consent_id"]
        res = client.post(f"/inbox/threads/{cid}/draft", headers=owner)
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "template" and d6_ok(body["text"])
        assert "₹" not in body["text"]
        last_in = inbox.scalars(
            select(InboxMessage)
            .where(InboxMessage.consent_id == cid, InboxMessage.direction == "in")
            .order_by(InboxMessage.created_at.desc())
            .limit(1)
        ).one()
        hindi = language_of(last_in.body) == "hi"
        assert (language_of(body["text"]) == "hi") is hindi
        found.add(body["topic"])
        if body["topic"] == "invoice":
            assert body["attach"] == {"kind": "stay_invoice", "consent_id": cid}
        else:
            assert body["attach"] is None
    assert {"invoice", "parking", "booking", "directions", "late_checkout",
            "early_checkin"} <= found  # fmt: skip
    assert recorder.sent == 0 and count(inbox, InboxMessage) == stored, "drafts are never sent"


@pytest.mark.usefixtures("inbox")
def test_invoice_draft_from_claude_keeps_the_attachment_and_the_guard(
    client: TestClient, owner: dict[str, str]
) -> None:
    cid = thread_by_topic(client, owner, "invoice")
    client.app.state.reply_wording = FixedWording(  # type: ignore[attr-defined]
        "Namaste Farhan ji, your stay invoice is attached. Thank you for staying with us."
    )
    ai = client.post(f"/inbox/threads/{cid}/draft", headers=owner).json()
    assert ai["source"] == "ai" and ai["attach"]["kind"] == "stay_invoice"
    client.app.state.reply_wording = FixedWording(  # type: ignore[attr-defined]
        "Namaste Farhan ji, your invoice DEODAR/2627/0001 for ₹3,784 is attached."
    )
    guarded = client.post(f"/inbox/threads/{cid}/draft", headers=owner).json()
    assert guarded["source"] == "template" and d6_ok(guarded["text"])
    assert guarded["attach"] == {"kind": "stay_invoice", "consent_id": cid}


@pytest.mark.usefixtures("inbox")
def test_simulated_hindi_bill_request_gets_a_hindi_invoice_draft(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    bill = "कृपया मेरे पिछले स्टे का बिल भेज दीजिए।"
    for _ in SIMULATE_TEXTS:
        cid = client.post("/inbox/simulate", headers=owner).json()["consent_id"]
        inbox.expire_all()
        newest = inbox.scalars(select(InboxMessage).order_by(InboxMessage.id.desc())).first()
        if newest is not None and newest.body == bill:
            break
    draft = client.post(f"/inbox/threads/{cid}/draft", headers=owner).json()
    assert draft["topic"] == "invoice" and language_of(draft["text"]) == "hi"
    assert draft["attach"] == {"kind": "stay_invoice", "consent_id": cid}


@pytest.mark.parametrize(
    ("text", "topic", "language"),
    [
        ("Please share the GST bill.", "invoice", "en"),
        ("Late checkout milega kya kal?", "late_checkout", "hinglish"),
        ("Can we get an early check-in on Friday?", "early_checkin", "en"),
        ("दो गाड़ियों के लिए पार्किंग है?", "parking", "hi"),
        ("Any rooms available for Diwali?", "booking", "en"),
        ("Wifi is down in our room", "wifi", "en"),
        ("When will the refund come?", "refund", "en"),
        ("What is the best route from Dehradun?", "directions", "en"),
        ("See you soon", "other", "en"),
    ],
)
def test_topic_and_language(text: str, topic: str, language: str) -> None:
    assert (topic_of(text), language_of(text)) == (topic, language)


# --- profile column and erasure -------------------------------------------------------


@pytest.mark.usefixtures("inbox")
def test_profile_column(client: TestClient, owner: dict[str, str], inbox: Session) -> None:
    cid = thread_by_topic(client, owner, "invoice")
    profile = client.get(f"/inbox/threads/{cid}/messages", headers=owner).json()["profile"]
    assert profile["consent_given_at"] and profile["proof_status"] == "verified"
    assert profile["stays_count"] == len(profile["stays"]) >= 1
    assert profile["last_invoice"] is None
    assert "Prefers a mountain-view room" in profile["remembers"]
    assert profile["notes"] == ["Travels for work, mostly on weekdays"]
    assert profile["language"] == "English"
    consent = inbox.get(Consent, cid)
    assert consent is not None
    inbox.add(StayInvoice(property_id=consent.booking.property_id, booking_id=consent.booking_id,
                          fy="2627", seq=1, number="DEODAR/2627/0001",
                          created_at=datetime.now(UTC) - timedelta(minutes=5)))  # fmt: skip
    inbox.commit()
    again = client.get(f"/inbox/threads/{cid}/messages", headers=owner).json()["profile"]
    assert again["last_invoice"] == "DEODAR/2627/0001"


@pytest.mark.usefixtures("inbox")
def test_forget_erases_what_seedha_remembers(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    cid = threads(client, owner)[0]["consent_id"]
    consent = inbox.get(Consent, cid)
    assert consent is not None
    guest_id = consent.guest_id
    assert count(inbox, GuestMemory, GuestMemory.guest_id == guest_id) >= 2
    res = client.post(f"/inbox/threads/{cid}/forget", headers=owner, json={"confirm": True})
    assert res.status_code == 200
    assert count(inbox, GuestMemory, GuestMemory.guest_id == guest_id) == 0
    assert count(inbox, InboxMessage, InboxMessage.consent_id == cid) == 0
    assert count(inbox, GuestMemory) > 0, "other guests keep theirs"
