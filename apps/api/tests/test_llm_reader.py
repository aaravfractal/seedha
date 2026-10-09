"""Claude statement reader with the SDK replaced by a fake (no network)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from typing import Any, cast

import anthropic
import httpx2
import pytest

from app.config import load_settings
from app.services.llm import ClaudeStatementReader, statement_reader
from app.services.parser import ReaderUnavailableError

TEST_KEY = "test-key"  # pragma: allowlist secret (dummy value, never sent)
REQUEST = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


@dataclass
class Block:
    """A response content block."""

    type: str
    text: str = ""


@dataclass
class FakeMessage:
    """A final message."""

    stop_reason: str
    content: list[Block] = field(default_factory=list)


class FakeStream:
    """Context manager returned by messages.stream()."""

    def __init__(self, message: FakeMessage | None, error: Exception | None) -> None:
        self.message = message
        self.error = error

    def __enter__(self) -> FakeStream:
        if self.error:
            raise self.error
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def get_final_message(self) -> FakeMessage:
        assert self.message is not None
        return self.message


class FakeMessages:
    """Stands in for client.messages and records the request."""

    def __init__(self, message: FakeMessage | None = None, error: Exception | None = None) -> None:
        self.message = message
        self.error = error
        self.kwargs: dict[str, Any] = {}

    def stream(self, **kwargs: Any) -> FakeStream:
        self.kwargs = kwargs
        return FakeStream(self.message, self.error)


def reader_with(messages: FakeMessages) -> ClaudeStatementReader:
    fake_client = cast(anthropic.Anthropic, type("C", (), {"messages": messages})())
    return ClaudeStatementReader(api_key=TEST_KEY, model="claude-opus-5", client=fake_client)


def test_returns_parsed_json_and_sends_strict_schema() -> None:
    payload = {"channel": "Agoda", "rows": []}
    messages = FakeMessages(FakeMessage("end_turn", [Block("text", json.dumps(payload))]))
    assert reader_with(messages).extract("statement text", "a.csv") == payload
    fmt = messages.kwargs["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    assert fmt["schema"]["additionalProperties"] is False
    assert messages.kwargs["model"] == "claude-opus-5"
    assert "statement text" in messages.kwargs["messages"][0]["content"]


@pytest.mark.parametrize(
    "message",
    [
        FakeMessage("refusal", []),
        FakeMessage("max_tokens", [Block("text", "{")]),
        FakeMessage("end_turn", [Block("text", "not json")]),
        FakeMessage("end_turn", [Block("text", "[1, 2]")]),
    ],
)
def test_unusable_answers_raise(message: FakeMessage) -> None:
    with pytest.raises(ReaderUnavailableError):
        reader_with(FakeMessages(message)).extract("x", "a.csv")


@pytest.mark.parametrize(
    "error",
    [
        anthropic.APIConnectionError(request=REQUEST),
        anthropic.RateLimitError(
            "slow down", response=httpx2.Response(429, request=REQUEST), body=None
        ),
        anthropic.InternalServerError(
            "boom", response=httpx2.Response(500, request=REQUEST), body=None
        ),
    ],
)
def test_api_errors_become_reader_unavailable(error: Exception) -> None:
    with pytest.raises(ReaderUnavailableError):
        reader_with(FakeMessages(error=error)).extract("x", "a.csv")


def test_reader_is_none_without_key() -> None:
    settings = replace(load_settings(), anthropic_api_key="", claude_model="claude-opus-5")
    assert statement_reader(settings) is None
    with_key = replace(settings, anthropic_api_key=TEST_KEY)
    assert isinstance(statement_reader(with_key), ClaudeStatementReader)
