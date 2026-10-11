"""Consent rule (rule 4), the D6 guard on AI text, and nothing auto-sent
(rule 7), swept over the eight seeded inbox threads (POLISH_BUILD T1)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, InboxMessage, Message, Property, StayInvoice
from app.services.drafter import MONEY_PATTERN
from app.services.inbox import (
    DEVANAGARI,
    TEMPLATES,
    ClaudeReplyWording,
    d6_ok,
    record_inbound,
    simulate_target,
    template_reply,
)
from app.services.messages import handle_inbound
from app.services.whatsapp import SendResult, SimulatedSender, is_stop
from seed.load import load_sample
from tests.conftest import DEMO_DATE, DEVICE_KEY

TODAY = datetime(2026, 10, 13, 6, 30, tzinfo=UTC)

BAD_AI_TEXTS = (
    "Namaste ji, your stay came to ₹3,784 in total.",
    "Namaste ji, the room is Rs 3784 a night.",
    "Namaste ji, only rs.900 more for the valley view.",
    "Namaste ji, your invoice DEODAR/2627/0001 is attached.",
    "Namaste ji, room 1204 is ready for you.",
    "Namaste ji, call us on 9876543210.",
    "Namaste ji, the total was 4,283 for the night.",
    "Namaste ji, we can give 15% off on your next stay.",
)


@dataclass
class Recorder:
    """Records every send; nothing leaves the test."""

    sent: list[str] = field(default_factory=list)

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        _ = (to, message_id)
        self.sent.append(body)
        return SendResult(ok=True, transport="simulated", provider_id=f"t-{len(self.sent)}")


class FakeMessages:
    """Stands in for anthropic.Anthropic().messages (no network)."""

    def __init__(self, text: str, stop_reason: str = "end_turn", fail: bool = False) -> None:
        self.text, self.stop_reason, self.fail = text, stop_reason, fail
        self.calls = 0

    def create(self, **_kwargs: Any) -> SimpleNamespace:
        self.calls += 1
        if self.fail:
            raise anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x.invalid"))
        block = SimpleNamespace(type="text", text=self.text)
        return SimpleNamespace(stop_reason=self.stop_reason, content=[block])


def claude(messages: FakeMessages) -> ClaudeReplyWording:
    """The real Claude wording class around a fake client."""
    fake: Any = SimpleNamespace(messages=messages)
    return ClaudeReplyWording("unused", "unused-model", client=fake)


@pytest.fixture(name="inbox")
def fixture_inbox(session: Session) -> Session:
    load_sample(session, DEMO_DATE, with_statements=True, device_key=DEVICE_KEY, with_inbox=True)
    session.commit()
    return session


@pytest.fixture(name="recorder")
def fixture_recorder(client: TestClient) -> Recorder:
    recorder = Recorder()
    client.app.state.sender = recorder  # type: ignore[attr-defined]
    client.app.state.clock = lambda: TODAY  # type: ignore[attr-defined]
    return recorder


def thread_ids(client: TestClient, owner: dict[str, str]) -> list[int]:
    listed = client.get("/inbox/threads", headers=owner).json()["threads"]
    return sorted(int(t["consent_id"]) for t in listed)


def count(session: Session, model: type[Any], *where: Any) -> int:
    session.expire_all()
    return int(session.scalar(select(func.count()).select_from(model).where(*where)) or 0)


def desk_done(client: TestClient, owner: dict[str, str]) -> bool:
    steps = client.get("/pipeline", headers=owner).json()["steps"]
    return bool(next(s["done"] for s in steps if s["key"] == "desk"))


# --- rule 4: only active Desk consents are threads ---------------------------------------

THREAD_CALLS = (
    ("GET", "messages", None),
    ("POST", "messages", {"body": "Hello again"}),
    ("POST", "draft", None),
    ("POST", "read", None),
    ("POST", "simulate", {"text": "Hello"}),
    ("POST", "forget", {"confirm": True}),
    ("GET", "invoice", None),
    ("GET", "invoice.pdf", None),
)


@pytest.mark.usefixtures("inbox")
def test_withdrawn_erased_and_unknown_threads_refuse_every_action(
    client: TestClient, owner: dict[str, str], recorder: Recorder
) -> None:
    stopped, forgotten = thread_ids(client, owner)[:2]
    res = client.post(f"/inbox/threads/{stopped}/simulate", headers=owner, json={"text": "Stop"})
    assert (res.status_code, res.json()) == (200, None)
    res = client.post(f"/inbox/threads/{forgotten}/forget", headers=owner, json={"confirm": True})
    assert res.status_code == 200
    for cid in (stopped, forgotten, 999_999):
        for method, suffix, body in THREAD_CALLS:
            res = client.request(method, f"/inbox/threads/{cid}/{suffix}", headers=owner,
                                 json=body)  # fmt: skip
            assert (res.status_code, res.json()["error"]["code"]) == (404, "no_such_thread"), (
                cid,
                suffix,
            )
    remaining = thread_ids(client, owner)
    assert len(remaining) == 6 and stopped not in remaining and forgotten not in remaining
    assert recorder.sent == []


def test_threads_are_exactly_the_active_desk_consents(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    # A consent without a WhatsApp number, and one already withdrawn, get no thread.
    prop = inbox.scalars(select(Property)).one()
    desk = inbox.scalars(
        select(Booking)
        .where(Booking.source == "desk", Booking.guest_id.not_in(select(Consent.guest_id)))
        .order_by(Booking.id)
        .limit(2)
    ).all()
    for i, stay in enumerate(desk):
        assert stay.guest_id is not None
        inbox.add(Consent(guest_id=stay.guest_id, booking_id=stay.id, wording_version="v1",
                          given_at=TODAY, salt="ef" * 16, fingerprint=f"{stay.id:064x}",
                          whatsapp_number=None if i == 0 else "+919876500002",
                          withdrawn_at=None if i == 0 else TODAY))  # fmt: skip
    inbox.commit()
    listed = client.get("/inbox/threads", headers=owner).json()["threads"]
    active = inbox.scalars(
        select(Consent).where(
            Consent.withdrawn_at.is_(None),
            Consent.erased_at.is_(None),
            Consent.whatsapp_number.is_not(None),
        )
    ).all()
    assert sorted(t["consent_id"] for t in listed) == sorted(c.id for c in active)
    assert len(listed) == 8
    for c in active:
        assert c.booking.source == "desk" and c.booking.property_id == prop.id
    # Rule 4: guests known only from OTA statements (the 12 repeat guests among
    # them) never appear in the inbox.
    consented = {c.guest.display_name for c in active}
    ota_names = set(
        inbox.scalars(select(Booking.guest_name).where(Booking.source == "statement")).all()
    )
    assert len(ota_names - consented) > 500
    text = client.get("/inbox/threads", headers=owner).text
    for name in ota_names - consented:
        assert name not in text, name
    assert client.get("/repeat", headers=owner).json()["count"] == 12


@pytest.mark.usefixtures("inbox")
def test_unknown_number_writing_in_gets_no_thread(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    before = count(inbox, InboxMessage)
    assert (
        record_inbound(inbox, "+919811122233", "Hello, room free?", SimulatedSender(), TODAY) == 0
    )
    inbox.commit()
    assert count(inbox, InboxMessage) == before
    assert len(thread_ids(client, owner)) == 8


def test_seeded_consents_never_mark_the_desk_step(
    client: TestClient, owner: dict[str, str], inbox: Session, recorder: Recorder
) -> None:
    assert count(inbox, Consent, Consent.seeded.is_(True)) == 8
    assert desk_done(client, owner) is False
    for _ in range(5):
        assert client.post("/inbox/simulate", headers=owner).status_code == 200
    assert desk_done(client, owner) is False
    assert client.post("/demo/reset", headers=owner).json()["ok"] is True
    assert desk_done(client, owner) is False
    # The demo loop's own Desk consent is what marks the step.
    url = client.post("/desk/checkin", headers=owner, json={"room": 104}).json()["url"]
    token = url.rsplit("/", 1)[-1]
    res = client.post(f"/public/consent/{token}", json={"agree": True, "whatsapp": "9876543210"})
    assert res.status_code == 200
    assert desk_done(client, owner) is True
    assert recorder.sent == []


# --- D6: no AI money or numbers ever reach the response ----------------------------------


@pytest.mark.usefixtures("inbox")
@pytest.mark.parametrize("bad", BAD_AI_TEXTS)
def test_claude_text_with_money_or_numbers_never_reaches_the_owner(
    client: TestClient, owner: dict[str, str], recorder: Recorder, bad: str
) -> None:
    assert not d6_ok(bad)
    fake = FakeMessages(bad)
    client.app.state.reply_wording = claude(fake)  # type: ignore[attr-defined]
    cids = thread_ids(client, owner)
    for cid in cids:
        res = client.post(f"/inbox/threads/{cid}/draft", headers=owner)
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "template"
        assert body["text"] != bad and bad not in res.text
        assert d6_ok(body["text"]) and MONEY_PATTERN.search(body["text"]) is None
    assert fake.calls == len(cids) == 8
    assert recorder.sent == []


@pytest.mark.usefixtures("inbox")
def test_claude_clean_text_is_used_and_failures_fall_back(
    client: TestClient, owner: dict[str, str]
) -> None:
    cid = thread_ids(client, owner)[0]
    clean = "Namaste ji, thank you for writing. We will reply shortly."
    client.app.state.reply_wording = claude(FakeMessages(clean))  # type: ignore[attr-defined]
    body = client.post(f"/inbox/threads/{cid}/draft", headers=owner).json()
    assert (body["source"], body["text"]) == ("ai", clean)
    for fake in (
        FakeMessages(clean, stop_reason="max_tokens"),
        FakeMessages(clean, fail=True),
        FakeMessages("x" * 401),
        FakeMessages("   "),
    ):
        client.app.state.reply_wording = claude(fake)  # type: ignore[attr-defined]
        body = client.post(f"/inbox/threads/{cid}/draft", headers=owner).json()
        assert body["source"] == "template" and d6_ok(body["text"])
        assert fake.calls == 1


def test_every_template_passes_d6_with_every_seeded_guest(inbox: Session) -> None:
    prop = inbox.scalars(select(Property)).one()
    consents = inbox.scalars(select(Consent)).all()
    assert len(consents) == 8
    for consent in consents:
        for topic in TEMPLATES:
            english = template_reply(prop, consent, topic, "en")
            hinglish = template_reply(prop, consent, topic, "hinglish")
            hindi = template_reply(prop, consent, topic, "hi")
            assert english == hinglish, "Latin-script guests get the English template"
            for text in (english, hindi):
                assert d6_ok(text), (topic, text)
                assert "{" not in text and "}" not in text
                assert consent.guest.short_name in text
            assert DEVANAGARI.search(hindi) and not DEVANAGARI.search(english)


def test_simulated_texts_never_stop_or_carry_money(inbox: Session) -> None:
    prop = inbox.scalars(select(Property)).one()
    outbound = count(inbox, InboxMessage, InboxMessage.direction == "out")
    for turn in range(30):
        now = TODAY + timedelta(minutes=turn)
        consent, text = simulate_target(inbox, prop, now)
        assert not is_stop(text) and MONEY_PATTERN.search(text) is None
        number = consent.whatsapp_number or ""
        assert handle_inbound(inbox, number, text, "simulated", now) == 0
        assert record_inbound(inbox, number, text, SimulatedSender(), now) == 1
    assert all(c.is_active for c in inbox.scalars(select(Consent)))
    assert count(inbox, InboxMessage, InboxMessage.direction == "out") == outbound
    assert count(inbox, Message) == 0


# --- rule 7: nothing is sent or queued for approval by simulate or draft ----------------


def test_simulate_and_draft_create_no_outbound_and_no_approvals(
    client: TestClient, owner: dict[str, str], inbox: Session, recorder: Recorder
) -> None:
    approvals = client.get("/messages", headers=owner).json()
    outbound = count(inbox, InboxMessage, InboxMessage.direction == "out")
    for _ in range(10):
        assert client.post("/inbox/simulate", headers=owner).status_code == 200
    for cid in thread_ids(client, owner):
        assert client.post(f"/inbox/threads/{cid}/draft", headers=owner).status_code == 200
        client.app.state.reply_wording = claude(  # type: ignore[attr-defined]
            FakeMessages("Namaste ji, we look forward to your visit.")
        )
        assert client.post(f"/inbox/threads/{cid}/draft", headers=owner).json()["source"] == "ai"
        client.app.state.reply_wording = None  # type: ignore[attr-defined]
    assert client.get("/messages", headers=owner).json() == approvals
    assert approvals["messages"] == [] and approvals["pending"] == 0
    assert count(inbox, InboxMessage, InboxMessage.direction == "out") == outbound
    assert count(inbox, Message) == 0
    assert count(inbox, StayInvoice) == 0, "a draft only offers the invoice, never issues it"
    assert recorder.sent == []
