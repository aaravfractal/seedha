"""Shared request dependencies: database session, settings, owner auth."""

from __future__ import annotations

import hmac
from collections.abc import Iterator
from dataclasses import replace
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.errors import ApiError
from app.models import DeskDevice, OwnerAccount, Property
from app.public_mode import is_remote_public
from app.services.desk import device_for_key
from app.services.drafter import ClaudeWording, Wording


def get_settings(request: Request) -> Settings:
    """Settings the app was built with. For a public-demo visitor Claude is off,
    so the labelled fallbacks run and nobody else spends the owner's credits."""
    settings: Settings = request.app.state.settings
    if settings.anthropic_api_key and is_remote_public(request):
        return replace(settings, anthropic_api_key="")
    return settings


def get_session(request: Request) -> Iterator[Session]:
    """One session per request; commits on success, rolls back on error."""
    factory: sessionmaker[Session] = request.app.state.session_factory
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def require_owner(
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Owner routes need `Authorization: Bearer <OWNER_API_TOKEN>`.

    The web app adds the token on the server side; browsers never see it.
    """
    if not settings.owner_api_token:
        raise ApiError(503, "owner_auth_not_configured", "OWNER_API_TOKEN is not set")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(
        token.encode(), settings.owner_api_token.encode()
    ):
        raise ApiError(401, "unauthorised", "Owner token missing or wrong")


def require_subject_access(
    request: Request,
    settings: SettingsDep,
    x_seedha_subject: Annotated[str | None, Header()] = None,
) -> None:
    """Which signed-in session may run this property (security review S1).

    The web BFF forwards the session's subject on owner routes: "demo" for
    Direct beta login or "a<id>" for an owner account. Without the header the
    caller is a server-side token holder (jobs, tests). A demo session and any
    account may run only a sample property; a property with real data needs an
    account whose WhatsApp number is in OWNER_PHONES.
    """
    if x_seedha_subject is None:
        return
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        prop = session.scalar(select(Property).order_by(Property.id).limit(1))
        if prop is None or prop.is_sample:
            if x_seedha_subject == "demo" or _account(session, x_seedha_subject) is not None:
                return
            raise ApiError(401, "session_ended", "Please sign in again")
        if x_seedha_subject != "demo":
            account = _account(session, x_seedha_subject)
            if account is not None and account.phone in settings.owner_phones:
                return
    raise ApiError(403, "not_owner", "This account cannot open this hotel")


def _account(session: Session, subject: str) -> OwnerAccount | None:
    if not subject.startswith("a") or not subject[1:].isdigit():
        return None
    account = session.get(OwnerAccount, int(subject[1:]))
    return account if account is not None and account.verified_at is not None else None


def require_owner_session(
    _token: Annotated[None, Depends(require_owner)],
    _subject: Annotated[None, Depends(require_subject_access)],
) -> None:
    """Owner token plus, when present, a session allowed to run this property."""


OwnerDep = Annotated[None, Depends(require_owner_session)]


def get_property(session: SessionDep) -> Property:
    """The single property this hackathon build serves."""
    prop = session.scalar(select(Property).order_by(Property.id).limit(1))
    if prop is None:
        raise ApiError(409, "not_seeded", "No hotel loaded. Run make seed.")
    return prop


PropertyDep = Annotated[Property, Depends(get_property)]


def require_device(
    session: SessionDep,
    x_device_key: Annotated[str | None, Header()] = None,
) -> DeskDevice:
    """Device routes need `X-Device-Key`; only its SHA-256 is stored."""
    device = device_for_key(session, x_device_key or "")
    if device is None:
        raise ApiError(401, "unknown_device", "Device key missing or not registered")
    return device


DeviceDep = Annotated[DeskDevice, Depends(require_device)]


def get_wording(request: Request, settings: SettingsDep) -> Wording | None:
    """Claude wording for drafts (None in simulated mode); tests override
    it via app.state.wording."""
    override: Wording | None = getattr(request.app.state, "wording", None)
    if override is not None:
        return override
    if not settings.llm_enabled:
        return None
    return ClaudeWording(settings.anthropic_api_key, settings.claude_model)


WordingDep = Annotated[Wording | None, Depends(get_wording)]
