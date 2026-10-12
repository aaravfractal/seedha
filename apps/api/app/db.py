"""Database engine and session handling (SQLite for the demo, Postgres when hosted)."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Declarative base for every Seedha table."""


POSTGRES_SCHEMES = ("postgres://", "postgresql://", "postgresql+psycopg2://")
PSYCOPG_SCHEME = "postgresql+psycopg://"


def normalise_database_url(database_url: str) -> str:
    """One driver for Postgres: psycopg 3.

    Neon and Render hand out postgres:// or postgresql:// URLs (often with
    ?sslmode=require, which psycopg understands as is). SQLAlchemy would pick
    psycopg2 for those, so the scheme is rewritten; everything after it is kept.
    """
    url = database_url.strip()
    for scheme in POSTGRES_SCHEMES:
        if url.startswith(scheme):
            return PSYCOPG_SCHEME + url[len(scheme) :]
    return url


def make_engine(database_url: str) -> Engine:
    """Create an engine. SQLite gets foreign keys switched on; Postgres uses psycopg 3."""
    database_url = normalise_database_url(database_url)
    if not database_url.startswith("sqlite"):
        # pool_pre_ping: hosted Postgres (Neon) closes idle connections.
        pg_engine = create_engine(database_url, pool_pre_ping=True)

        @event.listens_for(pg_engine, "connect")
        def _utc_session(dbapi_connection: object, _record: object) -> None:
            # Stored times are UTC; read them back in UTC whatever the server's zone.
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            cursor.execute("SET TIME ZONE 'UTC'")
            cursor.close()
            dbapi_connection.commit()  # type: ignore[attr-defined]

        return pg_engine
    engine = create_engine(database_url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection: object, _record: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Session factory bound to an engine; objects stay readable after commit."""
    return sessionmaker(bind=engine, expire_on_commit=False)


@contextmanager
def session_scope(factory: sessionmaker[Session]) -> Iterator[Session]:
    """Commit on success, roll back on any error."""
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
