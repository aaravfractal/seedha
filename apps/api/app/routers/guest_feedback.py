"""Card-page guest feedback (D-106). See app.services.guest_feedback.

Public, rate limited per client and per client per hotel:
POST /public/site/{slug}/feedback. Owner: GET/PUT /settings/rewards,
GET /site/guest-feedback, PATCH /site/guest-feedback/{id} and
POST /site/guest-feedback/{id}/send-reward (owner approval, rule 7).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.ratelimit import rate_limited
from app.routers.auth import NowDep
from app.routers.messages import SenderDep
from app.routers.public_site import find_site
from app.services import guest_feedback as fb
from app.services.desk import business_date
from app.services.site import get_config

router = APIRouter(tags=["guest feedback"])

FEEDBACK_LIMITS = [
    Depends(rate_limited("guest_feedback")),
    Depends(rate_limited("guest_feedback_hotel", per="slug")),
]


def api_error(exc: fb.FeedbackError) -> ApiError:
    """The service problem as an API error."""
    return ApiError(exc.status, exc.code, exc.message)


@router.post(
    "/public/site/{slug}/feedback", response_model=fb.FeedbackSaved, dependencies=FEEDBACK_LIMITS
)
def leave_feedback(
    slug: str, body: fb.FeedbackIn, session: SessionDep, now: NowDep
) -> fb.FeedbackSaved:
    """Save the form. 409 already_rated when the stay already has a rating."""
    prop, _ = find_site(session, slug, now)
    today = business_date(session, prop.id, now.date())
    try:
        return fb.submit(session, prop, get_config(session, prop.id), body, today, now)
    except fb.FeedbackError as exc:
        raise api_error(exc) from exc


@router.get("/settings/rewards", response_model=fb.RewardSettings)
def get_rewards(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> fb.RewardSettings:
    """Which rewards the card page offers."""
    return fb.reward_settings(get_config(session, prop.id))


@router.put("/settings/rewards", response_model=fb.RewardSettings)
def put_rewards(
    body: fb.RewardSettings, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> fb.RewardSettings:
    """Turn rewards on or off. Check OTA contracts before offering discounts."""
    return fb.save_reward_settings(get_config(session, prop.id), body)


@router.get("/site/guest-feedback", response_model=list[fb.GuestFeedbackOut])
def list_feedback(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> list[fb.GuestFeedbackOut]:
    """Every guest feedback, newest first."""
    return [fb.feedback_out(r) for r in fb.feedback_list(session, prop.id)]


@router.patch("/site/guest-feedback/{feedback_id}", response_model=fb.GuestFeedbackOut)
def patch_feedback(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    feedback_id: int,
    body: fb.FeedbackPatch,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    now: NowDep,
) -> fb.GuestFeedbackOut:
    """Mark read or unread, hide or show."""
    try:
        row = fb.owned(session, prop.id, feedback_id)
    except fb.FeedbackError as exc:
        raise api_error(exc) from exc
    fb.patch(row, body, now)
    session.flush()
    return fb.feedback_out(row)


@router.post("/site/guest-feedback/{feedback_id}/send-reward", response_model=fb.RewardSent)
def send_reward(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    feedback_id: int,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    sender: SenderDep,
    now: NowDep,
) -> fb.RewardSent:
    """Owner approves the reward: a one-time code, sent on WhatsApp (simulated
    without keys) only with consent and no STOP."""
    try:
        row = fb.owned(session, prop.id, feedback_id)
        done = fb.send_reward(session, prop, row, sender, settings.web_origin, now)
    except fb.FeedbackError as exc:
        raise api_error(exc) from exc
    session.flush()
    return fb.RewardSent(code=done.code, sent=done.transport is not None,
                         transport=done.transport, feedback=fb.feedback_out(row))  # fmt: skip
