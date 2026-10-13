"""The card page (a guest who scanned the hotel's printed card) and the
owner's private notes. See app.services.card_page.

Public, rate limited per client: POST /public/site/{slug}/card/verify,
/card/rate and /card/feedback. Owner: GET /site/feedback and
PATCH /site/feedback/{id} ({read} only).
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.models import SiteFeedback
from app.ratelimit import rate_limited
from app.routers.auth import NowDep
from app.routers.public_site import find_site
from app.services import card_page as card
from app.services.consent import as_utc
from app.services.desk import business_date

router = APIRouter(tags=["card page"])

# A guest types a reference once or twice; a script guessing references is
# slowed per client and per client per hotel.
VERIFY_LIMITS = [
    Depends(rate_limited("card_verify")),
    Depends(rate_limited("card_verify_hotel", per="slug")),
]
RATE_LIMIT = Depends(rate_limited("card_rate"))
FEEDBACK_LIMIT = Depends(rate_limited("card_feedback"))


class FeedbackOut(BaseModel):
    """One private note, for the owner."""

    id: int
    message: str
    created_at: datetime
    read: bool


class ReadIn(BaseModel):
    """Mark a note read or unread. Nothing else can be changed."""

    model_config = ConfigDict(extra="forbid")

    read: bool


@router.post(
    "/public/site/{slug}/card/verify",
    response_model=card.VerifyOut,
    response_model_exclude_unset=True,
    dependencies=VERIFY_LIMITS,
)
def verify_stay(slug: str, body: card.VerifyIn, session: SessionDep, now: NowDep) -> card.VerifyOut:
    """verified (with a 30-minute stay token), needs_phone, not_found,
    not_ended or already_rated. `perk_code` is null when there is none."""
    prop, _ = find_site(session, slug, now)
    today = business_date(session, prop.id, now.date())
    return card.verify(session, prop.id, body, today, now)


@router.post("/public/site/{slug}/card/rate", status_code=204, dependencies=[RATE_LIMIT])
def rate_stay(slug: str, body: card.CardRatingIn, session: SessionDep, now: NowDep) -> Response:
    """204 once; 409 already_rated; 400 for an unknown or expired token."""
    prop, _ = find_site(session, slug, now)
    result = card.rate(session, prop.id, body, now)
    if result == "invalid":
        raise ApiError(400, "invalid_stay_token", "Please enter your booking reference again.")
    if result == "already_rated":
        raise ApiError(409, "already_rated", "This stay has already been rated. Thank you.")
    return Response(status_code=204)


@router.post("/public/site/{slug}/card/feedback", status_code=204, dependencies=[FEEDBACK_LIMIT])
def leave_feedback(slug: str, body: card.FeedbackIn, session: SessionDep, now: NowDep) -> Response:
    """Store a private note for the owner: never public, never counted."""
    prop, _ = find_site(session, slug, now)
    card.add_feedback(session, prop.id, body.message, now)
    return Response(status_code=204)


def feedback_out(row: SiteFeedback) -> FeedbackOut:
    """A note for the owner's list."""
    return FeedbackOut(id=row.id, message=row.message, created_at=as_utc(row.created_at),
                       read=row.read_at is not None)  # fmt: skip


@router.get("/site/feedback", response_model=list[FeedbackOut])
def list_feedback(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> list[FeedbackOut]:
    """Every private note, newest first."""
    return [feedback_out(r) for r in card.feedback_list(session, prop.id)]


@router.patch("/site/feedback/{feedback_id}", response_model=FeedbackOut)
def read_feedback(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    feedback_id: int,
    body: ReadIn,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    now: NowDep,
) -> FeedbackOut:
    """Mark a note read or unread."""
    row = card.mark_read(session, prop.id, feedback_id, body.read, now)
    if row is None:
        raise ApiError(404, "no_such_feedback", "No note with that id")
    return feedback_out(row)
