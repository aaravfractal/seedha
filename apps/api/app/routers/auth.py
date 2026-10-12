"""Owner sign in (WhatsApp OTP), sign up, Direct beta login, /me and onboarding.

Only the web server calls these routes: every one needs the server-side
OWNER_API_TOKEN, so a browser can never reach them directly. The web app
holds the signed session cookie and tells the API who is signed in with the
`X-Seedha-Subject` header ("demo" or "a<account id>"), which the API trusts
only together with that token.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import OwnerAccount, Property
from app.ratelimit import GLOBAL_FACTOR, Limit, RateLimiter
from app.services.auth import (
    CONTRACT_KEYS,
    AuthError,
    OnboardingUpdate,
    SentCode,
    account_for_phone,
    account_onboarding,
    check_code,
    mask_phone,
    normalise_phone,
    sample_onboarding,
    save_onboarding,
    send_code,
    sign_up,
)
from app.services.desk import utc_now

router = APIRouter(tags=["auth"])

# Per client address, on top of the per-number rules (resend 30 s, 5 tries).
AUTH_LIMITS: dict[str, Limit] = {
    "otp_send": Limit(6, 60),
    "otp_verify": Limit(10, 60),
    "auth_demo": Limit(30, 60),
}
# Codes per WhatsApp number, whoever asks (security review S7): stops anyone
# pumping codes at a number. 5 an hour.
PER_NUMBER_SENDS = Limit(5, 60 * 60)
DEMO_SUBJECT = "demo"
MAX_PERCENT = 50
MAX_COST_RUPEES = 100_000


def get_now(request: Request) -> datetime:
    """Current UTC time; tests set app.state.clock to move time."""
    clock: Callable[[], datetime] | None = getattr(request.app.state, "clock", None)
    return clock() if clock is not None else utc_now()


NowDep = Annotated[datetime, Depends(get_now)]


def demo_codes(settings: Settings, session: Session) -> bool:
    """Show sign-in codes on screen only for the sample hotel (SEEDHA_DEMO=1),
    never in production."""
    if not settings.seedha_demo or settings.production:
        return False
    prop = session.scalar(select(Property).order_by(Property.id).limit(1))
    return prop is None or prop.is_sample


def number_cap(request: Request, raw_phone: str) -> None:
    """429 when this number has had too many codes this hour."""
    try:
        phone = normalise_phone(raw_phone)
    except AuthError:
        return  # the service reports the bad number
    limiter: RateLimiter = request.app.state.rate_limiter
    wait = limiter.check("otp_number", phone, PER_NUMBER_SENDS)
    if wait > 0:
        raise ApiError(
            429,
            "too_many_codes",
            "Too many codes for this number. Try again later.",
            headers={"Retry-After": str(math.ceil(wait))},
        )


def accounts_open(request: Request) -> None:
    """Production (the hosted demo) offers the sample hotel only: OTP sign in
    and sign up are off unless ALLOW_OWNER_ACCOUNTS=1. Direct beta login works."""
    settings: Settings = request.app.state.settings
    if settings.production and not settings.allow_owner_accounts:
        raise ApiError(
            403,
            "accounts_off",
            "This hosted demo uses the sample hotel only. Use Direct beta login.",
        )


def limited(bucket: str) -> Callable[[Request], None]:
    """429 when one client (or every client together) is over the bucket's limit."""
    limit = AUTH_LIMITS[bucket]
    ceiling = Limit(limit.count * GLOBAL_FACTOR, limit.seconds)

    def dependency(request: Request) -> None:
        limiter: RateLimiter = request.app.state.rate_limiter
        client = request.client.host if request.client else "unknown"
        wait = limiter.check(bucket, client, limit) or limiter.check(bucket, "*", ceiling)
        if wait > 0:
            raise ApiError(
                429,
                "too_many_requests",
                "Too many tries. Please wait a minute and try again.",
                headers={"Retry-After": str(math.ceil(wait))},
            )

    return dependency


def as_api_error(exc: AuthError) -> ApiError:
    """Map a service refusal to the shared error shape; extra facts go in headers."""
    headers: dict[str, str] = {}
    if exc.retry_after is not None:
        headers["Retry-After"] = str(exc.retry_after)
    if exc.tries_left is not None:
        headers["X-Tries-Left"] = str(exc.tries_left)
    return ApiError(exc.status, exc.code, exc.message, headers=headers or None)


# --- Who is signed in -----------------------------------------------------------


def get_subject(
    _owner: OwnerDep,
    x_seedha_subject: Annotated[str | None, Header()] = None,
) -> str:
    """The signed-in subject the web server vouches for."""
    subject = (x_seedha_subject or "").strip()
    if subject == DEMO_SUBJECT or (subject.startswith("a") and subject[1:].isdigit()):
        return subject
    raise ApiError(401, "session_ended", "Your session has ended. Sign in again.")


SubjectDep = Annotated[str, Depends(get_subject)]


def account_of(session: SessionDep, subject: str) -> OwnerAccount | None:
    """The account behind a subject (None for the demo)."""
    if subject == DEMO_SUBJECT:
        return None
    account = session.get(OwnerAccount, int(subject[1:]))
    if account is None or account.verified_at is None:
        raise ApiError(401, "session_ended", "Your session has ended. Sign in again.")
    return account


# --- Schemas --------------------------------------------------------------------

Phone = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
Hotel = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Town = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class OtpRequestIn(BaseModel):
    """Ask for a code on WhatsApp."""

    phone: Phone


class OtpSentOut(BaseModel):
    """A code is on its way. `demo_code` is filled only when SEEDHA_DEMO=1."""

    sent: bool
    masked_phone: str
    expires_in: int
    resend_in: int
    tries_left: int
    demo_code: str | None = None


class OtpVerifyIn(BaseModel):
    """The code the owner typed."""

    phone: Phone
    code: Annotated[str, StringConstraints(strip_whitespace=True, max_length=12)]


class AccountOut(BaseModel):
    """Enough for the web server to start a session."""

    subject: str
    name: str
    hotel_name: str
    onboarded: bool


class OtpVerifyOut(BaseModel):
    """`account` is null when the number has no account yet (sign up first)."""

    verified: bool
    account: AccountOut | None


class SignupIn(BaseModel):
    """Three details plus the terms box, which must be ticked."""

    name: Name
    hotel: Hotel
    phone: Phone
    terms: Literal[True]
    updates: bool = False


class DemoOut(BaseModel):
    """Direct beta login into the sample hotel."""

    subject: str
    name: str
    hotel_name: str
    onboarded: bool


class MeOut(BaseModel):
    """Who is signed in and which hotel they see."""

    kind: Literal["demo", "owner"]
    name: str
    hotel_name: str
    masked_phone: str | None
    onboarded: bool
    property_name: str
    property_rooms: int
    property_is_sample: bool


class OkOut(BaseModel):
    """A plain acknowledgement."""

    ok: bool


class ContractsPercent(BaseModel):
    """Commission per channel in percent (two decimals at most)."""

    mmt: Decimal | None = Field(default=None, ge=0, le=MAX_PERCENT, decimal_places=2)
    bcom: Decimal | None = Field(default=None, ge=0, le=MAX_PERCENT, decimal_places=2)
    agoda: Decimal | None = Field(default=None, ge=0, le=MAX_PERCENT, decimal_places=2)
    ta: Decimal | None = Field(default=None, ge=0, le=MAX_PERCENT, decimal_places=2)


class OnboardingIn(BaseModel):
    """Any subset of the four steps."""

    property_name: Hotel | None = None
    town: Town | None = None
    rooms: int | None = Field(default=None, ge=1, le=500)
    contracts: ContractsPercent | None = None
    cost_per_room: int | None = Field(default=None, ge=0, le=MAX_COST_RUPEES)
    clear_cost: bool = False
    connect_whatsapp: bool = False
    finish: bool = False


class OnboardingOut(BaseModel):
    """Saved answers. For the sample hotel nothing is saved (`saved` false)."""

    sample: bool
    saved: bool
    note: str
    property_name: str
    town: str
    rooms: int | None
    contracts: dict[str, float]
    cost_per_room: int | None
    whatsapp_connected: bool
    whatsapp_mode: Literal["simulated"]
    done: bool


SAMPLE_NOTE = (
    "Sample hotel: these steps are shown for the tour. Its contracts and numbers stay as seeded."
)
OWNER_NOTE = "Saved to your account. Your statements decide the numbers you see."


# --- Routes ---------------------------------------------------------------------


def _sent(sent: SentCode, demo: bool) -> OtpSentOut:
    return OtpSentOut(sent=True, masked_phone=mask_phone(sent.phone), expires_in=sent.expires_in,
                      resend_in=sent.resend_in, tries_left=sent.tries_left,
                      demo_code=sent.code if demo else None)  # fmt: skip


@router.post(
    "/auth/otp/request",
    response_model=OtpSentOut,
    dependencies=[Depends(accounts_open), Depends(limited("otp_send"))],
)
def request_code(
    request: Request,
    body: OtpRequestIn,
    _owner: OwnerDep,
    session: SessionDep,
    settings: SettingsDep,
    now: NowDep,
) -> OtpSentOut:
    """Send a sign-in code (simulated sender)."""
    demo = demo_codes(settings, session)
    try:
        number_cap(request, body.phone)
        sent = send_code(session, body.phone, now, demo=demo)
    except AuthError as exc:
        raise as_api_error(exc) from None
    return _sent(sent, demo)


@router.post(
    "/auth/otp/verify",
    response_model=OtpVerifyOut,
    dependencies=[Depends(accounts_open), Depends(limited("otp_verify"))],
)
def verify_code(
    body: OtpVerifyIn, _owner: OwnerDep, session: SessionDep, now: NowDep
) -> OtpVerifyOut:
    """Check a code. On success the web server starts the session."""
    try:
        phone = check_code(session, body.phone, body.code, now)
    except AuthError as exc:
        session.commit()  # keep the counted try even though we answer with an error
        raise as_api_error(exc) from None
    account = account_for_phone(session, phone)
    if account is None:
        return OtpVerifyOut(verified=True, account=None)
    if account.verified_at is None:
        account.verified_at = now
    return OtpVerifyOut(
        verified=True,
        account=AccountOut(
            subject=f"a{account.id}",
            name=account.name,
            hotel_name=account.hotel_name,
            onboarded=account.onboarded_at is not None,
        ),  # fmt: skip
    )


@router.post(
    "/auth/signup",
    response_model=OtpSentOut,
    dependencies=[Depends(accounts_open), Depends(limited("otp_send"))],
)
def signup(
    request: Request,
    body: SignupIn,
    _owner: OwnerDep,
    session: SessionDep,
    settings: SettingsDep,
    now: NowDep,
) -> OtpSentOut:
    """Create the account (unverified) and send the first code."""
    demo = demo_codes(settings, session)
    try:
        sign_up(session, name=body.name, hotel=body.hotel, raw_phone=body.phone,
                updates=body.updates, now=now)  # fmt: skip
        number_cap(request, body.phone)
        sent = send_code(session, body.phone, now, demo=demo)
    except AuthError as exc:
        session.commit()  # the account details stay; only the send was refused
        raise as_api_error(exc) from None
    return _sent(sent, demo)


@router.post("/auth/demo", response_model=DemoOut, dependencies=[Depends(limited("auth_demo"))])
def demo_login(_owner: OwnerDep, prop: PropertyDep) -> DemoOut:
    """Direct beta login: only ever opens a sample (fictional) hotel."""
    if not prop.is_sample:
        raise ApiError(403, "not_sample", "Direct beta login is only for the sample hotel.")
    return DemoOut(subject=DEMO_SUBJECT, name=prop.owner_name, hotel_name=prop.name,
                   onboarded=True)  # fmt: skip


@router.get("/me", response_model=MeOut)
def me(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> MeOut:
    """The signed-in owner (or the demo) and the hotel they see."""
    account = account_of(session, subject)
    if account is None:
        return MeOut(kind="demo", name=prop.owner_name, hotel_name=prop.name, masked_phone=None,
                     onboarded=True, property_name=prop.name, property_rooms=prop.rooms_count,
                     property_is_sample=prop.is_sample)  # fmt: skip
    return MeOut(kind="owner", name=account.name, hotel_name=account.hotel_name,
                 masked_phone=mask_phone(account.phone),
                 onboarded=account.onboarded_at is not None, property_name=prop.name,
                 property_rooms=prop.rooms_count, property_is_sample=prop.is_sample)  # fmt: skip


@router.post("/auth/logout", response_model=OkOut)
def logout(_owner: OwnerDep) -> OkOut:
    """Sessions are signed cookies held by the web server, which clears it."""
    return OkOut(ok=True)


def _onboarding_out(session: SessionDep, prop: PropertyDep, account: OwnerAccount | None,
                    saved: bool) -> OnboardingOut:  # fmt: skip
    state = sample_onboarding(session, prop) if account is None else account_onboarding(account)
    return OnboardingOut(
        sample=account is None,
        saved=saved,
        note=SAMPLE_NOTE if account is None else OWNER_NOTE,
        property_name=state.property_name,
        town=state.town,
        rooms=state.rooms,
        contracts={k: state.contracts_bps[k] / 100 for k in CONTRACT_KEYS},
        cost_per_room=None if state.cost_per_room is None else state.cost_per_room // 100,
        whatsapp_connected=state.whatsapp_connected,
        whatsapp_mode="simulated",
        done=state.done,
    )


@router.get("/onboarding", response_model=OnboardingOut)
def get_onboarding(subject: SubjectDep, session: SessionDep, prop: PropertyDep) -> OnboardingOut:
    """Current answers (the seeded values for the sample hotel)."""
    return _onboarding_out(session, prop, account_of(session, subject), saved=False)


@router.patch("/onboarding", response_model=OnboardingOut)
def patch_onboarding(
    body: OnboardingIn, subject: SubjectDep, session: SessionDep, prop: PropertyDep, now: NowDep
) -> OnboardingOut:
    """Save step answers on the account. The demo saves nothing at all."""
    account = account_of(session, subject)
    if account is None:
        return _onboarding_out(session, prop, None, saved=False)
    contracts = None
    if body.contracts is not None:
        given = body.contracts.model_dump(exclude_none=True)
        contracts = {k: int(Decimal(v) * 100) for k, v in given.items()}
    save_onboarding(
        account,
        OnboardingUpdate(
            property_name=body.property_name,
            town=body.town,
            rooms=body.rooms,
            contracts_bps=contracts,
            cost_per_room=None if body.cost_per_room is None else body.cost_per_room * 100,
            clear_cost=body.clear_cost,
            connect_whatsapp=body.connect_whatsapp,
            finish=body.finish,
        ),
        now,
    )
    session.flush()
    return _onboarding_out(session, prop, account, saved=True)
