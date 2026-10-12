"""Owner photos for the hotel site: checked by content, resized, re-encoded.

Every upload is opened by Pillow and accepted only if its real format (not the
declared content type) is JPEG, PNG or WebP, or HEIC when the optional
pillow_heif package is installed. The picture is turned upright, converted to
RGB, shrunk to at most 1024 px on the long side and saved as a new JPEG of
about 200 KB built from pixels only, so no EXIF (including GPS), XMP or other
metadata can survive. Bytes live in the database (site_photo), so they
survive redeploys on an ephemeral disk and are covered by database backups.
"""

from __future__ import annotations

import hashlib
import warnings
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, defer

from app.models import SitePhoto

try:  # optional: its binary wheels are GPLv2-labelled, so the owner decides
    from pillow_heif import register_heif_opener  # type: ignore[import-not-found]

    register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:  # pragma: no cover - depends on the environment
    HEIC_SUPPORTED = False

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PHOTOS = 8
MAX_SIDE = 1024
TARGET_BYTES = 200_000
QUALITIES = (85, 80, 75, 70, 65, 60)
MAX_PIXELS = 40_000_000
ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
HEIF_FORMATS = frozenset({"HEIF", "HEIC"})
HEIC_BRANDS = frozenset({b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1"})
HEIC_MESSAGE = "HEIC photos are not supported yet. Please upload JPEG, PNG or WebP."
TYPE_MESSAGE = "Please upload a JPEG, PNG or WebP photo."

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


def is_heic(data: bytes) -> bool:
    """True for an ISO base media file with a HEIC/HEIF brand (by content)."""
    return data[4:8] == b"ftyp" and data[8:12] in HEIC_BRANDS


def _open(data: bytes) -> Image.Image:
    """Open and fully decode, refusing decompression bombs and unknown formats."""
    if is_heic(data) and not HEIC_SUPPORTED:
        raise PhotoError(415, "heic_not_supported", HEIC_MESSAGE)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            img = Image.open(BytesIO(data))
            fmt = (img.format or "").upper()
            if fmt not in ALLOWED_FORMATS and not (HEIC_SUPPORTED and fmt in HEIF_FORMATS):
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
