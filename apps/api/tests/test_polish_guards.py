"""Privacy and security review fixes for the polish build (V1-1, V1-2):
per-thread guest simulation is sample-only, limited and stored as simulated;
Desk printing is limited and stays on the laptop during a public demo."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app
from app.models import InboxMessage, Property
from tests.test_inbox_seed import fixture_inbox, threads

__all__ = ["fixture_inbox"]


@pytest.mark.usefixtures("inbox")
def test_thread_simulate_is_stored_as_simulated(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    cid = int(threads(client, owner)[0]["consent_id"])
    res = client.post(
        f"/inbox/threads/{cid}/simulate", headers=owner, json={"text": "Is breakfast at 8?"}
    )
    assert res.status_code == 200, res.text
    newest = session.scalars(select(InboxMessage).order_by(InboxMessage.id.desc()).limit(1)).one()
    assert (newest.direction, newest.transport) == ("in", "simulated")


def test_thread_simulate_refused_for_a_real_hotel(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    cid = int(threads(client, owner)[0]["consent_id"])
    inbox.scalars(select(Property)).one().is_sample = False
    inbox.commit()
    res = client.post(f"/inbox/threads/{cid}/simulate", headers=owner, json={"text": "Hello"})
    assert (res.status_code, res.json()["error"]["code"]) == (403, "not_sample")


@pytest.mark.usefixtures("inbox")
def test_thread_simulate_is_rate_limited(client: TestClient, owner: dict[str, str]) -> None:
    cid = int(threads(client, owner)[0]["consent_id"])
    codes = [
        client.post(
            f"/inbox/threads/{cid}/simulate", headers=owner, json={"text": "Hello"}
        ).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [200] * 10 and codes[10] == 429


@pytest.mark.usefixtures("sample")
def test_close_slip_printing_is_rate_limited(client: TestClient, owner: dict[str, str]) -> None:
    codes = [client.post("/desk/close-slip", headers=owner).status_code for _ in range(7)]
    assert codes[:6] == [200] * 6 and codes[6] == 429


@pytest.fixture(name="remote")
def fixture_remote(settings: Settings, factory: sessionmaker[Session]) -> Iterator[TestClient]:
    with TestClient(create_app(settings, factory), client=("203.0.113.7", 50000)) as client:
        yield client


@pytest.mark.usefixtures("sample")
def test_public_demo_visitors_cannot_print(
    remote: TestClient, owner: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    res = remote.post("/desk/close-slip", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (403, "print_local_only")
    night = remote.get("/rooms/nights", headers=owner).json()["nights"][-1]
    room = next(t["room"] for t in night["tiles"] if t["sold"])
    res = remote.post(f"/rooms/{night['night']}/{room}/slip", headers=owner)
    assert (res.status_code, res.json()["error"]["code"]) == (403, "print_local_only")
