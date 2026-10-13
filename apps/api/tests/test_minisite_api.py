"""Hotel mini-site API (docs/HOTEL_MINISITE.md): room details, the computed
"from" price, verified-guest ratings (one-time tokens from Seedha Link and
Desk checkout, public summary only from 3 ratings, owner hide but never edit
stars) and card QR codes on <PUBLIC_BASE_URL>/h/<slug>."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app
from app.models import Booking, Consent, DirectBooking, Property, SiteRating
from app.routers.public_site import public_site
from app.services import site_gen as gen
from app.services.proof import erase_consent
from app.services.site_cards import qr_matrix
from app.services.site_details import SAMPLE_DETAILS, RoomDetail, SiteDetailsIn
from app.services.site_ratings import (
    guest_link_base,
    issue_token,
    one_decimal_average,
    summary,
    token_hash,
)
from tests.test_site_publish import build, publish
from tests.test_site_v2_cards import ec_level, png_matrix

SAMPLE = "/public/site/deodar-view"
NOW = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)
PAST = date(2020, 1, 1)


def sample_prop(session: Session) -> Property:
    return session.scalars(select(Property)).one()


def details_with(client: TestClient, owner: dict[str, str], rooms: list[dict[str, Any]]) -> Any:
    body = client.get("/site/details", headers=owner).json()
    for key in ("amenity_labels", "sample"):
        body.pop(key)
    return client.put("/site/details", headers=owner, json={**body, "rooms": rooms})


def link_book(client: TestClient, room_type: str = "Standard", day: int = 0) -> Any:
    page = client.get("/public/link").json()
    return client.post("/public/link/book", json={
        "check_in": page["dates"][day]["check_in"], "nights": 2, "room_type": room_type,
    })  # fmt: skip


def stay_id(session: Session, index: int = 0) -> int:
    """A stored stay booking's id (a Desk rating link needs a real stay)."""
    ids = session.scalars(select(Booking.id).where(Booking.status == "stay").order_by(Booking.id))
    return list(ids)[index]


def give(session: Session, prop_id: int, ref: int, stars: int, comment: str = "") -> SiteRating:
    """A given rating (as if the guest used the link)."""
    issue_token(session, prop_id, "desk", ref, NOW, PAST)
    row = session.scalars(select(SiteRating).where(SiteRating.source_ref == ref)).one()
    row.stars, row.comment, row.used_at = stars, comment, NOW
    session.commit()
    return row


# --- room details --------------------------------------------------------------------


def test_room_detail_rules() -> None:
    ok = RoomDetail(name="Standard", size_sqft=240, beds_en="1 queen bed", max_guests=2,
                    features_en=["Heater", "Tea"], photo_id=None)  # fmt: skip
    assert ok.beds_hi == "" and ok.features_hi == []
    bad: list[dict[str, Any]] = [
        {"name": ""},
        {"name": "x" * 61},
        {"name": "A", "size_sqft": 49},
        {"name": "A", "size_sqft": 5001},
        {"name": "A", "max_guests": 0},
        {"name": "A", "max_guests": 13},
        {"name": "A", "beds_en": "x" * 41},
        {"name": "A", "features_en": ["a", "b", "c"]},
        {"name": "A", "features_hi": [""]},
        {"name": "A", "features_en": ["x" * 41]},
        {"name": "A", "beds_en": "<b>bed</b>"},
        {"name": "A", "features_en": ["Wi" + chr(0x202E) + "fi"]},
        {"name": "A", "price": 100},
    ]
    for body in bad:
        with pytest.raises(ValidationError):
            RoomDetail.model_validate(body)
    with pytest.raises(ValidationError):
        SiteDetailsIn(rooms=[RoomDetail(name="A"), RoomDetail(name="A")])
    with pytest.raises(ValidationError):
        SiteDetailsIn(rooms=[RoomDetail(name=f"R{i}") for i in range(13)])


def test_sample_rooms_cover_the_sample_room_types() -> None:
    names = [r.name for r in SAMPLE_DETAILS.rooms]
    assert names == ["Family Suite", "Deluxe Valley View", "Standard"]
    rooms = SAMPLE_DETAILS.rooms
    assert all(r.size_sqft and r.max_guests and len(r.features_en) == 2 for r in rooms)
    assert SAMPLE_DETAILS.geo is not None and round(SAMPLE_DETAILS.geo.lat, 1) == 30.5


@pytest.mark.usefixtures("base_sample")
def test_owner_saves_room_details_for_rooms_the_hotel_sells(
    client: TestClient, owner: dict[str, str]
) -> None:
    body = client.get("/site/details", headers=owner).json()
    assert body["sample"] is True and len(body["rooms"]) == 3
    room = {
        "name": "Standard",
        "size_sqft": 250,
        "beds_en": "1 queen bed",
        "beds_hi": "",
        "max_guests": 2,
        "features_en": ["Heater"],
        "features_hi": [],
        "photo_id": None,
    }
    saved = details_with(client, owner, [room])
    assert saved.status_code == 200 and saved.json()["rooms"] == [room]
    unknown = details_with(client, owner, [{**room, "name": "Penthouse"}])
    assert unknown.status_code == 422 and unknown.json()["error"]["code"] == "bad_room_details"
    no_photo = details_with(client, owner, [{**room, "photo_id": 999}])
    assert no_photo.status_code == 422


@pytest.mark.usefixtures("base_sample")
def test_built_room_names_and_own_photos_are_accepted(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    prop = sample_prop(session)
    photos = build(session, prop, [gen.Room("Cottage", 500_000, "Quiet.", "शांत।")])
    room = {"name": "Cottage", "photo_id": photos[1].id}
    assert details_with(client, owner, [room]).status_code == 200


# --- public payload ------------------------------------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_public_payload_has_room_details_from_price_and_empty_ratings(client: TestClient) -> None:
    body = client.get(SAMPLE).json()
    assert [r["name"] for r in body["details"]["rooms"]] == [
        "Family Suite", "Deluxe Valley View", "Standard",
    ]  # fmt: skip
    assert body["from_price_paise"] == min(r["nightly_rate"] for r in body["rooms"])
    assert body["from_price_paise"] == 340_000
    assert body["ratings"] == {"count": 0, "average": None, "comments": []}


@pytest.mark.usefixtures("base_sample")
def test_public_room_photo_only_when_that_photo_is_published(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    prop = sample_prop(session)
    prop.is_sample = False
    session.commit()
    photos = build(session, prop)
    details_with(client, owner, [{"name": "Deluxe Valley View", "photo_id": photos[0].id}])
    assert publish(client, owner, "deodar-view").status_code == 200
    body = client.get(SAMPLE).json()
    assert body["details"]["rooms"][0]["photo_id"] == photos[0].id
    assert body["from_price_paise"] == 450_000
    client.delete(f"/site/photos/{photos[0].id}", headers=owner)
    assert client.get(SAMPLE).json()["details"]["rooms"][0]["photo_id"] is None


# --- ratings -------------------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_link_booking_gives_a_one_time_rating_link(
    client: TestClient, settings: Settings, session: Session
) -> None:
    booked = link_book(client).json()
    url = booked["rating_url"]
    assert url.startswith(f"{settings.web_origin.rstrip('/')}/rate/")
    token = url.rsplit("/", 1)[1]
    row = session.scalars(select(SiteRating)).one()
    assert row.token_hash == token_hash(token) and token not in row.token_hash
    assert (row.source, row.stars, row.used_at) == ("link", None, None)
    stay = session.get_one(DirectBooking, row.source_ref).booking
    ends = stay.check_in + timedelta(days=stay.nights)
    assert row.opens_on == ends  # MR-1/MR-2: only once the stay is over
    page = client.get(f"/public/rate/{token}").json()
    assert page == {"hotel": "Deodar View", "slug": "deodar-view", "state": "not_yet",
                    "opens_on": ends.isoformat()}  # fmt: skip
    early = client.post(f"/public/rate/{token}", json={"stars": 5})
    assert (early.status_code, early.json()["error"]["code"]) == (409, "not_open_yet")
    row.opens_on = PAST  # the stay is over
    session.commit()
    page = client.get(f"/public/rate/{token}").json()
    assert page == {"hotel": "Deodar View", "slug": "deodar-view", "state": "open",
                    "opens_on": None}  # fmt: skip
    res = client.post(f"/public/rate/{token}", json={"stars": 5, "comment": "Lovely\nstay"})
    assert res.status_code == 204
    again = client.post(f"/public/rate/{token}", json={"stars": 1})
    assert again.status_code == 409
    assert client.get(f"/public/rate/{token}").json()["state"] == "used"
    session.expire_all()
    row = session.scalars(select(SiteRating)).one()
    assert (row.stars, row.comment) == (5, "Lovely stay")


@pytest.mark.usefixtures("sample")
def test_desk_checkout_gives_one_rating_link_per_stay(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    first = client.post("/desk/checkout", headers=owner, json={"room": 112}).json()
    assert "/rate/" in first["rating_url"]
    again = client.post("/desk/checkout", headers=owner, json={"room": 112}).json()
    assert again["rating_url"] is None and again["slip"] == first["slip"]
    rows = session.scalars(select(SiteRating)).all()
    assert [(r.source, r.source_ref) for r in rows] == [("desk", first["booking_id"])]
    token = first["rating_url"].rsplit("/", 1)[1]
    assert client.get(f"/public/rate/{token}").json()["state"] == "open"  # checkout: stay over


@pytest.mark.usefixtures("base_sample")
def test_cancelled_booking_never_opens_a_rating(client: TestClient, session: Session) -> None:
    prop = sample_prop(session)
    ref = stay_id(session)
    token = issue_token(session, prop.id, "desk", ref, NOW, PAST)
    assert token is not None
    session.get_one(Booking, ref).status = "cancelled"
    session.commit()
    assert client.get(f"/public/rate/{token}").json()["state"] == "invalid"
    assert client.post(f"/public/rate/{token}", json={"stars": 5}).status_code == 404


@pytest.mark.usefixtures("base_sample")
def test_rating_links_use_the_card_base_url(settings: Settings) -> None:
    assert guest_link_base(replace(settings, public_base_url="https://x.example")) == (
        "https://x.example"
    )
    assert guest_link_base(replace(settings, public_base_url="")) == settings.web_origin


@pytest.mark.usefixtures("base_sample")
def test_erasure_blanks_rating_comments_but_keeps_stars(session: Session) -> None:
    prop = sample_prop(session)
    booking = session.scalars(
        select(Booking).where(Booking.status == "stay", Booking.guest_id.is_not(None))
    ).first()
    assert booking is not None and booking.guest_id is not None
    consent = Consent(guest_id=booking.guest_id, booking_id=booking.id, wording_version="v1",
                      given_at=NOW, salt="cd" * 16, fingerprint="ab" * 32)  # fmt: skip
    session.add(consent)
    session.flush()
    other_id = session.scalars(
        select(Booking.id).where(Booking.status == "stay", Booking.guest_id != consent.guest_id)
    ).first()
    assert other_id is not None
    row = give(session, prop.id, booking.id, 4, "Asha from room 104")
    other = give(session, prop.id, other_id, 5, "Kept")
    erase_consent(session, consent, NOW)
    session.commit()
    session.expire_all()
    assert (row.stars, row.comment) == (4, "")
    assert (other.stars, other.comment) == (5, "Kept")


@pytest.mark.usefixtures("base_sample")
def test_rating_input_rules(client: TestClient, session: Session) -> None:
    prop = sample_prop(session)
    ref = stay_id(session)
    token = issue_token(session, prop.id, "desk", ref, NOW, PAST)
    session.commit()
    assert token is not None
    assert issue_token(session, prop.id, "desk", ref, NOW, PAST) is None  # idempotent
    bodies: list[dict[str, Any]] = [
        {"stars": 0}, {"stars": 6}, {"stars": 3, "comment": "x" * 201},
        {"stars": 3, "comment": "<script>"}, {"stars": 3, "name": "Asha"}, {},
    ]  # fmt: skip
    for body in bodies:
        assert client.post(f"/public/rate/{token}", json=body).status_code == 422
    for bad in ("nope", "x" * 65):
        assert client.get(f"/public/rate/{bad}").json() == {
            "hotel": "", "slug": "", "state": "invalid", "opens_on": None,
        }  # fmt: skip
        assert client.post(f"/public/rate/{bad}", json={"stars": 4}).status_code == 404
    assert client.post(f"/public/rate/{token}", json={"stars": 4}).status_code == 204


@pytest.mark.usefixtures("base_sample")
def test_rating_links_are_rate_limited(client: TestClient) -> None:
    codes = [client.get("/public/rate/nope").status_code for _ in range(25)]
    assert codes[0] == 200 and codes[-1] == 429


def test_average_is_one_decimal_half_up() -> None:
    assert one_decimal_average([5, 4, 4]) == 4.3
    assert one_decimal_average([5, 4]) == 4.5
    assert one_decimal_average([4, 4, 5, 5, 5, 5]) == 4.7
    assert one_decimal_average([1, 2, 2, 2]) == 1.8


@pytest.mark.usefixtures("base_sample")
def test_public_summary_needs_three_and_never_shows_hidden_comments(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    prop = sample_prop(session)
    give(session, prop.id, 1, 5, "Warm staff")
    give(session, prop.id, 2, 4, "")
    assert summary(session, prop.id).model_dump() == {"count": 2, "average": None, "comments": []}
    issue_token(session, prop.id, "desk", 9, NOW, PAST)  # issued, never used: does not count
    rude = give(session, prop.id, 3, 1, "Rude words")
    body = client.get(SAMPLE).json()["ratings"]
    assert body["count"] == 3 and body["average"] == 3.3
    assert {c["comment"] for c in body["comments"]} == {"Warm staff", "Rude words"}
    assert body["comments"][0]["month"] == "2026-10"

    listed = client.get("/site/ratings", headers=owner).json()
    assert len(listed) == 3 and set(listed[0]) == {
        "id", "stars", "comment", "hidden", "created_at", "source",
    }  # fmt: skip
    hidden = client.patch(f"/site/ratings/{rude.id}", headers=owner, json={"hidden": True})
    assert hidden.status_code == 200 and hidden.json()["stars"] == 1
    body = client.get(SAMPLE).json()["ratings"]
    assert body["count"] == 3 and body["average"] == 3.3
    assert [c["comment"] for c in body["comments"]] == ["Warm staff"]
    no_stars = client.patch(f"/site/ratings/{rude.id}", headers=owner, json={"stars": 5})
    assert no_stars.status_code == 422
    missing = client.patch("/site/ratings/9999", headers=owner, json={"hidden": True})
    assert missing.status_code == 404


@pytest.mark.usefixtures("base_sample")
def test_hosted_sample_hotel_shows_no_ratings(session: Session, settings: Settings) -> None:
    prop = sample_prop(session)
    for ref in (1, 2, 3):
        give(session, prop.id, ref, 5)
    hosted = replace(settings, production=True)
    assert public_site("deodar-view", session, hosted, NOW).ratings.count == 0
    assert public_site("deodar-view", session, settings, NOW).ratings.count == 3


@pytest.mark.usefixtures("sample")
def test_reset_restores_zero_ratings(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    assert link_book(client).json()["rating_url"]
    assert client.post("/demo/reset", headers=owner).status_code == 200
    assert session.scalar(select(func.count()).select_from(SiteRating)) == 0
    assert client.get(SAMPLE).json()["ratings"]["count"] == 0


# --- card QR -------------------------------------------------------------------------


@pytest.fixture(name="based")
def fixture_based(settings: Settings, factory: sessionmaker[Session]) -> Iterator[TestClient]:
    """A client whose PUBLIC_BASE_URL differs from the site's own address."""
    custom = replace(settings, public_base_url="https://seedha.example/", site_root_domain="h.test")
    with TestClient(create_app(custom, factory)) as c:
        yield c


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize("card", ["wallet", "room", "desk"])
def test_card_qr_points_at_public_base_url(
    based: TestClient, owner: dict[str, str], card: str
) -> None:
    target = f"https://seedha.example/h/deodar-view?src=card-{card}"
    svg = based.get(f"/site/cards/qr.svg?card={card}", headers=owner)
    assert f"<title>{target}</title>" in svg.text
    matrix, side = png_matrix(based.get(f"/site/cards/qr.png?card={card}", headers=owner).content)
    assert side >= 1024 and matrix == qr_matrix(target) and ec_level(matrix) == "H"


@pytest.mark.usefixtures("base_sample")
def test_card_qr_falls_back_to_the_site_address(
    settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    custom = replace(settings, public_base_url="", site_root_domain="h.test")
    with TestClient(create_app(custom, factory)) as c:
        svg = c.get("/site/cards/qr.svg?card=room", headers=owner).text
    assert "<title>https://deodar-view.h.test?src=card-room</title>" in svg


@pytest.mark.usefixtures("base_sample")
def test_owner_site_lists_what_each_card_qr_encodes(
    based: TestClient, owner: dict[str, str]
) -> None:
    urls = based.get("/site", headers=owner).json()["card_urls"]
    assert urls == {
        card: f"https://seedha.example/h/deodar-view?src=card-{card}"
        for card in ("wallet", "room", "desk")
    }
