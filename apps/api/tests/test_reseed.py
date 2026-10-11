"""Reseeding is repeatable (POLISH_BUILD T1): load_sample with the inbox and
"Reset demo data" give the same counts every time, and the locked numbers
hold after a reset once the six sample statements are read again."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import (
    Base,
    Booking,
    Consent,
    GuestMemory,
    InboxMessage,
    Message,
    PerkCode,
    ProofBundle,
    StayInvoice,
)
from app.money import rupees
from seed.closes import CLOSE_STAYS
from seed.inbox_threads import THREADS
from seed.load import load_sample
from tests.conftest import DEMO_DATE, DEVICE_KEY

COUNTED: tuple[type[Any], ...] = (Booking, Consent, GuestMemory, InboxMessage, ProofBundle,
                                  PerkCode, Message, StayInvoice)  # fmt: skip


def counts(session: Session) -> dict[str, int]:
    session.expire_all()
    out = {m.__tablename__: int(session.scalar(select(func.count()).select_from(m)) or 0)
           for m in COUNTED}  # fmt: skip
    out["closes"] = int(
        session.scalar(select(func.count()).where(Booking.external_ref.like("CL%"))) or 0
    )
    out["sealed"] = int(
        session.scalar(select(func.count()).where(Consent.proof_status == "verified")) or 0
    )
    return out


@pytest.fixture(name="fresh_engine")
def fixture_fresh_engine() -> Iterator[Engine]:
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False},
                        poolclass=StaticPool)  # fmt: skip
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


def expected_inbox_counts(found: dict[str, int]) -> None:
    preferences = sum(len(t.preferences) for t in THREADS)
    notes = sum(len(t.notes) for t in THREADS)
    lines = sum(len(t.lines) for t in THREADS)
    assert found["consent"] == found["sealed"] == len(THREADS) == 8
    assert found["guest_memory"] == preferences + notes
    assert found["inbox_message"] == lines
    assert found["proof_bundle"] == 1
    assert found["closes"] == len(CLOSE_STAYS)
    assert (found["message"], found["stay_invoice"]) == (0, 0)


def test_load_sample_with_inbox_twice_gives_the_same_counts(
    session: Session, fresh_engine: Engine
) -> None:
    load_sample(session, DEMO_DATE, with_statements=True, device_key=DEVICE_KEY, with_inbox=True)
    session.commit()
    first = counts(session)
    with Session(fresh_engine) as other:
        load_sample(other, DEMO_DATE, with_statements=True, device_key=DEVICE_KEY,
                    with_inbox=True)  # fmt: skip
        other.commit()
        second = counts(other)
    assert first == second
    expected_inbox_counts(first)


def import_statements(client: TestClient, owner: dict[str, str]) -> None:
    for sample in client.get("/statements/samples", headers=owner).json():
        res = client.post(f"/statements/samples/{sample['index']}", headers=owner)
        assert res.status_code == 200 and res.json()["status"] == "imported", res.text


def locked_numbers(client: TestClient, owner: dict[str, str]) -> None:
    summary = client.get("/statements", headers=owner).json()
    assert (summary["rows"], summary["flagged"]) == (1_500, 3)
    assert {r["external_ref"] for r in summary["flagged_rows"]} == {
        "MM48213", "AG77102", "BK55320",
    }  # fmt: skip
    flip = client.get("/ledger/channels", headers=owner).json()
    assert flip["totals"]["paid_to_channels"] == rupees(10_39_108)
    assert flip["totals"]["net_kept"] == rupees(47_33_012)
    adr = {c["key"]: c["net_adr"] for c in flip["channels"]}
    assert (adr["mmt"], adr["direct"]) == (rupees(2_737), rupees(4_283))
    repeat = client.get("/repeat", headers=owner).json()
    assert (repeat["count"], repeat["paid_twice_total"]) == (12, rupees(41_800))


def test_reset_twice_gives_the_same_counts_and_the_locked_numbers(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    locked_numbers(client, owner)
    seen: list[dict[str, int]] = []
    for _ in range(2):
        assert client.post("/demo/reset", headers=owner).json()["ok"] is True
        found = counts(sample)
        expected_inbox_counts(found)
        seen.append(found)
        assert len(client.get("/inbox/threads", headers=owner).json()["threads"]) == 8
        proof = client.get("/proof", headers=owner).json()
        assert (proof["pending"], proof["proven"], len(proof["bundles"])) == (0, 8, 1)
        steps = {
            s["key"]: s["done"] for s in client.get("/pipeline", headers=owner).json()["steps"]
        }
        assert not any(steps.values()), steps
        import_statements(client, owner)
        locked_numbers(client, owner)
    assert seen[0] == seen[1]
