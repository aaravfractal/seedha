"""Owner sign-in with a WhatsApp one-time code, sign up and onboarding.

Rules (docs/FRONTEND_MASTER.md D4; handoff BEHAVIOR validation rules):

* Indian mobile ``^[6-9]\\d{9}$``; "+91", "91", "0", spaces and dashes are
  accepted and removed.
* The code has 6 digits, expires after 300 s and is single use.
* A new code may be sent 30 s after the last one at the earliest.
* 5 wrong tries lock the number for 15 minutes. Asking for a new code does
  not reset the tries while the current code is still valid, so a resend
  cannot buy extra guesses.
* Only a salted SHA-256 of the code is stored; codes are compared in
  constant time.

The sender is simulated (no approved WhatsApp sign-in template yet). With
SEEDHA_DEMO=1 the code goes back to the web app for a labelled demo banner
and to the server log; otherwise it is never returned and never logged.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Channel, ChannelContract, OtpChallenge, OwnerAccount, Property
from app.services.consent import as_utc

logger = logging.getLogger("seedha.auth")

CODE_DIGITS = 6
CODE_TTL = timedelta(seconds=300)
RESEND_AFTER = timedelta(seconds=30)
MAX_TRIES = 5
LOCK_FOR = timedelta(minutes=15)

INDIAN_MOBILE = re.compile(r"^[6-9]\d{9}$")
CODE_PATTERN = re.compile(r"^\d{6}$")
_SEPARATORS = re.compile(r"[\s\-().]")
_COUNTRY_DIGITS = 12
_TRUNK_DIGITS = 11

# Onboarding defaults (handoff: MMT 22, Booking 18, Agoda 20, agents 10 %).
CONTRACT_KEYS = ("mmt", "bcom", "agoda", "ta")
DEFAULT_CONTRACTS_BPS = {"mmt": 2200, "bcom": 1800, "agoda": 2000, "ta": 1000}


class AuthError(Exception):
    """A refusal the owner should see. `retry_after` is in whole seconds."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        *,
        retry_after: int | None = None,
        tries_left: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.retry_after = retry_after
        self.tries_left = tries_left


def normalise_phone(raw: str) -> str:
    """'+91 98765 43210' -> '9876543210'. Raises AuthError if not an Indian mobile."""
    digits = _SEPARATORS.sub("", raw.strip())
    if digits.startswith("+"):
        digits = digits[1:]
    if len(digits) == _COUNTRY_DIGITS and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == _TRUNK_DIGITS and digits.startswith("0"):
        digits = digits[1:]
    if not INDIAN_MOBILE.match(digits):
        raise AuthError(
            422,
            "invalid_phone",
            "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.",
        )
    return digits


def mask_phone(phone: str) -> str:
    """'9876543210' -> '+91 98765 •••10'."""
    return f"+91 {phone[:5]} •••{phone[-2:]}"


def hash_code(salt: str, phone: str, code: str) -> str:
    """Salted SHA-256 of the code, bound to the phone it was sent to."""
    return hashlib.sha256(f"{salt}|{phone}|{code}".encode()).hexdigest()


def new_code() -> str:
    """A uniformly random 6-digit code from the OS random source."""
    return f"{secrets.randbelow(10**CODE_DIGITS):0{CODE_DIGITS}d}"


def _seconds_until(moment: datetime, now: datetime) -> int:
    return max(1, int((moment - now).total_seconds() + 0.999))


@dataclass(frozen=True, slots=True)
class SentCode:
    """What the caller learns about a sent code. `code` is for demo mode only."""

    phone: str
    code: str
    expires_in: int
    resend_in: int
    tries_left: int


def _locked(challenge: OtpChallenge, now: datetime) -> int:
    """Seconds left on a lock, or 0."""
    if challenge.locked_until is None:
        return 0
    until = as_utc(challenge.locked_until)
    return _seconds_until(until, now) if until > now else 0


def send_code(session: Session, raw_phone: str, now: datetime, *, demo: bool) -> SentCode:
    """Create (or replace) the code for a phone and hand it to the simulated sender."""
    phone = normalise_phone(raw_phone)
    challenge = session.scalar(select(OtpChallenge).where(OtpChallenge.phone == phone))
    if challenge is not None:
        wait = _locked(challenge, now)
        if wait:
            raise AuthError(
                429, "locked", "Too many tries. Try again in 15 minutes.", retry_after=wait
            )
        next_send = as_utc(challenge.last_sent_at) + RESEND_AFTER
        if next_send > now:
            wait = _seconds_until(next_send, now)
            raise AuthError(
                429,
                "resend_wait",
                f"Wait {wait} seconds before asking for a new code.",
                retry_after=wait,
            )
        expired = as_utc(challenge.expires_at) <= now or challenge.used_at is not None
        if expired or challenge.locked_until is not None:
            challenge.attempts = 0
    else:
        challenge = OtpChallenge(phone=phone, attempts=0)
        session.add(challenge)
    code = new_code()
    salt = secrets.token_hex(16)
    challenge.salt = salt
    challenge.code_hash = hash_code(salt, phone, code)
    challenge.created_at = now
    challenge.last_sent_at = now
    challenge.expires_at = now + CODE_TTL
    challenge.locked_until = None
    challenge.used_at = None
    session.flush()
    if demo:
        logger.warning("SIMULATED WhatsApp code for %s (SEEDHA_DEMO=1): %s", mask_phone(phone),
                       code)  # fmt: skip
    else:
        logger.warning("SIMULATED WhatsApp code issued for %s (code not logged)", mask_phone(phone))
    return SentCode(
        phone=phone,
        code=code,
        expires_in=int(CODE_TTL.total_seconds()),
        resend_in=int(RESEND_AFTER.total_seconds()),
        tries_left=MAX_TRIES - challenge.attempts,
    )


def check_code(session: Session, raw_phone: str, code: str, now: datetime) -> str:
    """Verify a code. Returns the normalised phone; the code cannot be used again."""
    phone = normalise_phone(raw_phone)
    if not CODE_PATTERN.match(code):
        raise AuthError(422, "invalid_code", "Enter the 6-digit code.")
    challenge = session.scalar(select(OtpChallenge).where(OtpChallenge.phone == phone))
    if challenge is None or challenge.used_at is not None:
        raise AuthError(404, "no_code", "No code is waiting for this number. Ask for a new one.")
    wait = _locked(challenge, now)
    if wait:
        raise AuthError(
            429,
            "locked",
            "Too many tries. Try again in 15 minutes.",
            retry_after=wait,
            tries_left=0,
        )
    if as_utc(challenge.expires_at) <= now:
        raise AuthError(410, "expired", "This code has expired. Ask for a new one.")
    if not hmac.compare_digest(challenge.code_hash, hash_code(challenge.salt, phone, code)):
        # One atomic UPDATE, so parallel guesses cannot share a count (review S9).
        attempts = session.execute(
            update(OtpChallenge)
            .where(OtpChallenge.id == challenge.id)
            .values(attempts=OtpChallenge.attempts + 1)
            .returning(OtpChallenge.attempts)
        ).scalar_one()
        session.refresh(challenge, ["attempts"])
        left = MAX_TRIES - attempts
        if left <= 0:
            challenge.locked_until = now + LOCK_FOR
            raise AuthError(
                429,
                "locked",
                "Too many tries. Try again in 15 minutes.",
                retry_after=int(LOCK_FOR.total_seconds()),
                tries_left=0,
            )
        noun = "try" if left == 1 else "tries"
        raise AuthError(
            401,
            "wrong_code",
            f"That code is not right. {left} {noun} left.",
            tries_left=left,
        )
    challenge.used_at = now
    challenge.attempts = 0
    return phone


def account_for_phone(session: Session, phone: str) -> OwnerAccount | None:
    """The owner account registered to a normalised phone, if any."""
    return session.scalar(select(OwnerAccount).where(OwnerAccount.phone == phone))


def sign_up(
    session: Session,
    *,
    name: str,
    hotel: str,
    raw_phone: str,
    updates: bool,
    now: datetime,
) -> str:
    """Record a new, unverified account. A verified account is never changed here,
    so nobody can take over a number by signing up with it again."""
    phone = normalise_phone(raw_phone)
    account = account_for_phone(session, phone)
    if account is None:
        session.add(OwnerAccount(name=name, hotel_name=hotel, phone=phone,
                                 terms_accepted_at=now, updates_opt_in=updates,
                                 created_at=now))  # fmt: skip
    elif account.verified_at is None:
        account.name = name
        account.hotel_name = hotel
        account.terms_accepted_at = now
        account.updates_opt_in = updates
    session.flush()
    return phone


# --- Onboarding ---------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Onboarding:
    """Onboarding answers. Commission rates are basis points."""

    property_name: str
    town: str
    rooms: int | None
    contracts_bps: dict[str, int]
    cost_per_room: int | None
    whatsapp_connected: bool
    done: bool


def sample_onboarding(session: Session, prop: Property) -> Onboarding:
    """The sample hotel's real seeded values, shown read-only."""
    rows = session.execute(
        select(Channel.key, ChannelContract.commission_bps)
        .join(ChannelContract, ChannelContract.channel_id == Channel.id)
        .where(Channel.property_id == prop.id, Channel.key.in_(CONTRACT_KEYS))
        .order_by(ChannelContract.valid_from)
    )
    contracts = dict(DEFAULT_CONTRACTS_BPS) | {row.key: row.commission_bps for row in rows}
    return Onboarding(
        property_name=prop.name,
        town=prop.city,
        rooms=prop.rooms_count,
        contracts_bps=contracts,
        cost_per_room=None,
        whatsapp_connected=False,
        done=True,
    )


def account_onboarding(account: OwnerAccount) -> Onboarding:
    """Saved answers for an account, with handoff defaults for the gaps."""
    contracts = dict(DEFAULT_CONTRACTS_BPS)
    if account.contracts:
        stored = json.loads(account.contracts)
        contracts |= {k: int(v) for k, v in stored.items() if k in DEFAULT_CONTRACTS_BPS}
    return Onboarding(
        property_name=account.property_name or account.hotel_name,
        town=account.town or "",
        rooms=account.rooms,
        contracts_bps=contracts,
        cost_per_room=account.cost_per_room,
        whatsapp_connected=account.whatsapp_connected_at is not None,
        done=account.onboarded_at is not None,
    )


@dataclass(frozen=True, slots=True)
class OnboardingUpdate:
    """Fields to change; None means "leave as is"."""

    property_name: str | None = None
    town: str | None = None
    rooms: int | None = None
    contracts_bps: dict[str, int] | None = None
    cost_per_room: int | None = None
    clear_cost: bool = False
    connect_whatsapp: bool = False
    finish: bool = False


def save_onboarding(account: OwnerAccount, update: OnboardingUpdate, now: datetime) -> None:
    """Store onboarding answers on the account only (never on the property)."""
    if update.property_name is not None:
        account.property_name = update.property_name
    if update.town is not None:
        account.town = update.town
    if update.rooms is not None:
        account.rooms = update.rooms
    if update.contracts_bps is not None:
        merged = account_onboarding(account).contracts_bps | update.contracts_bps
        account.contracts = json.dumps(merged, sort_keys=True)
    if update.clear_cost:
        account.cost_per_room = None
    elif update.cost_per_room is not None:
        account.cost_per_room = update.cost_per_room
    if update.connect_whatsapp and account.whatsapp_connected_at is None:
        account.whatsapp_connected_at = now
    if update.finish and account.onboarded_at is None:
        account.onboarded_at = now
