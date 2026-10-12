"""Shared fixtures: a database, the sample hotel, an API client.

The database is a fresh in-memory SQLite per test by default. With
TEST_DATABASE_URL set (e.g. postgresql://localhost:5432/seedha_test)
the same tests run on that Postgres: the tables are created once per session
and emptied (identities restarted) after every test.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from dataclasses import replace
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, load_settings
from app.db import make_engine, make_session_factory
from app.main import create_app
from app.models import Base
from seed.load import load_sample

OWNER_TOKEN = "test-owner-token"
DEVICE_KEY = "test-desk-key"  # pragma: allowlist secret (test value)
DEMO_DATE = date(2026, 10, 13)
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "").strip()


@pytest.fixture(name="server_engine", scope="session")
def fixture_server_engine() -> Iterator[Engine | None]:
    """The TEST_DATABASE_URL engine with every table created, or None for SQLite."""
    if not TEST_DATABASE_URL:
        yield None
        return
    eng = make_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


def empty_tables(eng: Engine) -> None:
    """Remove every row and restart every id sequence (Postgres)."""
    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with eng.begin() as conn:
        conn.execute(text("SET LOCAL lock_timeout = '10s'"))
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))  # noqa: S608


@pytest.fixture(name="engine")
def fixture_engine(server_engine: Engine | None) -> Iterator[Engine]:
    """A fresh in-memory SQLite database with foreign keys on (or the emptied server DB)."""
    if server_engine is not None:
        yield server_engine
        empty_tables(server_engine)
        return
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
