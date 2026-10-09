"""Shared fixtures: an in-memory database, the sample hotel, an API client."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, load_settings
from app.db import make_session_factory
from app.main import create_app
from app.models import Base
from seed.load import load_sample

OWNER_TOKEN = "test-owner-token"
DEVICE_KEY = "test-desk-key"  # pragma: allowlist secret (test value)
DEMO_DATE = date(2026, 10, 13)


@pytest.fixture(name="engine")
def fixture_engine() -> Iterator[Engine]:
    """A fresh in-memory SQLite database with foreign keys on."""
    eng = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(eng, "connect")
    def _fk(dbapi_connection: object, _record: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture(name="factory")
def fixture_factory(engine: Engine) -> sessionmaker[Session]:
    return make_session_factory(engine)


@pytest.fixture(name="session")
def fixture_session(factory: sessionmaker[Session]) -> Iterator[Session]:
    with factory() as s:
        yield s


@pytest.fixture(name="sample")
def fixture_sample(session: Session) -> Session:
    """The sample hotel with all 1,500 statement lines loaded."""
    load_sample(session, DEMO_DATE, with_statements=True, device_key=DEVICE_KEY)
    session.commit()
    return session


@pytest.fixture(name="base_sample")
def fixture_base_sample(session: Session) -> Session:
    """The sample hotel as `make seed` loads it (no statements yet)."""
    load_sample(session, DEMO_DATE, with_statements=False, device_key=DEVICE_KEY)
    session.commit()
    return session


@pytest.fixture(name="settings")
def fixture_settings() -> Settings:
    return replace(load_settings(), owner_api_token=OWNER_TOKEN, anthropic_api_key="",
                   whatsapp_token="", razorpay_key_id="", proof_rpc_url="")  # fmt: skip


@pytest.fixture(name="client")
def fixture_client(settings: Settings, factory: sessionmaker[Session]) -> Iterator[TestClient]:
    with TestClient(create_app(settings, factory)) as c:
        yield c


@pytest.fixture(name="owner")
def fixture_owner() -> dict[str, str]:
    return {"Authorization": f"Bearer {OWNER_TOKEN}"}


@pytest.fixture(name="device")
def fixture_device() -> dict[str, str]:
    return {"X-Device-Key": DEVICE_KEY}
