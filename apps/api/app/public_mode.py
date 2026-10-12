"""Public demo mode (make demo-live, make demo-lan): SEEDHA_PUBLIC=1.

Visitors who reach the demo through the tunnel or the Wi-Fi may look around
the sample hotel, but nothing they do may spend the owner's money or test
tokens: for them Claude stays off (the labelled fallbacks run) and tonight's
proof is kept local. The laptop running Seedha (loopback) keeps every feature.
The web app's BFF forwards the real client address, so a visitor never
appears as loopback (see routers/site.py local_reset_only).

Hosted (SEEDHA_ENV=production): every client is remote. The API is reachable
on its own public URL and uvicorn trusts X-Forwarded-For from any peer there
(the platform proxy's address is not fixed), so a caller could claim to be
127.0.0.1; loopback therefore grants nothing in production. Spending is
decided by who is signed in instead (`may_spend`).
"""

from __future__ import annotations

import hmac
import ipaddress
import math
import os

from fastapi import Request
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.errors import ApiError
from app.models import OwnerAccount
from app.ratelimit import Limit, RateLimiter


def is_loopback(host: str) -> bool:
    """True for 127.0.0.0/8, ::1 and IPv4-mapped loopback; False for names and junk."""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    mapped = getattr(ip, "ipv4_mapped", None)
    return bool(ip.is_loopback or (mapped is not None and mapped.is_loopback))


def app_settings(request: Request) -> Settings:
    """The settings the app was built with (not the per-request copy)."""
    settings: Settings = request.app.state.settings
    return settings


def is_production(request: Request) -> bool:
    """SEEDHA_ENV=production (the hosted demo)."""
    return app_settings(request).production


def is_remote_public(request: Request) -> bool:
    """True in production (every client is remote), or when SEEDHA_PUBLIC is
    exactly "1" and the client is not this machine."""
    if is_production(request):
        return True
    if os.environ.get("SEEDHA_PUBLIC", "") != "1":
        return False
    host = request.client.host if request.client else ""
    return not is_loopback(host)


def is_real_owner(request: Request) -> bool:
    """Production: the request carries the owner token and a session for a
    verified owner account whose number is in OWNER_PHONES, with real accounts
    allowed (ALLOW_OWNER_ACCOUNTS=1). Never true for the demo subject."""
    settings = app_settings(request)
    subject = request.headers.get("x-seedha-subject", "")
    if not (settings.allow_owner_accounts and settings.owner_phones and settings.owner_api_token):
        return False
    if not subject.startswith("a") or not subject[1:].isdigit():
        return False
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(
        token.encode(), settings.owner_api_token.encode()
    ):
        return False
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        account = session.get(OwnerAccount, int(subject[1:]))
        return bool(
            account is not None
            and account.verified_at is not None
            and account.phone in settings.owner_phones
        )


def may_spend(request: Request, *, demo_allowed: bool) -> bool:
    """May this request spend the owner's Claude credits or testnet POL?

    Local demo: yes, except a remote visitor in public mode. Production: only
    a real owner account, or anyone when the owner set the flag for the demo
    (`demo_allowed`: ALLOW_CLAUDE_FOR_DEMO or ALLOW_DEMO_PROOF_WRITES)."""
    if not is_remote_public(request):
        return True
    if not is_production(request):
        return False
    return demo_allowed or is_real_owner(request)


PRINT_LIMIT = Limit(6, 60)
PRINT_BUCKET = "desk_print"


def print_guarded(request: Request) -> None:
    """Desk printing (room slips, the close slip): only from the laptop during a
    public demo, and at most 6 prints a minute per client, so nobody can flood
    the thermal printer or the command queue. Hosted (production) has no
    laptop: printing stays open to signed-in sessions, with the same limit."""
    if is_remote_public(request) and not is_production(request):
        raise ApiError(
            403, "print_local_only", "Printing works only on the computer running the demo"
        )
    limiter: RateLimiter = request.app.state.rate_limiter
    client = request.client.host if request.client else "unknown"
    wait = limiter.check(PRINT_BUCKET, client, PRINT_LIMIT)
    if wait > 0:
        raise ApiError(
            429,
            "too_many_requests",
            "Too many prints. Please wait a minute and try again.",
            headers={"Retry-After": str(math.ceil(wait))},
        )
