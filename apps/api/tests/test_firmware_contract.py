"""The firmware's test fixture is a real /desk/poll response from this API.

The firmware's native tests (firmware/seedha-desk/test) replay this file, so
the box and the API cannot drift apart. Volatile values (consent token,
expiry, ids) are normalised. Regenerate with UPDATE_FIXTURES=1.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "firmware"
    / "seedha-desk"
    / "test"
    / "fixtures"
    / "poll.json"
)


def normalise(commands: list[dict[str, Any]]) -> dict[str, Any]:
    out = []
    for index, command in enumerate(commands, start=1):
        payload = dict(command["payload"])
        if "url" in payload:
            payload["url"] = re.sub(r"/consent/[^/]+$", "/consent/TOKEN", payload["url"])
        if "expires_at" in payload:
            payload["expires_at"] = "2026-10-13T09:10:00+00:00"
        out.append({"id": index, "kind": command["kind"], "payload": payload})
    return {"commands": out, "server_time": "2026-10-13T09:00:00+00:00"}


@pytest.mark.usefixtures("sample")
def test_poll_fixture_matches_the_api(
    client: TestClient, owner: dict[str, str], device: dict[str, str]
) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": 104}).json()["url"]
    client.post(
        f"/public/consent/{url.rsplit('/', 1)[-1]}", json={"agree": True, "whatsapp": "9876543210"}
    )
    client.post("/desk/checkout", headers=owner, json={"room": 104})
    commands = client.get("/desk/poll", headers=device).json()["commands"]
    generated = json.dumps(normalise(commands), indent=2, ensure_ascii=False) + "\n"
    if os.environ.get("UPDATE_FIXTURES") == "1":
        FIXTURE.write_text(generated, encoding="utf-8")
    assert FIXTURE.read_text(encoding="utf-8") == generated, "run with UPDATE_FIXTURES=1"
    assert "9876543210" not in generated  # the box never sees guest contact data
