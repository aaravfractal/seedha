"""Stay invoices (POLISH_BUILD B4, D-100): totals equal the booking row, GST
backed out exactly, numbering per financial year, GSTIN only when set, the
Sample mark, the PDF, scope (active consents of this property only) and the
GST rate setting."""

from __future__ import annotations

import io
import re
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from itertools import count
from typing import Any

import pdfplumber
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Channel,
    Consent,
    DirectBooking,
    Guest,
    OwnerAccount,
    OwnerSettings,
    Property,
    Room,
    StayInvoice,
)
from app.money import MoneyError, rupees
from app.routers.settings import SAMPLE_GSTIN
from app.services.inbox import d6_ok
from app.services.invoice import (
    FOOTER,
    THANK_YOU,
    Invoice,
    Issuer,
    build_invoice,
    financial_year,
    format_rs,
    gst_included_split,
    half_rate_label,
    invoice_prefix,
    issuer_for,
    last_invoice_number,
    render_pdf,
    safe_filename,
)

DEMO = {"X-Seedha-Subject": "demo"}
TODAY = datetime(2026, 10, 13, 6, 30, tzinfo=UTC)  # noon in India
_refs = count(1)


def at(moment: datetime, client: TestClient) -> None:
    client.app.state.clock = lambda: moment  # type: ignore[attr-defined]


def channel(session: Session, key: str) -> Channel:
    return session.scalars(select(Channel).where(Channel.key == key)).one()


def stay(  # pylint: disable=too-many-arguments
    session: Session,
    *,
    key: str = "walkin",
    list_amount: int = rupees(9_000),
    discount: int = rupees(500),
    nights: int = 2,
    check_in: date = date(2026, 9, 20),
    property_id: int | None = None,
    passed: bool = True,
    guest: Guest | None = None,
) -> Booking:
    """A finished stay of a fresh (fictional) guest, no commission lines."""
    ch = channel(session, key)
    pid = property_id if property_id is not None else ch.property_id
    if guest is None:
        guest = Guest(property_id=pid, display_name="Asha Rawat (sample)", short_name="Asha")
        session.add(guest)
        session.flush()
    room = session.scalars(select(Room).where(Room.number == 104)).first()
    total = list_amount - discount
    booking = Booking(
        property_id=pid, channel_id=ch.id, guest_id=guest.id,
        room_id=room.id if room else None, external_ref=f"INV{next(_refs):05d}",
        source="history", status="stay", check_in=check_in, nights=nights,
        guest_name=guest.display_name, list_amount=list_amount, discount=discount,
        commission=0, gst_on_commission=0, fees=0, net_kept=total, payout_reported=total,
        math_check_passed=passed,
    )  # fmt: skip
    session.add(booking)
    session.flush()
    return booking


def consent_for(session: Session, booking: Booking, *, withdrawn: bool = False) -> int:
    assert booking.guest_id is not None
    row = Consent(
        guest_id=booking.guest_id, booking_id=booking.id, wording_version="v1",
        given_at=TODAY - timedelta(days=20), salt="ab" * 16,
        fingerprint=f"{booking.id:064x}", whatsapp_number="9876500000",
        withdrawn_at=TODAY if withdrawn else None,
    )  # fmt: skip
    session.add(row)
    session.commit()
    return row.id


def get_invoice(client: TestClient, owner: dict[str, str], cid: int) -> dict[str, object]:
    res = client.get(f"/inbox/threads/{cid}/invoice", headers={**owner, **DEMO})
    assert res.status_code == 200, res.text
    body: dict[str, object] = res.json()
    return body


def pdf_text(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


# --- maths -------------------------------------------------------------------------


@pytest.mark.parametrize("bps", [0, 500, 1200, 1800, 2800, 501])
@pytest.mark.parametrize("total", [0, 100, rupees(1), rupees(3_399), rupees(8_500), 123_457])
def test_gst_split_always_adds_up_to_the_total(total: int, bps: int) -> None:
    split = gst_included_split(total, bps)
    assert split.taxable + split.cgst + split.sgst == total
    assert 0 <= split.sgst <= split.cgst + 100
    assert split.taxable <= total


def test_gst_split_backs_tax_out_of_the_price() -> None:
    split = gst_included_split(rupees(3_400), 500)
    assert (split.taxable, split.cgst, split.sgst) == (rupees(3_238), rupees(81), rupees(81))
    assert gst_included_split(rupees(3_400), 0).taxable == rupees(3_400)


def test_gst_split_refuses_bad_input() -> None:
    with pytest.raises(MoneyError):
        gst_included_split(-1, 500)
    with pytest.raises(MoneyError):
        gst_included_split(100, 2_801)


def test_number_parts_and_labels() -> None:
    assert financial_year(date(2027, 3, 31)) == "2627"
    assert financial_year(date(2027, 4, 1)) == "2728"
    assert financial_year(date(2099, 12, 1)) == "9900"
    prop = Property(name="X", short_name="Pine & Oak", city="c", address="a", rooms_count=1,
                    owner_name="o", perk_text="p", code_prefix="", is_sample=False)  # fmt: skip
    assert invoice_prefix(prop) == "PINEOAK"
    assert safe_filename("DEODAR/2627/0001") == "stay-invoice-DEODAR-2627-0001.pdf"
    assert safe_filename('../"x"\r\n') == "stay-invoice-x.pdf"
    assert safe_filename("///") == "stay-invoice-invoice.pdf"
    assert format_rs(rupees(1_23_456)) == "Rs 1,23,456"
    assert format_rs(-rupees(500)) == "-Rs 500"
    assert (half_rate_label(500), half_rate_label(1800), half_rate_label(0)) == ("2.5%", "9%", "0%")


# --- API: totals, numbering ------------------------------------------------------------


@pytest.mark.parametrize(
    ("list_amount", "discount", "nights", "key"),
    [(rupees(9_000), rupees(500), 2, "walkin"), (rupees(6_200), rupees(744), 1, "mmt"),
     (rupees(10_001), 0, 3, "bcom"), (rupees(4_283), rupees(1), 1, "direct")],
)  # fmt: skip
def test_invoice_totals_equal_the_booking_row(
    sample: Session, client: TestClient, owner: dict[str, str],
    list_amount: int, discount: int, nights: int, key: str,
) -> None:  # fmt: skip
    at(TODAY, client)
    booking = stay(sample, key=key, list_amount=list_amount, discount=discount, nights=nights)
    inv = get_invoice(client, owner, consent_for(sample, booking))
    assert inv["total_paid"] == booking.list_amount - booking.discount
    assert inv["taxable"] + inv["cgst"] + inv["sgst"] == inv["total_paid"]  # type: ignore[operator]
    assert inv["room_charges"] == booking.list_amount
    assert inv["discount"] == booking.discount
    assert inv["nights"] == nights
    assert inv["gst_bps"] == 500
    assert inv["rate_is_average"] is (list_amount % nights != 0)
    assert inv["thank_you"] == THANK_YOU
    assert inv["footer"] == FOOTER


def test_number_is_per_financial_year_and_reused(
    sample: Session, client: TestClient, owner: dict[str, str]
) -> None:
    at(TODAY, client)
    first = consent_for(sample, stay(sample))
    second = consent_for(sample, stay(sample))
    one = get_invoice(client, owner, first)
    assert one["number"] == "DEODAR/2627/0001"
    assert one["filename"] == "stay-invoice-DEODAR-2627-0001.pdf"
    assert one["issued_on"] == "2026-10-13"
    assert get_invoice(client, owner, second)["number"] == "DEODAR/2627/0002"
    assert get_invoice(client, owner, first)["number"] == "DEODAR/2627/0001"
    at(datetime(2027, 3, 31, 18, 29, tzinfo=UTC), client)  # 23:59 on 31 March in India
    assert get_invoice(client, owner, consent_for(sample, stay(sample)))["number"] == (
        "DEODAR/2627/0003"
    )
    at(datetime(2027, 3, 31, 18, 31, tzinfo=UTC), client)  # 00:01 on 1 April in India
    april = get_invoice(client, owner, consent_for(sample, stay(sample)))
    assert april["number"] == "DEODAR/2728/0001"
    assert april["issued_on"] == "2027-04-01"
    assert len(sample.scalars(select(StayInvoice)).all()) == 4


def test_latest_finished_stay_is_invoiced_and_flagged_rows_are_not(
    sample: Session, client: TestClient, owner: dict[str, str]
) -> None:
    at(TODAY, client)
    older = stay(sample, check_in=date(2026, 5, 1), list_amount=rupees(4_000), discount=0)
    guest = older.guest
    stay(sample, guest=guest, check_in=date(2026, 9, 1), passed=False)  # flagged, not reviewed
    stay(sample, guest=guest, check_in=date(2026, 10, 12), nights=3)  # not finished yet
    cid = consent_for(sample, older)
    inv = get_invoice(client, owner, cid)
    assert inv["total_paid"] == rupees(4_000)
    assert inv["check_out"] == "2026-05-03"
    assert last_invoice_number(sample, sample.get(Consent, cid)) == inv["number"]  # type: ignore[arg-type]


def test_no_finished_stay_is_404(
    sample: Session, client: TestClient, owner: dict[str, str]
) -> None:
    at(TODAY, client)
    cid = consent_for(sample, stay(sample, check_in=date(2026, 10, 12), nights=2))
    res = client.get(f"/inbox/threads/{cid}/invoice", headers={**owner, **DEMO})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "no_completed_stay"


def test_payment_method_by_source(
    sample: Session, client: TestClient, owner: dict[str, str]
) -> None:
    at(TODAY, client)
    ota = get_invoice(client, owner, consent_for(sample, stay(sample, key="mmt")))
    assert ota["payment_method"] == "Paid via MakeMyTrip"
    walkin = get_invoice(client, owner, consent_for(sample, stay(sample, key="walkin")))
    assert walkin["payment_method"] == "Not recorded"
    linked = stay(sample, key="direct", list_amount=rupees(5_000), discount=0)
    sample.add(DirectBooking(property_id=linked.property_id, booking_id=linked.id,
                             amount=rupees(5_000), payment_method="upi_simulated",
                             payment_ref="SIM-1"))  # fmt: skip
    assert get_invoice(client, owner, consent_for(sample, linked))["payment_method"] == (
        "UPI (simulated)"
    )


# --- GSTIN, issuer, Sample mark, PDF ----------------------------------------------------


def test_demo_sees_the_sample_gstin_and_the_sample_mark(
    sample: Session, client: TestClient, owner: dict[str, str]
) -> None:
    at(TODAY, client)
    inv = get_invoice(client, owner, consent_for(sample, stay(sample)))
    assert inv["gstin"] == SAMPLE_GSTIN
    assert inv["sample"] is True
    assert inv["hotel_name"] == "Hotel Deodar View"
    assert inv["hotel_address"] == "Mall Road, Mussoorie"


def test_issuer_shows_gstin_only_when_set() -> None:
    prop = Property(name="Pine Rest", short_name="Pine", city="c", address="Hill Road",
                    rooms_count=10, owner_name="o", perk_text="p", code_prefix="PINE",
                    is_sample=False)  # fmt: skip
    empty = OwnerSettings(subject="a1", gstin=None, room_gst_bps=None)
    assert issuer_for(prop, empty, demo=False, sample_gstin="X").gstin is None
    assert issuer_for(prop, None, demo=False, sample_gstin="X").gst_bps == 500
    assert issuer_for(prop, None, demo=True, sample_gstin="X").gstin is None
    own = OwnerSettings(subject="a1", gstin="05AAAAA0000A1Z5", business_name="Pine Rest LLP",
                        address="12 Hill Road", pin="248001", room_gst_bps=1200)  # fmt: skip
    issuer = issuer_for(prop, own, demo=False, sample_gstin="X")
    assert (issuer.name, issuer.address, issuer.gstin, issuer.gst_bps, issuer.sample) == (
        "Pine Rest LLP",
        "12 Hill Road 248001",
        "05AAAAA0000A1Z5",
        1200,
        False,
    )
    own.pin = None
    assert issuer_for(prop, own, demo=False, sample_gstin="X").address == "12 Hill Road"


def invoice_of(**changes: Any) -> Invoice:
    base = Invoice(
        number="PINE/2627/0007", issued_on=date(2026, 10, 13), hotel_name="Pine Rest",
        hotel_address="Hill Road", gstin=None, sample=False, guest_name="Asha",
        check_in=date(2026, 9, 1), nights=2, room="104 (Deluxe)",
        rate_per_night=rupees(4_500), rate_is_average=False, room_charges=rupees(9_000),
        discount=0, taxable=rupees(8_571), gst_bps=500, cgst=rupees(215), sgst=rupees(214),
        total_paid=rupees(9_000), payment_method="Not recorded",
    )  # fmt: skip
    return replace(base, **changes)


def test_pdf_without_gstin_or_sample_mark() -> None:
    data = render_pdf(invoice_of())
    assert data.startswith(b"%PDF")
    text = pdf_text(data)
    assert "GSTIN" not in text
    assert "SAMPLE" not in text
    assert "PINE/2627/0007" in text
    assert "Rs 9,000" in text
    assert "Discount Rs 0" in text
    assert FOOTER in text
    assert render_pdf(invoice_of()) == data  # deterministic bytes


def test_pdf_download(sample: Session, client: TestClient, owner: dict[str, str]) -> None:
    at(TODAY, client)
    booking = stay(sample, list_amount=rupees(12_345), discount=rupees(345), nights=3)
    cid = consent_for(sample, booking)
    res = client.get(f"/inbox/threads/{cid}/invoice.pdf", headers={**owner, **DEMO})
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    disposition = res.headers["content-disposition"]
    assert disposition == 'attachment; filename="stay-invoice-DEODAR-2627-0001.pdf"'
    assert re.fullmatch(r'attachment; filename="[A-Za-z0-9.-]+"', disposition)
    assert res.content.startswith(b"%PDF")
    text = pdf_text(res.content)
    for needle in (
        "DEODAR/2627/0001",
        "Total paid Rs 12,000",
        "Discount -Rs 345",
        "Rate per night Rs 4,115",
        f"GSTIN {SAMPLE_GSTIN}",
        "SAMPLE",
        "CGST at 2.5%",
        "Payment Not recorded",
        THANK_YOU,
        FOOTER,
    ):
        assert needle in text, needle
    with pdfplumber.open(io.BytesIO(res.content)) as pdf:
        assert pdf.metadata.get("Author") == "Seedha"


def test_ai_covering_text_may_not_carry_the_invoice_number() -> None:
    """The number and amounts are attached by code; an AI text holding them
    fails the D6 guard and falls back to the template."""
    assert not d6_ok("Your invoice DEODAR/2627/0001 is attached")
    assert not d6_ok("Total paid Rs 12,000")
    assert d6_ok("Here is your stay invoice. Thank you for staying with us.")


def test_build_invoice_refuses_another_hotels_booking(sample: Session) -> None:
    prop = sample.scalars(select(Property)).one()
    other = Property(name="Other", short_name="Other", city="c", address="a", rooms_count=1,
                     owner_name="o", perk_text="p", code_prefix="OTH", is_sample=False)  # fmt: skip
    sample.add(other)
    sample.flush()
    booking = stay(sample, property_id=other.id)
    issuer = Issuer(name="x", address="y", gstin=None, gst_bps=500, sample=False)
    with pytest.raises(ValueError, match="not at your hotel"):
        build_invoice(sample, prop, booking, issuer=issuer, now=TODAY)


# --- scope and auth ---------------------------------------------------------------------


def test_other_property_withdrawn_and_unknown_threads_are_404(
    sample: Session, client: TestClient, owner: dict[str, str]
) -> None:
    at(TODAY, client)
    other = Property(name="Other", short_name="Other", city="c", address="a", rooms_count=1,
                     owner_name="o", perk_text="p", code_prefix="OTH", is_sample=True)  # fmt: skip
    sample.add(other)
    sample.flush()
    elsewhere = consent_for(sample, stay(sample, property_id=other.id))
    withdrawn = consent_for(sample, stay(sample), withdrawn=True)
    for cid in (elsewhere, withdrawn, 999_999):
        for suffix in ("invoice", "invoice.pdf"):
            res = client.get(f"/inbox/threads/{cid}/{suffix}", headers={**owner, **DEMO})
            assert res.status_code == 404, (cid, suffix)
    assert sample.scalars(select(StayInvoice)).all() == []


def test_invoice_is_owner_only(sample: Session, client: TestClient, owner: dict[str, str]) -> None:
    at(TODAY, client)
    cid = consent_for(sample, stay(sample))
    for suffix in ("invoice", "invoice.pdf"):
        assert client.get(f"/inbox/threads/{cid}/{suffix}").status_code == 401
        bad = {"Authorization": "Bearer wrong", **DEMO}
        assert client.get(f"/inbox/threads/{cid}/{suffix}", headers=bad).status_code == 401
        odd = {**owner, "X-Seedha-Subject": "nobody"}
        assert client.get(f"/inbox/threads/{cid}/{suffix}", headers=odd).status_code == 401
    # a server-side token holder (no subject header) gets the demo view
    assert client.get(f"/inbox/threads/{cid}/invoice", headers=owner).status_code == 200


# --- Settings: the GST rate ------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_gst_rate_setting_drives_the_invoice(client: TestClient, owner: dict[str, str],
                                             sample: Session) -> None:  # fmt: skip
    at(TODAY, client)
    headers = {**owner, **DEMO}
    view = client.get("/settings", headers=headers).json()["invoice"]
    assert view == {"room_gst_bps": 500, "is_default": True, "default_bps": 500, "max_bps": 2800}
    res = client.patch("/settings/invoice", headers=headers, json={"room_gst_bps": 1800})
    assert res.status_code == 200
    assert res.json()["room_gst_bps"] == 1800
    assert res.json()["is_default"] is False
    assert client.get("/settings/invoice", headers=headers).json()["room_gst_bps"] == 1800
    inv = get_invoice(client, owner, consent_for(sample, stay(sample, discount=0)))
    assert inv["gst_bps"] == 1800
    assert (inv["taxable"], inv["cgst"], inv["sgst"]) == (rupees(7_627), rupees(687), rupees(686))
    assert any(line["label"] == "CGST at 9%" for line in inv["lines"])  # type: ignore[attr-defined]
    for bad in (-1, 2_801, "five"):
        res = client.patch("/settings/invoice", headers=headers, json={"room_gst_bps": bad})
        assert res.status_code == 422, bad
    res = client.patch("/settings/invoice", headers=headers, json={"room_gst_bps": None})
    assert res.json()["is_default"] is True
    assert (
        client.patch("/settings/invoice", headers=owner, json={"room_gst_bps": 0}).status_code
        == 401
    )


def test_owner_account_gstin_and_rate_on_the_sample_hotel(
    sample: Session, client: TestClient, owner: dict[str, str]
) -> None:
    at(TODAY, client)
    account = OwnerAccount(
        name="Meera Rawat", hotel_name="Pine Crest", phone="9876543210",
        terms_accepted_at=TODAY, created_at=TODAY, verified_at=TODAY,
    )  # fmt: skip
    sample.add(account)
    sample.flush()
    subject = f"a{account.id}"
    sample.add(OwnerSettings(subject=subject, gstin=None, room_gst_bps=1200, updated_at=TODAY))
    cid = consent_for(sample, stay(sample))
    res = client.get(
        f"/inbox/threads/{cid}/invoice", headers={**owner, "X-Seedha-Subject": subject}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["gstin"] is None  # hidden while the owner has not set one
    assert body["gst_bps"] == 1200
    assert body["hotel_name"] == "Hotel Deodar View"  # sample data keeps the sample hotel
    assert body["sample"] is True
