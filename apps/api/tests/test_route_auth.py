"""Every route is classified, and every owner and device route refuses
requests without its credential (M11 security pass)."""

from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

PUBLIC = {
    ("GET", "/health"),
    ("GET", "/public/consent/{token}"),
    ("POST", "/public/consent/{token}"),
    ("GET", "/public/link"),
    ("POST", "/public/link/book"),
    ("POST", "/public/data-deletion"),
    ("GET", "/public/site/{slug}"),
    ("GET", "/public/site/{slug}/availability"),
    ("GET", "/public/site/{slug}/resolve"),
    ("GET", "/public/site/{slug}/photos/{photo_id}"),
    ("GET", "/public/sample"),
    ("GET", "/webhooks/whatsapp"),
    ("POST", "/webhooks/whatsapp"),
}
DEVICE = {("GET", "/desk/poll"), ("POST", "/desk/ack")}


def all_routes(client: TestClient) -> set[tuple[str, str]]:
    """Every operation the app serves, read from its OpenAPI schema (no route
    hides from the schema, so the schema is the complete list)."""
    paths = client.app.openapi()["paths"]  # type: ignore[attr-defined]
    return {(method.upper(), path) for path, ops in paths.items() for method in ops}


def concrete(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "1", path)


@pytest.mark.usefixtures("sample")
def test_every_owner_route_needs_the_owner_token(
    client: TestClient, device: dict[str, str]
) -> None:
    owner_routes = all_routes(client) - PUBLIC - DEVICE
    assert len(owner_routes) > 30
    for method, path in sorted(owner_routes):
        for headers in ({}, {"Authorization": "Bearer wrong"}, device):
            res = client.request(method, concrete(path), headers=headers, json={})
            assert res.status_code == 401, f"{method} {path} with {headers} -> {res.status_code}"


@pytest.mark.usefixtures("sample")
def test_device_routes_need_the_device_key(client: TestClient, owner: dict[str, str]) -> None:
    for method, path in DEVICE:
        for headers in ({}, {"X-Device-Key": "wrong"}, owner):
            res = client.request(method, path, headers=headers, json={"ids": [1]})
            assert res.status_code == 401, f"{method} {path} with {headers}"


def test_public_routes_are_the_known_set(client: TestClient) -> None:
    assert all_routes(client) >= PUBLIC | DEVICE
