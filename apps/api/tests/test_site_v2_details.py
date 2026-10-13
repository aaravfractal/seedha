"""Hotel Site V2 (docs/HOTEL_SITE_V2.md): the owner's hotel facts (strict
validation, fixed 40 amenities, sample facts, locked public page) and card
scan counts (only counts, per card type per hotel day)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Property, SiteCardScan
from app.services.site_details import (
    AMENITIES,
    AMENITY_IDS,
    SAMPLE_DETAILS,
    read_details,
    save_details,
)

SAMPLE = "/public/site/deodar-view"


def facts(**over: Any) -> dict[str, Any]:
    """A valid details body with some fields replaced."""
    body: dict[str, Any] = {
        "amenities": ["parking", "wifi"],
        "nearby": [{"name_en": "Gun Hill", "minutes": 10, "mode": "drive",
                    "kind": "viewpoint", "bearing": 330}],
        "how_to_reach": [{"mode": "road", "text_en": "35 km from Dehradun."}],
        "good_to_know": [{"text_en": "Steep last 200 m.", "text_hi": "आख़िरी 200 मीटर चढ़ाई।"}],
        "check_in": "13:00",
        "check_out": "10:30",
        "contact": {"phone": "+91 98000 00001", "whatsapp": "+91 98000 00001",
                    "email": "stay@example.com", "address_en": "Camel's Back Road"},
        "geo": {"lat": 30.46, "lng": 78.07},
    }  # fmt: skip
    body.update(over)
    return body


def test_forty_fixed_amenities_with_both_labels() -> None:
    assert len(AMENITIES) == 40 and len(set(AMENITY_IDS)) == 40
    assert all(en and hi and en != hi for _, en, hi in AMENITIES)


@pytest.mark.usefixtures("base_sample")
def test_sample_hotel_starts_from_labelled_sample_facts(
    client: TestClient, owner: dict[str, str]
) -> None:
    body = client.get("/site/details", headers=owner).json()
    assert body["sample"] is True
    assert body["geo"] == {"lat": 30.4598, "lng": 78.0664}
    assert [p["name_en"] for p in body["nearby"]][:2] == ["Mall Road", "Gun Hill"]
    assert "(sample address)" in body["contact"]["address_en"]
    public = client.get(SAMPLE).json()["details"]
    assert public["sample"] is True and len(public["amenity_labels"]) == len(public["amenities"])


@pytest.mark.usefixtures("base_sample")
def test_owner_saves_facts_and_the_site_shows_them(
    client: TestClient, owner: dict[str, str]
) -> None:
    saved = client.put("/site/details", headers=owner, json=facts()).json()
    # Amenities keep the fixed order, with labels in both languages.
    assert saved["amenities"] == ["wifi", "parking"] and saved["sample"] is False
    assert saved["amenity_labels"][0] == {"id": "wifi", "en": "Free Wi-Fi", "hi": "मुफ़्त वाई-फ़ाई"}
    assert client.get("/site", headers=owner).json()["details"]["check_in"] == "13:00"
    assert client.get(SAMPLE).json()["details"]["contact"]["email"] == "stay@example.com"


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize(
    "bad",
    [
        {"amenities": ["wifi", "helipad"]},
        {"amenities": ["wifi"] * 41},
        {"nearby": [{"name_en": "<b>Hill</b>", "minutes": 5, "mode": "walk"}]},
        {"nearby": [{"name_en": "Hill", "minutes": 0, "mode": "walk"}]},
        {"nearby": [{"name_en": "Hill", "minutes": 5, "mode": "fly"}]},
        {"nearby": [{"name_en": "Hill", "minutes": 5, "mode": "walk", "bearing": 360}]},
        {"nearby": [{"name_en": "Hill", "minutes": 5, "mode": "walk"}] * 9},
        {"how_to_reach": [{"mode": "road", "text_en": "x" * 201}]},
        {"good_to_know": [{"text_en": ""}]},
        {"check_in": "25:00"},
        {"contact": {"phone": "call me"}},
        {"contact": {"email": "not-an-email"}},
        {"contact": {"phone": "+91 9", "fax": "1"}},
        {"geo": {"lat": 91, "lng": 0}},
        {"extra": 1},
    ],
)
def test_bad_facts_are_refused(
    client: TestClient, owner: dict[str, str], bad: dict[str, Any]
) -> None:
    assert client.put("/site/details", headers=owner, json=facts(**bad)).status_code == 422


@pytest.mark.usefixtures("base_sample")
def test_details_need_the_owner(client: TestClient) -> None:
    assert client.get("/site/details").status_code == 401
    assert client.put("/site/details", json=facts()).status_code == 401
    assert client.get("/site/scans").status_code == 401


@pytest.mark.usefixtures("base_sample")
def test_locked_public_page_shows_sample_facts_never_edits(session: Session) -> None:
    prop = session.scalars(select(Property)).one()
    from app.services.site_details import SiteDetailsIn  # noqa: PLC0415

    save_details(session, prop.id, SiteDetailsIn.model_validate(facts()))
    assert read_details(session, prop.id, is_sample=True, locked=False).sample is False
    locked = read_details(session, prop.id, is_sample=True, locked=True)
    assert locked.sample is True and locked.geo == SAMPLE_DETAILS.geo


@pytest.mark.usefixtures("base_sample")
def test_other_hotels_start_empty(session: Session) -> None:
    prop = session.scalars(select(Property)).one()
    empty = read_details(session, prop.id, is_sample=False, locked=False)
    assert empty.amenities == [] and empty.contact.phone == "" and empty.geo is None


@pytest.mark.usefixtures("base_sample")
def test_card_scans_count_only(client: TestClient, owner: dict[str, str], session: Session) -> None:
    for card in ("wallet", "wallet", "room", "desk"):
        assert client.post(f"{SAMPLE}/scan", json={"card": card}).status_code == 204
    assert client.post(f"{SAMPLE}/scan", json={"card": "flyer"}).status_code == 422
    assert client.post("/public/site/no-such-hotel/scan", json={"card": "room"}).status_code == 404
    scans = client.get("/site/scans", headers=owner).json()
    assert scans["total"] == 4
    assert scans["by_card"] == {"wallet": 2, "room": 1, "desk": 1}
    assert len(scans["by_day"]) == 1 and scans["by_day"][0]["wallet"] == 2
    # Only counts: the table has no column for anything about the visitor.
    columns = set(SiteCardScan.__table__.columns.keys())
    assert columns == {"id", "property_id", "card", "day", "count"}
    assert len(session.scalars(select(SiteCardScan)).all()) == 3


@pytest.mark.usefixtures("base_sample")
def test_card_scans_are_rate_limited(client: TestClient) -> None:
    codes = [client.post(f"{SAMPLE}/scan", json={"card": "room"}).status_code for _ in range(31)]
    assert 429 not in codes[:30] and codes[30] == 429
