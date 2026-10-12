"""Seedha Site text: owner inputs, one lean Claude call, plain-code checks.

Claude sees the owner's resized photos, description, hotel name, town and room
names (never prices) and returns strict JSON. Every field is then checked by
code (lengths, photo ids, and the D6 site guard: no money, price words, %,
numbers of 3 or more digits in any script, or web addresses). A field that
fails falls back to template text built from the owner's own inputs. Room
prices on the site come only from what the owner typed (price_paise).

Without ANTHROPIC_API_KEY or SITE_GEN_MODEL (or for demo and public visitors,
see deps.get_settings) no call is made and a labelled sample is used.
"""

from __future__ import annotations

import base64
import json
import logging
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, timezone
from typing import Any, Literal, Protocol

import anthropic
from anthropic.types import ContentBlockParam, ImageBlockParam, OutputConfigParam
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Property, SiteContent, SiteGenRun, SitePhoto
from app.services.drafter import MONEY_PATTERN, WEB_ADDRESS
from app.services.events import EVENT_MONEY
from app.services.site import GALLERY, ROOM_COPY, TAGLINE
from app.services.site import google_description as sample_google
from app.services.site_photos import list_photos

logger = logging.getLogger("seedha.site_gen")

DAILY_LIMIT = 3
MIN_PHOTOS = 4
MAX_TOKENS = 3_000
DESCRIPTION_MAX = 1_200
POINT_MAX = 120
GOOGLE_MAX = 750
BLURB_MAX = 300
CAPTION_WORDS = 8
POINTS = 3
RUNS_SHOWN = 20
# Models whose docs list output_config.effort (R1 read the live docs).
EFFORT_MODELS = ("claude-haiku-5-5",)
IST = timezone(timedelta(hours=5, minutes=30))
CONTENT_TEXT_KEYS = (
    "description_en",
    "description_hi",
    "google_description_en",
    "google_description_hi",
)
CONTENT_LIST_KEYS = ("why_book_direct_en", "why_book_direct_hi")
LIMIT_TODAY = "Generation limit reached for today"
LIMIT_MONTH = "Monthly AI limit reached"

HINDI_MONEY = re.compile(r"(रुपये|रुपए|रुपया|रु\.|लाख|करोड़|कीमत|किराया|शुल्क|प्रतिशत)")
# Any name.tld (any top-level domain, e.g. .site) or an email address.
ANY_ADDRESS = re.compile(r"(\b[a-z0-9-]{2,}\.[a-z]{2,}\b|@)", re.IGNORECASE)
EXTRA_MONEY = re.compile(r"(\bpercent\b|\bcosts?\b|\bcharges?\b|\bdiscounts?\b)", re.IGNORECASE)

SYSTEM = (
    "You write short, warm, honest website text for a small family-run hill hotel in India, "
    "in English and in natural Hindi (Devanagari). Use only what the photos and the owner's "
    "words show; never invent facilities, awards or distances. Never mention money, prices, "
    "rates, fees, discounts, percentages, phone numbers, web addresses or any number with "
    "three or more digits. Captions: at most 8 words. Why book direct: exactly 3 short "
    "points about talking to the owner and returning-guest perks, never a lower price. "
    "Google descriptions: at most 750 characters. Order photos with the strongest first, "
    "using the given photo ids. Answer with JSON only."
)

_PAIR = {
    "type": "object",
    "properties": {"en": {"type": "array", "items": {"type": "string"}},
                   "hi": {"type": "array", "items": {"type": "string"}}},
    "required": ["en", "hi"],
    "additionalProperties": False,
}  # fmt: skip
SITE_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "description_en": {"type": "string"},
        "description_hi": {"type": "string"},
        "room_blurbs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "blurb_en": {"type": "string"},
                               "blurb_hi": {"type": "string"}},
                "required": ["name", "blurb_en", "blurb_hi"],
                "additionalProperties": False,
            },
        },
        "photo_order": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"photo_id": {"type": "integer"}, "caption_en": {"type": "string"},
                               "caption_hi": {"type": "string"}},
                "required": ["photo_id", "caption_en", "caption_hi"],
                "additionalProperties": False,
            },
        },
        "why_book_direct": _PAIR,
        "google_description_en": {"type": "string"},
        "google_description_hi": {"type": "string"},
    },
    "required": ["description_en", "description_hi", "room_blurbs", "photo_order",
                 "why_book_direct", "google_description_en", "google_description_hi"],
    "additionalProperties": False,
}  # fmt: skip

TEMPLATE_POINTS_EN = (
    "Book direct with us",
    "Talk to the owner before you arrive",
    "A thank-you perk when you come back",
)
TEMPLATE_POINTS_HI = (
    "हमसे सीधे बुक करें",
    "आने से पहले मालिक से बात करें",
    "दोबारा आने पर एक धन्यवाद तोहफ़ा",
)


class SiteGenUnavailableError(RuntimeError):
    """Claude could not write the site this time (after the request was sent)."""


# --- the D6 site guard -------------------------------------------------------------


def _ascii_digits(text: str) -> str:
    """Every Unicode decimal digit (Devanagari ०-९ included) as its ASCII digit."""
    return "".join(
        str(unicodedata.decimal(ch)) if ch.isdecimal() and not ch.isascii() else ch for ch in text
    )


def site_text_ok(text: str) -> bool:
    """False when generated text mentions money, a price word, %, a number of
    3 or more digits (any script) or a web address. Years are not excused."""
    plain = _ascii_digits(text)
    return not (
        EVENT_MONEY.search(plain)
        or MONEY_PATTERN.search(plain)
        or WEB_ADDRESS.search(plain)
        or ANY_ADDRESS.search(plain)
        or HINDI_MONEY.search(plain)
        or EXTRA_MONEY.search(plain)
    )


def words(text: str) -> int:
    """Word count (whitespace separated)."""
    return len(text.split())


def trim(text: str, limit: int) -> str:
    """Whitespace collapsed and cut at a word boundary within `limit` characters."""
    plain = " ".join(text.split())
    if len(plain) <= limit:
        return plain
    cut = plain[:limit].rsplit(" ", 1)[0]
    return cut or plain[:limit]


def first_words(text: str, count: int = CAPTION_WORDS) -> str:
    """The first `count` words."""
    return " ".join(text.split()[:count])


# --- stored build ----------------------------------------------------------------


@dataclass(slots=True)
class Room:
    """An owner room type. The price is only what the owner typed (paise)."""

    name: str
    price_paise: int
    blurb_en: str = ""
    blurb_hi: str = ""


def get_content(session: Session, property_id: int) -> SiteContent:
    """The property's site content row, created empty on first use."""
    row = session.scalar(select(SiteContent).where(SiteContent.property_id == property_id))
    if row is None:
        row = SiteContent(property_id=property_id, owner_description="", rooms_json="[]",
                          content_json="{}", source="none")  # fmt: skip
        session.add(row)
        session.flush()
    return row


def read_rooms(row: SiteContent) -> list[Room]:
    """Rooms from storage (bad entries skipped)."""
    try:
        raw = json.loads(row.rooms_json or "[]")
    except json.JSONDecodeError:
        return []
    rooms: list[Room] = []
    for item in raw if isinstance(raw, list) else []:
        if isinstance(item, dict) and isinstance(item.get("name"), str):
            price = item.get("price_paise")
            rooms.append(
                Room(
                    item["name"],
                    price if isinstance(price, int) else 0,
                    str(item.get("blurb_en", "")),
                    str(item.get("blurb_hi", "")),
                )
            )
    return rooms


def write_rooms(row: SiteContent, rooms: Sequence[Room]) -> None:
    """Store rooms as JSON."""
    row.rooms_json = json.dumps(
        [{"name": r.name, "price_paise": r.price_paise, "blurb_en": r.blurb_en,
          "blurb_hi": r.blurb_hi} for r in rooms],
        ensure_ascii=False,
    )  # fmt: skip


def read_content(row: SiteContent) -> dict[str, Any]:
    """Generated or edited text, every key present."""
    try:
        raw = json.loads(row.content_json or "{}")
    except json.JSONDecodeError:
        raw = {}
    raw = raw if isinstance(raw, dict) else {}
    out: dict[str, Any] = {k: str(raw.get(k, "")) for k in CONTENT_TEXT_KEYS}
    for key in CONTENT_LIST_KEYS:
        value = raw.get(key)
        out[key] = [str(v) for v in value] if isinstance(value, list) else []
    return out


def write_content(row: SiteContent, content: dict[str, Any]) -> None:
    """Store text as JSON."""
    row.content_json = json.dumps(content, ensure_ascii=False)


# --- templates (owner's own inputs) --------------------------------------------------


@dataclass(frozen=True, slots=True)
class Owner:
    """Everything the templates may use: the owner's own inputs."""

    hotel: str
    town: str
    description: str


def template_field(owner: Owner, key: str) -> Any:
    """Template text for one content field."""
    if key in ("description_en", "description_hi"):
        return trim(owner.description, DESCRIPTION_MAX) or f"{owner.hotel}, {owner.town}"
    if key in ("google_description_en", "google_description_hi"):
        return trim(f"{owner.hotel}, {owner.town}. {owner.description}", GOOGLE_MAX)
    if key == "why_book_direct_en":
        return list(TEMPLATE_POINTS_EN)
    return list(TEMPLATE_POINTS_HI)


def template_blurb(owner: Owner, room: Room) -> str:
    """Template line for a room."""
    return f"{room.name} · {owner.hotel}"


def template_caption(owner: Owner) -> str:
    """Template caption for a photo."""
    return first_words(owner.hotel)


# --- applying Claude's answer, field by field ---------------------------------------


def _text(value: object, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    plain = " ".join(value.split())
    return plain if plain and len(plain) <= limit and site_text_ok(plain) else None


def _caption(value: object) -> str | None:
    text = _text(value, 120)
    return text if text is not None and words(text) <= CAPTION_WORDS else None


def _points(value: object) -> list[str] | None:
    if not isinstance(value, list) or len(value) != POINTS:
        return None
    points = [_text(v, POINT_MAX) for v in value]
    return [p for p in points if p is not None] if all(points) else None


def _content_fields(payload: dict[str, Any]) -> dict[str, Any]:
    pair = payload.get("why_book_direct")
    pair = pair if isinstance(pair, dict) else {}
    return {
        "description_en": _text(payload.get("description_en"), DESCRIPTION_MAX),
        "description_hi": _text(payload.get("description_hi"), DESCRIPTION_MAX),
        "google_description_en": _text(payload.get("google_description_en"), GOOGLE_MAX),
        "google_description_hi": _text(payload.get("google_description_hi"), GOOGLE_MAX),
        "why_book_direct_en": _points(pair.get("en")),
        "why_book_direct_hi": _points(pair.get("hi")),
    }


def _apply_rooms(
    payload: dict[str, Any], owner: Owner, rooms: list[Room], fallback: list[str]
) -> None:
    blurbs: dict[str, dict[str, Any]] = {}
    for item in payload.get("room_blurbs") or []:
        if isinstance(item, dict) and isinstance(item.get("name"), str):
            blurbs.setdefault(item["name"].strip().casefold(), item)
    for index, room in enumerate(rooms):
        item = blurbs.get(room.name.strip().casefold(), {})
        for lang in ("en", "hi"):
            text = _text(item.get(f"blurb_{lang}"), BLURB_MAX)
            if text is None:
                fallback.append(f"rooms.{index}.blurb_{lang}")
                text = template_blurb(owner, room)
            setattr(room, f"blurb_{lang}", text)


def _apply_photos(
    payload: dict[str, Any], owner: Owner, photos: list[SitePhoto], fallback: list[str]
) -> None:
    by_id = {p.id: p for p in photos}
    order: list[int] = []
    captioned: set[tuple[int, str]] = set()
    for item in payload.get("photo_order") or []:
        photo_id = item.get("photo_id") if isinstance(item, dict) else None
        if not isinstance(photo_id, int) or photo_id not in by_id or photo_id in order:
            continue
        order.append(photo_id)
        for lang in ("en", "hi"):
            text = _caption(item.get(f"caption_{lang}"))
            if text is not None:
                setattr(by_id[photo_id], f"caption_{lang}", text)
                captioned.add((photo_id, lang))
    for photo in photos:
        for lang in ("en", "hi"):
            if (photo.id, lang) not in captioned:
                fallback.append(f"photos.{photo.id}.caption_{lang}")
                setattr(photo, f"caption_{lang}", template_caption(owner))
    if len(order) == len(by_id):
        for position, photo_id in enumerate(order):
            by_id[photo_id].position = position
    else:
        fallback.append("photo_order")


def apply_generated(
    payload: dict[str, Any],
    owner: Owner,
    rooms: list[Room],
    photos: list[SitePhoto],
) -> tuple[dict[str, Any], list[str]]:
    """Checked content from Claude's JSON plus the names of fields that fell
    back to templates. Mutates `rooms` blurbs and `photos` captions/order."""
    fallback: list[str] = []
    content: dict[str, Any] = {}
    for key, checked in _content_fields(payload).items():
        if checked is None:
            fallback.append(key)
        content[key] = template_field(owner, key) if checked is None else checked
    _apply_rooms(payload, owner, rooms, fallback)
    _apply_photos(payload, owner, photos, fallback)
    return content, fallback


def template_build(owner: Owner, rooms: list[Room], photos: list[SitePhoto]) -> dict[str, Any]:
    """Every field from templates (Claude offline and nothing to keep)."""
    for room in rooms:
        room.blurb_en = room.blurb_en or template_blurb(owner, room)
        room.blurb_hi = room.blurb_hi or template_blurb(owner, room)
    for photo in photos:
        photo.caption_en = photo.caption_en or template_caption(owner)
        photo.caption_hi = photo.caption_hi or template_caption(owner)
    return {k: template_field(owner, k) for k in CONTENT_TEXT_KEYS + CONTENT_LIST_KEYS}


def sample_build(
    prop: Property, owner: Owner, rooms: list[Room], photos: list[SitePhoto]
) -> dict[str, Any]:
    """The labelled sample (no Claude call). The sample hotel gets its existing
    sample copy; any other hotel gets templates from its owner's inputs."""
    if not prop.is_sample:
        return template_build(owner, rooms, photos)
    google = sample_google(prop)
    for room in rooms:
        _, detail = ROOM_COPY.get(room.name, ("", {"en": "", "hi": ""}))
        room.blurb_en = detail["en"] or template_blurb(owner, room)
        room.blurb_hi = detail["hi"] or template_blurb(owner, room)
    for index, photo in enumerate(photos):
        label = GALLERY[index % len(GALLERY)]
        photo.caption_en, photo.caption_hi = label["en"], label["hi"]
    return {
        "description_en": TAGLINE["en"],
        "description_hi": TAGLINE["hi"],
        "why_book_direct_en": list(TEMPLATE_POINTS_EN),
        "why_book_direct_hi": list(TEMPLATE_POINTS_HI),
        "google_description_en": google["en"],
        "google_description_hi": google["hi"],
    }


# --- limits and usage -------------------------------------------------------------


def day_start(now: datetime) -> datetime:
    """Midnight India time, as UTC (stored times are UTC)."""
    local = now.astimezone(IST)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)


def month_start(now: datetime) -> datetime:
    """The first of this month India time, as UTC."""
    local = now.astimezone(IST)
    first = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return first.astimezone(UTC)


def generations_today(session: Session, property_id: int, now: datetime) -> int:
    """Claude calls for this property since midnight (failed calls count)."""
    return int(
        session.scalar(
            select(func.count())
            .select_from(SiteGenRun)
            .where(SiteGenRun.property_id == property_id, SiteGenRun.at >= day_start(now))
        )
        or 0
    )


@dataclass(frozen=True, slots=True)
class MonthUsage:
    """Token totals this month across the account."""

    input_tokens: int
    output_tokens: int
    cache_creation_tokens: int
    cache_read_tokens: int
    runs: int

    @property
    def total(self) -> int:
        """Input + output + cache tokens (what the monthly cap counts)."""
        return (
            self.input_tokens
            + self.output_tokens
            + self.cache_creation_tokens
            + self.cache_read_tokens
        )


def month_usage(session: Session, now: datetime) -> MonthUsage:
    """Sums over every property's runs since the first of the month."""
    row = session.execute(
        select(
            func.coalesce(func.sum(SiteGenRun.input_tokens), 0),
            func.coalesce(func.sum(SiteGenRun.output_tokens), 0),
            func.coalesce(func.sum(SiteGenRun.cache_creation_tokens), 0),
            func.coalesce(func.sum(SiteGenRun.cache_read_tokens), 0),
            func.count(SiteGenRun.id),
        ).where(SiteGenRun.at >= month_start(now))
    ).one()
    return MonthUsage(*(int(v) for v in row))


def recent_runs(session: Session, property_id: int) -> list[SiteGenRun]:
    """The latest runs for the Settings panel."""
    return list(
        session.scalars(
            select(SiteGenRun)
            .where(SiteGenRun.property_id == property_id)
            .order_by(SiteGenRun.at.desc(), SiteGenRun.id.desc())
            .limit(RUNS_SHOWN)
        )
    )


def limit_message(session: Session, property_id: int, now: datetime, cap: int) -> str | None:
    """Why no call may be made now, or None."""
    if generations_today(session, property_id, now) >= DAILY_LIMIT:
        return LIMIT_TODAY
    if month_usage(session, now).total >= cap:
        return LIMIT_MONTH
    return None


# --- the Claude call --------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class GenInput:
    """What one generation sends: photos (JPEG bytes by id) and owner text. No prices."""

    hotel: str
    town: str
    description: str
    room_names: tuple[str, ...]
    photos: tuple[tuple[int, bytes], ...]


@dataclass(frozen=True, slots=True)
class Usage:
    """Tokens one call used."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0


@dataclass(frozen=True, slots=True)
class GenOutcome:
    """Claude's parsed JSON (None when it gave none), why it stopped, and usage."""

    payload: dict[str, Any] | None
    stop_reason: str
    usage: Usage = field(default_factory=Usage)


class SiteWriter(Protocol):
    """Writes site text from photos and the owner's words."""

    model: str

    def write(self, request: GenInput) -> GenOutcome:
        """One call. Raises SiteGenUnavailableError when no answer came back."""


def user_content(request: GenInput) -> list[ContentBlockParam]:
    """Photos first (each labelled with its id; cache marker on the last image),
    then the owner's words fenced as data."""
    blocks: list[ContentBlockParam] = []
    for index, (photo_id, data) in enumerate(request.photos):
        image: ImageBlockParam = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": base64.b64encode(data).decode(),
            },
        }
        if index == len(request.photos) - 1:
            image["cache_control"] = {"type": "ephemeral"}
        blocks.append({"type": "text", "text": f"Photo id {photo_id}:"})
        blocks.append(image)
    rooms = "\n".join(f"- {name}" for name in request.room_names)
    blocks.append({
        "type": "text",
        "text": (f"Hotel: {request.hotel}\nTown: {request.town}\nRoom types:\n{rooms}\n"
                 f"<owner_description>\n{request.description}\n</owner_description>"),
    })  # fmt: skip
    return blocks


def _usage(message: Any) -> Usage:
    usage = getattr(message, "usage", None)
    if usage is None:
        return Usage()
    return Usage(
        input_tokens=int(getattr(usage, "input_tokens", 0) or 0),
        output_tokens=int(getattr(usage, "output_tokens", 0) or 0),
        cache_creation_tokens=int(getattr(usage, "cache_creation_input_tokens", 0) or 0),
        cache_read_tokens=int(getattr(usage, "cache_read_input_tokens", 0) or 0),
    )


class ClaudeSiteWriter:
    """SiteWriter backed by the Anthropic Messages API (structured output)."""

    def __init__(self, api_key: str, model: str, client: anthropic.Anthropic | None = None) -> None:
        self._client = client or anthropic.Anthropic(api_key=api_key, timeout=60.0, max_retries=1)
        self.model = model

    def output_config(self) -> OutputConfigParam:
        """JSON schema always; effort low only for models documented to take it."""
        config: OutputConfigParam = {"format": {"type": "json_schema", "schema": SITE_SCHEMA}}
        if self.model.startswith(EFFORT_MODELS):
            config["effort"] = "low"
        return config

    def write(self, request: GenInput) -> GenOutcome:
        """Claude's JSON, or a stop reason with no payload."""
        try:
            message = self._client.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=SYSTEM,
                messages=[{"role": "user", "content": user_content(request)}],
                output_config=self.output_config(),
            )
        except anthropic.APIError as exc:
            logger.warning("Claude site generation unavailable: %s", type(exc).__name__)
            raise SiteGenUnavailableError from exc
        usage = _usage(message)
        stop = str(message.stop_reason)
        if stop != "end_turn":
            logger.warning("Claude site generation stopped: %s", stop)
            return GenOutcome(None, stop, usage)
        text = next((b.text for b in message.content if b.type == "text"), "")
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return GenOutcome(None, "bad_json", usage)
        return GenOutcome(payload if isinstance(payload, dict) else None, stop, usage)


# --- one generation, shared by the route and scripts/site_gen_once.py ---------------

ALL_FIELDS = CONTENT_TEXT_KEYS + CONTENT_LIST_KEYS
SAMPLE_MESSAGE = "Sample text. Add ANTHROPIC_API_KEY and SITE_GEN_MODEL to write your own."
OFFLINE_MESSAGE = (
    "AI writing is not available right now. Simple text from your own words is ready to edit."
)
OFFLINE_KEPT = "AI writing is not available right now. Your text is unchanged."
NOT_READY = "Add at least 4 photos, a description and one room first"


GenStatus = Literal["generated", "limit_reached", "offline", "sample"]


class NotReadyError(ValueError):
    """Generation needs at least 4 photos, a description and one room."""


@dataclass(frozen=True, slots=True)
class GenResult:
    """What one generation attempt did."""

    status: GenStatus
    message: str
    fallback: list[str]
    usage: Usage


def photo_data(session: Session, ids: list[int]) -> tuple[tuple[int, bytes], ...]:
    """The stored JPEG bytes for these photo ids, in that order."""
    found = session.execute(select(SitePhoto.id, SitePhoto.data).where(SitePhoto.id.in_(ids)))
    rows = {row.id: row.data for row in found}
    return tuple((i, rows[i]) for i in ids)


def record_run(
    session: Session,
    property_id: int,
    model: str,
    status: str,
    usage: Usage,
    fallback: int,
    now: datetime,
) -> None:
    """Log one Claude call (it counts toward the limits whatever happened)."""
    session.add(SiteGenRun(property_id=property_id, at=now, status=status, model=model[:60],
                           input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                           cache_creation_tokens=usage.cache_creation_tokens,
                           cache_read_tokens=usage.cache_read_tokens,
                           fields_fallback=fallback))  # fmt: skip


def _ask(writer: SiteWriter, request: GenInput) -> GenOutcome:
    try:
        return writer.write(request)
    except SiteGenUnavailableError:
        return GenOutcome(None, "unavailable")


def run_generation(
    session: Session, prop: Property, writer: SiteWriter | None, now: datetime, cap: int
) -> GenResult:
    """Sample without a writer; otherwise one Claude call within the limits,
    checked field by field, with every call logged as a SiteGenRun."""
    row = get_content(session, prop.id)
    photos = list_photos(session, prop.id)
    rooms = read_rooms(row)
    if len(photos) < MIN_PHOTOS or not row.owner_description.strip() or not rooms:
        raise NotReadyError(NOT_READY)
    owner = Owner(prop.short_name, prop.city, row.owner_description)
    row.updated_at = now
    if writer is None:
        write_content(row, sample_build(prop, owner, rooms, photos))
        write_rooms(row, rooms)
        row.source = "sample"
        return GenResult("sample", SAMPLE_MESSAGE, [], Usage())
    limit = limit_message(session, prop.id, now, cap)
    if limit is not None:
        return GenResult("limit_reached", limit, [], Usage())
    outcome = _ask(writer, GenInput(
        hotel=prop.short_name, town=prop.city, description=row.owner_description,
        room_names=tuple(r.name for r in rooms),
        photos=photo_data(session, [p.id for p in photos]),
    ))  # fmt: skip
    fallback: list[str] = []
    status: GenStatus
    if outcome.payload is not None:
        content, fallback = apply_generated(outcome.payload, owner, rooms, photos)
        write_content(row, content)
        write_rooms(row, rooms)
        row.source, status, message = "claude", "generated", ""
    else:
        status, message = "offline", OFFLINE_KEPT
        if row.source in ("none", "sample"):
            write_content(row, template_build(owner, rooms, photos))
            write_rooms(row, rooms)
            row.source, fallback, message = "edited", list(ALL_FIELDS), OFFLINE_MESSAGE
    record_run(session, prop.id, writer.model, status, outcome.usage, len(fallback), now)
    session.flush()
    return GenResult(status, message, fallback, outcome.usage)
