"""Public mode (make demo-live): demo reset only from the machine running Seedha."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app
from app.routers.site import is_loopback


@pytest.fixture(name="client_at")
def fixture_client_at(
    settings: Settings, factory: sessionmaker[Session]
) -> Iterator[dict[str, TestClient]]:
    """One test client per client address: a tunnel visitor and the local machine."""
    with (
        TestClient(create_app(settings, factory), client=("203.0.113.7", 50000)) as remote,
        TestClient(create_app(settings, factory), client=("127.0.0.1", 50000)) as local,
        TestClient(create_app(settings, factory), client=("::1", 50000)) as local6,
    ):
        yield {"remote": remote, "local": local, "local6": local6}


@pytest.mark.usefixtures("sample")
def test_public_mode_refuses_reset_from_a_remote_client(
    client_at: dict[str, TestClient], owner: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    res = client_at["remote"].post("/demo/reset", headers=owner)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "reset_local_only"
    # Refused before the session check, so a visitor learns nothing more.
    assert client_at["remote"].post("/demo/reset").status_code == 403


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize("which", ["local", "local6"])
def test_public_mode_allows_reset_from_loopback(
    which: str,
    client_at: dict[str, TestClient],
    owner: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    assert client_at[which].post("/demo/reset", headers=owner).json()["ok"] is True


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize("value", [None, ""])
def test_reset_unchanged_when_not_public(
    value: str | None,
    client_at: dict[str, TestClient],
    owner: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if value is None:
        monkeypatch.delenv("SEEDHA_PUBLIC", raising=False)
    else:
        monkeypatch.setenv("SEEDHA_PUBLIC", value)
    assert client_at["remote"].post("/demo/reset", headers=owner).json()["ok"] is True
    assert client_at["remote"].post("/demo/reset").status_code == 401


@pytest.mark.parametrize(
    ("host", "expected"),
    [
        ("127.0.0.1", True),
        ("127.8.9.10", True),
        ("::1", True),
        ("::ffff:127.0.0.1", True),
        ("192.168.0.106", False),
        ("203.0.113.7", False),
        ("testclient", False),
        ("", False),
    ],
)
def test_is_loopback(host: str, expected: bool) -> None:
    assert is_loopback(host) is expected
