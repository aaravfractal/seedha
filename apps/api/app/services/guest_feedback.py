"""Guest feedback from the card-page form (docs/CARD_PAGE.md, D-106).

A guest leaves a name, an overall rating (and food, a review), picks one of
the rewards the owner offers, and may tick (never pre-ticked) "Send my reward
code on WhatsApp. Reply STOP any time." A booking reference (plus the last 4
digits of the Desk number when one is on file, as on the card page) makes the
feedback verified: that stay's stars become its one public 'card' rating.

Rule 4 extended (D-106): this form is the second consent path. The number is
stored only with the tick, normalised, never shown publicly, and only after
the owner approves a reward is anything sent, always with the STOP line
(simulated without WhatsApp keys). STOP from the number withdraws it, and
/data-deletion blanks the name, number and review.

Unverified feedback stays private; its reward can only be Free breakfast
(when offered). Discounts (5% or Rs 100 off one direct booking within 12
months) are for verified stays only.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Booking, GuestFeedback, PerkCode, Property, SiteConfig, SiteRating
from app.services.card_page import BookingRef, last4, match_stay
from app.services.consent import as_utc, normalise_mobile
from app.services.drafter import STOP_LINE
from app.services.messages import perk_link
from app.services.perks import MAX_ATTEMPTS, code_stem, random_part
from app.services.site_details import Flat, Name, PlainText
from app.services.site_ratings import TOKEN_BYTES, stay_end, stay_rated, token_hash
from app.services.whatsapp import Sender

Reward = Literal["breakfast", "pct5", "flat100", "none"]
RewardId = Literal["breakfast", "pct5", "flat100"]
REWARD_IDS: tuple[RewardId, ...] = ("breakfast", "pct5", "flat100")
DISCOUNTS = frozenset({"pct5", "flat100"})
REWARD_LABELS: dict[str, tuple[str, str]] = {
    "breakfast": ("Free breakfast", "मुफ़्त नाश्ता"),
    "pct5": ("5% off your next direct stay", "अगले डायरेक्ट स्टे पर 5% की छूट"),
    "flat100": ("₹100 off your next direct stay", "अगले डायरेक्ट स्टे पर ₹100 की छूट"),
}
WORDING_VERSION = "card-2026-10"
MAX_PUBLIC_COMMENT = 200

WhatsApp = Annotated[str, Field(min_length=10, max_length=16, pattern=r"^[0-9+ ]+$")]
Review = Annotated[str, Field(max_length=500), Flat, PlainText]


class FeedbackError(ValueError):
    """A feedback problem with an HTTP status and a plain message."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class FeedbackIn(BaseModel):
    """The card-page form. Nothing else about the visitor is accepted."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Name
    whatsapp: WhatsApp | None = None
    booking_ref: BookingRef | None = None
    phone_last4: Annotated[str, Field(pattern=r"^[0-9]{4}$")] | None = None
    overall: int = Field(ge=1, le=5)
    food: int | None = Field(default=None, ge=1, le=5)
    review: Review = ""
    reward: Reward
    consent: StrictBool = False

    @field_validator("whatsapp")
    @classmethod
    def indian_mobile(cls, value: str | None) -> str | None:
        """'+91 90000 00101' -> '+919000000101' (Indian mobiles only)."""
        return None if value is None else normalise_mobile(value)

    @model_validator(mode="after")
    def number_with_consent(self) -> FeedbackIn:
        """The tick needs a number to send the code to."""
        if self.consent and self.whatsapp is None:
            raise ValueError("Enter your WhatsApp number to get the code on WhatsApp.")
        return self


class FeedbackSaved(BaseModel):
    """What the guest sees after sending."""

    verified: bool
    reward: Reward
    state: Literal["saved"] = "saved"


class RewardSettings(BaseModel):
    """Which rewards the hotel offers on its card page."""

    model_config = ConfigDict(extra="forbid")

    breakfast: StrictBool
    pct5: StrictBool
    flat100: StrictBool


class RewardOption(BaseModel):
    """One offered reward, labelled in English and Hindi."""

    id: RewardId
    en: str
    hi: str


def reward_settings(config: SiteConfig) -> RewardSettings:
    """The hotel's reward switches (Free breakfast on, discounts off by default)."""
    return RewardSettings(
        breakfast=config.reward_breakfast, pct5=config.reward_pct5, flat100=config.reward_flat100
    )


def save_reward_settings(config: SiteConfig, body: RewardSettings) -> RewardSettings:
    """Store the owner's reward switches."""
    config.reward_breakfast, config.reward_pct5, config.reward_flat100 = (
        body.breakfast,
        body.pct5,
        body.flat100,
    )
    return reward_settings(config)


def enabled_rewards(config: SiteConfig) -> list[RewardId]:
    """The offered reward ids, in a fixed order."""
    on = reward_settings(config).model_dump()
    return [r for r in REWARD_IDS if on[r]]


def reward_options(config: SiteConfig) -> list[RewardOption]:
    """The offered rewards for the public site payload."""
    return [
        RewardOption(id=r, en=REWARD_LABELS[r][0], hi=REWARD_LABELS[r][1])
        for r in enabled_rewards(config)
    ]


def granted_reward(chosen: Reward, offered: list[RewardId], verified: bool) -> Reward:
    """The reward a submission gets: the choice when offered (discounts only
    for a verified stay), else Free breakfast when offered, else none."""
    if chosen == "none":
        return "none"
    if chosen in offered and (verified or chosen not in DISCOUNTS):
        return chosen
    return "breakfast" if "breakfast" in offered else "none"


def verified_stay(
    session: Session, property_id: int, body: FeedbackIn, today: date
) -> Booking | None:
    """The ended stay the reference (and phone digits, typed or from the
    WhatsApp number) point at, or None: then the feedback is unverified."""
    if body.booking_ref is None:
        return None
    phone = body.phone_last4 or last4(body.whatsapp)
    stay = match_stay(session, property_id, body.booking_ref, phone).booking
    if stay is None or stay_end(stay.check_in, stay.nights) > today:
        return None
    return stay


def give_rating(session: Session, stay: Booking, stars: int, review: str, now: datetime) -> None:
    """The stay's one public 'card' rating. Its comment is the review when it
    fits a rating comment (200 characters), else stars only. A fresh random
    hash replaces any open card-page token, so that token cannot rate again."""
    comment = review if len(review) <= MAX_PUBLIC_COMMENT else ""
    # A fresh hash that is never handed out: the row is used at once.
    fresh = token_hash(secrets.token_urlsafe(TOKEN_BYTES))
    values = {"token_hash": fresh, "used_at": now, "stars": stars, "comment": comment}
    where = (SiteRating.source == "card") & (SiteRating.source_ref == stay.id)
    if session.scalar(select(SiteRating.id).where(where)) is None:
        session.add(SiteRating(property_id=stay.property_id, source="card", source_ref=stay.id,
                               created_at=now, opens_on=stay_end(stay.check_in, stay.nights),
                               **values))  # fmt: skip
    else:
        session.execute(
            update(SiteRating).where(where).values(**values)
            .execution_options(synchronize_session=False)
        )  # fmt: skip
    session.flush()


def submit(  # noqa: PLR0913  (each argument is a distinct fact)
    session: Session, prop: Property, config: SiteConfig, body: FeedbackIn, today: date,
    now: datetime,
) -> FeedbackSaved:  # fmt: skip
    """Store the feedback; a verified stay also gets its public rating.
    One per stay: a stay already rated (any source) answers already_rated."""
    stay = verified_stay(session, prop.id, body, today)
    taken = stay is not None and (
        stay_rated(session, stay.id)
        or session.scalar(select(GuestFeedback.id).where(GuestFeedback.booking_id == stay.id))
        is not None
    )
    if taken:
        raise FeedbackError(409, "already_rated", "This stay has already been rated. Thank you.")
    reward = granted_reward(body.reward, enabled_rewards(config), stay is not None)
    row = GuestFeedback(
        property_id=prop.id, booking_id=stay.id if stay else None, verified=stay is not None,
        name=body.name, phone=body.whatsapp if body.consent else None,
        consent_at=now if body.consent else None,
        consent_wording_version=WORDING_VERSION if body.consent else None,
        overall=body.overall, food=body.food, review=body.review, reward=reward, status="new",
        created_at=now,
    )  # fmt: skip
    try:
        with session.begin_nested():
            session.add(row)
            session.flush()
            if stay is not None:
                give_rating(session, stay, body.overall, body.review, now)
    except IntegrityError as exc:  # the same stay sent twice at the same moment
        raise FeedbackError(409, "already_rated", "This stay has already been rated.") from exc
    return FeedbackSaved(verified=stay is not None, reward=reward)


# --- owner ---------------------------------------------------------------------------


class GuestFeedbackOut(BaseModel):
    """One feedback for the owner. The number is never shown, only whether
    the guest can be sent the code (consent given, not withdrawn)."""

    id: int
    verified: bool
    booking_ref: str | None
    name: str
    overall: int
    food: int | None
    review: str
    reward: Reward
    reward_label: str | None
    status: Literal["new", "reward_sent", "hidden"]
    read: bool
    can_message: bool
    withdrawn: bool
    perk_code: str | None
    created_at: datetime


class FeedbackPatch(BaseModel):
    """Mark read or unread, hide or show. Nothing else can be changed."""

    model_config = ConfigDict(extra="forbid")

    read: StrictBool | None = None
    hidden: StrictBool | None = None


class RewardSent(BaseModel):
    """The reward code the owner approved, and whether it went on WhatsApp."""

    code: str
    sent: bool
    transport: str | None
    feedback: GuestFeedbackOut


def can_message(row: GuestFeedback) -> bool:
    """Consent given with a number, and no STOP or erasure since."""
    return row.phone is not None and row.consent_at is not None and row.withdrawn_at is None


def feedback_out(row: GuestFeedback) -> GuestFeedbackOut:
    """The owner's view of one feedback."""
    return GuestFeedbackOut(
        id=row.id, verified=row.verified,
        booking_ref=row.booking.external_ref if row.booking else None, name=row.name,
        overall=row.overall, food=row.food, review=row.review,
        reward=row.reward,  # type: ignore[arg-type]
        reward_label=REWARD_LABELS[row.reward][0] if row.reward in REWARD_LABELS else None,
        status=row.status,  # type: ignore[arg-type]
        read=row.read_at is not None, can_message=can_message(row),
        withdrawn=row.withdrawn_at is not None,
        perk_code=row.perk_code.code if row.perk_code else None,
        created_at=as_utc(row.created_at),
    )  # fmt: skip


def feedback_list(session: Session, property_id: int) -> list[GuestFeedback]:
    """The hotel's guest feedback, newest first."""
    return list(
        session.scalars(
            select(GuestFeedback)
            .where(GuestFeedback.property_id == property_id)
            .order_by(GuestFeedback.created_at.desc(), GuestFeedback.id.desc())
        )
    )


def owned(session: Session, property_id: int, feedback_id: int) -> GuestFeedback:
    """This hotel's feedback, or 404."""
    row = session.get(GuestFeedback, feedback_id)
    if row is None or row.property_id != property_id:
        raise FeedbackError(404, "no_such_feedback", "No feedback with that id")
    return row


def patch(row: GuestFeedback, body: FeedbackPatch, now: datetime) -> GuestFeedback:
    """Read flag and hidden state. Showing again restores new or reward_sent."""
    if body.read is not None:
        row.read_at = (row.read_at or now) if body.read else None
    if body.hidden is not None:
        visible = "reward_sent" if row.perk_code_id is not None else "new"
        row.status = "hidden" if body.hidden else visible
    return row


def issue_reward_code(
    session: Session, prop: Property, row: GuestFeedback, now: datetime
) -> PerkCode:
    """A new one-time perk code for this feedback's reward (never reused)."""
    stay = row.booking
    stem = code_stem(prop.code_prefix, row.name or "guest", now.year)
    for _ in range(MAX_ATTEMPTS):
        code = f"{stem}-{random_part()}"
        if session.scalar(select(PerkCode.id).where(PerkCode.code == code)) is None:
            perk = PerkCode(code=code, guest_id=stay.guest_id if stay else None,
                            origin_booking_id=stay.id if stay else None,
                            perk=REWARD_LABELS[row.reward][0], created_at=now)  # fmt: skip
            session.add(perk)
            session.flush()
            return perk
    raise RuntimeError("Could not find an unused perk code")  # pragma: no cover


def reward_message(row: GuestFeedback, perk: PerkCode, link: str) -> str:
    """The WhatsApp text: thanks, the reward, the code, the link and STOP."""
    first = row.name.split()[0] if row.name.split() else "there"
    use = (
        "Use it once on a direct booking within 12 months"
        if row.reward in DISCOUNTS
        else "Use it on your next direct booking"
    )
    return (
        f"Thank you for your feedback, {first}. Your reward: {perk.perk}. Code {perk.code}. "
        f"{use}: {link} {STOP_LINE}"
    )


@dataclass(frozen=True, slots=True)
class Delivery:
    """The approved code and how it went out (transport None: not sent)."""

    code: str
    transport: str | None


def send_reward(  # noqa: PLR0913  (each argument is a distinct fact)
    session: Session, prop: Property, row: GuestFeedback, sender: Sender, web_origin: str,
    now: datetime,
) -> Delivery:  # fmt: skip
    """Owner approval (rule 7): one code per feedback. Sent on WhatsApp only
    with consent and no STOP; otherwise the owner hands the code over."""
    if row.reward == "none":
        raise FeedbackError(409, "no_reward", "This guest did not choose a reward.")
    if row.perk_code_id is not None:
        raise FeedbackError(409, "already_sent", "A reward code was already made for this guest.")
    if row.reward in DISCOUNTS and not row.verified:  # pragma: no cover  (refused at submit)
        raise FeedbackError(409, "not_verified", "Discounts are only for verified stays.")
    perk = issue_reward_code(session, prop, row, now)
    row.perk_code_id = perk.id
    row.status = "reward_sent" if row.status != "hidden" else row.status
    row.read_at = row.read_at or now
    if not can_message(row) or row.phone is None:
        return Delivery(perk.code, None)
    result = sender.send(row.phone, reward_message(row, perk, perk_link(web_origin, perk.code)),
                         row.id)  # fmt: skip
    if not result.ok:
        raise FeedbackError(502, "send_failed", result.error or "Sending failed. Try again.")
    return Delivery(perk.code, result.transport)


# --- STOP, erasure, Needs you --------------------------------------------------------


def withdraw_number(session: Session, number: str, now: datetime) -> int:
    """STOP from this number: no more reward messages to it."""
    result = session.execute(
        update(GuestFeedback)
        .where(GuestFeedback.phone == number, GuestFeedback.withdrawn_at.is_(None))
        .values(withdrawn_at=now)
        .execution_options(synchronize_session=False)
    )
    return int(getattr(result, "rowcount", 0) or 0)


def erase_values(now: datetime) -> dict[str, object]:
    """What erasure leaves of a feedback: stars and reward, no name, number or words."""
    return {"name": "", "phone": None, "review": "",
            "withdrawn_at": func.coalesce(GuestFeedback.withdrawn_at, now)}  # fmt: skip


def erase(session: Session, number: str, now: datetime) -> int:
    """Data deletion: blank the feedback sent with this number."""
    result = session.execute(
        update(GuestFeedback)
        .where(GuestFeedback.phone == number)
        .values(**erase_values(now))
        .execution_options(synchronize_session=False)
    )
    return int(getattr(result, "rowcount", 0) or 0)


def unread_count(session: Session, property_id: int) -> tuple[int, datetime | None]:
    """How many feedbacks are new and unread, and when the newest came."""
    count, latest = session.execute(
        select(func.count(GuestFeedback.id), func.max(GuestFeedback.created_at)).where(
            GuestFeedback.property_id == property_id,
            GuestFeedback.read_at.is_(None),
            GuestFeedback.status == "new",
        )
    ).one()
    return int(count or 0), latest
