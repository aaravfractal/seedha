"""Public demo visitors cannot spend the owner's Claude credits or testnet
POL (live features review V1 S1, S2). The laptop keeps every feature."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from starlette.requests import Request

from app.config import Settings
from app.deps import get_settings
from app.main import create_app
from app.public_mode import is_loopback, is_remote_public
from tests.test_desk_flow import token_from

FAKE_KEY = "not-a-real-key"


def request_from(host: str, settings: Settings) -> Request:
    app = SimpleNamespace(state=SimpleNamespace(settings=settings))
    return Request({"type": "http", "app": app, "client": (host, 50000), "headers": []})


@pytest.mark.parametrize(
    ("flag", "host", "claude_on"),
    [("1", "203.0.113.7", False), ("1", "127.0.0.1", True), ("1", "::1", True),
     ("", "203.0.113.7", True), ("true", "203.0.113.7", True)],
)  # fmt: skip
def test_claude_is_off_only_for_public_visitors(
    settings: Settings, monkeypatch: pytest.MonkeyPatch, flag: str, host: str, claude_on: bool
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", flag)
    keyed = replace(settings, anthropic_api_key=FAKE_KEY, claude_model="m")
    got = get_settings(request_from(host, keyed))
    assert got.llm_enabled is claude_on
    assert keyed.anthropic_api_key == FAKE_KEY


def test_loopback_and_remote_detection(monkeypatch: pytest.MonkeyPatch, settings: Settings) -> None:
    assert is_loopback("127.0.0.1") and is_loopback("::ffff:127.0.0.1")
    assert not is_loopback("localhost") and not is_loopback("10.0.0.2")
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    assert is_remote_public(request_from("192.168.0.20", settings))
    assert not is_remote_public(request_from("127.0.0.1", settings))


class NeverWriter:
    """Fails the test if anything tries to publish or check the chain."""

    def __getattr__(self, name: str) -> object:
        raise AssertionError(f"chain writer used: {name}")


@pytest.fixture(name="remote")
def fixture_remote(settings: Settings, factory: sessionmaker[Session]) -> Iterator[TestClient]:
    app = create_app(settings, factory)
    app.state.chain_writer = NeverWriter()
    with TestClient(app, client=("203.0.113.7", 50000)) as client:
        yield client


@pytest.mark.usefixtures("sample")
def test_public_visitor_proof_write_stays_local(
    remote: TestClient, owner: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    checkin = remote.post("/desk/checkin", headers=owner, json={"room": 104}).json()
    token = token_from(checkin["url"])
    agreed = remote.post(f"/public/consent/{token}", json={"agree": True, "whatsapp": "9876543210"})
    assert agreed.status_code == 200
    out = remote.post("/proof/bundle", headers=owner)
    assert out.status_code == 200
    body = out.json()
    assert body["chain"]["mode"] == "local"
    assert body["chain"]["reason"] == "public_mode"
    assert body["bundles"][0]["chain_status"] == "stored"
    assert body["bundles"][0]["chain_tx"] is None
    assert remote.get("/proof", headers=owner).json()["chain"]["reason"] == "public_mode"
