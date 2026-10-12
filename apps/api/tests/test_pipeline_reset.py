"""The 8-step loop ticks only from the demo session's own actions, and Reset
demo data clears every step (FINAL_MASTER Part 2a: step 6 "Print a checkout
slip" showed done after a reset while steps 1 to 5 were not)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.test_desk_flow import token_from


def done(client: TestClient, owner: dict[str, str]) -> set[str]:
    steps = client.get("/pipeline", headers=owner).json()["steps"]
    return {s["key"] for s in steps if s["done"]}


def consent(client: TestClient, owner: dict[str, str], room: int) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": room}).json()["url"]
    res = client.post(f"/public/consent/{token_from(url)}",
                      json={"agree": True, "whatsapp": "9876543210"})  # fmt: skip
    assert res.status_code == 200, res.text


@pytest.mark.usefixtures("base_sample")
def test_fresh_and_reset_start_at_zero(client: TestClient, owner: dict[str, str]) -> None:
    assert done(client, owner) == set()
    consent(client, owner, 104)
    assert client.post("/desk/checkout", headers=owner, json={"room": 104}).status_code == 200
    client.post("/pipeline/flip/seen", headers=owner)
    assert {"desk", "slip", "flip"} <= done(client, owner)
    assert client.post("/demo/reset", headers=owner).json()["ok"] is True
    assert done(client, owner) == set()


@pytest.mark.usefixtures("base_sample")
def test_slip_needs_the_loops_own_guest(client: TestClient, owner: dict[str, str]) -> None:
    # Checking out an in-house sample guest who never consented at the Desk
    # prints a slip but does not tick step 6 ahead of steps 1 to 5.
    out = client.post("/desk/checkout", headers=owner, json={"room": 112})
    assert out.status_code == 200
    assert "slip" not in done(client, owner)
    consent(client, owner, 104)
    client.post("/desk/checkout", headers=owner, json={"room": 104})
    assert {"desk", "slip"} <= done(client, owner)


@pytest.mark.usefixtures("base_sample")
def test_slip_cannot_be_marked_seen_directly(client: TestClient, owner: dict[str, str]) -> None:
    res = client.post("/pipeline/slip/seen", headers=owner)
    assert res.status_code == 422
    assert "slip" not in done(client, owner)
