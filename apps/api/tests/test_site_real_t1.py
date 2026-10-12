"""Seedha Site real mode, gap tests (T1, docs/SITE_REAL.md section 6).

Claude is always a fake. Covers: a hostile reply (prices, rupee signs, long
numbers in any script, web addresses) never reaching stored or public text;
public room prices equal to what the owner typed; per-field template
fallback; daily and monthly limits on IST boundaries and across properties;
token logging; upload size, type, pixel and metadata edges; owner-only access
on every site route; no Claude for demo or public visitors; slug rules,
the unique index, a lost publish race, rename redirects; public photos only
for published sites; public routes never calling Claude.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.models import Property, SiteConfig, SiteContent, SiteGenRun, SitePhoto
from app.services import site_gen as gen
from app.services import slug as slugs
from app.services.site_photos import MAX_UPLOAD_BYTES, add_photo, clean_photo
from tests.test_hosting import RAILWAY_PROXY, headers, prod
from tests.test_site_build import (
    DESCRIPTION,
    MODEL,
    TEST_KEY,
    Block,
    FakeCreate,
    FakeMessage,
    FakeUsage,
    good_payload,
    make_client,
    photo_ids,
    picture,
    replying,
)
from tests.test_site_publish import other_hotel

NOW = datetime(2026, 10, 12, 6, 0, tzinfo=UTC)  # 11:30 India time
# Owner-typed prices with odd paise, so any rounding or Claude number shows.
OWNER_ROOMS = [
    {"name": "Deluxe Valley View", "price_paise": 456_789},
    {"name": "Family Suite", "price_paise": 612_301},
    {"name": "Attic Nook", "price_paise": 1},
]
TWO_ROOMS = [
    {"name": "Deluxe Valley View", "price_paise": 450_000},
    {"name": "Family Suite", "price_paise": 650_000},
]
SAMPLE = "/public/site/deodar-view"
LEAKS = ("₹", "Rs", "INR", "http", "www", ".com", "@", "4500", "४५००", "3999", "1998",
         "९९९", "tariff", "price", "deodar.site")  # fmt: skip


# --- helpers ----------------------------------------------------------------------


@pytest.fixture(name="ai_settings")
def fixture_ai_settings(settings: Settings) -> Settings:
    return replace(settings, anthropic_api_key=TEST_KEY, site_gen_model=MODEL)


@pytest.fixture(name="fake")
def fixture_fake() -> FakeCreate:
    return replying()


@pytest.fixture(name="ai")
def fixture_ai(
    ai_settings: Settings, factory: sessionmaker[Session], fake: FakeCreate, base_sample: Session
) -> Iterator[TestClient]:
    del base_sample  # the sample hotel is loaded
    with make_client(ai_settings, factory, fake) as c:
        yield c


def answer(payload: dict[str, Any]) -> FakeMessage:
    return FakeMessage("end_turn", [Block("text", json.dumps(payload, ensure_ascii=False))])


def upload(client: TestClient, owner: dict[str, str], data: bytes, name: str = "p.jpg",
           ctype: str = "image/jpeg") -> Any:  # fmt: skip
    return client.post("/site/photos", headers=owner, files={"photo": (name, data, ctype)})


def ready(client: TestClient, owner: dict[str, str], rooms: list[dict[str, Any]] | None = None
          ) -> list[int]:  # fmt: skip
    data = picture((900, 600))
    ids = [upload(client, owner, data).json()["id"] for _ in range(4)]
    res = client.patch(
        "/site/build",
        headers=owner,
        json={"owner_description": DESCRIPTION, "rooms": rooms or OWNER_ROOMS},
    )
    assert res.status_code == 200
    return ids  # fmt: skip


def generate(client: TestClient, owner: dict[str, str]) -> dict[str, Any]:
    res = client.post("/site/build/generate", headers=owner)
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


def strings(value: Any) -> Iterator[str]:
    """Every string inside a JSON-like value."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def runs(session: Session) -> int:
    session.expire_all()
    return int(session.scalar(select(func.count()).select_from(SiteGenRun)) or 0)


def sample_id(session: Session) -> int:
    return int(session.scalar(select(Property.id).order_by(Property.id).limit(1)) or 0)


def log_run(session: Session, property_id: int, at: datetime, **tokens: int) -> None:
    session.add(SiteGenRun(property_id=property_id, at=at, status="generated", model=MODEL,
                           **tokens))  # fmt: skip
    session.commit()


# --- prices only from the owner -----------------------------------------------------


def hostile(ids: list[int]) -> dict[str, Any]:
    """Every field Claude writes carries a price, a long number or an address."""
    order = [
        {"photo_id": i, "caption_en": f"Only ₹{n}999 tonight", "caption_hi": "सिर्फ़ ९९९ रुपये"}
        for n, i in enumerate(ids, start=1)
    ]
    return good_payload(
        ids,
        description_en="Deluxe rooms at ₹4,500 per night. Book at www.deodar.example",
        description_hi="कमरे ४५०० रुपये में, deodar.site पर बुक करें",
        room_blurbs=[
            {"name": "Deluxe Valley View", "blurb_en": "Rs 3999 only", "blurb_hi": "₹३९९९",
             "price_paise": 1},
            {"name": "Family Suite", "blurb_en": "Since 1998", "blurb_hi": "मेल करें a@b.in"},
            {"name": "Attic Nook", "blurb_en": "INR 4500 tariff", "blurb_hi": "कीमत कम"},
            {"name": "Penthouse", "blurb_en": "A brand-new room", "blurb_hi": "नया कमरा"},
        ],
        photo_order=order,
        why_book_direct={"en": ["Best price guaranteed", "Talk to us", "Perks"],
                         "hi": ["https://deodar.example", "बात करें", "तोहफ़ा"]},
        google_description_en="Tariff from 4500, see http://deodar.example",
        google_description_hi="किराया ४५०० से",
    )  # fmt: skip


def every_field(ids: list[int]) -> set[str]:
    """Every field name a fully refused answer falls back on (three rooms)."""
    names = set(gen.CONTENT_TEXT_KEYS + gen.CONTENT_LIST_KEYS)
    names |= {f"rooms.{i}.blurb_{lang}" for i in range(3) for lang in ("en", "hi")}
    return names | {f"photos.{i}.caption_{lang}" for i in ids for lang in ("en", "hi")}


def assert_clean(values: list[Any]) -> None:
    """No string passes on money, a long number or an address."""
    for text in strings(values):
        if text.startswith("/api/"):
            continue  # photo addresses carry the photo id and hash, not text
        assert gen.site_text_ok(text), text
        for leak in LEAKS:
            assert leak not in text, (leak, text)


@pytest.mark.usefixtures("base_sample")
def test_hostile_reply_never_reaches_stored_or_public_text(
    ai_settings: Settings, factory: sessionmaker[Session], owner: dict[str, str],
    session: Session,
) -> None:  # fmt: skip
    fake = FakeCreate(lambda kwargs: answer(hostile(photo_ids(kwargs))))
    with make_client(ai_settings, factory, fake) as c:
        ids = ready(c, owner)
        body = generate(c, owner)
        assert c.post("/site/publish", headers=owner).status_code == 200
        public = c.get(SAMPLE).json()
    assert body["status"] == "generated"
    assert set(body["fallback_fields"]) == every_field(ids)

    # The owner's typed prices, exactly, and no room Claude invented.
    owned = [(r["name"], r["price_paise"]) for r in OWNER_ROOMS]
    assert [(r["name"], r["price_paise"]) for r in body["rooms"]] == owned
    assert [(r["room_type"], r["nightly_rate"]) for r in public["rooms"]] == owned

    row = session.scalars(select(SiteContent)).one()
    assert [r["price_paise"] for r in json.loads(row.rooms_json)] == [456_789, 612_301, 1]
    captions = [[p.caption_en, p.caption_hi] for p in session.scalars(select(SitePhoto))]
    assert_clean([json.loads(row.content_json), json.loads(row.rooms_json), captions])
    assert_clean([body["content"], body["rooms"], body["photos"], public["text"],
                  public["photos"], [r["detail"] for r in public["rooms"]]])  # fmt: skip


def test_an_empty_answer_falls_back_everywhere(
    ai: TestClient, owner: dict[str, str], fake: FakeCreate
) -> None:
    fake.reply = answer({})
    ids = ready(ai, owner)
    body = generate(ai, owner)
    assert body["status"] == "generated" and body["source"] == "claude"
    assert "photo_order" in body["fallback_fields"]
    assert body["content"]["description_en"] == DESCRIPTION
    assert body["content"]["why_book_direct_hi"] == list(gen.TEMPLATE_POINTS_HI)
    assert [p["id"] for p in body["photos"]] == ids
    assert {p["caption_en"] for p in body["photos"]} == {"Deodar View"}
    assert body["rooms"][0]["blurb_en"] == "Deluxe Valley View · Deodar View"


def test_one_bad_field_keeps_every_other_claude_field(
    ai: TestClient, owner: dict[str, str], fake: FakeCreate
) -> None:
    fake.reply = lambda kwargs: answer(
        good_payload(photo_ids(kwargs), description_hi="केवल ३ ००० रुपये")
    )
    ready(ai, owner, rooms=TWO_ROOMS)
    body = generate(ai, owner)
    assert body["fallback_fields"] == ["description_hi"]
    # The Hindi fallback is a fixed Hindi line, never the owner's English
    # (honesty review V2-L7); it carries no money.
    fallback_hi = body["content"]["description_hi"]
    assert fallback_hi != DESCRIPTION
    assert any("\u0900" <= ch <= "\u097f" for ch in fallback_hi)
    assert "₹" not in fallback_hi and "रुपये" not in fallback_hi
    good = good_payload([])
    assert body["content"]["description_en"] == good["description_en"]
    assert body["content"]["google_description_hi"] == good["google_description_hi"]
    assert body["content"]["why_book_direct_en"] == good["why_book_direct"]["en"]


@pytest.mark.parametrize(
    "text",
    ["Call 98765 43210", "Rs.45", "₹ 9", "१,२००", "२०२६", "１２３", "٣٤٥", "5000/-", "RS 45",
     "rs45", "Room 101", "WWW.EXAMPLE.COM", "cheap rates", "free tickets", "२० प्रतिशत",
     "three thousand rupees", "mail us at stay@deodar"],
)  # fmt: skip
def test_site_guard_rejects_more(text: str) -> None:
    assert not gen.site_text_ok(text)


# --- limits -----------------------------------------------------------------------


def test_failed_calls_use_up_the_day(
    ai: TestClient, owner: dict[str, str], fake: FakeCreate, session: Session
) -> None:
    fake.reply = FakeMessage("refusal")
    ready(ai, owner)
    for _ in range(3):
        assert generate(ai, owner)["status"] == "offline"
    fake.reply = None  # would fail the test if called
    body = generate(ai, owner)
    assert body["status"] == "limit_reached" and body["generations_today"] == 3
    assert len(fake.calls) == 3
    assert runs(session) == 3  # a refused attempt is not logged as a run


def test_the_day_turns_at_india_midnight(
    ai: TestClient, owner: dict[str, str], fake: FakeCreate
) -> None:
    ready(ai, owner)
    late = datetime(2026, 10, 12, 18, 25, tzinfo=UTC)  # 23:55 India time
    ai.app.state.clock = lambda: late  # type: ignore[attr-defined]
    for _ in range(3):
        generate(ai, owner)
    ai.app.state.clock = lambda: late + timedelta(minutes=4)  # type: ignore[attr-defined]
    assert generate(ai, owner)["status"] == "limit_reached"
    ai.app.state.clock = lambda: late + timedelta(minutes=6)  # type: ignore[attr-defined]
    body = generate(ai, owner)
    assert body["status"] == "generated" and body["generations_today"] == 1
    assert len(fake.calls) == 4


def test_daily_limit_is_per_hotel_and_monthly_cap_is_shared(
    ai: TestClient, owner: dict[str, str], fake: FakeCreate, session: Session
) -> None:
    ready(ai, owner)
    other = other_hotel(session, "valley-inn")
    for _ in range(3):
        log_run(session, other.id, NOW - timedelta(minutes=5), input_tokens=1_000)
    assert generate(ai, owner)["status"] == "generated"  # another hotel's day is its own
    log_run(session, other.id, NOW - timedelta(hours=1), input_tokens=300_000)
    body = generate(ai, owner)
    assert body["status"] == "limit_reached" and body["message"] == gen.LIMIT_MONTH
    assert len(fake.calls) == 1


@pytest.mark.usefixtures("base_sample")
def test_monthly_cap_boundary_and_india_month(
    ai_settings: Settings, factory: sessionmaker[Session], owner: dict[str, str],
    session: Session,
) -> None:  # fmt: skip
    fake = replying()
    capped = replace(ai_settings, site_gen_monthly_token_cap=50_000)
    pid = sample_id(session)
    # 23:30 India time on 30 Sep: last month. 00:30 India time on 1 Oct: this month.
    log_run(session, pid, datetime(2026, 9, 30, 18, 0, tzinfo=UTC), input_tokens=900_000)
    log_run(
        session,
        pid,
        datetime(2026, 9, 30, 19, 0, tzinfo=UTC),
        input_tokens=20_000,
        output_tokens=9_000,
        cache_creation_tokens=10_000,
        cache_read_tokens=10_999,
    )
    with make_client(capped, factory, fake) as c:
        ready(c, owner)
        build = c.get("/site/build", headers=owner).json()
        assert (build["month_tokens_used"], build["monthly_token_cap"]) == (49_999, 50_000)
        assert generate(c, owner)["status"] == "generated"  # one under the cap may call
        assert generate(c, owner)["status"] == "limit_reached"
    assert len(fake.calls) == 1


# --- token logging ----------------------------------------------------------------


def test_usage_sums_every_hotel_and_lists_only_this_one(
    ai: TestClient, owner: dict[str, str], session: Session, fake: FakeCreate
) -> None:
    fake.reply = lambda kwargs: replace(
        answer(good_payload(photo_ids(kwargs), description_en="₹")),
        usage=FakeUsage(1_234, 567, 89, 10),
    )
    ready(ai, owner, rooms=TWO_ROOMS)
    body = generate(ai, owner)
    pid = sample_id(session)
    yesterday = NOW - timedelta(days=1)
    for minutes in range(1, 23):  # 22 older runs this month (the list shows 20)
        log_run(session, pid, yesterday - timedelta(minutes=minutes), input_tokens=minutes,
                output_tokens=1)  # fmt: skip
    other = other_hotel(session, "valley-inn")
    log_run(session, other.id, NOW - timedelta(hours=2), input_tokens=7_000, output_tokens=500,
            cache_read_tokens=300)  # fmt: skip
    log_run(session, pid, NOW - timedelta(days=40), input_tokens=1_000_000)  # last month
    assert body["fallback_fields"] == ["description_en"]
    usage = ai.get("/site/gen/usage", headers=owner).json()
    older = sum(range(1, 23))
    assert usage["month_runs"] == 22 + 1 + 1
    assert usage["month_input_tokens"] == older + 7_000 + 300 + 1_234 + 89 + 10
    assert usage["month_output_tokens"] == 22 + 500 + 567
    assert len(usage["runs"]) == 20
    first = usage["runs"][0]
    assert (first["status"], first["model"], first["input_tokens"], first["output_tokens"],
            first["cache_creation_tokens"], first["cache_read_tokens"]) == (
        "generated", MODEL, 1_234, 567, 89, 10)  # fmt: skip
    assert [r["input_tokens"] for r in usage["runs"][1:]] == list(range(1, 20))
    assert 7_000 not in [r["input_tokens"] for r in usage["runs"]]
    newest = session.scalars(select(SiteGenRun).order_by(SiteGenRun.at.desc())).first()
    assert newest is not None and newest.fields_fallback == 1


# --- uploads ----------------------------------------------------------------------


def padded_jpeg(total: int) -> bytes:
    """A real JPEG followed by padding (decoders ignore bytes after the end marker)."""
    out = BytesIO()
    Image.new("RGB", (100, 80), "red").save(out, "JPEG")
    return out.getvalue() + b"\0" * (total - len(out.getvalue()))


def test_ten_mb_is_the_exact_limit(ai: TestClient, owner: dict[str, str], session: Session) -> None:
    assert upload(ai, owner, padded_jpeg(MAX_UPLOAD_BYTES)).status_code == 201
    res = upload(ai, owner, padded_jpeg(MAX_UPLOAD_BYTES + 1))
    assert (res.status_code, res.json()["error"]["code"]) == (413, "file_too_large")
    session.expire_all()
    assert session.scalar(select(func.count()).select_from(SitePhoto)) == 1


def encoded(fmt: str, size: tuple[int, int] = (300, 200), mode: str = "RGB") -> bytes:
    out = BytesIO()
    Image.new(mode, size, "blue").save(out, fmt)
    return out.getvalue()


@pytest.mark.parametrize(
    ("data", "status", "code"),
    [
        (encoded("GIF"), 415, "unsupported_type"),  # declared as image/jpeg below
        (encoded("BMP"), 415, "unsupported_type"),
        (encoded("TIFF"), 415, "unsupported_type"),
        (picture((300, 200), "WEBP")[:200], 422, "unreadable_photo"),
        (picture((300, 200), "PNG")[:2_000], 422, "unreadable_photo"),
        (encoded("PNG", (8000, 5001), "1"), 413, "photo_too_large"),
    ],
)
def test_types_truncation_and_pixel_bombs(
    ai: TestClient, owner: dict[str, str], session: Session, data: bytes, status: int, code: str
) -> None:
    res = upload(ai, owner, data, "photo.jpg", "image/jpeg")
    assert (res.status_code, res.json()["error"]["code"]) == (status, code)
    session.expire_all()
    assert session.scalar(select(func.count()).select_from(SitePhoto)) == 0


def test_ninth_photo_refused_and_not_stored(
    ai: TestClient, owner: dict[str, str], session: Session
) -> None:
    data = encoded("JPEG")
    for _ in range(8):
        assert upload(ai, owner, data).status_code == 201
    for fmt in ("PNG", "WEBP"):
        res = upload(ai, owner, encoded(fmt), f"x.{fmt.lower()}", f"image/{fmt.lower()}")
        assert (res.status_code, res.json()["error"]["code"]) == (409, "too_many_photos")
    session.expire_all()
    assert session.scalar(select(func.count()).select_from(SitePhoto)) == 8


def test_resize_keeps_shape_and_never_upscales() -> None:
    tall = clean_photo(picture((3024, 4032)))
    assert (tall.width, tall.height) == (768, 1024) and len(tall.data) <= 200_000
    wide = clean_photo(picture((4032, 3024)))
    assert (wide.width, wide.height) == (1024, 768) and len(wide.data) <= 200_000
    small = clean_photo(picture((320, 240)))
    assert (small.width, small.height) == (320, 240)
    assert Image.open(BytesIO(small.data)).format == "JPEG"


def test_transparent_png_lands_on_white() -> None:
    out = BytesIO()
    Image.new("RGBA", (40, 30), (255, 0, 0, 0)).save(out, "PNG")
    clean = Image.open(BytesIO(clean_photo(out.getvalue()).data))
    assert clean.mode == "RGB"
    pixel = clean.getpixel((20, 15))
    assert isinstance(pixel, tuple) and min(pixel) > 245


def test_metadata_stripped_from_every_format() -> None:
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    exif[0x8825] = {1: "N", 2: (30.0, 27.0, 18.0)}  # GPSInfo
    xmp = b'<x:xmpmeta xmlns:x="adobe:ns:meta/">SecretPlace</x:xmpmeta>'
    jpeg = BytesIO()
    Image.new("RGB", (64, 48), "green").save(
        jpeg, "JPEG", exif=exif.tobytes(), xmp=xmp, comment=b"SecretComment",
        icc_profile=b"SecretProfile" * 4,
    )  # fmt: skip
    info = PngImagePlugin.PngInfo()
    info.add_text("Location", "SecretPlace")
    png = BytesIO()
    Image.new("RGB", (64, 48), "green").save(png, "PNG", pnginfo=info, exif=exif.tobytes())
    webp = BytesIO()
    Image.new("RGB", (64, 48), "green").save(webp, "WEBP", exif=exif.tobytes(), xmp=xmp)
    for source in (jpeg.getvalue(), png.getvalue(), webp.getvalue()):
        assert b"PhoneMaker" in source or b"SecretPlace" in source
        data = clean_photo(source).data
        for marker in (b"Exif", b"PhoneMaker", b"SecretPlace", b"SecretComment",
                       b"SecretProfile", b"xmpmeta", b"ICC_PROFILE"):  # fmt: skip
            assert marker not in data
        out = Image.open(BytesIO(data))
        assert not out.getexif() and "icc_profile" not in out.info and "comment" not in out.info


# --- owner-only and who may spend ----------------------------------------------------

SITE_ROUTES: list[tuple[str, str, dict[str, Any] | None]] = [
    ("get", "/site", None),
    ("patch", "/site", {"mood": "sky"}),
    ("patch", "/site/branding", {"hide_branding": True}),
    ("post", "/site/packages/wk", None),
    ("patch", "/site/packages/wk", {"state": "skipped"}),
    ("get", "/site/slug/check?slug=valley-inn", None),
    ("get", "/site/address", None),
    ("post", "/site/publish", {"slug": "valley-inn"}),
    ("get", "/site/photos", None),
    ("patch", "/site/photos/order", {"ids": []}),
    ("delete", "/site/photos/1", None),
    ("get", "/site/photos/1", None),
    ("get", "/site/build", None),
    ("patch", "/site/build", {"owner_description": "Hijacked"}),
    ("post", "/site/build/generate", None),
    ("get", "/site/gen/usage", None),
]


@pytest.mark.parametrize(("method", "path", "body"), SITE_ROUTES)
def test_every_site_route_is_owner_only(
    ai: TestClient, owner: dict[str, str], session: Session, fake: FakeCreate,
    method: str, path: str, body: dict[str, Any] | None,
) -> None:  # fmt: skip
    assert ai.request(method, path, json=body).status_code == 401
    assert ai.request(method, path, json=body, headers={"Authorization": "Bearer x"}
                      ).status_code == 401  # fmt: skip
    prop = session.scalars(select(Property)).one()
    prop.is_sample = False
    session.commit()
    for subject in ("demo", "a999", "junk"):
        res = ai.request(method, path, json=body, headers=owner | {"X-Seedha-Subject": subject})
        assert res.status_code == 403, (subject, res.text)
    session.expire_all()
    config = session.scalar(select(SiteConfig))
    assert config is None or (config.published_at is None and not config.hide_branding)
    assert session.scalar(select(SiteContent)) is None
    assert not fake.calls


@pytest.mark.usefixtures("base_sample")
def test_demo_in_production_never_logs_a_run(
    ai_settings: Settings, factory: sessionmaker[Session], fake: FakeCreate, session: Session
) -> None:
    with make_client(prod(ai_settings), factory, fake, client=RAILWAY_PROXY) as c:
        demo = headers("demo")
        ready(c, demo)
        for _ in range(4):
            assert generate(c, demo)["status"] == "sample"
        usage = c.get("/site/gen/usage", headers=demo).json()
    assert (usage["month_runs"], usage["generations_today"]) == (0, 0)
    assert not fake.calls and runs(session) == 0


@pytest.mark.usefixtures("base_sample")
def test_public_demo_visitor_never_calls_claude(
    ai_settings: Settings, factory: sessionmaker[Session], fake: FakeCreate,
    owner: dict[str, str], monkeypatch: pytest.MonkeyPatch,
) -> None:  # fmt: skip
    monkeypatch.setenv("SEEDHA_PUBLIC", "1")
    with make_client(ai_settings, factory, fake, client=("203.0.113.7", 50000)) as c:
        ready(c, owner)
        body = generate(c, owner)
    assert body["status"] == "sample" and body["key_configured"] is False
    assert not fake.calls


# --- slugs ------------------------------------------------------------------------


@pytest.mark.parametrize("word", sorted(slugs.RESERVED))
def test_every_reserved_word_is_refused(word: str) -> None:
    assert slugs.shape_problem(word) in ("slug_reserved", "slug_invalid")
    if len(word) >= slugs.MIN_LENGTH:
        assert slugs.shape_problem(word) == "slug_reserved"


@pytest.mark.usefixtures("base_sample")
def test_reserved_words_refused_whatever_the_case(
    ai: TestClient, owner: dict[str, str], session: Session
) -> None:
    ai.patch("/site", headers=owner, json={"stage": "review"})
    for word in ("WWW", " Admin ", "LOGIN", "h", "api"):
        res = ai.post("/site/publish", headers=owner, json={"slug": word})
        assert res.status_code == 422, word
        assert res.json()["error"]["code"] in ("slug_reserved", "slug_invalid")
    session.expire_all()
    config = session.scalar(select(SiteConfig))
    assert config is not None and config.published_at is None and config.slug is None


def test_the_database_keeps_slugs_unique(session: Session) -> None:
    first = other_hotel(session, "valley-inn")
    second = other_hotel(session, None)
    config = session.scalar(select(SiteConfig).where(SiteConfig.property_id == second.id))
    assert config is not None and first.id != second.id
    config.slug = "valley-inn"
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


@pytest.mark.usefixtures("base_sample")
def test_a_lost_publish_race_changes_nothing(
    ai: TestClient, owner: dict[str, str], session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    other_hotel(session, "valley-inn")
    ai.patch("/site", headers=owner, json={"stage": "review"})
    monkeypatch.setattr("app.routers.site.problem", lambda *_: None)
    res = ai.post("/site/publish", headers=owner, json={"slug": "valley-inn"})
    assert (res.status_code, res.json()["error"]["code"]) == (422, "slug_taken")
    session.expire_all()
    config = session.scalars(
        select(SiteConfig).where(SiteConfig.property_id == sample_id(session))
    ).one()
    assert (config.slug, config.published_at, config.previous_slug) == (None, None, None)
    assert ai.get("/public/site/valley-inn/resolve").json()["state"] == "live"


@pytest.mark.usefixtures("base_sample")
def test_rename_back_and_the_last_minute_of_a_redirect(
    ai: TestClient, owner: dict[str, str], session: Session
) -> None:
    clock = [NOW]
    ai.app.state.clock = lambda: clock[0]  # type: ignore[attr-defined]
    ai.patch("/site", headers=owner, json={"stage": "review"})
    for slug in ("first-name", "second-name", "first-name"):
        assert ai.post("/site/publish", headers=owner, json={"slug": slug}).status_code == 200
    assert ai.get("/public/site/first-name/resolve").json()["state"] == "live"
    moved = ai.get("/public/site/second-name/resolve").json()
    assert moved == {"state": "moved", "slug": "first-name"}
    newcomer = other_hotel(session, None, published=False)
    clock[0] = NOW + timedelta(days=30) - timedelta(seconds=1)
    assert ai.get("/public/site/second-name").json()["redirect_to"] == "first-name"
    assert slugs.problem(session, "second-name", newcomer.id, clock[0]) == "slug_taken"
    clock[0] = NOW + timedelta(days=30)
    assert ai.get("/public/site/second-name").status_code == 404
    assert slugs.problem(session, "second-name", newcomer.id, clock[0]) is None
    config = session.scalars(select(SiteConfig).where(SiteConfig.property_id == newcomer.id)).one()
    config.slug, config.published_at = "second-name", clock[0]
    session.commit()
    taken = ai.get("/public/site/second-name/resolve").json()
    assert taken == {"state": "live", "slug": "second-name"}


# --- public photos and public routes ----------------------------------------------------


def photo(session: Session, property_id: int) -> SitePhoto:
    row = add_photo(session, property_id, clean_photo(encoded("JPEG")))
    session.commit()
    return row


@pytest.mark.usefixtures("base_sample")
def test_public_photos_only_for_published_sites(
    ai: TestClient, owner: dict[str, str], session: Session
) -> None:
    hidden = other_hotel(session, "valley-inn", published=False)
    theirs = photo(session, hidden.id)
    assert ai.get(f"/public/site/valley-inn/photos/{theirs.id}").status_code == 404
    mine = photo(session, sample_id(session))
    url = f"{SAMPLE}/photos/{mine.id}"
    assert ai.get(url).status_code == 404  # the sample page is public, its owner photos are not
    gen.get_content(session, sample_id(session)).source = "edited"
    session.commit()
    ai.post("/site/publish", headers=owner)
    res = ai.get(url)
    assert res.status_code == 200
    again = ai.get(url, headers={"If-None-Match": res.headers["etag"]})
    assert again.status_code == 304
    assert again.headers["cache-control"] == "public, max-age=86400, immutable"
    assert again.headers["etag"] == res.headers["etag"]
    private = ai.get(f"/site/photos/{mine.id}", headers=owner)
    assert private.headers["cache-control"] == "private, no-cache"


@pytest.mark.usefixtures("base_sample")
def test_public_routes_with_a_key_set_never_call_claude(
    ai: TestClient, owner: dict[str, str], session: Session, fake: FakeCreate
) -> None:
    ready(ai, owner)
    edit = {"content": {"description_en": "Our own words"}}
    assert ai.patch("/site/build", headers=owner, json=edit).status_code == 200
    assert ai.post("/site/publish", headers=owner).status_code == 200
    fake.reply = None
    mine = session.scalars(select(SitePhoto)).first()
    assert mine is not None
    today = ai.get(SAMPLE).json()["today"]
    for path in (SAMPLE, f"{SAMPLE}/resolve", f"{SAMPLE}/photos/{mine.id}",
                 f"{SAMPLE}/availability?check_in={today}&room_type=Standard",
                 "/public/site/nowhere", "/public/site/nowhere/resolve"):  # fmt: skip
        assert ai.get(path).status_code in (200, 404)
    assert not fake.calls and runs(session) == 0
