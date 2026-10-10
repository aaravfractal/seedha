"""Seedha Site packages (approve, skip, edit) and the public hotel site (P5)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Guest, Property, SiteConfig
from app.money import rupees
from app.ratelimit import LIMITS
from app.routers import public_site
from app.services.site import PACKAGES, package_price, read_states

SITE = "/public/site/deodar-view"


def packages_by_key(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {p["key"]: p for p in body["packages"]}


@pytest.mark.usefixtures("sample")
def test_package_lines_add_up_and_never_undercut_the_room_price(
    client: TestClient, owner: dict[str, str]
) -> None:
    body = client.get("/site", headers=owner).json()
    for p in body["packages"]:
        assert sum(line["amount"] for line in p["lines"]) == p["price"]
        assert p["price"] >= p["nightly_rate"] * p["nights"]
        assert p["state"] == "pending" and p["approved"] is False
    wk = packages_by_key(body)["wk"]
    assert wk["includes"] == {"en": "2 nights, breakfast, bonfire", "hi": "2 रातें, नाश्ता, अलाव"}
    assert wk["name"]["hi"] == "बादलों में वीकेंड"
    assert body["google"]["description"]["en"].startswith("Deodar View is a family-run 22-room")
    assert body["setup"]["photos_sent"] == 6 and body["slug"] == "deodar-view"


@pytest.mark.usefixtures("sample")
def test_edit_skip_and_bring_back_a_package(client: TestClient, owner: dict[str, str]) -> None:
    client.post("/site/packages/wk", headers=owner)
    body = client.patch("/site/packages/wk", headers=owner, json={"nights": 3}).json()
    wk = packages_by_key(body)["wk"]
    # 3 nights at the public Deluxe rate plus breakfast for each night; needs a fresh OK.
    assert (wk["nights"], wk["price"], wk["state"]) == (3, rupees(4_300 * 3 + 400 * 3), "pending")
    assert wk["includes"]["en"] == "3 nights, breakfast, bonfire"
    body = client.patch("/site/packages/mm", headers=owner, json={"state": "skipped"}).json()
    assert packages_by_key(body)["mm"]["state"] == "skipped"
    body = client.patch("/site/packages/mm", headers=owner, json={"state": "pending"}).json()
    assert packages_by_key(body)["mm"]["state"] == "pending"
    body = client.patch("/site/packages/wk", headers=owner, json={"nights": 2}).json()
    assert packages_by_key(body)["wk"]["price"] == rupees(9_400)
    for bad in ({"nights": 0}, {"nights": 8}, {"state": "live"}):
        assert client.patch("/site/packages/wk", headers=owner, json=bad).status_code == 422
    assert client.patch("/site/packages/zz", headers=owner, json={"nights": 2}).status_code == 404
    assert client.patch("/site/packages/wk", json={"nights": 2}).status_code == 401


def test_stored_decisions_read_the_earlier_format() -> None:
    assert read_states("wk") == {"wk": ("approved", None)}
    assert read_states("cd:skipped:,wk:pending:3") == {
        "cd": ("skipped", None),
        "wk": ("pending", 3),
    }
    rates = {"Deluxe Valley View": rupees(4_300), "Standard": rupees(3_400)}
    assert [package_price(s, rates) for s in PACKAGES] == [
        rupees(9_400),
        rupees(4_300),
        rupees(11_900),
    ]


@pytest.mark.usefixtures("sample")
def test_public_site_shows_only_approved_packages_and_no_guest_data(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    res = client.get(SITE)
    assert res.status_code == 200
    body = res.json()
    assert (body["hotel"], body["hotel_hi"], body["sample"], body["published"]) == (
        "Deodar View",
        "देवदार व्यू",
        True,
        False,
    )
    assert body["packages"] == []
    assert {r["room_type"]: r["nightly_rate"] for r in body["rooms"]} == {
        "Family Suite": rupees(6_200),
        "Deluxe Valley View": rupees(4_300),
        "Standard": rupees(3_400),
    }
    assert body["contact"] == {"phone": "+91 90000 00000", "upi": "deodarview@upi",
                               "placeholder": True}  # fmt: skip
    assert "stage" not in body and "setup" not in body and "google" not in body
    names = sample.scalars(select(Guest.display_name)).all()
    assert names and not any(name in res.text for name in names)

    client.post("/site/packages/cd", headers=owner)
    public = client.get(SITE).json()["packages"]
    assert [(p["key"], p["price"]) for p in public] == [("cd", rupees(4_300))]
    assert set(public[0]) == {"key", "name", "includes", "nights", "price"}
    assert client.get("/public/site/nowhere").status_code == 404


@pytest.mark.usefixtures("sample")
def test_a_real_hotel_site_is_public_only_after_publish(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    prop = sample.scalars(select(Property)).one()
    prop.is_sample = False
    sample.commit()
    assert client.get(SITE).status_code == 404
    for stage in ("chat", "review"):
        client.patch("/site", headers=owner, json={"stage": stage})
    assert client.get(SITE).status_code == 404
    client.post("/site/publish", headers=owner)
    body = client.get(SITE).json()
    assert body["published"] is True and body["contact"]["placeholder"] is False
    config = sample.scalars(select(SiteConfig)).one()
    sample.refresh(config)
    assert config.published_at is not None


@pytest.mark.usefixtures("sample")
def test_booking_bar_availability(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    today = date.fromisoformat(client.get(SITE).json()["today"])
    url = f"{SITE}/availability"

    def ask(day: date, room: str = "Deluxe Valley View", nights: int = 2) -> dict[str, Any]:
        res = client.get(url, params={"check_in": day.isoformat(), "room_type": room,
                                      "nights": nights})  # fmt: skip
        body: dict[str, Any] = res.json()
        return body

    assert ask(today + timedelta(days=30)) | {"check_in": None} == {
        "open": True, "reason": None, "check_in": None, "nights": 2,
        "room_type": "Deluxe Valley View",
    }  # fmt: skip
    assert ask(today)["reason"] == "past"
    assert ask(today + timedelta(days=400))["reason"] == "too_far"
    monkeypatch.setattr(public_site, "free_room", lambda *_args: None)
    assert ask(today + timedelta(days=30))["reason"] == "full"
    assert ask(today, room="Penthouse")["error"]["code"] == "no_such_room"
    bad = client.get(url, params={"check_in": "2026-11-01", "room_type": "Standard", "nights": 0})
    assert bad.status_code == 422


@pytest.mark.usefixtures("sample")
def test_public_site_is_rate_limited(client: TestClient) -> None:
    codes = [client.get(SITE).status_code for _ in range(LIMITS["site"].count)]
    assert set(codes) == {200}
    res = client.get(SITE)
    assert res.status_code == 429 and res.headers["retry-after"]
