"""Seedha Site real mode, owner routes: photos, the owner's inputs, one-tap
generation and AI usage (docs/SITE_REAL.md sections 1 and 2).

Owner-only like routers/site.py. Room prices are only what the owner typed
(price_paise); generated text passes the D6 site guard field by field.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Header, Request, Response, UploadFile
from pydantic import BaseModel, Field, StrictInt, field_validator
from sqlalchemy.orm import Session

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Property, SitePhoto
from app.ratelimit import GLOBAL_FACTOR, Limit, RateLimiter
from app.routers.auth import NowDep
from app.services import site_gen as gen
from app.services.site_photos import (
    MAX_UPLOAD_BYTES,
    PhotoError,
    add_photo,
    clean_photo,
    delete_photo,
    find_photo,
    list_photos,
    reorder_photos,
)

router = APIRouter(prefix="/site", tags=["site-build"])

Status = gen.GenStatus
Source = Literal["none", "sample", "claude", "edited"]


def limited(bucket: str, limit: Limit) -> Callable[[Request], None]:
    """429 when one client (or every client together) is over `limit`."""
    ceiling = Limit(limit.count * GLOBAL_FACTOR, limit.seconds)

    def dependency(request: Request) -> None:
        limiter: RateLimiter = request.app.state.rate_limiter
        client = request.client.host if request.client else "unknown"
        wait = limiter.check(bucket, client, limit) or limiter.check(bucket, "*", ceiling)
        if wait > 0:
            raise ApiError(429, "too_many_requests",
                           "Too many tries. Please wait a minute and try again.",
                           headers={"Retry-After": str(math.ceil(wait))})  # fmt: skip

    return dependency


EDIT_LIMIT = Depends(limited("site_build", Limit(60, 60)))
IMAGE_LIMIT = Depends(limited("site_build_image", Limit(240, 60)))
GENERATE_LIMIT = Depends(limited("site_generate", Limit(5, 60)))


# --- shapes ---------------------------------------------------------------------


class PhotoOut(BaseModel):
    """One stored photo (bytes served separately)."""

    id: int
    position: int
    width: int
    height: int
    size_bytes: int
    url: str
    caption_en: str
    caption_hi: str


class PhotosOut(BaseModel):
    """The property's photos in order."""

    photos: list[PhotoOut]


class OrderIn(BaseModel):
    """Every photo id once, in the new order."""

    ids: list[int] = Field(max_length=8)


class RoomOut(BaseModel):
    """A room type with the owner's own price (paise)."""

    name: str
    price_paise: int
    blurb_en: str
    blurb_hi: str


class ContentOut(BaseModel):
    """Generated or edited site text. Never carries a price."""

    description_en: str
    description_hi: str
    why_book_direct_en: list[str]
    why_book_direct_hi: list[str]
    google_description_en: str
    google_description_hi: str


class BuildOut(BaseModel):
    """Everything the setup and review screens need."""

    owner_description: str
    rooms: list[RoomOut]
    content: ContentOut
    photos: list[PhotoOut]
    source: Source
    key_configured: bool
    model: str
    generations_today: int
    daily_limit: int
    month_tokens_used: int
    monthly_token_cap: int


class GenerateOut(BuildOut):
    """The build after one generation attempt."""

    status: Status
    fallback_fields: list[str]
    message: str


Point = Annotated[str, Field(min_length=1, max_length=gen.POINT_MAX)]


def _caption_words(value: str | None) -> str | None:
    if value is not None and gen.words(value) > gen.CAPTION_WORDS:
        raise ValueError("captions are at most 8 words")
    return value


class RoomIn(BaseModel):
    """A room type typed by the owner. The price is whole paise."""

    name: str = Field(min_length=2, max_length=60)
    price_paise: StrictInt = Field(ge=1, le=10_000_000)
    blurb_en: str | None = Field(default=None, max_length=gen.BLURB_MAX)
    blurb_hi: str | None = Field(default=None, max_length=gen.BLURB_MAX)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        name = " ".join(value.split())
        if len(name) < 2:  # noqa: PLR2004
            raise ValueError("room name is too short")
        return name


class ContentIn(BaseModel):
    """Any subset of the site text, as the owner edited it."""

    description_en: str | None = Field(default=None, max_length=gen.DESCRIPTION_MAX)
    description_hi: str | None = Field(default=None, max_length=gen.DESCRIPTION_MAX)
    why_book_direct_en: list[Point] | None = Field(default=None, min_length=3, max_length=3)
    why_book_direct_hi: list[Point] | None = Field(default=None, min_length=3, max_length=3)
    google_description_en: str | None = Field(default=None, max_length=gen.GOOGLE_MAX)
    google_description_hi: str | None = Field(default=None, max_length=gen.GOOGLE_MAX)


class CaptionIn(BaseModel):
    """A photo caption, at most 8 words in each language."""

    photo_id: int
    caption_en: str | None = Field(default=None, max_length=120)
    caption_hi: str | None = Field(default=None, max_length=120)

    _words_en = field_validator("caption_en")(_caption_words)
    _words_hi = field_validator("caption_hi")(_caption_words)


class BuildPatchIn(BaseModel):
    """The owner's inputs and edits; omitted fields stay as they are."""

    owner_description: str | None = Field(default=None, max_length=2000)
    rooms: list[RoomIn] | None = Field(default=None, min_length=1, max_length=10)
    content: ContentIn | None = None
    captions: list[CaptionIn] | None = Field(default=None, max_length=8)


# --- helpers --------------------------------------------------------------------


def photo_out(row: SitePhoto) -> PhotoOut:
    """A photo with its owner preview address (through the web app's /api)."""
    return PhotoOut(id=row.id, position=row.position, width=row.width, height=row.height,
                    size_bytes=row.size_bytes, url=f"/api/site/photos/{row.id}",
                    caption_en=row.caption_en, caption_hi=row.caption_hi)  # fmt: skip


def photos_out(session: Session, prop: Property) -> PhotosOut:
    """All photos in order."""
    return PhotosOut(photos=[photo_out(p) for p in list_photos(session, prop.id)])


def build_out(
    session: Session, prop: Property, settings: SettingsDep, now: datetime
) -> dict[str, Any]:
    """The build state as a dict (shared by BuildOut and GenerateOut)."""
    row = gen.get_content(session, prop.id)
    session.flush()
    return {
        "owner_description": row.owner_description,
        "rooms": [RoomOut(name=r.name, price_paise=r.price_paise, blurb_en=r.blurb_en,
                          blurb_hi=r.blurb_hi) for r in gen.read_rooms(row)],
        "content": ContentOut(**gen.read_content(row)),
        "photos": [photo_out(p) for p in list_photos(session, prop.id)],
        "source": row.source if row.source in ("none", "sample", "claude", "edited") else "none",
        "key_configured": settings.site_gen_enabled,
        "model": settings.site_gen_model if settings.site_gen_enabled else "",
        "generations_today": gen.generations_today(session, prop.id, now),
        "daily_limit": gen.DAILY_LIMIT,
        "month_tokens_used": gen.month_usage(session, now).total,
        "monthly_token_cap": settings.site_gen_monthly_token_cap,
    }  # fmt: skip


def _photo_error(exc: PhotoError) -> ApiError:
    return ApiError(exc.status, exc.code, exc.message)


# --- photos ---------------------------------------------------------------------


@router.post("/photos", response_model=PhotoOut, status_code=201, dependencies=[EDIT_LIMIT])
def upload_photo(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    photo: Annotated[UploadFile, File(description="One JPEG, PNG or WebP photo, 10 MB at most")],
) -> PhotoOut:
    """Add one photo: checked by content, resized, every EXIF field removed.
    A plain def so the image work runs in the threadpool (final audit A1b-1)."""
    data = photo.file.read(MAX_UPLOAD_BYTES + 1)
    try:
        row = add_photo(session, prop.id, clean_photo(data))
    except PhotoError as exc:
        raise _photo_error(exc) from None
    return photo_out(row)


@router.get("/photos", response_model=PhotosOut, dependencies=[EDIT_LIMIT])
def get_photos(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> PhotosOut:
    """The property's photos in order."""
    return photos_out(session, prop)


@router.patch("/photos/order", response_model=PhotosOut, dependencies=[EDIT_LIMIT])
def order_photos(
    body: OrderIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> PhotosOut:
    """Put the photos in the owner's order (every photo id exactly once)."""
    if not reorder_photos(session, prop.id, body.ids):
        raise ApiError(422, "bad_order", "List every photo exactly once")
    return photos_out(session, prop)


@router.delete("/photos/{photo_id}", response_model=PhotosOut, dependencies=[EDIT_LIMIT])
def remove_photo(
    photo_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> PhotosOut:
    """Delete a photo; the rest close the gap."""
    if not delete_photo(session, prop.id, photo_id):
        raise ApiError(404, "no_such_photo", "No photo with that id")
    return photos_out(session, prop)


@router.get("/photos/{photo_id}", dependencies=[IMAGE_LIMIT])
def photo_bytes(
    photo_id: int,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    """The stored JPEG for the owner's preview (private; ETag is its SHA-256)."""
    row = find_photo(session, prop.id, photo_id)
    if row is None:
        raise ApiError(404, "no_such_photo", "No photo with that id")
    etag = f'"{row.sha256}"'
    headers = {"Cache-Control": "private, no-cache", "ETag": etag}
    if if_none_match is not None and etag in if_none_match:
        return Response(status_code=304, headers=headers)
    return Response(content=row.data, media_type="image/jpeg", headers=headers)


# --- build state ----------------------------------------------------------------


@router.get("/build", response_model=BuildOut, dependencies=[EDIT_LIMIT])
def get_build(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep, now: NowDep
) -> BuildOut:
    """The owner's inputs, the site text and the AI allowance."""
    return BuildOut(**build_out(session, prop, settings, now))


def _patch_rooms(row: Any, rooms: list[RoomIn]) -> bool:
    """Replace rooms; blurbs not sent are kept by name. True if a blurb was edited."""
    names = [r.name.casefold() for r in rooms]
    if len(names) != len(set(names)):
        raise ApiError(422, "duplicate_room", "Each room type needs its own name")
    old = {r.name.casefold(): r for r in gen.read_rooms(row)}
    edited = False
    new: list[gen.Room] = []
    for room in rooms:
        before = old.get(room.name.casefold())
        blurb_en = (
            room.blurb_en if room.blurb_en is not None else (before.blurb_en if before else "")
        )
        blurb_hi = (
            room.blurb_hi if room.blurb_hi is not None else (before.blurb_hi if before else "")
        )
        edited = edited or room.blurb_en is not None or room.blurb_hi is not None
        new.append(gen.Room(room.name, room.price_paise, blurb_en, blurb_hi))
    gen.write_rooms(row, new)
    return edited


@router.patch("/build", response_model=BuildOut, dependencies=[EDIT_LIMIT])
def patch_build(
    body: BuildPatchIn,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    now: NowDep,
) -> BuildOut:
    """Save the owner's inputs and edits. Editing site text marks it "edited"."""
    row = gen.get_content(session, prop.id)
    edited = False
    if body.owner_description is not None:
        row.owner_description = body.owner_description.strip()
    if body.rooms is not None:
        edited = _patch_rooms(row, body.rooms)
    if body.content is not None:
        changes = body.content.model_dump(exclude_none=True)
        if changes:
            gen.write_content(row, gen.read_content(row) | changes)
            edited = True
    for caption in body.captions or []:
        photo = find_photo(session, prop.id, caption.photo_id)
        if photo is None:
            raise ApiError(404, "no_such_photo", "No photo with that id")
        if caption.caption_en is not None:
            photo.caption_en = " ".join(caption.caption_en.split())
        if caption.caption_hi is not None:
            photo.caption_hi = " ".join(caption.caption_hi.split())
        edited = True
    if edited:
        row.source = "edited"
    row.updated_at = now
    return BuildOut(**build_out(session, prop, settings, now))


# --- generation -----------------------------------------------------------------


def get_site_writer(request: Request, settings: SettingsDep) -> gen.SiteWriter | None:
    """Claude when the key and SITE_GEN_MODEL are set (per-request settings, so
    demo and public visitors get None); tests set app.state.site_writer."""
    if not settings.site_gen_enabled:
        return None
    override: gen.SiteWriter | None = getattr(request.app.state, "site_writer", None)
    if override is not None:
        return override
    return gen.ClaudeSiteWriter(settings.anthropic_api_key, settings.site_gen_model)


SiteWriterDep = Annotated[gen.SiteWriter | None, Depends(get_site_writer)]


@router.post("/build/generate", response_model=GenerateOut, dependencies=[GENERATE_LIMIT])
def generate(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    now: NowDep,
    writer: SiteWriterDep,
) -> GenerateOut:
    """One Claude call (or the labelled sample without a key). Counts toward
    3 a day and the monthly token cap even if the call fails after sending."""
    try:
        result = gen.run_generation(session, prop, writer, now, settings.site_gen_monthly_token_cap)
    except gen.NotReadyError as exc:
        raise ApiError(422, "not_ready", str(exc)) from None
    return GenerateOut(**build_out(session, prop, settings, now), status=result.status,
                       fallback_fields=result.fallback, message=result.message)  # fmt: skip


# --- usage ----------------------------------------------------------------------


class RunOut(BaseModel):
    """One generation call's tokens."""

    at: datetime
    status: str
    model: str
    input_tokens: int
    output_tokens: int
    cache_creation_tokens: int
    cache_read_tokens: int


class UsageOut(BaseModel):
    """Site AI usage for Settings. Month input includes cache tokens."""

    runs: list[RunOut]
    month_input_tokens: int
    month_output_tokens: int
    month_runs: int
    monthly_token_cap: int
    generations_today: int
    daily_limit: int


@router.get("/gen/usage", response_model=UsageOut, dependencies=[EDIT_LIMIT])
def gen_usage(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep, now: NowDep
) -> UsageOut:
    """The latest 20 runs and this month's totals (all properties)."""
    month = gen.month_usage(session, now)
    return UsageOut(
        runs=[
            RunOut.model_validate(r, from_attributes=True)
            for r in gen.recent_runs(session, prop.id)
        ],
        month_input_tokens=month.input_tokens
        + month.cache_creation_tokens
        + month.cache_read_tokens,
        month_output_tokens=month.output_tokens,
        month_runs=month.runs,
        monthly_token_cap=settings.site_gen_monthly_token_cap,
        generations_today=gen.generations_today(session, prop.id, now),
        daily_limit=gen.DAILY_LIMIT,
    )
