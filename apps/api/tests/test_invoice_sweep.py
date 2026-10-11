"""Stay invoice sweep (POLISH_BUILD T1): every invoiceable booking at several
GST rates, sequential numbers per financial year, the PDF text, flagged rows
and the consent scope (withdrawn, erased, another property)."""

from __future__ import annotations

import io
from datetime import UTC, datetime, timedelta

import pdfplumber
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, Guest, Property, StayInvoice
from app.services.invoice import Issuer, build_invoice, format_rs, invoice_prefix
from seed.load import load_sample
from tests.conftest import DEMO_DATE, DEVICE_KEY

RATES = (0, 500, 1200, 1800, 2800)
TODAY = datetime(2026, 10, 13, 6, 30, tzinfo=UTC)  # noon in India, FY 2026-27
DEMO = {"X-Seedha-Subject": "demo"}
FLAGGED = ("MM48213", "AG77102", "BK55320")


@pytest.fixture(name="inbox")
def fixture_inbox(session: Session) -> Session:
    load_sample(session, DEMO_DATE, with_statements=True, device_key=DEVICE_KEY, with_inbox=True)
    session.commit()
    return session


def invoiceable(session: Session) -> list[Booking]:
    """Finished stays that passed the math check or that the owner accepted."""
    rows = session.scalars(
        select(Booking)
        .where(
            Booking.status == "stay",
            or_(Booking.math_check_passed.is_(True), Booking.review_status == "accepted"),
        )
        .order_by(Booking.id)
    ).all()
    return [b for b in rows if b.check_in + timedelta(days=b.nights) <= DEMO_DATE]


def pdf_text(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def test_every_invoiceable_booking_adds_up_at_every_rate(sample: Session) -> None:
    prop = sample.scalars(select(Property)).one()
    rows = invoiceable(sample)
    assert len(rows) > 1_400
    numbers: dict[int, str] = {}
    for bps in RATES:
        issuer = Issuer(name="Hotel", address="Road", gstin=None, gst_bps=bps, sample=True)
        for booking in rows:
            inv = build_invoice(sample, prop, booking, issuer=issuer, now=TODAY)
            total = booking.list_amount - booking.discount
            assert inv.total_paid == total, booking.external_ref
            assert inv.taxable + inv.cgst + inv.sgst == total, (booking.external_ref, bps)
            assert inv.room_charges == booking.list_amount
            assert inv.discount == booking.discount
            assert inv.gst_bps == bps
            assert 0 <= inv.cgst - inv.sgst <= 100, "halves differ by at most a rupee"
            assert inv.taxable % 100 == inv.cgst % 100 == 0, "rupee-rounded line items"
            if bps == 0:
                assert (inv.cgst, inv.sgst) == (0, 0)
            assert numbers.setdefault(booking.id, inv.number) == inv.number, "number reused"
    prefix = invoice_prefix(prop)
    expected = [f"{prefix}/2627/{n:04d}" for n in range(1, len(rows) + 1)]
    assert [numbers[b.id] for b in rows] == expected, "sequential, no gaps, no repeats"
    seqs = sample.scalars(select(StayInvoice.seq).order_by(StayInvoice.seq)).all()
    assert list(seqs) == list(range(1, len(rows) + 1))


def threads(client: TestClient, owner: dict[str, str]) -> list[int]:
    listed = client.get("/inbox/threads", headers=owner).json()["threads"]
    return sorted(int(t["consent_id"]) for t in listed)


@pytest.mark.parametrize("bps", RATES)
def test_seeded_threads_invoice_and_pdf_at_each_rate(
    client: TestClient, owner: dict[str, str], inbox: Session, bps: int
) -> None:
    client.app.state.clock = lambda: TODAY  # type: ignore[attr-defined]
    headers = {**owner, **DEMO}
    res = client.patch("/settings/invoice", headers=headers, json={"room_gst_bps": bps})
    assert res.status_code == 200
    cids = threads(client, owner)
    assert len(cids) == 8
    seen: list[str] = []
    for cid in cids:
        res = client.get(f"/inbox/threads/{cid}/invoice", headers=headers)
        assert res.status_code == 200, res.text
        inv = res.json()
        consent = inbox.get(Consent, cid)
        assert consent is not None
        stay = consent.booking  # the one-night Desk close the guest consented on
        assert inv["total_paid"] == stay.list_amount - stay.discount
        assert inv["taxable"] + inv["cgst"] + inv["sgst"] == inv["total_paid"]
        assert inv["gst_bps"] == bps and inv["sample"] is True
        pdf = client.get(f"/inbox/threads/{cid}/invoice.pdf", headers=headers)
        assert pdf.status_code == 200
        text = pdf_text(pdf.content)
        assert inv["number"] in text
        assert f"Total paid {format_rs(inv['total_paid'])}" in text
        seen.append(inv["number"])
    assert seen == [f"DEODAR/2627/{n:04d}" for n in range(1, 9)]
    again = [client.get(f"/inbox/threads/{c}/invoice", headers=headers).json() for c in cids]
    assert [i["number"] for i in again] == seen
    inbox.expire_all()
    assert inbox.scalar(select(func.count()).select_from(StayInvoice)) == 8


def consent_on(session: Session, booking: Booking) -> int:
    assert booking.guest_id is not None
    row = Consent(guest_id=booking.guest_id, booking_id=booking.id, wording_version="v1",
                  given_at=TODAY - timedelta(days=1), salt="cd" * 16,
                  fingerprint=f"{booking.id:064x}", whatsapp_number="+919876500001")  # fmt: skip
    session.add(row)
    session.commit()
    return row.id


@pytest.mark.parametrize("ref", FLAGGED)
def test_flagged_row_is_never_invoiced_until_accepted(
    client: TestClient, owner: dict[str, str], sample: Session, ref: str
) -> None:
    client.app.state.clock = lambda: TODAY  # type: ignore[attr-defined]
    flagged = sample.scalars(select(Booking).where(Booking.external_ref == ref)).one()
    assert flagged.math_check_passed is False
    # A lone guest on the flagged row: no other stay could be invoiced instead.
    guest = Guest(property_id=flagged.property_id, display_name="Kiran Bisht (sample)",
                  short_name="Kiran")  # fmt: skip
    sample.add(guest)
    sample.flush()
    flagged.guest_id = guest.id
    cid = consent_on(sample, flagged)
    for decision in (None, "exclude"):
        if decision is not None:
            res = client.post(f"/statements/rows/{flagged.id}/review", headers=owner,
                              json={"decision": decision})  # fmt: skip
            assert res.status_code == 200
        for suffix in ("invoice", "invoice.pdf"):
            res = client.get(f"/inbox/threads/{cid}/{suffix}", headers={**owner, **DEMO})
            assert (res.status_code, res.json()["error"]["code"]) == (404, "no_completed_stay")
    sample.expire_all()
    assert sample.scalar(select(func.count()).select_from(StayInvoice)) == 0
    res = client.post(f"/statements/rows/{flagged.id}/review", headers=owner,
                      json={"decision": "accept"})  # fmt: skip
    assert res.status_code == 200
    res = client.get(f"/inbox/threads/{cid}/invoice", headers={**owner, **DEMO})
    if flagged.status != "stay":  # AG77102 is a cancellation: accepted, still no stay
        assert (res.status_code, res.json()["error"]["code"]) == (404, "no_completed_stay")
        return
    inv = res.json()
    assert inv["total_paid"] == flagged.list_amount - flagged.discount
    assert inv["taxable"] + inv["cgst"] + inv["sgst"] == inv["total_paid"]


def test_withdrawn_and_erased_threads_get_no_invoice(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    client.app.state.clock = lambda: TODAY  # type: ignore[attr-defined]
    stopped, forgotten, kept = threads(client, owner)[:3]
    res = client.post(f"/inbox/threads/{stopped}/simulate", headers=owner, json={"text": "STOP"})
    assert (res.status_code, res.json()) == (200, None)
    res = client.post(f"/inbox/threads/{forgotten}/forget", headers=owner, json={"confirm": True})
    assert res.status_code == 200
    for cid in (stopped, forgotten):
        for suffix in ("invoice", "invoice.pdf"):
            res = client.get(f"/inbox/threads/{cid}/{suffix}", headers={**owner, **DEMO})
            assert (res.status_code, res.json()["error"]["code"]) == (404, "no_such_thread")
    inbox.expire_all()
    assert inbox.scalar(select(func.count()).select_from(StayInvoice)) == 0
    assert client.get(f"/inbox/threads/{kept}/invoice", headers={**owner, **DEMO}).status_code == (
        200
    )


def test_another_propertys_seeded_consent_is_404_everywhere(
    client: TestClient, owner: dict[str, str], inbox: Session
) -> None:
    client.app.state.clock = lambda: TODAY  # type: ignore[attr-defined]
    cid = threads(client, owner)[0]
    consent = inbox.get(Consent, cid)
    assert consent is not None
    other = Property(name="Other Hotel", short_name="Other", city="c", address="a",
                     rooms_count=5, owner_name="o", perk_text="p", code_prefix="OTH",
                     is_sample=True)  # fmt: skip
    inbox.add(other)
    inbox.flush()
    consent.booking.property_id = other.id
    inbox.commit()
    for method, suffix in (("GET", "invoice"), ("GET", "invoice.pdf"), ("GET", "messages"),
                           ("POST", "draft")):  # fmt: skip
        res = client.request(method, f"/inbox/threads/{cid}/{suffix}", headers={**owner, **DEMO})
        assert (res.status_code, res.json()["error"]["code"]) == (404, "no_such_thread"), suffix
    assert cid not in threads(client, owner)
