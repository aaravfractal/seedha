"""Shared request dependencies: database session, settings, owner auth."""

from __future__ import annotations

import hmac
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.errors import ApiError
from app.models import Property


def get_settings(request: Request) -> Settings:
    """Settings the app was built with."""
    settings: Settings = request.app.state.settings
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


OwnerDep = Annotated[None, Depends(require_owner)]


def get_property(session: SessionDep) -> Property:
    """The single property this hackathon build serves."""
    prop = session.scalar(select(Property).order_by(Property.id).limit(1))
    if prop is None:
        raise ApiError(409, "not_seeded", "No hotel loaded. Run make seed.")
    return prop


PropertyDep = Annotated[Property, Depends(get_property)]
