"""Verified-guest ratings for the hotel mini-site.

Only a guest who booked direct on Seedha Link or checked out at the Desk gets
a rating link, made when that happens: one random token per direct booking or
Desk checkout, stored only as its SHA-256. The raw token is returned once, for
the confirmation screen or the checkout response; nothing is sent by message.

A token rates once: 1 to 5 stars and an optional plain-text comment of up to
200 characters (the same text rules as the site facts). The owner can hide a
comment but never change the stars, and hidden comments are never public.
The public summary shows an average only from 3 ratings up; below that the
site says the hotel has no ratings yet. Nothing here is invented: the sample
hotel starts with zero ratings and a demo reset restores zero.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import SiteRating
from app.services.site_details import Flat, PlainText

RatingSource = Literal["link", "desk"]
MIN_PUBLIC_COUNT = 3
MAX_PUBLIC_COMMENTS = 12
TOKEN_BYTES = 24
MAX_TOKEN_LENGTH = 64

Comment = Annotated[str, Field(max_length=200), Flat, PlainText]


class RatingIn(BaseModel):
    """A guest's rating: stars and an optional comment. Nothing else."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    stars: int = Field(ge=1, le=5)
    comment: Comment = ""


class RatingComment(BaseModel):
    """A visible comment on the public site, with its month (YYYY-MM)."""

    stars: int
    comment: str
    month: str


class RatingsSummary(BaseModel):
    """The public summary. `average` (one decimal) and `comments` only when
    `count` is at least 3; hidden comments never appear, their stars count."""

    count: int = 0
    average: float | None = None
    comments: list[RatingComment] = Field(default_factory=list)


def token_hash(token: str) -> str:
    """The stored form of a rating token."""
    return hashlib.sha256(token.encode()).hexdigest()


def issue_token(
    session: Session, property_id: int, source: RatingSource, source_ref: int, now: datetime
) -> str | None:
    """A new one-time rating token for this direct booking or Desk checkout,
    or None when one was already issued (the raw token is never kept)."""
    existing = session.scalar(
        select(SiteRating.id).where(
            SiteRating.source == source, SiteRating.source_ref == source_ref
        )
    )
    if existing is not None:
        return None
    token = secrets.token_urlsafe(TOKEN_BYTES)
    try:
        with session.begin_nested():
            session.add(
                SiteRating(property_id=property_id, token_hash=token_hash(token), source=source,
                           source_ref=source_ref, created_at=now)
            )  # fmt: skip
    except IntegrityError:  # issued at the same moment by another request
        return None
    return token


def rating_url(base_url: str, token: str | None) -> str | None:
    """<PUBLIC_BASE_URL>/rate/<token>, or None without a token."""
    return f"{base_url.rstrip('/')}/rate/{token}" if token else None


def find_token(session: Session, token: str) -> SiteRating | None:
    """The rating row for a raw token, or None."""
    if not token or len(token) > MAX_TOKEN_LENGTH:
        return None
    return session.scalar(select(SiteRating).where(SiteRating.token_hash == token_hash(token)))


def use_token(session: Session, row: SiteRating, rating: RatingIn, now: datetime) -> bool:
    """Record the rating once. False when the token was already used (also
    when two submissions race: only one update matches `used_at IS NULL`)."""
    result = session.execute(
        update(SiteRating)
        .where(SiteRating.id == row.id, SiteRating.used_at.is_(None))
        .values(used_at=now, stars=rating.stars, comment=rating.comment)
        .execution_options(synchronize_session=False)
    )
    session.expire(row)
    return bool(getattr(result, "rowcount", 0))


def used_ratings(session: Session, property_id: int) -> list[SiteRating]:
    """The hotel's ratings that guests have given, newest first."""
    return list(
        session.scalars(
            select(SiteRating)
            .where(SiteRating.property_id == property_id, SiteRating.stars.is_not(None))
            .order_by(SiteRating.used_at.desc(), SiteRating.id.desc())
        )
    )


def one_decimal_average(stars: list[int]) -> float:
    """The mean of the stars, rounded half up to one decimal (integer maths)."""
    tenths = (sum(stars) * 20 + len(stars)) // (2 * len(stars))
    return tenths / 10


def summary(session: Session, property_id: int) -> RatingsSummary:
    """The public summary for the hotel site."""
    rows = used_ratings(session, property_id)
    stars = [r.stars for r in rows if r.stars is not None]
    if len(stars) < MIN_PUBLIC_COUNT:
        return RatingsSummary(count=len(stars))
    comments = [
        RatingComment(stars=r.stars, comment=r.comment, month=r.used_at.strftime("%Y-%m"))
        for r in rows
        if r.comment and not r.hidden and r.stars is not None and r.used_at is not None
    ][:MAX_PUBLIC_COMMENTS]
    return RatingsSummary(count=len(stars), average=one_decimal_average(stars), comments=comments)


def set_hidden(
    session: Session, property_id: int, rating_id: int, hidden: bool
) -> SiteRating | None:
    """Hide or show a rating's comment. Stars are never changed. None when
    the rating is not this hotel's or has not been given yet."""
    row = session.get(SiteRating, rating_id)
    if row is None or row.property_id != property_id or row.stars is None:
        return None
    row.hidden = hidden
    session.flush()
    return row
