"""Hotel Site V2 (docs/HOTEL_SITE_V2.md): the owner's hotel facts (strict
validation, fixed 40 amenities, sample facts, locked public page) and card
scan counts (only counts, per card type per hotel day)."""

from __future__ import annotations

from dataclasses import replace
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Property, SiteCardScan
from app.proxy_trust import proxy_proof, server_render
from app.services.site_details import (
    AMENITIES,
    AMENITY_IDS,
    DAILY_SCAN_CAP,
    SAMPLE_DETAILS,
    read_details,
    record_scan,
    save_details,
)
from tests.conftest import OWNER_TOKEN

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
        # R1-10: control, bidi and zero-width characters; invisible-only names
        {"nearby": [{"name_en": "\u202eHill", "minutes": 5, "mode": "walk"}]},
        {"nearby": [{"name_en": "\u200b", "minutes": 5, "mode": "walk"}]},
        {"nearby": [{"name_en": " \u2066 ", "minutes": 5, "mode": "walk"}]},
        {"nearby": [{"name_en": "...", "minutes": 5, "mode": "walk"}]},
        {"good_to_know": [{"text_en": "Bell\x00"}]},
        {"how_to_reach": [{"mode": "road", "text_en": "By\u200broad"}]},
        {"contact": {"phone": "²³⁴⁵⁶⁷"}},
        {"contact": {"phone": "١٢٣٤٥٦"}},
        {"contact": {"phone": "91+2345678"}},
        {"contact": {"whatsapp": "+91 9"}},
        {"contact": {"email": "a@b.co?cc=x&body=hi"}},
        {"contact": {"email": "a=b@c.com"}},
        # R2-1: a card perk is short owner text, never a price or discount
        {"card_perk_en": "x" * 101},
        {"card_perk_en": "10% off your next stay"},
        {"card_perk_en": "Rs 500 back"},
        {"card_perk_hi": "₹500"},
        {"card_perk_en": "<b>Tea</b>"},
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
    codes = [client.post(f"{SAMPLE}/scan", json={"card": "room"}).status_code for _ in range(11)]
    assert 429 not in codes[:10] and codes[10] == 429


@pytest.mark.usefixtures("base_sample")
def test_text_rules_keep_ordinary_owner_text(client: TestClient, owner: dict[str, str]) -> None:
    """Line breaks become spaces; a Devanagari joiner is kept; a card perk is
    optional and saved as written."""
    body = facts(
        good_to_know=[{"text_en": "Bring warm\nclothes.", "text_hi": "क्\u200dष ठंड"}],
        card_perk_en="Masala chai on arrival",
        card_perk_hi="पहुंचने पर मसाला चाय",
    )
    saved = client.put("/site/details", headers=owner, json=body).json()
    assert saved["good_to_know"][0]["text_en"] == "Bring warm clothes."
    assert saved["card_perk_en"] == "Masala chai on arrival"
    assert client.get(SAMPLE).json()["details"]["card_perk_hi"] == "पहुंचने पर मसाला चाय"
    empty = client.put("/site/details", headers=owner, json=facts()).json()
    assert empty["card_perk_en"] == "" and empty["card_perk_hi"] == ""


def test_sample_card_perk_is_labelled() -> None:
    assert SAMPLE_DETAILS.card_perk_en == (
        "Sample perk: masala chai on arrival for guests who book direct"
    )
    assert SAMPLE_DETAILS.card_perk_hi.startswith("नमूना")


@pytest.mark.usefixtures("base_sample")
def test_scan_limit_is_per_hotel_per_client(client: TestClient, session: Session) -> None:
    """R1-4: one client's allowance is counted per hotel."""
    other = Property(name="Hotel Valley Inn", short_name="Valley Inn", city="Nainital",
                     address="Sample address", rooms_count=10, owner_name="Sample Owner",
                     perk_text="Tea", code_prefix="VI", is_sample=False)  # fmt: skip
    session.add(other)
    session.commit()
    codes = [client.post(f"{SAMPLE}/scan", json={"card": "room"}).status_code for _ in range(11)]
    assert set(codes[:10]) == {204} and codes[10] == 429
    # Another slug has its own allowance (404 here: that hotel is not live).
    assert client.post("/public/site/valley-inn/scan", json={"card": "room"}).status_code == 404


@pytest.mark.usefixtures("base_sample")
def test_scans_above_the_daily_cap_are_not_counted(session: Session) -> None:
    """R1-4: at most DAILY_SCAN_CAP per card type per hotel day."""
    prop = session.scalars(select(Property)).one()
    day = date(2026, 10, 13)
    assert record_scan(session, prop.id, "desk", day)
    row = session.scalars(select(SiteCardScan)).one()
    row.count = DAILY_SCAN_CAP - 1
    assert record_scan(session, prop.id, "desk", day)
    assert not record_scan(session, prop.id, "desk", day)
    assert row.count == DAILY_SCAN_CAP
    assert record_scan(session, prop.id, "wallet", day)


def proof_headers(**extra: str) -> dict[str, str]:
    return {"x-seedha-proxy": proxy_proof(OWNER_TOKEN), **extra}


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize(
    ("headers", "render"),
    [
        (proof_headers(), True),  # the web server's own cached render
        ({}, False),  # an ordinary client
        (proof_headers(**{"x-forwarded-for": "203.0.113.7"}), False),  # BFF, a visitor
        ({"x-seedha-proxy": "0" * 64}, False),  # a wrong proof
    ],
)
def test_server_renders_have_their_own_bucket(
    client: TestClient, headers: dict[str, str], render: bool
) -> None:
    """R1-2: only a valid proof without a visitor address uses site_ssr."""
    codes = [client.get(SAMPLE, headers=headers).status_code for _ in range(61)]
    assert set(codes[:60]) == {200}
    assert codes[60] == (200 if render else 429)
    # Renders never draw down the ordinary bucket, and the reverse.
    assert client.get(SAMPLE, headers=proof_headers()).status_code == 200


def test_server_render_counts_the_hosting_hop_in_production(settings: Settings) -> None:
    hosted = replace(settings, production=True)

    def scope(*pairs: tuple[str, str]) -> dict[str, Any]:
        return {"headers": [(k.encode(), v.encode()) for k, v in pairs]}

    proof = ("x-seedha-proxy", proxy_proof(OWNER_TOKEN))
    assert server_render(scope(proof, ("x-forwarded-for", "10.0.0.9")), hosted)  # Railway's hop
    assert not server_render(scope(proof, ("x-forwarded-for", "203.0.113.7, 10.0.0.9")), hosted)
    assert not server_render(scope(("x-forwarded-for", "10.0.0.9")), hosted)
    assert not server_render(scope(proof, ("x-forwarded-for", "10.0.0.9")), settings)
    assert server_render(scope(proof), settings)
    assert not server_render(scope(proof), replace(settings, owner_api_token=""))
