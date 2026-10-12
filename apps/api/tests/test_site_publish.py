"""Hotel addresses and the public site (docs/SITE_REAL.md section 5): slug
rules, reserved words, uniqueness, rename redirects for 30 days, publish
(owner only), not-live 404s, the public photo route's caching, prices only
from what the owner typed, and no AI call from any public route."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Any

import anthropic
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, root_domain
from app.main import create_app
from app.models import Property, SiteConfig, SitePhoto
from app.services import site_gen as gen
from app.services import slug as slugs
from app.services.site_photos import add_photo, clean_photo

NOW = datetime(2026, 10, 12, 6, 0, tzinfo=UTC)
SAMPLE = "/public/site/deodar-view"


@pytest.fixture(name="clock")
def fixture_clock(client: TestClient) -> Iterator[list[datetime]]:
    """The API's clock; tests move it by changing now[0]."""
    now = [NOW]
    client.app.state.clock = lambda: now[0]  # type: ignore[attr-defined]
    yield now


def sample_prop(session: Session) -> Property:
    return session.scalars(select(Property).order_by(Property.id)).first()  # type: ignore[return-value]


def other_hotel(session: Session, slug: str | None = None, *, published: bool = True) -> Property:
    """A second (non-sample) property, optionally live at `slug`."""
    prop = Property(
        name="Hotel Valley Inn",
        short_name="Valley Inn",
        city="Nainital",
        address="Sample address",
        rooms_count=10,
        owner_name="Sample Owner",
        perk_text="Tea on arrival",
        code_prefix="VI",
        is_sample=False,
    )
    session.add(prop)
    session.flush()
    session.add(
        SiteConfig(
            property_id=prop.id,
            slug=slug,
            mood="pine",
            lang="en",
            stage="empty",
            approved_packages="",
            published_at=NOW if published else None,
        )
    )
    session.commit()
    return prop


def jpeg(colour: str = "green") -> bytes:
    out = BytesIO()
    Image.new("RGB", (60, 40), colour).save(out, "JPEG")
    return out.getvalue()


def build(session: Session, prop: Property, rooms: list[gen.Room] | None = None) -> list[SitePhoto]:
    """An owner build: generated text, typed room prices and two photos."""
    row = gen.get_content(session, prop.id)
    row.source = "claude"
    row.owner_description = "Family-run hotel with valley views."
    gen.write_rooms(
        row, rooms or [gen.Room("Deluxe Valley View", 450_000, "Big windows.", "बड़ी खिड़कियाँ।")]
    )
    gen.write_content(
        row,
        {
            "description_en": "A quiet family hotel.",
            "description_hi": "एक शांत होटल।",
            "why_book_direct_en": ["Talk to us", "Pay by UPI", "Perks"],
            "why_book_direct_hi": ["बात करें", "UPI", "पर्क"],
        },
    )
    photos = [add_photo(session, prop.id, clean_photo(jpeg(c))) for c in ("green", "blue")]
    photos[0].caption_en = "Valley view"
    session.commit()
    return photos


def publish(client: TestClient, owner: dict[str, str], slug: str | None = None) -> Any:
    return client.post("/site/publish", headers=owner, json={"slug": slug} if slug else None)


# --- slug rules -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("slug", "why"),
    [
        ("deodar-view", None),
        ("abc", None),
        ("a" * 40, None),
        ("hotel-7", None),
        ("ab", "slug_invalid"),
        ("a" * 41, "slug_invalid"),
        ("-deodar", "slug_invalid"),
        ("deodar-", "slug_invalid"),
        ("deodar--view", "slug_invalid"),
        ("Deodar", "slug_invalid"),
        ("deodar_view", "slug_invalid"),
        ("देवदार", "slug_invalid"),
        ("www", "slug_reserved"),
        ("app", "slug_reserved"),
        ("api", "slug_reserved"),
        ("admin", "slug_reserved"),
        ("mail", "slug_reserved"),
        ("docs", "slug_reserved"),
        ("status", "slug_reserved"),
        ("login", "slug_reserved"),
    ],
)
def test_slug_shape_rules(slug: str, why: str | None) -> None:
    assert slugs.shape_problem(slug) == why


def test_root_domain_and_addresses() -> None:
    assert root_domain(" https://Seedha.IN/ ") == "seedha.in"
    assert root_domain("seedha.in:443") == "seedha.in"
    assert root_domain("") == ""
    assert slugs.site_url("deodar-view", "http://localhost:3000/", "") == (
        "http://localhost:3000/h/deodar-view"
    )
    assert slugs.site_url("deodar-view", "x", "seedha.in") == "https://deodar-view.seedha.in"
    assert slugs.display_address("https://deodar-view.seedha.in") == "deodar-view.seedha.in"


@pytest.mark.usefixtures("base_sample")
def test_slug_check_suggests_and_explains(
    client: TestClient, owner: dict[str, str], clock: list[datetime]
) -> None:
    del clock
    url = "/site/slug/check"
    body = client.get(url, headers=owner).json()
    assert body["slug"] == body["suggestion"] == "deodar-view" and body["ok"] is True
    assert body["reason"] is None and body["url"].endswith("/h/deodar-view")
    body = client.get(url, headers=owner, params={"slug": " Valley-Inn "}).json()
    assert (body["slug"], body["ok"]) == ("valley-inn", True)
    for slug, reason in (
        ("www", "slug_reserved"),
        ("ab", "slug_invalid"),
        ("a--b", "slug_invalid"),
    ):
        body = client.get(url, headers=owner, params={"slug": slug}).json()
        assert (body["ok"], body["reason"]) == (False, reason) and body["message"]
    assert client.get(url).status_code == 401


@pytest.mark.usefixtures("base_sample")
def test_slugs_are_unique_and_suggestions_avoid_taken_ones(
    client: TestClient, owner: dict[str, str], session: Session, clock: list[datetime]
) -> None:
    del clock
    other_hotel(session, "deodar-view")
    body = client.get("/site/slug/check", headers=owner).json()
    assert body["suggestion"] == "deodar-view-2"
    taken = client.get("/site/slug/check", headers=owner, params={"slug": "deodar-view"}).json()
    assert (taken["ok"], taken["reason"]) == (False, "slug_taken")
    client.patch("/site", headers=owner, json={"stage": "review"})
    res = publish(client, owner, "deodar-view")
    assert (res.status_code, res.json()["error"]["code"]) == (422, "slug_taken")
    res = publish(client, owner, "www")
    assert (res.status_code, res.json()["error"]["code"]) == (422, "slug_reserved")
    assert publish(client, owner).json()["slug"] == "deodar-view-2"


def test_suggestions_for_awkward_names(session: Session) -> None:
    for short, expected in (
        ("Om", "om-hotel"),
        ("Admin", "admin-hotel"),
        ("होटल", "my-hotel"),
        ("A" * 50, "a" * 40),
    ):
        prop = Property(
            name=short,
            short_name=short,
            city="Almora",
            address="Sample",
            rooms_count=5,
            owner_name="Sample",
            perk_text="Tea",
            code_prefix="X",
            is_sample=False,
        )
        session.add(prop)
        session.flush()
        config = SiteConfig(property_id=prop.id)
        assert slugs.suggested_slug(session, prop, config, NOW) == expected
        config.slug = expected
        session.add(config)
        session.flush()


@pytest.mark.usefixtures("base_sample")
def test_publish_race_on_the_same_slug_is_a_conflict(
    client: TestClient, owner: dict[str, str], session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    other_hotel(session, "valley-inn")
    client.patch("/site", headers=owner, json={"stage": "review"})
    monkeypatch.setattr("app.routers.site.problem", lambda *_: None)
    res = publish(client, owner, "valley-inn")
    assert (res.status_code, res.json()["error"]["code"]) == (422, "slug_taken")


# --- publish and renames -----------------------------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_address_for_the_publish_panel(
    client: TestClient, owner: dict[str, str], session: Session, clock: list[datetime]
) -> None:
    del clock
    body = client.get("/site/address", headers=owner).json()
    assert body == {
        "slug": "deodar-view",
        "suggested_slug": "deodar-view",
        "url": "http://localhost:3000/h/deodar-view",
        "address": "localhost:3000/h/deodar-view",
        "published": False,
        "root_domain": "",
        "hide_branding": False,
    }
    assert client.get("/site/address").status_code == 401
    other = other_hotel(session, None, published=False)
    config = session.scalars(select(SiteConfig).where(SiteConfig.property_id == other.id)).one()
    assert slugs.current_slug(other, config) is None
    assert slugs.suggested_slug(session, other, config, NOW) == "valley-inn"
    client.patch("/site", headers=owner, json={"stage": "review"})
    publish(client, owner, "deodar-hills")
    body = client.get("/site/address", headers=owner).json()
    assert (body["slug"], body["suggested_slug"], body["published"]) == (
        "deodar-hills",
        "deodar-hills",
        True,
    )


@pytest.mark.usefixtures("base_sample")
def test_publish_needs_a_build_and_sets_the_address(
    client: TestClient, owner: dict[str, str], session: Session, clock: list[datetime]
) -> None:
    res = publish(client, owner, "deodar-mussoorie")
    assert (res.status_code, res.json()["error"]["code"]) == (409, "not_ready")
    build(session, sample_prop(session))
    body = publish(client, owner, "Deodar-Mussoorie").json()
    assert body["published"] is True and body["slug"] == "deodar-mussoorie"
    assert body["url"].endswith("/h/deodar-mussoorie") and body["address"].endswith(
        "/h/deodar-mussoorie"
    )
    assert body["published_at"].startswith(clock[0].date().isoformat())
    assert client.get("/site", headers=owner).json()["live"] is True
    config = session.scalars(select(SiteConfig)).one()
    session.refresh(config)
    assert (config.slug, config.previous_slug) == ("deodar-mussoorie", "deodar-view")


@pytest.mark.usefixtures("base_sample")
def test_a_renamed_address_redirects_for_30_days_only(
    client: TestClient, owner: dict[str, str], session: Session, clock: list[datetime]
) -> None:
    client.patch("/site", headers=owner, json={"stage": "review"})
    publish(client, owner, "first-name")
    publish(client, owner, "second-name")
    old = client.get("/public/site/first-name").json()
    assert old["redirect_to"] == "second-name" and old["slug"] == "second-name"
    assert client.get("/public/site/second-name").json()["redirect_to"] is None
    assert client.get("/public/site/first-name/resolve").json() == {
        "state": "moved",
        "slug": "second-name",
    }
    assert client.get("/public/site/second-name/resolve").json() == {
        "state": "live",
        "slug": "second-name",
    }
    newcomer = other_hotel(session, None, published=False)
    assert slugs.problem(session, "first-name", newcomer.id, clock[0]) == "slug_taken"

    clock[0] = NOW + timedelta(days=30, minutes=1)
    assert client.get("/public/site/first-name").status_code == 404
    assert client.get("/public/site/first-name/resolve").json() == {
        "state": "none",
        "slug": "first-name",
    }
    assert slugs.problem(session, "first-name", newcomer.id, clock[0]) is None


@pytest.mark.usefixtures("base_sample")
def test_republishing_keeps_the_address_and_first_publish_time(
    client: TestClient, owner: dict[str, str], clock: list[datetime]
) -> None:
    client.patch("/site", headers=owner, json={"stage": "review"})
    first = publish(client, owner).json()
    clock[0] = NOW + timedelta(days=2)
    again = publish(client, owner, "deodar-view").json()
    assert first["published_at"][:19] == again["published_at"][:19] == "2026-10-12T06:00:00"
    assert again["slug"] == "deodar-view"


@pytest.mark.usefixtures("base_sample")
def test_publish_is_owner_only(client: TestClient, owner: dict[str, str], session: Session) -> None:
    assert client.post("/site/publish").status_code == 401
    assert (
        client.post("/site/publish", headers={"Authorization": "Bearer wrong"}).status_code == 401
    )
    sample_prop(session).is_sample = False
    session.commit()
    res = client.post("/site/publish", headers=owner | {"X-Seedha-Subject": "demo"})
    assert res.status_code == 403


# --- the public site ---------------------------------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_unknown_and_unpublished_sites_are_not_live(
    client: TestClient, session: Session, clock: list[datetime]
) -> None:
    del clock
    other_hotel(session, "valley-inn", published=False)
    for slug in ("valley-inn", "nowhere", "www", "x"):
        res = client.get(f"/public/site/{slug}")
        assert (
            res.status_code == 404
            and res.json()["error"]["message"] == "This hotel site isn't live yet"
        )
        assert client.get(f"/public/site/{slug}/resolve").json()["state"] == "none"
    assert client.get(SAMPLE).status_code == 200


@pytest.mark.usefixtures("base_sample")
def test_public_site_shows_the_build_only_after_publish(
    client: TestClient, owner: dict[str, str], session: Session, clock: list[datetime]
) -> None:
    del clock
    rooms = [
        gen.Room("Deluxe Valley View", 450_000, "Big windows.", ""),
        gen.Room("Attic", 0, "", ""),
    ]
    photos = build(session, sample_prop(session), rooms)
    before = client.get(SAMPLE).json()
    assert before["source"] == "none" and before["text"] is None and before["photos"] == []
    assert {r["room_type"]: r["nightly_rate"] for r in before["rooms"]}[
        "Deluxe Valley View"
    ] == 430_000
    assert len(before["gallery"]) == 6

    preview = client.get("/site", headers=owner).json()
    assert (
        preview["source"] == "claude"
        and preview["photos"][0]["url"] == f"/api/site/photos/{photos[0].id}"
    )

    publish(client, owner)
    body = client.get(SAMPLE).json()
    assert body["rooms"] == [
        {
            "room_type": "Deluxe Valley View",
            "name_hi": "Deluxe Valley View",
            "detail": {"en": "Big windows.", "hi": "Big windows."},
            "nightly_rate": 450_000,
        }
    ]
    assert body["text"]["description"] == {"en": "A quiet family hotel.", "hi": "एक शांत होटल।"}
    assert body["text"]["why_book_direct"]["en"] == ["Talk to us", "Pay by UPI", "Perks"]
    first = body["photos"][0]
    assert (
        first["url"]
        == f"/api/public/site/deodar-view/photos/{photos[0].id}?v={photos[0].sha256[:8]}"
    )
    assert (first["caption_en"], first["caption_hi"]) == ("Valley view", "Valley view")
    assert (first["width"], first["height"]) == (60, 40)
    assert body["gallery"] == [] and body["hide_branding"] is False
    assert body["booking_url"] == "/link"


@pytest.mark.usefixtures("base_sample")
def test_hide_branding_is_an_owner_only_setting(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    assert client.get(SAMPLE).json()["hide_branding"] is False
    res = client.patch("/site/branding", headers=owner, json={"hide_branding": True})
    assert res.status_code == 200 and res.json() == {"hide_branding": True}
    assert client.get(SAMPLE).json()["hide_branding"] is True
    assert client.get("/site", headers=owner).json()["hide_branding"] is True
    assert client.patch("/site/branding", headers=owner, json={}).status_code == 422
    assert client.patch("/site/branding", json={"hide_branding": False}).status_code == 401
    sample_prop(session).is_sample = False
    session.commit()
    demo = owner | {"X-Seedha-Subject": "demo"}
    assert (
        client.patch("/site/branding", headers=demo, json={"hide_branding": False}).status_code
        == 403
    )
    assert client.patch("/site/branding", headers=owner, json={"hide_branding": False}).json() == {
        "hide_branding": False
    }


@pytest.mark.usefixtures("base_sample")
def test_a_real_hotel_uses_its_own_details(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    sample_prop(session).is_sample = False
    session.commit()
    client.patch("/site", headers=owner, json={"stage": "review"})
    publish(client, owner)
    body = client.get(SAMPLE).json()
    assert body["nearby"] == [] and body["tagline"] == {"en": "", "hi": ""}
    assert body["location"]["en"] == body["location"]["hi"] != "Mall Road, Mussoorie"


@pytest.mark.usefixtures("base_sample")
def test_addresses_on_the_root_domain(
    settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    hosted = replace(settings, site_root_domain="seedha.in", web_origin="https://app.seedha.in")
    with TestClient(create_app(hosted, factory)) as c:
        body = c.get(SAMPLE).json()
        assert (
            body["url"] == "https://deodar-view.seedha.in"
            and body["address"] == "deodar-view.seedha.in"
        )
        assert body["booking_url"] == "https://app.seedha.in/link"
        address = c.get("/site/address", headers=owner).json()
        assert address["root_domain"] == "seedha.in"
        assert address["url"] == "https://deodar-view.seedha.in"
        check = c.get("/site/slug/check", headers=owner, params={"slug": "valley-inn"}).json()
        assert check["url"] == "https://valley-inn.seedha.in"


# --- the public photo route --------------------------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_public_photo_route_caching_and_scope(
    client: TestClient, owner: dict[str, str], session: Session, clock: list[datetime]
) -> None:
    del clock
    photos = build(session, sample_prop(session))
    url = f"/public/site/deodar-view/photos/{photos[0].id}"
    assert client.get(url).status_code == 404  # sample hotel, not yet published
    publish(client, owner)
    res = client.get(url, params={"v": photos[0].sha256[:8]})
    assert res.status_code == 200 and res.headers["content-type"] == "image/jpeg"
    assert res.headers["cache-control"] == "public, max-age=86400, immutable"
    assert res.headers["etag"] == f'"{photos[0].sha256}"' and res.content.startswith(b"\xff\xd8")
    again = client.get(url, headers={"If-None-Match": res.headers["etag"]})
    assert again.status_code == 304 and again.content == b""
    assert client.get(url, headers={"If-None-Match": '"other"'}).status_code == 200

    other = other_hotel(session, "valley-inn")
    theirs = add_photo(session, other.id, clean_photo(jpeg("red")))
    session.commit()
    assert client.get(f"/public/site/deodar-view/photos/{theirs.id}").status_code == 404
    assert client.get(f"/public/site/valley-inn/photos/{theirs.id}").status_code == 200
    assert client.get(f"/public/site/valley-inn/photos/{photos[0].id}").status_code == 404
    assert client.get("/public/site/nowhere/photos/1").status_code == 404
    assert client.get(f"/public/site/deodar-view/photos/{10_000}").status_code == 404


@pytest.mark.usefixtures("base_sample")
def test_photos_have_their_own_generous_rate_limit(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    photos = build(session, sample_prop(session))
    publish(client, owner)
    url = f"/public/site/deodar-view/photos/{photos[0].id}"
    for _ in range(80):  # ten page views of eight photos each in a minute
        assert client.get(url).status_code == 200
    assert client.get(SAMPLE).status_code == 200


@pytest.mark.usefixtures("base_sample")
def test_public_routes_never_call_ai(
    client: TestClient, owner: dict[str, str], session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_: object, **__: object) -> None:
        raise AssertionError("a public page called Claude")

    photos = build(session, sample_prop(session))
    publish(client, owner)
    monkeypatch.setattr(anthropic.Anthropic, "__init__", boom)
    monkeypatch.setattr(gen, "run_generation", boom)
    today = client.get(SAMPLE).json()["today"]
    for path in (SAMPLE, f"{SAMPLE}/resolve", f"{SAMPLE}/photos/{photos[0].id}"):
        assert client.get(path).status_code == 200
    res = client.get(f"{SAMPLE}/availability", params={"check_in": today, "room_type": "Standard"})
    assert res.status_code == 200


@pytest.mark.usefixtures("base_sample")
def test_a_sample_hotel_without_settings_holds_its_default_address(session: Session) -> None:
    newcomer = other_hotel(session, None, published=False)
    for short, sample in (("Pine Lodge", True), ("Lake Inn", False)):
        session.add(
            Property(
                name=short,
                short_name=short,
                city="Almora",
                address="Sample",
                rooms_count=5,
                owner_name="Sample",
                perk_text="Tea",
                code_prefix="X",
                is_sample=sample,
            )
        )
    session.commit()
    assert slugs.problem(session, "pine-lodge", newcomer.id, NOW) == "slug_taken"
    assert slugs.problem(session, "lake-inn", newcomer.id, NOW) is None
    assert slugs.redirect_active(SiteConfig(), NOW) is False
