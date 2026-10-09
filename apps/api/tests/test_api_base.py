"""Health, property and pipeline endpoints: success, bad input, unauthorised."""

from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app


def test_health_reports_simulated_modes(client: TestClient) -> None:
    body = client.get("/health").json()
    assert body == {
        "status": "ok",
        "llm": "simulated",
        "whatsapp": "simulated",
        "payments": "simulated",
        "proof_chain": "simulated",
    }


@pytest.mark.usefixtures("base_sample")
def test_property_requires_owner(client: TestClient) -> None:
    assert client.get("/property").status_code == 401
    wrong = client.get("/property", headers={"Authorization": "Bearer nope"})
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "unauthorised"
    basic = client.get("/property", headers={"Authorization": "Basic x"})
    assert basic.status_code == 401


@pytest.mark.usefixtures("base_sample")
def test_property_ok(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/property", headers=owner).json()
    assert body["name"] == "Hotel Deodar View"
    assert body["rooms_count"] == 22
    assert body["is_sample"] is True


def test_not_seeded(client: TestClient, owner: dict[str, str]) -> None:
    res = client.get("/property", headers=owner)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "not_seeded"


def test_owner_token_not_configured(settings: Settings, factory: sessionmaker[Session]) -> None:
    app = create_app(replace(settings, owner_api_token=""), factory)
    with TestClient(app) as c:
        res = c.get("/property", headers={"Authorization": "Bearer anything"})
    assert res.status_code == 503


@pytest.mark.usefixtures("base_sample")
def test_pipeline_starts_empty(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/pipeline", headers=owner).json()
    assert [s["key"] for s in body["steps"]] == [
        "up", "ai", "flip", "rep", "desk", "slip", "msg", "book",
    ]  # fmt: skip
    assert body["done_count"] == 0


@pytest.mark.usefixtures("base_sample")
def test_pipeline_unauthorised(client: TestClient) -> None:
    assert client.get("/pipeline").status_code == 401
    assert client.post("/pipeline/flip/seen").status_code == 401


@pytest.mark.usefixtures("sample")
def test_pipeline_after_statements(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/pipeline", headers=owner).json()
    done = {s["key"] for s in body["steps"] if s["done"]}
    assert done == {"up", "ai"}


@pytest.mark.usefixtures("base_sample")
def test_mark_seen_is_idempotent(client: TestClient, owner: dict[str, str]) -> None:
    client.post("/pipeline/flip/seen", headers=owner)
    body = client.post("/pipeline/flip/seen", headers=owner).json()
    assert body["done_count"] == 1


@pytest.mark.usefixtures("base_sample")
def test_mark_seen_rejects_unknown_step(client: TestClient, owner: dict[str, str]) -> None:
    res = client.post("/pipeline/book/seen", headers=owner)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_input"
