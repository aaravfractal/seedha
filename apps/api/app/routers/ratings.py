"""Verified-guest ratings (hotel mini-site): the guest's one-time rating page
and the owner's list with hide or show for comments.

Public: GET and POST /public/rate/{token}. The token is the guest's proof of
a Seedha Link direct booking or a Desk checkout; it rates once, and only
from `opens_on` (the stay is over), on the hotel's business date. Owner:
GET /site/ratings and PATCH /site/ratings/{id} ({hidden} only: the stars a
guest gave can never be changed). See app.services.site_ratings.
"""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.models import Property, SiteRating
from app.ratelimit import rate_limited
from app.services.desk import business_date, utc_now
from app.services.site import get_config, slugify
from app.services.site_ratings import (
    RatingIn,
    RatingState,
    find_token,
    rating_state,
    set_hidden,
    use_token,
    used_ratings,
)
from app.services.slug import current_slug

# One router for both halves (public /public/rate, owner /site/ratings).
router = APIRouter(tags=["ratings"])

# A guest opens the page and submits once; a script guessing tokens is slowed.
RATE_LIMIT = Depends(rate_limited("rate"))


class RatePageOut(BaseModel):
    """What the rating page needs. `hotel` and `slug` are empty when invalid;
    `opens_on` (the day the stay ends) only when the state is not_yet."""

    hotel: str
    slug: str
    state: RatingState
    opens_on: date | None = None


class OwnerRatingOut(BaseModel):
    """One given rating, for the owner. `created_at` is when the guest rated."""

    id: int
    stars: int
    comment: str
    hidden: bool
    created_at: datetime
    source: str


class HiddenIn(BaseModel):
    """Hide or show a comment. Nothing else can be changed."""

    model_config = ConfigDict(extra="forbid")

    hidden: bool


def hotel_slug(session: SessionDep, prop: Property) -> str:
    """The hotel site's current address slug."""
    return current_slug(prop, get_config(session, prop.id)) or slugify(prop.short_name)


@router.get("/public/rate/{token}", response_model=RatePageOut, dependencies=[RATE_LIMIT])
def rate_page(token: str, session: SessionDep) -> RatePageOut:
    """The hotel's name and whether this link can still rate."""
    row = find_token(session, token)
    if row is None:
        return RatePageOut(hotel="", slug="", state="invalid")
    prop = session.get(Property, row.property_id)
    if prop is None:
        return RatePageOut(hotel="", slug="", state="invalid")
    state = rating_state(session, row, business_date(session, prop.id, utc_now().date()))
    if state == "invalid":
        return RatePageOut(hotel="", slug="", state="invalid")
    return RatePageOut(
        hotel=prop.short_name,
        slug=hotel_slug(session, prop),
        state=state,
        opens_on=row.opens_on if state == "not_yet" else None,
    )


@router.post("/public/rate/{token}", status_code=204, dependencies=[RATE_LIMIT])
def rate(token: str, body: RatingIn, session: SessionDep) -> Response:
    """Record the rating once: 204, then 409 for any later try; 409 before the
    stay is over; 404 for an unknown link or a cancelled booking."""
    row = find_token(session, token)
    state = (
        rating_state(session, row, business_date(session, row.property_id, utc_now().date()))
        if row is not None
        else "invalid"
    )
    if row is None or state == "invalid":
        raise ApiError(404, "no_such_rating_link", "This rating link is not valid")
    if state == "not_yet":
        raise ApiError(409, "not_open_yet", "You can rate your stay once it is over.")
    if not use_token(session, row, body, utc_now()):
        raise ApiError(409, "already_rated", "This stay has already been rated. Thank you.")
    return Response(status_code=204)


def owner_rating(row: SiteRating) -> OwnerRatingOut:
    """A given rating for the owner's list."""
    return OwnerRatingOut(id=row.id, stars=row.stars or 0, comment=row.comment, hidden=row.hidden,
                          created_at=row.used_at or row.created_at, source=row.source)  # fmt: skip


@router.get("/site/ratings", response_model=list[OwnerRatingOut])
def list_ratings(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> list[OwnerRatingOut]:
    """Every rating guests have given, newest first, hidden comments included."""
    return [owner_rating(r) for r in used_ratings(session, prop.id)]


@router.patch("/site/ratings/{rating_id}", response_model=OwnerRatingOut)
def hide_rating(
    rating_id: int, body: HiddenIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> OwnerRatingOut:
    """Hide or show a rating's comment. The stars still count either way."""
    row = set_hidden(session, prop.id, rating_id, hidden=body.hidden)
    if row is None:
        raise ApiError(404, "no_such_rating", "No rating with that id")
    return owner_rating(row)
