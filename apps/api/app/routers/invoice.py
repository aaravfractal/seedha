"""Stay invoice preview and PDF for a consented guest's finished stay (B4).

Owner routes under /inbox so the web BFF forwards them unchanged. Only an
active consent of this property has an invoice; anything else is a 404.
Every amount comes from the booking row by code (rule 1, D-100).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Header, Response
from pydantic import BaseModel

from app.deps import OwnerDep, PropertyDep, SessionDep
from app.errors import ApiError
from app.models import Property
from app.routers.auth import DEMO_SUBJECT, NowDep, account_of
from app.routers.inbox import thread_or_404
from app.routers.settings import SAMPLE_GSTIN
from app.services.invoice import (
    FOOTER,
    THANK_YOU,
    Invoice,
    InvoiceError,
    detail_lines,
    gst_note,
    invoice_for_consent,
    issuer_for,
    render_pdf,
)
from app.services.settings import find_settings

router = APIRouter(prefix="/inbox", tags=["inbox"])


class InvoiceLineOut(BaseModel):
    """One printed line, label and display value as on the PDF."""

    label: str
    value: str


class InvoiceOut(BaseModel):
    """The invoice preview. Money in integer paise; `lines` are display text."""

    number: str
    filename: str
    issued_on: date
    sample: bool
    hotel_name: str
    hotel_address: str
    gstin: str | None
    guest_name: str
    check_in: date
    check_out: date
    nights: int
    room: str
    rate_per_night: int
    rate_is_average: bool
    room_charges: int
    discount: int
    taxable: int
    gst_bps: int
    cgst: int
    sgst: int
    total_paid: int
    payment_method: str
    lines: list[InvoiceLineOut]
    gst_note: str
    thank_you: str
    footer: str


def invoice_out(inv: Invoice) -> InvoiceOut:
    """Shape the preview."""
    return InvoiceOut(
        number=inv.number, filename=inv.filename, issued_on=inv.issued_on, sample=inv.sample,
        hotel_name=inv.hotel_name, hotel_address=inv.hotel_address, gstin=inv.gstin,
        guest_name=inv.guest_name, check_in=inv.check_in, check_out=inv.check_out,
        nights=inv.nights, room=inv.room, rate_per_night=inv.rate_per_night,
        rate_is_average=inv.rate_is_average, room_charges=inv.room_charges,
        discount=inv.discount, taxable=inv.taxable, gst_bps=inv.gst_bps, cgst=inv.cgst,
        sgst=inv.sgst, total_paid=inv.total_paid, payment_method=inv.payment_method,
        lines=[InvoiceLineOut(label=label, value=value) for label, value in detail_lines(inv)],
        gst_note=gst_note(inv), thank_you=THANK_YOU, footer=FOOTER,
    )  # fmt: skip


def load_invoice(
    session: SessionDep, prop: Property, consent_id: int, subject: str | None, now: datetime
) -> Invoice:
    """The invoice of the thread's latest finished stay, or the API error.

    Without a subject header (server-side token holders) the demo view is used.
    """
    consent = thread_or_404(session, prop.id, consent_id)
    who = (subject or DEMO_SUBJECT).strip()
    demo = who == DEMO_SUBJECT
    if not demo:  # require_subject_access already refused malformed subjects
        account_of(session, who)
    issuer = issuer_for(prop, find_settings(session, who), demo=demo, sample_gstin=SAMPLE_GSTIN)
    try:
        return invoice_for_consent(session, prop, consent, issuer=issuer, now=now)
    except InvoiceError as exc:
        raise ApiError(exc.status, exc.code, exc.message) from exc


SubjectHeader = Annotated[str | None, Header(alias="x-seedha-subject")]


@router.get("/threads/{consent_id}/invoice", response_model=InvoiceOut)
def get_invoice(
    consent_id: int,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    now: NowDep,
    x_seedha_subject: SubjectHeader = None,
) -> InvoiceOut:
    """Preview the stay invoice (numbered on first request, reused after)."""
    return invoice_out(load_invoice(session, prop, consent_id, x_seedha_subject, now))


@router.get(
    "/threads/{consent_id}/invoice.pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def get_invoice_pdf(
    consent_id: int,
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    now: NowDep,
    x_seedha_subject: SubjectHeader = None,
) -> Response:
    """The same invoice as a PDF download."""
    inv = load_invoice(session, prop, consent_id, x_seedha_subject, now)
    return Response(
        content=render_pdf(inv),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{inv.filename}"',
            "Cache-Control": "no-store",
        },
    )
