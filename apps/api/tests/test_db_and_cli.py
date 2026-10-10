"""Engine helpers, the seed CLI and small model behaviours."""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import func, select, text

from app.db import make_engine, make_session_factory, session_scope
from app.models import Base, Booking, Consent
from app.services.ledger import LedgerError, load_ledger
from seed import load as seed_load
from seed.coded_history import CODED_STAYS


def test_sqlite_engine_enforces_foreign_keys(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'fk.db'}")
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
    engine.dispose()


def test_session_scope_commits_and_rolls_back(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 's.db'}")
    Base.metadata.create_all(engine)
    factory = make_session_factory(engine)
    with session_scope(factory) as session:
        session.execute(text("INSERT INTO pipeline_step (key, done_at) VALUES ('flip', '2026')"))
    with pytest.raises(RuntimeError), session_scope(factory) as session:
        session.execute(text("INSERT INTO pipeline_step (key, done_at) VALUES ('rep', '2026')"))
        raise RuntimeError("boom")
    with session_scope(factory) as session:
        keys = session.scalars(text("SELECT key FROM pipeline_step")).all()
    assert keys == ["flip"]
    engine.dispose()


def test_ledger_unknown_property(sample: object) -> None:
    with pytest.raises(LedgerError):
        load_ledger(sample, 999)  # type: ignore[arg-type]


def test_consent_is_active_until_withdrawn_or_erased() -> None:
    consent = Consent(withdrawn_at=None, erased_at=None)
    assert consent.is_active
    consent.withdrawn_at = datetime.now(UTC)
    assert not consent.is_active
    consent.withdrawn_at = None
    consent.erased_at = datetime.now(UTC)
    assert not consent.is_active


def test_seed_cli_loads_into_database_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    url = f"sqlite:///{tmp_path / 'cli.db'}"
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("DEMO_DATE", "2026-10-13")
    monkeypatch.setattr(sys, "argv", ["seed.load", "--with-statements"])
    seed_load.main()
    with make_session_factory(engine)() as session:
        count = session.scalar(select(func.count()).select_from(Booking))
    assert count == 1_500 + 152 + 14 + len(CODED_STAYS)  # D-080 coded history
    engine.dispose()
