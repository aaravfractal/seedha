"""Public mode (make demo-lan, make demo-live): guest links use PUBLIC_BASE_URL,
and the demo reset stays on the machine running Seedha (live features T1)."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, load_settings
from app.main import create_app
from tests.conftest import OWNER_TOKEN
from tests.test_desk_flow import poll, token_from

PUBLIC = "https://sample-demo.trycloudflare.com"


@pytest.fixture(name="public_settings")
def fixture_public_settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    monkeypatch.setenv("WEB_ORIGIN", "http://localhost:3000")
    monkeypatch.setenv("PUBLIC_BASE_URL", PUBLIC)
    return replace(load_settings(), owner_api_token=OWNER_TOKEN, anthropic_api_key="",
                   whatsapp_token="", razorpay_key_id="", proof_rpc_url="")  # fmt: skip


@pytest.fixture(name="public_client")
def fixture_public_client(
    public_settings: Settings, factory: sessionmaker[Session]
) -> Iterator[TestClient]:
    with TestClient(create_app(public_settings, factory)) as client:
        yield client


@pytest.mark.parametrize(
    ("web_origin", "public_base", "expected"),
    [("http://localhost:3000", "http://192.168.0.106:3000", "http://192.168.0.106:3000"),
     ("http://localhost:3000", "  " + PUBLIC + "  ", PUBLIC),
     ("http://localhost:3000", "", "http://localhost:3000"),
     ("", "", "http://localhost:3000")],
)  # fmt: skip
def test_public_base_url_decision_table(
    monkeypatch: pytest.MonkeyPatch, web_origin: str, public_base: str, expected: str
) -> None:
    monkeypatch.setenv("WEB_ORIGIN", web_origin)
    monkeypatch.setenv("PUBLIC_BASE_URL", public_base)
    if not web_origin:
        monkeypatch.delenv("WEB_ORIGIN")
    assert load_settings().web_origin == expected


@pytest.mark.usefixtures("sample")
def test_desk_qr_and_perk_link_use_public_base_url(
    public_client: TestClient, owner: dict[str, str], device: dict[str, str]
) -> None:
    checkin = public_client.post("/desk/checkin", headers=owner, json={"room": 104}).json()
    assert checkin["url"].startswith(f"{PUBLIC}/consent/")
    show_qr = [c for c in poll(public_client, device) if c["kind"] == "show_qr"]
    assert [c["payload"]["url"] for c in show_qr] == [checkin["url"]]
    token = token_from(checkin["url"])
    yes = public_client.post(f"/public/consent/{token}",
                             json={"agree": True, "whatsapp": "9876543210"})  # fmt: skip
    assert yes.status_code == 200
    out = public_client.post("/desk/checkout", headers=owner, json={"room": 104}).json()
    code = out["perk_code"]
    messages = public_client.get("/messages", headers=owner).json()["messages"]
    assert [m["link"] for m in messages] == [f"{PUBLIC}/link/{code}"]
    assert "localhost" not in str(messages)
    assert f"{PUBLIC}/link/{code}" in messages[0]["body"]


@pytest.mark.usefixtures("sample")
def test_cors_allows_the_public_origin_only(public_client: TestClient) -> None:
    preflight = {"Access-Control-Request-Method": "GET"}
    ok = public_client.options("/health", headers=preflight | {"Origin": PUBLIC})
    assert ok.headers.get("access-control-allow-origin") == PUBLIC
    other = public_client.options("/health", headers=preflight | {"Origin": "https://evil.example"})
    assert other.headers.get("access-control-allow-origin") is None


@pytest.fixture(name="remote")
def fixture_remote(settings: Settings, factory: sessionmaker[Session]) -> Iterator[TestClient]:
    with TestClient(create_app(settings, factory), client=("203.0.113.7", 50000)) as client:
        yield client


@pytest.fixture(name="loopback")
def fixture_loopback(settings: Settings, factory: sessionmaker[Session]) -> Iterator[TestClient]:
    with TestClient(create_app(settings, factory), client=("127.0.0.1", 50000)) as client:
        yield client


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    "headers",
    [{"X-Forwarded-For": "127.0.0.1"}, {"X-Real-IP": "127.0.0.1"},
     {"Host": "localhost:8000"}, {"Forwarded": "for=127.0.0.1"},
     {"cf-connecting-ip": "127.0.0.1"}],
)  # fmt: skip
def test_spoofed_headers_never_make_a_remote_client_local(
    remote: TestClient,
    owner: dict[str, str],
    headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    res = remote.post("/demo/reset", headers=owner | headers)
    assert (res.status_code, res.json()["error"]["code"]) == (403, "reset_local_only")


@pytest.mark.usefixtures("sample")
def test_loopback_reset_allowed_and_counts_nothing_against_remote(
    loopback: TestClient, remote: TestClient, owner: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    for _ in range(3):
        assert remote.post("/demo/reset", headers=owner).status_code == 403
    assert loopback.post("/demo/reset", headers=owner).json()["ok"] is True


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize("value", ["0", "false", "no"])
def test_reset_unchanged_when_public_flag_is_not_one(
    remote: TestClient, owner: dict[str, str], value: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", value)
    assert remote.post("/demo/reset", headers=owner).json()["ok"] is True
