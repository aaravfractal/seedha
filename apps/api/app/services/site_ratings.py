"""Verified-guest ratings for the hotel mini-site.

Only a guest who booked direct on Seedha Link or checked out at the Desk gets
a rating link, made when that happens: one random token per direct booking or
Desk checkout, stored only as its SHA-256. The raw token is returned once, for
the confirmation screen or the checkout response; nothing is sent by message.

A link opens only once the stay is over: from check-in + nights of the
direct booking (Link), or at once for a Desk checkout. A cancelled booking
never opens. Before that the page says when it opens.

A token rates once: 1 to 5 stars and an optional plain-text comment of up to
200 characters (the same text rules as the site facts). The owner can hide a
comment but never change the stars, and hidden comments are never public.
The public summary shows an average only from 3 ratings up; below that the
site says the hotel has no ratings yet. Nothing here is invented: the sample
hotel starts with 2 sample ratings (seed/guest_feedback.py), below 3.

The card page (app.services.card_page) adds a third source, 'card': a guest
who verifies a stay with its booking reference gets a 30-minute token in a
'card' row. Every source shares one rule: one given rating per stay.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Booking, DirectBooking, SiteRating
from app.services.site_details import Flat, PlainText

RatingSource = Literal["link", "desk", "card"]
RatingState = Literal["open", "used", "not_yet", "invalid"]
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
    session: Session,
    property_id: int,
    source: RatingSource,
    source_ref: int,
    now: datetime,
    opens_on: date,
) -> str | None:
    """A new one-time rating token for this direct booking or Desk checkout,
    usable from `opens_on`, or None when one was already issued (the raw
    token is never kept)."""
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
                           source_ref=source_ref, created_at=now, opens_on=opens_on)
            )  # fmt: skip
    except IntegrityError:  # issued at the same moment by another request
        return None
    return token


def stay_end(check_in: date, nights: int) -> date:
    """The day a stay ends (checkout day): check-in + nights."""
    return check_in + timedelta(days=nights)


def guest_link_base(settings: Settings) -> str:
    """The base for rating links: PUBLIC_BASE_URL (as for card QR codes), else
    the web origin, where the /rate page lives."""
    return settings.public_base_url or settings.web_origin


def rating_url(base_url: str, token: str | None) -> str | None:
    """<PUBLIC_BASE_URL>/rate/<token>, or None without a token."""
    return f"{base_url.rstrip('/')}/rate/{token}" if token else None


def rated_booking(session: Session, row: SiteRating) -> Booking | None:
    """The booking a rating link was issued for (via the direct booking for Link)."""
    if row.source in ("desk", "card"):
        return session.get(Booking, row.source_ref)
    direct = session.get(DirectBooking, row.source_ref)
    return direct.booking if direct is not None else None


def stay_rated(session: Session, booking_id: int) -> bool:
    """Whether this stay already has a given rating from any source (Link via
    its direct booking, Desk or card page): one rating per stay."""
    directs = select(DirectBooking.id).where(DirectBooking.booking_id == booking_id)
    found = session.scalar(
        select(SiteRating.id)
        .where(
            SiteRating.stars.is_not(None),
            (SiteRating.source.in_(("desk", "card")) & (SiteRating.source_ref == booking_id))
            | ((SiteRating.source == "link") & SiteRating.source_ref.in_(directs)),
        )
        .limit(1)
    )
    return found is not None


def rating_state(session: Session, row: SiteRating, today: date) -> RatingState:
    """used (also when the stay was rated another way), open, not_yet (before
    `opens_on`), or invalid when the booking is gone, cancelled or not a stay
    (such a link never opens)."""
    if row.used_at is not None:
        return "used"
    booking = rated_booking(session, row)
    if booking is None or booking.status != "stay":
        return "invalid"
    if stay_rated(session, booking.id):
        return "used"
    return "not_yet" if today < row.opens_on else "open"


def find_token(session: Session, token: str, *, card: bool = False) -> SiteRating | None:
    """The rating row for a raw token, or None. A card-page token is found
    only with `card` (it never works as a /rate link, and the reverse)."""
    if not token or len(token) > MAX_TOKEN_LENGTH:
        return None
    row = session.scalar(select(SiteRating).where(SiteRating.token_hash == token_hash(token)))
    return row if row is not None and (row.source == "card") == card else None


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


def erase_guest_comments(session: Session, guest_id: int) -> None:
    """Guest erasure: blank the comments of ratings for this guest's bookings
    (Desk, card page) or direct bookings (Link). The stars stay; no text remains."""
    bookings = select(Booking.id).where(Booking.guest_id == guest_id)
    directs = select(DirectBooking.id).where(DirectBooking.booking_id.in_(bookings))
    session.execute(
        update(SiteRating)
        .where(
            (SiteRating.source.in_(("desk", "card")) & SiteRating.source_ref.in_(bookings))
            | ((SiteRating.source == "link") & SiteRating.source_ref.in_(directs))
        )
        .values(comment="")
        .execution_options(synchronize_session=False)
    )
