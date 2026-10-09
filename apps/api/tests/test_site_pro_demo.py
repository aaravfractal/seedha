"""Seedha Site, Pro previews and demo reset (M9)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, SiteConfig
from app.money import rupees
from app.services.site import get_config


def site(client: TestClient, owner: dict[str, str]) -> dict[str, Any]:
    res = client.get("/site", headers=owner)
    assert res.status_code == 200
    body: dict[str, Any] = res.json()
    return body


@pytest.mark.usefixtures("sample")
def test_site_flow_and_package_prices(client: TestClient, owner: dict[str, str]) -> None:
    body = site(client, owner)
    assert (body["stage"], body["mood"], body["lang"], body["live"]) == (
        "empty",
        "pine",
        "en",
        False,
    )
    prices = {p["key"]: p["price"] for p in body["packages"]}
    assert prices == {"wk": rupees(9_400), "cd": rupees(4_300), "mm": rupees(11_900)}
    rooms = {r["room_type"]: r["nightly_rate"] for r in body["rooms"]}
    assert rooms == {"Family Suite": rupees(6_200), "Deluxe Valley View": rupees(4_300),
                     "Standard": rupees(3_400)}  # fmt: skip
    why = {p["key"]: p["why"] for p in body["packages"]}
    assert why["mm"] == "July and August are your emptiest months."
    assert why["wk"].startswith("Your weekends fill fastest:")

    early = client.post("/site/publish", headers=owner)
    assert (early.status_code, early.json()["error"]["code"]) == (409, "not_ready")
    for stage in ("chat", "review"):
        body = client.patch("/site", headers=owner, json={"stage": stage}).json()
    body = client.patch("/site", headers=owner, json={"mood": "sky", "lang": "hi"}).json()
    assert (body["stage"], body["mood"], body["lang"]) == ("review", "sky", "hi")
    body = client.post("/site/packages/wk", headers=owner).json()
    assert [p["approved"] for p in body["packages"]] == [True, False, False]
    assert client.post("/site/packages/zz", headers=owner).status_code == 404
    live = client.post("/site/publish", headers=owner).json()
    assert live["live"] is True and live["published_at"]
    assert client.patch("/site", headers=owner, json={"mood": "neon"}).status_code == 422


@pytest.mark.usefixtures("base_sample")
def test_site_reasons_without_data(client: TestClient, owner: dict[str, str]) -> None:
    why = {p["key"]: p["why"] for p in site(client, owner)["packages"]}
    assert why["wk"] == "Weekends usually fill first in hill towns."


@pytest.mark.usefixtures("sample")
def test_pro_audit_from_flagged_lines(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    pro = client.get("/pro", headers=owner).json()
    assert (pro["audit_claim"], pro["audit_cancelled_lines"], pro["audit_over_rate_lines"]) == (
        rupees(802), 1, 0,
    )  # fmt: skip
    assert (pro["pulse_sample"], pro["rate_watch_sample"], pro["consents"]) == (True, True, 0)
    row = sample.scalars(select(Booking).where(Booking.external_ref == "MM90942")).first()
    assert row is not None
    row.commission += rupees(100)
    row.net_kept -= rupees(100)
    sample.commit()
    over = client.get("/pro", headers=owner).json()
    assert over["audit_over_rate_lines"] == 1
    assert over["audit_claim"] == rupees(802) + rupees(100) + rupees(18)


@pytest.mark.usefixtures("sample")
def test_demo_reset(client: TestClient, owner: dict[str, str], sample: Session) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": 104}).json()["url"]
    client.post(
        f"/public/consent/{url.rsplit('/', 1)[-1]}", json={"agree": True, "whatsapp": "9876543210"}
    )
    assert client.post("/demo/reset", headers=owner).json()["ok"] is True
    sample.expire_all()
    assert sample.scalar(select(func.count()).select_from(Consent)) == 0
    assert sample.scalar(select(func.count()).where(Booking.source == "statement")) == 0
    assert client.get("/desk/state", headers=owner).json()["guests"][0]["name"] == "Neha Gupta"
    assert client.post("/demo/reset").status_code == 401


@pytest.mark.usefixtures("sample")
def test_site_and_pro_need_owner(client: TestClient) -> None:
    assert client.get("/site").status_code == 401
    assert client.patch("/site", json={"mood": "sky"}).status_code == 401
    assert client.post("/site/publish").status_code == 401
    assert client.get("/pro").status_code == 401


def test_site_config_survives_a_create_race(
    sample: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The first lookup misses (another request is inserting), the insert
    then conflicts, and get_config returns the row that won."""
    existing = sample.scalars(select(SiteConfig)).one()
    original = Session.scalar
    calls = {"n": 0}

    def first_lookup_misses(self: Session, *args: Any, **kwargs: Any) -> Any:
        calls["n"] += 1
        return None if calls["n"] == 1 else original(self, *args, **kwargs)

    monkeypatch.setattr(Session, "scalar", first_lookup_misses)
    assert get_config(sample, 1).id == existing.id
    assert calls["n"] == 2
