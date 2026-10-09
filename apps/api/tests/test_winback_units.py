"""Savings (ruling 5), drafts (rules 1 and 5) and WhatsApp plumbing, as units."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass, field, replace
from typing import Any, cast

import anthropic
import httpx
import httpx2
import pytest

from app.config import load_settings
from app.money import rupees
from app.services.drafter import ClaudeWording, DraftFacts, acceptable, draft_body, template
from app.services.savings import compute_saving
from app.services.whatsapp import (
    CloudApiSender,
    SimulatedSender,
    inbound_texts,
    is_stop,
    sender_for,
    valid_signature,
)

DUMMY_KEY = "dummy"  # pragma: allowlist secret (never sent)
FACTS = DraftFacts("Rahul ji", "Deodar View", "breakfast is on us", "DEODAR-RS26",
                   "http://localhost:3000/link/DEODAR-RS26")  # fmt: skip


def test_rahul_saving_ruling_5() -> None:
    saving = compute_saving(rupees(8_600), 2_200, True)
    assert saving is not None
    assert (saving.commission_avoided, saving.gst_avoided) == (rupees(1_892), rupees(341))
    assert saving.avoided == rupees(2_233)
    assert saving.upi_fee == rupees(34)
    assert saving.net_saving == rupees(2_199)
    assert saving.commission_rate_used == 2_200


def test_saving_uses_the_original_channel_rate() -> None:
    neha = compute_saving(rupees(8_600), 1_800, True)
    assert neha is not None
    assert (neha.avoided, neha.net_saving) == (rupees(1_827), rupees(1_793))
    agent = compute_saving(rupees(8_600), 1_000, False)
    assert agent is not None
    assert (agent.gst_avoided, agent.net_saving) == (0, rupees(826))
    assert compute_saving(rupees(8_600), 0, False) is None


def test_template_has_code_link_and_stop() -> None:
    body = template(FACTS)
    assert body.startswith("Namaste Rahul ji, thank you for staying at Deodar View.")
    assert "breakfast is on us" in body and "DEODAR-RS26" in body
    assert body.endswith("Reply STOP to opt out.")
    assert acceptable(body, FACTS)


@pytest.mark.parametrize(
    "bad",
    [
        "Hi Rahul ji, code DEODAR-RS26 http://localhost:3000/link/DEODAR-RS26",
        "Save ₹500! DEODAR-RS26 http://localhost:3000/link/DEODAR-RS26 Reply STOP to opt out.",
        "20% off DEODAR-RS26 http://localhost:3000/link/DEODAR-RS26 Reply STOP to opt out.",
        "Rs 900 back DEODAR-RS26 http://localhost:3000/link/DEODAR-RS26 Reply STOP to opt out.",
        "Come back http://localhost:3000/link/DEODAR-RS26 Reply STOP to opt out.",
        "x" * 700 + " DEODAR-RS26 http://localhost:3000/link/DEODAR-RS26 Reply STOP to opt out.",
    ],
)
def test_unsafe_wording_is_rejected(bad: str) -> None:
    assert not acceptable(bad, FACTS)


@dataclass
class FakeWording:
    """Returns a fixed candidate."""

    text: str | None
    calls: list[DraftFacts] = field(default_factory=list)

    def word(self, facts: DraftFacts) -> str | None:
        self.calls.append(facts)
        return self.text


def test_draft_body_prefers_good_claude_wording() -> None:
    good = ("Rahul ji, we loved hosting you at Deodar View. Next time book with us and "
            "breakfast is on us. Code DEODAR-RS26: http://localhost:3000/link/DEODAR-RS26 "
            "Reply STOP to opt out.")  # fmt: skip
    assert draft_body(FACTS, FakeWording(good)) == good
    assert draft_body(FACTS, FakeWording("Save ₹500!")) == template(FACTS)
    assert draft_body(FACTS, FakeWording(None)) == template(FACTS)
    assert draft_body(FACTS, None) == template(FACTS)


@dataclass
class Block:
    """Response content block."""

    type: str
    text: str = ""


@dataclass
class FakeMessage:
    """Response message."""

    stop_reason: str
    content: list[Block]


class FakeCreate:
    """client.messages with create()."""

    def __init__(self, result: FakeMessage | Exception) -> None:
        self.result = result

    def create(self, **kwargs: Any) -> FakeMessage:
        assert "Never mention prices" in kwargs["system"]
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def wording_with(result: FakeMessage | Exception) -> ClaudeWording:
    client = cast(anthropic.Anthropic, type("C", (), {"messages": FakeCreate(result)})())
    return ClaudeWording(api_key=DUMMY_KEY, model="claude-opus-5", client=client)


def test_claude_wording_paths() -> None:
    assert wording_with(FakeMessage("end_turn", [Block("text", "hello")])).word(FACTS) == "hello"
    assert wording_with(FakeMessage("max_tokens", [Block("text", "hel")])).word(FACTS) is None
    error = anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x.test"))
    assert wording_with(error).word(FACTS) is None


def test_simulated_sender_never_logs_the_number(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    result = SimulatedSender().send("+919876543210", "secret text", 7)
    assert (result.ok, result.transport, result.provider_id) == (True, "simulated", "sim-7")
    assert "9876543210" not in caplog.text and "secret text" not in caplog.text
    assert "SIMULATED" in caplog.text


def live_settings() -> Any:
    return replace(load_settings(), whatsapp_token="tok", whatsapp_phone_number_id="12345",
                   whatsapp_api_version="v21.0")  # fmt: skip


def test_cloud_api_sender_request_shape() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"messages": [{"id": "wamid.1"}]})

    sender = CloudApiSender(live_settings(), httpx.Client(transport=httpx.MockTransport(handler)))
    result = sender.send("+919876543210", "hello", 1)
    assert (result.ok, result.transport, result.provider_id) == (True, "whatsapp", "wamid.1")
    assert seen["url"] == "https://graph.facebook.com/v21.0/12345/messages"
    assert seen["auth"] == "Bearer tok"
    assert seen["body"] == {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": "919876543210",
        "type": "text",
        "text": {"body": "hello"},
    }


def test_cloud_api_sender_failures() -> None:
    refused = CloudApiSender(
        live_settings(), httpx.Client(transport=httpx.MockTransport(lambda _r: httpx.Response(400)))
    ).send("+919876543210", "x", 2)
    assert (refused.ok, refused.error) == (False, "WhatsApp refused the message")

    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    down = CloudApiSender(live_settings(), httpx.Client(transport=httpx.MockTransport(boom)))
    assert down.send("+919876543210", "x", 3).error == "WhatsApp could not be reached"


def test_sender_choice() -> None:
    assert isinstance(sender_for(load_settings()), SimulatedSender)
    assert isinstance(sender_for(live_settings()), CloudApiSender)


@pytest.mark.parametrize(("text", "stop"), [("STOP", True), ("stop.", True), (" Stop  all ", True),
                                            ("unsubscribe", True), ("please stop by", False),
                                            ("Yes", False)])  # fmt: skip
def test_stop_words(text: str, stop: bool) -> None:
    assert is_stop(text) is stop


def test_signature_check() -> None:
    body = b'{"x":1}'
    good = "sha256=" + hmac.new(b"secret", body, hashlib.sha256).hexdigest()
    assert valid_signature("secret", body, good)
    assert not valid_signature("secret", body, "sha256=00")
    assert not valid_signature("secret", body, None)
    assert not valid_signature("", body, good)


def test_inbound_texts_tolerates_junk() -> None:
    payload = {"entry": [{"changes": [{"value": {"messages": [
        {"from": "919876543210", "text": {"body": "STOP"}},
        {"from": "919876543210", "type": "image"},
        None,
    ]}}, None]}, {}]}  # fmt: skip
    assert list(inbound_texts(payload)) == [("919876543210", "STOP")]
    assert not list(inbound_texts([]))
