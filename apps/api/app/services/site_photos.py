"""Owner photos for the hotel site: checked by content, resized, re-encoded.

Every upload is opened by Pillow and accepted only if its real format (not the
declared content type) is JPEG, PNG, WebP or HEIC/HEIF (iPhone photos, read
by the pinned pillow-heif package). The picture is turned upright, converted to
RGB, shrunk to at most 1024 px on the long side and saved as a new JPEG of
about 200 KB built from pixels only, so no EXIF (including GPS), XMP or other
metadata can survive. Bytes live in the database (site_photo), so they
survive redeploys on an ephemeral disk and are covered by database backups.

Public pages also get responsive copies (R3-1): a fixed set of widths
(VARIANT_WIDTHS) and formats (AVIF, WebP, JPEG), made on first request from
the stored JPEG's pixels (never upscaled, no metadata) and cached in
site_photo_variant until the photo is deleted.
"""

from __future__ import annotations

import hashlib
import warnings
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Literal

from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, defer

from app.models import SitePhoto, SitePhotoVariant

# HEIC/HEIF decoding (owner-approved dependency; its wheels are GPLv2-labelled).
register_heif_opener()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PHOTOS = 8
MAX_SIDE = 1024
TARGET_BYTES = 200_000
QUALITIES = (85, 80, 75, 70, 65, 60)
# 30 MP: above any phone's default photo (24 MP at most), and a decoded RGBA
# copy stays near 120 MB (security review V1-L4).
MAX_PIXELS = 30_000_000
ALLOWED_FORMATS = ("JPEG", "PNG", "WEBP", "HEIF")
TYPE_MESSAGE = "Please upload a JPEG, PNG, WebP or HEIC photo."

# Responsive copies for public pages: only these widths and formats exist, so
# the cache is bounded (at most 9 copies per photo).
VARIANT_WIDTHS = (480, 768, 1024)
VARIANT_FORMATS = ("avif", "webp", "jpeg")
VariantFormat = Literal["avif", "webp", "jpeg"]
VARIANT_TYPES: dict[str, str] = {"avif": "image/avif", "webp": "image/webp", "jpeg": "image/jpeg"}
VARIANT_SAVE: dict[str, dict[str, Any]] = {
    "avif": {"format": "AVIF", "quality": 55, "speed": 6},
    "webp": {"format": "WEBP", "quality": 75, "method": 4},
    "jpeg": {"format": "JPEG", "quality": 82, "progressive": True, "optimize": True},
}

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class PhotoError(ValueError):
    """An upload Seedha cannot take, with the HTTP status and a short code."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class CleanPhoto:
    """A resized, metadata-free JPEG."""

    data: bytes
    width: int
    height: int
    sha256: str


def _open(data: bytes) -> Image.Image:
    """Open and fully decode, refusing decompression bombs and unknown formats."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            # Only these decoders are tried, never EPS, PSD and the rest (V1-L3).
            img = Image.open(BytesIO(data), formats=ALLOWED_FORMATS)
            fmt = (img.format or "").upper()
            if fmt not in ALLOWED_FORMATS:
                raise PhotoError(415, "unsupported_type", TYPE_MESSAGE)
            if img.width * img.height > MAX_PIXELS:
                raise PhotoError(413, "photo_too_large", "This photo has too many pixels")
            img.load()
    except PhotoError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise PhotoError(413, "photo_too_large", "This photo has too many pixels") from exc
    except UnidentifiedImageError as exc:
        raise PhotoError(415, "unsupported_type", TYPE_MESSAGE) from exc
    except (OSError, ValueError, SyntaxError) as exc:
        raise PhotoError(422, "unreadable_photo", "This photo could not be read") from exc
    return img


def _rgb(img: Image.Image) -> Image.Image:
    """Upright RGB pixels on white, with no metadata attached."""
    upright = ImageOps.exif_transpose(img) or img
    if upright.mode in ("RGBA", "LA", "P", "PA"):
        rgba = upright.convert("RGBA")
        flat = Image.new("RGB", rgba.size, (255, 255, 255))
        flat.paste(rgba, mask=rgba.getchannel("A"))
    else:
        flat = upright.convert("RGB")
    flat.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    # A brand-new image from raw pixels: nothing from the source's info dict.
    return Image.frombytes("RGB", flat.size, flat.tobytes())


def _encode(img: Image.Image) -> bytes:
    """JPEG at the highest quality from 85 down to 60 that fits about 200 KB."""
    out = b""
    for quality in QUALITIES:
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=quality, optimize=True)
        out = buffer.getvalue()
        if len(out) <= TARGET_BYTES:
            break
    return out


def clean_photo(data: bytes) -> CleanPhoto:
    """Check, resize and re-encode one upload (raises PhotoError)."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise PhotoError(413, "file_too_large", "Photos must be 10 MB or smaller")
    if not data:
        raise PhotoError(422, "empty_file", "This file is empty")
    pixels = _rgb(_open(data))
    jpeg = _encode(pixels)
    return CleanPhoto(jpeg, pixels.width, pixels.height, hashlib.sha256(jpeg).hexdigest())


def list_photos(session: Session, property_id: int) -> list[SitePhoto]:
    """The property's photos in order, without loading their bytes."""
    return list(
        session.scalars(
            select(SitePhoto)
            .options(defer(SitePhoto.data))
            .where(SitePhoto.property_id == property_id)
            .order_by(SitePhoto.position, SitePhoto.id)
        )
    )


def photo_count(session: Session, property_id: int) -> int:
    """How many photos the property has."""
    return int(
        session.scalar(
            select(func.count()).select_from(SitePhoto).where(SitePhoto.property_id == property_id)
        )
        or 0
    )


def add_photo(session: Session, property_id: int, photo: CleanPhoto) -> SitePhoto:
    """Store a cleaned photo at the end (409 when the property has 8)."""
    count = photo_count(session, property_id)
    if count >= MAX_PHOTOS:
        raise PhotoError(409, "too_many_photos", "You can add up to 8 photos. Remove one first.")
    row = SitePhoto(
        property_id=property_id,
        position=count,
        content_type="image/jpeg",
        width=photo.width,
        height=photo.height,
        size_bytes=len(photo.data),
        sha256=photo.sha256,
        data=photo.data,
    )
    session.add(row)
    session.flush()
    return row


def find_photo(session: Session, property_id: int, photo_id: int) -> SitePhoto | None:
    """One of this property's photos (None for another property's)."""
    row = session.get(SitePhoto, photo_id)
    return row if row is not None and row.property_id == property_id else None


def _renumber(rows: list[SitePhoto]) -> None:
    for position, row in enumerate(rows):
        row.position = position


def delete_photo(session: Session, property_id: int, photo_id: int) -> bool:
    """Remove a photo and close the gap. False when it is not this property's."""
    row = find_photo(session, property_id, photo_id)
    if row is None:
        return False
    session.execute(delete(SitePhotoVariant).where(SitePhotoVariant.photo_id == row.id))
    session.delete(row)
    session.flush()
    _renumber(list_photos(session, property_id))
    return True


def reorder_photos(session: Session, property_id: int, ids: list[int]) -> bool:
    """Put photos in the given order. False unless `ids` is exactly the set
    of this property's photos, each once."""
    rows = {row.id: row for row in list_photos(session, property_id)}
    if len(ids) != len(set(ids)) or set(ids) != set(rows):
        return False
    _renumber([rows[i] for i in ids])
    return True


def variant_width(photo_width: int, w: int) -> int:
    """The pixel width a `w` copy really has: never wider than the photo."""
    return min(w, photo_width)


def variant_widths(photo_width: int) -> list[int]:
    """The `w` values worth asking for: each gives a different real width
    (a 600 px photo has 480 and 768, and 768 is 600 px wide)."""
    out: list[int] = []
    seen: set[int] = set()
    for w in VARIANT_WIDTHS:
        real = variant_width(photo_width, w)
        if real not in seen:
            seen.add(real)
            out.append(w)
    return out


def make_variant(photo: SitePhoto, w: int, fmt: str) -> tuple[bytes, int, int]:
    """Re-encode the stored JPEG at `w` px wide (never upscaled) in `fmt`.
    Built from raw pixels, so no metadata is carried over."""
    with Image.open(BytesIO(photo.data), formats=("JPEG",)) as src:
        src.load()
        width = variant_width(src.width, w)
        height = max(1, round(src.height * width / src.width))
        pixels = src.convert("RGB")
        if (width, height) != pixels.size:
            pixels = pixels.resize((width, height), Image.Resampling.LANCZOS)
    clean = Image.frombytes("RGB", pixels.size, pixels.tobytes())
    buffer = BytesIO()
    clean.save(buffer, **VARIANT_SAVE[fmt])
    return buffer.getvalue(), width, height


def photo_variant(session: Session, photo: SitePhoto, w: int, fmt: str) -> SitePhotoVariant:
    """The cached copy, made and stored on first request (or when the photo's
    bytes changed since). A concurrent first request may store it first."""
    query = select(SitePhotoVariant).where(
        SitePhotoVariant.photo_id == photo.id,
        SitePhotoVariant.w == w,
        SitePhotoVariant.fmt == fmt,
    )
    row = session.scalar(query)
    if row is not None and row.source_sha256 == photo.sha256:
        return row
    data, width, height = make_variant(photo, w, fmt)
    fields = {"width": width, "height": height, "source_sha256": photo.sha256,
              "sha256": hashlib.sha256(data).hexdigest(), "data": data}  # fmt: skip
    if row is None:
        try:
            with session.begin_nested():
                row = SitePhotoVariant(photo_id=photo.id, w=w, fmt=fmt, **fields)
                session.add(row)
            return row
        except IntegrityError:  # another request stored it first
            row = session.scalars(query).one()
    for key, value in fields.items():
        setattr(row, key, value)
    session.flush()
    return row
