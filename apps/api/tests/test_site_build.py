"""Seedha Site real mode API: photo upload (type, size, EXIF, resize, order,
cap), the owner's inputs, one-call generation with the D6 site guard and
template fallback, daily and monthly limits, token logging and owner-only
access. Claude is always a fake here and is never called for real."""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Any, cast

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient
from PIL import ExifTags, Image
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, load_settings
from app.main import create_app
from app.models import Property, SiteContent, SiteGenRun, SitePhoto
from app.services import site_gen as gen
from app.services.site_photos import clean_photo
from tests.test_hosting import RAILWAY_PROXY, headers, prod

TEST_KEY = "test-key"  # pragma: allowlist secret (dummy value, never sent)
MODEL = "claude-haiku-5-5"
NOW = datetime(2026, 10, 12, 6, 0, tzinfo=UTC)
REQUEST = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
DESCRIPTION = "Family-run hotel above Mall Road. Valley views and homely breakfast."
ROOMS = [
    {"name": "Deluxe Valley View", "price_paise": 450_000},
    {"name": "Family Suite", "price_paise": 650_000},
]


# --- fakes ------------------------------------------------------------------------


@dataclass
class FakeUsage:
    """Token counts like anthropic.types.Usage."""

    input_tokens: int = 9_100
    output_tokens: int = 1_900
    cache_creation_input_tokens: int | None = 8_300
    cache_read_input_tokens: int | None = 0


@dataclass
class Block:
    """A response content block."""

    type: str
    text: str = ""


@dataclass
class FakeMessage:
    """A final message with stop reason and usage."""

    stop_reason: str
    content: list[Block] = field(default_factory=list)
    usage: FakeUsage = field(default_factory=FakeUsage)


class FakeCreate:
    """Stands in for client.messages and records every request."""

    def __init__(self, reply: Any = None, error: Exception | None = None) -> None:
        self.reply = reply
        self.error = error
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> FakeMessage:
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        reply = self.reply(kwargs) if callable(self.reply) else self.reply
        assert isinstance(reply, FakeMessage)
        return reply


def writer_with(fake: FakeCreate, model: str = MODEL) -> gen.ClaudeSiteWriter:
    client = cast(anthropic.Anthropic, type("C", (), {"messages": fake})())
    return gen.ClaudeSiteWriter(api_key=TEST_KEY, model=model, client=client)


def photo_ids(kwargs: dict[str, Any]) -> list[int]:
    blocks = kwargs["messages"][0]["content"]
    return [int(b["text"].split()[-1].rstrip(":")) for b in blocks
            if b["type"] == "text" and b["text"].startswith("Photo id")]  # fmt: skip


def good_payload(ids: list[int], **changes: Any) -> dict[str, Any]:
    base = {
        "description_en": "A quiet family hotel above Mall Road with valley views.",
        "description_hi": "मॉल रोड के ऊपर घाटी के नज़ारों वाला शांत पारिवारिक होटल।",
        "room_blurbs": [
            {"name": "Deluxe Valley View", "blurb_en": "Wake up to the valley",
             "blurb_hi": "घाटी के साथ सुबह"},
            {"name": "Family Suite", "blurb_en": "Room for the whole family",
             "blurb_hi": "पूरे परिवार के लिए जगह"},
        ],
        "photo_order": [{"photo_id": i, "caption_en": f"View {n}", "caption_hi": f"नज़ारा {n}"}
                        for n, i in enumerate(reversed(ids), start=1)],
        "why_book_direct": {"en": ["Talk to the owner", "Perks when you return", "Easy UPI"],
                            "hi": ["मालिक से बात करें", "लौटने पर तोहफ़ा", "आसान UPI"]},
        "google_description_en": "Family-run hotel above Mall Road, Mussoorie.",
        "google_description_hi": "मसूरी में मॉल रोड के ऊपर पारिवारिक होटल।",
    }  # fmt: skip
    return base | changes


def replying(**changes: Any) -> FakeCreate:
    """A fake that answers with the good payload (plus changes) for the sent ids."""

    def reply(kwargs: dict[str, Any]) -> FakeMessage:
        payload = good_payload(photo_ids(kwargs), **changes)
        return FakeMessage("end_turn", [Block("text", json.dumps(payload, ensure_ascii=False))])

    return FakeCreate(reply)


# --- images -----------------------------------------------------------------------


def picture(size: tuple[int, int] = (2000, 1500), fmt: str = "JPEG", **save: Any) -> bytes:
    """A photo-like image (gradient plus noise) in the given format."""
    noise = Image.effect_noise(size, 40).convert("RGB")
    gradient = Image.linear_gradient("L").resize(size).convert("RGB")
    img = Image.blend(noise, gradient, 0.6)
    if fmt == "PNG":
        img = img.convert("RGBA")
    buffer = BytesIO()
    img.save(buffer, format=fmt, **save)
    return buffer.getvalue()


def gps_jpeg(orientation: int = 1) -> bytes:
    exif = Image.Exif()
    exif[ExifTags.Base.Make] = "PhoneMaker"
    exif[ExifTags.Base.Orientation] = orientation
    exif[ExifTags.IFD.GPSInfo] = {1: "N", 2: (30.0, 27.0, 18.0), 3: "E", 4: (78.0, 4.0, 30.0)}
    return picture((1600, 1000), exif=exif.tobytes())


# --- fixtures ---------------------------------------------------------------------


@pytest.fixture(name="ai_settings")
def fixture_ai_settings(settings: Settings) -> Settings:
    return replace(settings, anthropic_api_key=TEST_KEY, site_gen_model=MODEL)


def make_client(settings: Settings, factory: sessionmaker[Session], fake: FakeCreate | None,
                **kwargs: Any) -> TestClient:  # fmt: skip
    app = create_app(settings, factory)
    app.state.clock = lambda: NOW
    if fake is not None:
        app.state.site_writer = writer_with(fake)
    return TestClient(app, **kwargs)


@pytest.fixture(name="fake")
def fixture_fake() -> FakeCreate:
    return replying()


@pytest.fixture(name="ai")
def fixture_ai(
    ai_settings: Settings, factory: sessionmaker[Session], fake: FakeCreate, base_sample: Session
) -> Iterator[TestClient]:
    del base_sample  # loaded for the sample hotel
    with make_client(ai_settings, factory, fake) as c:
        yield c


@pytest.fixture(name="plain")
def fixture_plain(
    settings: Settings, factory: sessionmaker[Session], fake: FakeCreate, base_sample: Session
) -> Iterator[TestClient]:
    """No key configured (the fake is installed but must never be used)."""
    del base_sample  # loaded for the sample hotel
    with make_client(settings, factory, fake) as c:
        yield c


def upload(client: TestClient, owner: dict[str, str], data: bytes, name: str = "p.jpg",
           ctype: str = "image/jpeg") -> Any:  # fmt: skip
    return client.post("/site/photos", headers=owner, files={"photo": (name, data, ctype)})


def ready(client: TestClient, owner: dict[str, str], photos: int = 4) -> list[int]:
    data = picture((1200, 900))
    ids = [upload(client, owner, data).json()["id"] for _ in range(photos)]
    res = client.patch("/site/build", headers=owner,
                       json={"owner_description": DESCRIPTION, "rooms": ROOMS})  # fmt: skip
    assert res.status_code == 200
    return ids


def generate(client: TestClient, owner: dict[str, str]) -> dict[str, Any]:
    res = client.post("/site/build/generate", headers=owner)
    assert res.status_code == 200, res.text
    return cast(dict[str, Any], res.json())


# --- photos -----------------------------------------------------------------------


def test_upload_resizes_and_compresses(ai: TestClient, owner: dict[str, str]) -> None:
    res = upload(ai, owner, picture((3000, 2000)))
    assert res.status_code == 201
    body = res.json()
    assert (body["width"], body["height"]) == (1024, 683)
    assert body["size_bytes"] <= 200_000
    assert body["url"] == f"/api/site/photos/{body['id']}"
    img = ai.get(body["url"].removeprefix("/api"), headers=owner)
    assert img.headers["content-type"] == "image/jpeg"
    assert img.headers["cache-control"].startswith("private")
    assert len(img.content) == body["size_bytes"]
    assert Image.open(BytesIO(img.content)).size == (1024, 683)


def test_png_and_webp_accepted_by_content_not_declared_type(
    ai: TestClient, owner: dict[str, str]
) -> None:
    png = upload(ai, owner, picture((800, 600), "PNG"), "a.jpg", "application/octet-stream")
    webp = upload(ai, owner, picture((600, 800), "WEBP"), "b.png", "image/png")
    assert png.status_code == webp.status_code == 201
    assert (webp.json()["width"], webp.json()["height"]) == (600, 800)


def test_exif_and_gps_removed(ai: TestClient, owner: dict[str, str], session: Session) -> None:
    source = gps_jpeg()
    assert Image.open(BytesIO(source)).getexif().get_ifd(ExifTags.IFD.GPSInfo)
    body = upload(ai, owner, source).json()
    stored = session.get(SitePhoto, body["id"])
    assert stored is not None
    out = Image.open(BytesIO(stored.data))
    assert not out.getexif()
    assert "exif" not in out.info
    assert b"Exif" not in stored.data and b"PhoneMaker" not in stored.data
    assert b"GPS" not in stored.data


def test_exif_orientation_applied_before_stripping() -> None:
    clean = clean_photo(gps_jpeg(orientation=6))
    assert (clean.width, clean.height) == (640, 1024)


def test_too_big_rejected(ai: TestClient, owner: dict[str, str]) -> None:
    res = upload(ai, owner, b"\xff\xd8" + b"0" * (11 * 1024 * 1024))
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "file_too_large"


@pytest.mark.parametrize(
    ("data", "name"),
    [
        (picture((50, 50), "GIF"), "a.gif"),
        (b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", "a.pdf"),
        (b"just text, not an image", "a.jpg"),
    ],
)
def test_other_types_rejected(
    ai: TestClient, owner: dict[str, str], data: bytes, name: str
) -> None:
    res = upload(ai, owner, data, name)
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "unsupported_type"


def heic_photo(orientation: int = 1, size: tuple[int, int] = (1600, 1000)) -> bytes:
    """A real HEIC (as an iPhone sends) with camera EXIF and GPS."""
    exif = Image.Exif()
    exif[ExifTags.Base.Make] = "PhoneMaker"
    exif[ExifTags.Base.Orientation] = orientation
    exif[ExifTags.IFD.GPSInfo] = {1: "N", 2: (30.0, 27.0, 18.0), 3: "E", 4: (78.0, 4.0, 30.0)}
    buffer = BytesIO()
    Image.open(BytesIO(picture(size))).save(buffer, format="HEIF", exif=exif.tobytes())
    return buffer.getvalue()


def test_heic_upload_converted_and_stripped(
    ai: TestClient, owner: dict[str, str], session: Session
) -> None:
    source = heic_photo()
    assert source[4:12] == b"ftypheic"
    assert Image.open(BytesIO(source)).getexif().get_ifd(ExifTags.IFD.GPSInfo)
    res = upload(ai, owner, source, "IMG_0001.HEIC", "image/heic")
    assert res.status_code == 201
    body = res.json()
    assert (body["width"], body["height"]) == (1024, 640)
    stored = session.get(SitePhoto, body["id"])
    assert stored is not None
    out = Image.open(BytesIO(stored.data))
    assert out.format == "JPEG"
    assert not out.getexif()
    assert b"Exif" not in stored.data and b"PhoneMaker" not in stored.data
    assert b"GPS" not in stored.data
    img = ai.get(f"/site/photos/{body['id']}", headers=owner)
    assert img.headers["content-type"] == "image/jpeg"


def test_heic_turned_upright() -> None:
    clean = clean_photo(heic_photo(orientation=6))
    assert (clean.width, clean.height) == (640, 1024)


def test_heic_declared_as_jpeg_still_read(ai: TestClient, owner: dict[str, str]) -> None:
    res = upload(ai, owner, heic_photo(size=(800, 600)), "photo.jpg", "image/jpeg")
    assert res.status_code == 201
    assert (res.json()["width"], res.json()["height"]) == (800, 600)


@pytest.mark.parametrize(
    ("data", "status"),
    [
        (b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic" + b"\x00" * 64, 415),
        (heic_photo(size=(400, 300))[:300], None),
    ],
)
def test_broken_heic_rejected(
    ai: TestClient, owner: dict[str, str], data: bytes, status: int | None
) -> None:
    res = upload(ai, owner, data, "IMG_0002.HEIC", "image/heic")
    assert res.status_code in ((status,) if status else (415, 422))
    assert res.json()["error"]["code"] in ("unsupported_type", "unreadable_photo")


def test_avif_not_accepted(ai: TestClient, owner: dict[str, str]) -> None:
    buffer = BytesIO()
    Image.new("RGB", (64, 48)).save(buffer, format="AVIF")
    assert upload(ai, owner, buffer.getvalue(), "a.avif", "image/avif").status_code == 415


def test_empty_and_huge_pixel_counts(ai: TestClient, owner: dict[str, str]) -> None:
    assert upload(ai, owner, b"").status_code == 422
    bomb = BytesIO()
    Image.new("1", (9000, 9000)).save(bomb, format="PNG")
    res = upload(ai, owner, bomb.getvalue(), "bomb.png", "image/png")
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "photo_too_large"


def test_truncated_photo_unreadable(ai: TestClient, owner: dict[str, str]) -> None:
    res = upload(ai, owner, picture((800, 600))[:400])
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "unreadable_photo"


def test_eight_photo_cap_order_and_delete(ai: TestClient, owner: dict[str, str]) -> None:
    data = picture((400, 300))
    ids = [upload(ai, owner, data).json()["id"] for _ in range(8)]
    full = upload(ai, owner, data)
    assert full.status_code == 409
    assert full.json()["error"]["code"] == "too_many_photos"
    order = list(reversed(ids))
    res = ai.patch("/site/photos/order", headers=owner, json={"ids": order})
    assert [p["id"] for p in res.json()["photos"]] == order
    assert [p["position"] for p in res.json()["photos"]] == list(range(8))
    bad = ai.patch("/site/photos/order", headers=owner, json={"ids": order[:-1]})
    assert bad.status_code == 422
    dup = ai.patch("/site/photos/order", headers=owner, json={"ids": [*order[:-1], order[0]]})
    assert dup.status_code == 422
    left = ai.delete(f"/site/photos/{order[2]}", headers=owner).json()["photos"]
    assert [p["id"] for p in left] == order[:2] + order[3:]
    assert [p["position"] for p in left] == list(range(7))
    assert ai.delete(f"/site/photos/{order[2]}", headers=owner).status_code == 404
    assert ai.get(f"/site/photos/{order[2]}", headers=owner).status_code == 404
    assert upload(ai, owner, data).status_code == 201
    listed = ai.get("/site/photos", headers=owner).json()["photos"]
    assert len(listed) == 8


def test_photo_etag_revalidates(ai: TestClient, owner: dict[str, str]) -> None:
    photo_id = upload(ai, owner, picture((500, 400))).json()["id"]
    first = ai.get(f"/site/photos/{photo_id}", headers=owner)
    etag = first.headers["etag"]
    again = ai.get(f"/site/photos/{photo_id}", headers=owner | {"If-None-Match": etag})
    assert again.status_code == 304
    assert not again.content


# --- owner-only -------------------------------------------------------------------

ROUTES = [
    ("get", "/site/photos"),
    ("post", "/site/photos"),
    ("patch", "/site/photos/order"),
    ("delete", "/site/photos/1"),
    ("get", "/site/photos/1"),
    ("get", "/site/build"),
    ("patch", "/site/build"),
    ("post", "/site/build/generate"),
    ("get", "/site/gen/usage"),
]


@pytest.mark.parametrize(("method", "path"), ROUTES)
def test_owner_only(
    ai: TestClient, owner: dict[str, str], session: Session, fake: FakeCreate,
    method: str, path: str,
) -> None:  # fmt: skip
    assert ai.request(method, path).status_code == 401
    wrong = {"Authorization": "Bearer nope"}
    assert ai.request(method, path, headers=wrong).status_code == 401
    prop = session.scalars(select(Property)).one()
    prop.is_sample = False
    session.commit()
    demo = owner | {"X-Seedha-Subject": "demo"}
    assert ai.request(method, path, headers=demo).status_code == 403
    assert not fake.calls


# --- build state and edits ----------------------------------------------------------


def test_build_state_defaults(ai: TestClient, owner: dict[str, str]) -> None:
    body = ai.get("/site/build", headers=owner).json()
    assert body["source"] == "none"
    assert body["key_configured"] is True
    assert body["model"] == MODEL
    assert body["daily_limit"] == 3
    assert body["generations_today"] == 0
    assert body["month_tokens_used"] == 0
    assert body["monthly_token_cap"] == 300_000
    assert body["content"]["why_book_direct_en"] == []


def test_patch_inputs_and_edits(ai: TestClient, owner: dict[str, str]) -> None:
    pid = upload(ai, owner, picture((500, 400))).json()["id"]
    priced = "Rooms from ₹4,500 a night, see www.example.com"
    body = ai.patch("/site/build", headers=owner,
                    json={"owner_description": priced, "rooms": ROOMS}).json()  # fmt: skip
    assert body["owner_description"] == priced  # the owner's own words are not guarded
    assert body["source"] == "none"
    assert [r["price_paise"] for r in body["rooms"]] == [450_000, 650_000]
    edit = {
        "content": {"description_en": "Our own words", "why_book_direct_hi": ["क", "ख", "ग"]},
        "captions": [{"photo_id": pid, "caption_en": "  Morning   view ", "caption_hi": "सुबह"}],
        "rooms": [{"name": "Family Suite", "price_paise": 700_000, "blurb_en": "Big room"}],
    }
    body = ai.patch("/site/build", headers=owner, json=edit).json()
    assert body["source"] == "edited"
    assert body["content"]["description_en"] == "Our own words"
    assert body["content"]["why_book_direct_hi"] == ["क", "ख", "ग"]
    assert body["photos"][0]["caption_en"] == "Morning view"
    assert body["rooms"] == [{"name": "Family Suite", "price_paise": 700_000,
                              "blurb_en": "Big room", "blurb_hi": ""}]  # fmt: skip
    one = {"rooms": [{"name": "family suite", "price_paise": 1}]}
    kept = ai.patch("/site/build", headers=owner, json=one).json()
    assert kept["rooms"][0]["blurb_en"] == "Big room"


@pytest.mark.parametrize(
    "body",
    [
        {"owner_description": "x" * 2001},
        {"rooms": []},
        {"rooms": [{"name": "Room", "price_paise": 1}] * 11},
        {"rooms": [{"name": "A", "price_paise": 100}]},
        {"rooms": [{"name": "  A  ", "price_paise": 100}]},
        {"rooms": [{"name": "Room", "price_paise": "4500"}]},
        {"rooms": [{"name": "Room", "price_paise": 4500.5}]},
        {"rooms": [{"name": "Room", "price_paise": 0}]},
        {"rooms": [{"name": "Room", "price_paise": 10_000_001}]},
        {"content": {"description_en": "x" * 1201}},
        {"content": {"why_book_direct_en": ["a", "b"]}},
        {"content": {"why_book_direct_en": ["a", "b", "x" * 121]}},
        {"content": {"google_description_hi": "x" * 751}},
        {
            "captions": [
                {"photo_id": 1, "caption_en": "one two three four five six seven eight nine"}
            ]
        },
    ],
)
def test_patch_validation(ai: TestClient, owner: dict[str, str], body: dict[str, Any]) -> None:
    assert ai.patch("/site/build", headers=owner, json=body).status_code == 422


def test_patch_duplicate_rooms_and_unknown_photo(ai: TestClient, owner: dict[str, str]) -> None:
    dup = [{"name": "Suite", "price_paise": 1}, {"name": "SUITE", "price_paise": 2}]
    res = ai.patch("/site/build", headers=owner, json={"rooms": dup})
    assert res.json()["error"]["code"] == "duplicate_room"
    res = ai.patch("/site/build", headers=owner,
                   json={"captions": [{"photo_id": 999, "caption_en": "x"}]})  # fmt: skip
    assert res.status_code == 404


# --- generation -------------------------------------------------------------------


def test_generate_needs_inputs(ai: TestClient, owner: dict[str, str], fake: FakeCreate) -> None:
    ready(ai, owner, photos=3)
    res = ai.post("/site/build/generate", headers=owner)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "not_ready"
    assert not fake.calls


def test_sample_without_key(plain: TestClient, owner: dict[str, str], fake: FakeCreate) -> None:
    ready(plain, owner)
    body = generate(plain, owner)
    assert body["status"] == "sample"
    assert body["source"] == "sample"
    assert body["key_configured"] is False and body["model"] == ""
    assert "Sample" in body["message"]
    assert body["content"]["description_en"].startswith("A quiet stay above Mall Road")
    assert body["rooms"][0]["blurb_en"] == "Breakfast included · valley view"
    assert body["photos"][0]["caption_en"] == "View"
    assert body["generations_today"] == 0
    assert not fake.calls


def test_sample_for_a_real_hotel_uses_owner_words(
    settings: Settings, factory: sessionmaker[Session], base_sample: Session
) -> None:
    prop = base_sample.scalars(select(Property)).one()
    prop.is_sample = False
    base_sample.commit()
    with make_client(settings, factory, None) as c:
        owner = {"Authorization": "Bearer test-owner-token"}
        ready(c, owner)
        body = generate(c, owner)
    assert body["status"] == "sample"
    assert body["content"]["description_en"] == DESCRIPTION
    assert body["rooms"][0]["blurb_en"] == f"Deluxe Valley View · {prop.short_name}"


def test_generate_request_shape(ai: TestClient, owner: dict[str, str], fake: FakeCreate) -> None:
    ids = ready(ai, owner)
    generate(ai, owner)
    (kwargs,) = fake.calls
    assert kwargs["model"] == MODEL
    assert kwargs["max_tokens"] == 3_000
    assert kwargs["output_config"]["effort"] == "low"
    assert kwargs["output_config"]["format"]["type"] == "json_schema"
    assert len(kwargs["system"].split()) < 150
    blocks = kwargs["messages"][0]["content"]
    images = [b for b in blocks if b["type"] == "image"]
    assert len(images) == 4
    assert all(b["source"]["media_type"] == "image/jpeg" for b in images)
    assert images[-1]["cache_control"] == {"type": "ephemeral"}
    assert all("cache_control" not in b for b in images[:-1])
    assert photo_ids(kwargs) == ids
    last = blocks[-1]
    assert last["type"] == "text" and DESCRIPTION in last["text"]
    assert "Deluxe Valley View" in last["text"]
    sent = json.dumps(kwargs["messages"]).replace(" ", "")
    for price in ("450000", "4500", "650000", "6500"):
        assert price not in sent  # room prices are never sent to Claude


def test_no_effort_for_other_models() -> None:
    config = writer_with(FakeCreate(), model="claude-haiku-4-5").output_config()
    assert "effort" not in config


def test_generated_content_stored(ai: TestClient, owner: dict[str, str], session: Session) -> None:
    ids = ready(ai, owner)
    body = generate(ai, owner)
    assert body["status"] == "generated"
    assert body["source"] == "claude"
    assert body["fallback_fields"] == []
    assert body["content"]["why_book_direct_en"] == ["Talk to the owner", "Perks when you return",
                                                     "Easy UPI"]  # fmt: skip
    assert [p["id"] for p in body["photos"]] == list(reversed(ids))
    assert body["photos"][0]["caption_en"] == "View 1"
    assert body["rooms"][1]["blurb_hi"] == "पूरे परिवार के लिए जगह"
    assert body["generations_today"] == 1
    assert body["month_tokens_used"] == 9_100 + 1_900 + 8_300
    run = session.scalars(select(SiteGenRun)).one()
    assert (run.status, run.model, run.input_tokens, run.output_tokens) == (
        "generated", MODEL, 9_100, 1_900)  # fmt: skip
    assert (run.cache_creation_tokens, run.cache_read_tokens, run.fields_fallback) == (8_300, 0, 0)


@pytest.mark.usefixtures("base_sample")
def test_prices_only_from_owner_input(
    ai_settings: Settings, factory: sessionmaker[Session],
    owner: dict[str, str],
) -> None:  # fmt: skip
    fake = replying(
        description_en="Deluxe rooms at ₹4,500 per night, a steal!",
        room_blurbs=[{"name": "Deluxe Valley View", "blurb_en": "Only Rs 3999 tonight",
                      "blurb_hi": "सिर्फ़ ३९९९ रुपये"}],
        google_description_en="Tariff starts low",
    )  # fmt: skip
    with make_client(ai_settings, factory, fake) as c:
        ready(c, owner)
        body = generate(c, owner)
    assert body["status"] == "generated"
    text = json.dumps(body, ensure_ascii=False)
    for leak in ("4,500", "3999", "३९९९", "Tariff", "₹", "Rs "):
        assert leak not in text
    expected = {"description_en", "google_description_en", "rooms.0.blurb_en",
                "rooms.0.blurb_hi", "rooms.1.blurb_en", "rooms.1.blurb_hi"}  # fmt: skip
    assert expected <= set(body["fallback_fields"])
    assert body["content"]["description_en"] == DESCRIPTION
    assert [r["price_paise"] for r in body["rooms"]] == [450_000, 650_000]


@pytest.mark.parametrize(
    ("changes", "field_name"),
    [
        ({"description_hi": "कमरे का किराया बहुत कम"}, "description_hi"),
        ({"description_en": "Visit us at www.deodar.example"}, "description_en"),
        ({"description_en": "Since १९९८ we have hosted guests"}, "description_en"),
        ({"description_en": "Opened in 1998"}, "description_en"),
        ({"description_en": "20% off for you"}, "description_en"),
        ({"description_en": "x" * 1201}, "description_en"),
        ({"google_description_hi": "होटल " * 200}, "google_description_hi"),
        ({"google_description_en": 42}, "google_description_en"),
        ({"why_book_direct": {"en": ["a", "b"], "hi": ["क", "ख", "ग"]}}, "why_book_direct_en"),
        ({"why_book_direct": {"en": ["a", "b", "c"], "hi": ["क", "ख", "फ़ीस १००%"]}},
         "why_book_direct_hi"),
        ({"why_book_direct": "nope"}, "why_book_direct_en"),
    ],
)  # fmt: skip
@pytest.mark.usefixtures("base_sample")
def test_d6_guard_falls_back_per_field(
    ai_settings: Settings, factory: sessionmaker[Session],
    owner: dict[str, str], changes: dict[str, Any], field_name: str,
) -> None:  # fmt: skip
    with make_client(ai_settings, factory, replying(**changes)) as c:
        ready(c, owner)
        body = generate(c, owner)
    assert field_name in body["fallback_fields"]
    template = gen.template_field(gen.Owner("Deodar View", "Mussoorie", DESCRIPTION), field_name)
    assert body["content"][field_name] == template or field_name.startswith("google")
    assert body["content"]["description_en" if field_name != "description_en" else
                           "description_hi"] != ""  # fmt: skip


@pytest.mark.usefixtures("base_sample")
def test_captions_and_photo_order_checked(
    ai_settings: Settings, factory: sessionmaker[Session],
    owner: dict[str, str],
) -> None:  # fmt: skip
    def reply(kwargs: dict[str, Any]) -> FakeMessage:
        ids = photo_ids(kwargs)
        order = [
            {"photo_id": ids[0], "caption_en": "one two three four five six seven eight nine",
             "caption_hi": "बढ़िया"},
            {"photo_id": ids[1], "caption_en": "Garden", "caption_hi": "बगीचा ५००"},
            {"photo_id": 99_999, "caption_en": "Not ours", "caption_hi": "नहीं"},
            {"photo_id": ids[1], "caption_en": "Duplicate", "caption_hi": "दोबारा"},
            "junk",
        ]  # fmt: skip
        payload = good_payload(ids, photo_order=order)
        return FakeMessage("end_turn", [Block("text", json.dumps(payload, ensure_ascii=False))])

    with make_client(ai_settings, factory, FakeCreate(reply)) as c:
        ids = ready(c, owner)
        body = generate(c, owner)
    fallback = set(body["fallback_fields"])
    assert "photo_order" in fallback
    assert f"photos.{ids[0]}.caption_en" in fallback
    assert f"photos.{ids[1]}.caption_hi" in fallback
    assert f"photos.{ids[0]}.caption_hi" not in fallback
    assert [p["id"] for p in body["photos"]] == ids  # order unchanged
    by_id = {p["id"]: p for p in body["photos"]}
    assert by_id[ids[1]]["caption_en"] == "Garden"
    assert by_id[ids[0]]["caption_en"] == "Deodar View"


@pytest.mark.parametrize("stop", ["refusal", "max_tokens"])
@pytest.mark.usefixtures("base_sample")
def test_stop_reasons_go_offline_with_templates(
    ai_settings: Settings, factory: sessionmaker[Session],
    owner: dict[str, str], session: Session, stop: str,
) -> None:  # fmt: skip
    fake = FakeCreate(FakeMessage(stop, [], FakeUsage(9_000, 3_000, 0, 0)))
    with make_client(ai_settings, factory, fake) as c:
        ready(c, owner)
        body = generate(c, owner)
    assert body["status"] == "offline"
    assert body["source"] == "edited"
    assert set(body["fallback_fields"]) == set(gen.CONTENT_TEXT_KEYS + gen.CONTENT_LIST_KEYS)
    assert body["content"]["why_book_direct_en"] == list(gen.TEMPLATE_POINTS_EN)
    assert body["generations_today"] == 1
    run = session.scalars(select(SiteGenRun)).one()
    assert (run.status, run.input_tokens, run.output_tokens) == ("offline", 9_000, 3_000)


@pytest.mark.parametrize(
    "fake",
    [
        FakeCreate(error=anthropic.APIConnectionError(request=REQUEST)),
        FakeCreate(FakeMessage("end_turn", [Block("text", "not json")])),
        FakeCreate(FakeMessage("end_turn", [Block("text", "[1, 2]")])),
    ],
)
def test_failed_call_still_counts(  # pylint: disable=unused-argument
    ai: TestClient, owner: dict[str, str], fake: FakeCreate, session: Session
) -> None:
    ready(ai, owner)
    body = generate(ai, owner)
    assert body["status"] == "offline"
    assert body["generations_today"] == 1
    assert session.scalars(select(SiteGenRun)).one().status == "offline"


def test_offline_keeps_claude_text(ai: TestClient, owner: dict[str, str], fake: FakeCreate) -> None:
    ready(ai, owner)
    first = generate(ai, owner)
    fake.reply = FakeMessage("refusal")
    second = generate(ai, owner)
    assert first["status"] == "generated"
    assert second["status"] == "offline"
    assert second["fallback_fields"] == []
    assert second["content"] == first["content"]
    assert second["source"] == "claude"


def test_daily_limit_stops_calls(ai: TestClient, owner: dict[str, str], fake: FakeCreate) -> None:
    ready(ai, owner)
    for _ in range(3):
        assert generate(ai, owner)["status"] == "generated"
    body = generate(ai, owner)
    assert body["status"] == "limit_reached"
    assert body["message"] == "Generation limit reached for today"
    assert len(fake.calls) == 3
    ai.app.state.clock = lambda: NOW + timedelta(days=1)  # type: ignore[attr-defined]
    assert generate(ai, owner)["status"] == "generated"
    assert len(fake.calls) == 4


def test_monthly_cap_stops_calls(
    ai: TestClient, owner: dict[str, str], fake: FakeCreate, session: Session
) -> None:
    ready(ai, owner)
    prop = session.scalars(select(Property)).one()
    last_month = NOW - timedelta(days=20)
    session.add(SiteGenRun(property_id=prop.id, at=last_month, status="generated",
                           model=MODEL, input_tokens=900_000))  # fmt: skip
    session.add(SiteGenRun(property_id=prop.id, at=NOW - timedelta(days=2), status="generated",
                           model=MODEL, input_tokens=250_000, output_tokens=40_000,
                           cache_read_tokens=10_000))  # fmt: skip
    session.commit()
    body = generate(ai, owner)
    assert body["status"] == "limit_reached"
    assert body["message"] == "Monthly AI limit reached"
    assert body["month_tokens_used"] == 300_000
    assert not fake.calls


def test_usage_endpoint(ai: TestClient, owner: dict[str, str]) -> None:
    ready(ai, owner)
    generate(ai, owner)
    generate(ai, owner)
    body = ai.get("/site/gen/usage", headers=owner).json()
    assert body["month_runs"] == 2
    assert body["month_input_tokens"] == 2 * (9_100 + 8_300)
    assert body["month_output_tokens"] == 2 * 1_900
    assert body["generations_today"] == 2 and body["daily_limit"] == 3
    assert body["monthly_token_cap"] == 300_000
    assert len(body["runs"]) == 2
    assert body["runs"][0]["input_tokens"] == 9_100
    assert body["runs"][0]["cache_read_tokens"] == 0


@pytest.mark.usefixtures("base_sample")
def test_demo_in_production_never_calls_claude(
    ai_settings: Settings, factory: sessionmaker[Session],
    fake: FakeCreate,
) -> None:  # fmt: skip
    with make_client(prod(ai_settings), factory, fake, client=RAILWAY_PROXY) as c:
        demo = headers("demo")
        ready(c, demo)
        body = generate(c, demo)
    assert body["status"] == "sample"
    assert body["key_configured"] is False
    assert not fake.calls


# --- guard and helpers --------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    ["₹500", "Rs 45", "INR", "rupees", "two lakh", "a crore", "best price", "low tariff",
     "no fee", "10%", "50 percent", "1,200", "year 2026", "१२३", "५००० रुपये", "कीमत",
     "seedha.site", "https://x.example", "extra charges"],
)  # fmt: skip
def test_site_guard_rejects(text: str) -> None:
    assert not gen.site_text_ok(text)


@pytest.mark.parametrize("text", ["Valley views from 2 rooms", "मॉल रोड से 5 मिनट", "१२ कमरे"])
def test_site_guard_allows(text: str) -> None:
    assert gen.site_text_ok(text)


def test_trim_and_helpers() -> None:
    assert gen.trim("a  b c", 10) == "a b c"
    assert gen.trim("hello world again", 12) == "hello world"
    assert gen.trim("x" * 20, 5) == "xxxxx"
    assert gen.first_words("1 2 3 4 5 6 7 8 9 10") == "1 2 3 4 5 6 7 8"


def test_stored_json_tolerates_bad_rows() -> None:
    row = SiteContent(rooms_json="{bad", content_json="[1]")
    assert not gen.read_rooms(row)
    assert gen.read_content(row)["description_en"] == ""
    row.rooms_json = json.dumps([{"name": "Ok", "price_paise": "9"}, {"nope": 1}, 3])
    assert gen.read_rooms(row) == [gen.Room("Ok", 0)]
    row.content_json = "{bad"
    assert gen.read_content(row)["why_book_direct_en"] == []


def test_usage_reads_missing_fields() -> None:
    assert gen._usage(object()) == gen.Usage()  # pylint: disable=protected-access
    partial = FakeUsage(10, 5, None, None)
    assert gen._usage(type("M", (), {"usage": partial})()) == gen.Usage(10, 5)  # pylint: disable=protected-access


def test_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SITE_GEN_MODEL", " claude-haiku-5-5 ")
    monkeypatch.setenv("SITE_GEN_MONTHLY_TOKEN_CAP", "1000")
    loaded = load_settings()
    assert loaded.site_gen_model == MODEL
    assert loaded.site_gen_monthly_token_cap == 1_000
    monkeypatch.setenv("SITE_GEN_MONTHLY_TOKEN_CAP", "lots")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    loaded = load_settings()
    assert loaded.site_gen_monthly_token_cap == 300_000
    assert not loaded.site_gen_enabled
