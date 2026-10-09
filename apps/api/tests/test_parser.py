"""Statement parsing: known layouts, Claude fallback, grounding, bad input."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from functools import cache
from pathlib import Path

import pytest
from openpyxl import Workbook
from reportlab.pdfgen import canvas

from app.services.parser import (
    REASON_NOT_IN_SOURCE,
    ParseError,
    ParseResult,
    ReaderUnavailableError,
    cell_amounts,
    grounded,
    money_row,
    parse_statement,
    sniff_type,
    source_amounts,
    to_date,
    to_int,
    to_paise,
    to_status,
)
from app.services.samples import SAMPLE_FILES, sample_path
from seed.load import read_csv


@cache
def parsed(name: str) -> ParseResult:
    return parse_statement(name, sample_path(SAMPLE_FILES.index(name)).read_bytes(), None)


@pytest.mark.parametrize(
    ("text", "paise"),
    [
        ("4,200.00", 420_000),
        ("₹ 4,200", 420_000),
        ("Rs. 1,23,456.50", 12_345_650),
        ("INR 99", 9_900),
        ("-802.00", -80_200),
        ("(802.00)", -80_200),
        (4200, 420_000),
        (4200.5, 420_050),
        ("", 0),
        (None, 0),
    ],
)
def test_to_paise(text: object, paise: int) -> None:
    assert to_paise(text) == paise


@pytest.mark.parametrize("bad", ["abc", "1.234", True, "12..5"])
def test_to_paise_rejects(bad: object) -> None:
    with pytest.raises(ParseError):
        to_paise(bad)


def test_dates_status_and_ints() -> None:
    assert to_date("01-Apr-2026") == date(2026, 4, 1)
    assert to_date("2026-04-01") == date(2026, 4, 1)
    assert to_date("01/04/2026") == date(2026, 4, 1)
    assert to_date(datetime(2026, 4, 1, 10, 0)) == date(2026, 4, 1)
    assert to_date(date(2026, 4, 1)) == date(2026, 4, 1)
    with pytest.raises(ParseError):
        to_date("April first")
    assert to_status("Cancelled") == "cancelled"
    assert to_status("cancelled_by_guest") == "cancelled"
    assert to_status("Departed") == "stay"
    assert to_int(" 3 ") == 3
    with pytest.raises(ParseError):
        to_int("three")


def test_money_row_rejects_negative_and_unknown_columns() -> None:
    with pytest.raises(ParseError):
        money_row("stay", "-100", "0")
    with pytest.raises(ParseError):
        money_row("stay", "100", "0", discount="-5")
    with pytest.raises(ParseError):
        money_row("stay", "100", "0", surcharge="5")


def test_sniff_type() -> None:
    assert sniff_type("a.pdf", b"%PDF-1.4") == "pdf"
    assert sniff_type("a.xlsx", b"PK\x03\x04rest") == "xlsx"
    assert sniff_type("a.csv", b"a,b\n1,2") == "csv"
    with pytest.raises(ParseError, match="not named .pdf"):
        sniff_type("a.csv", b"%PDF-1.4")
    with pytest.raises(ParseError, match="not named .xlsx"):
        sniff_type("a.pdf", b"PK\x03\x04")
    with pytest.raises(ParseError, match="UTF-8"):
        sniff_type("a.csv", b"\xff\xfe\x00bad")
    with pytest.raises(ParseError, match="PDF, Excel"):
        sniff_type("a.docx", b"hello")


@pytest.mark.parametrize(
    ("name", "layout", "count"),
    [
        ("MakeMyTrip Apr to Jun.pdf", "makemytrip-payout-pdf", 410),
        ("MakeMyTrip Jul to Sep.pdf", "makemytrip-payout-pdf", 412),
        ("Booking.com payouts.xlsx", "booking-com-payouts", 214),
        ("Agoda statement.csv", "agoda-statement", 96),
        ("Travel agent register.xlsx", "travel-agent-register", 180),
        ("Hotel register.xlsx", "hotel-register", 188),
    ],
)
def test_sample_files_parse_to_the_canonical_rows(name: str, layout: str, count: int) -> None:
    result = parsed(name)
    assert (result.layout, result.method, len(result.rows)) == (layout, "layout", count)
    canonical = {r["external_ref"]: r for r in read_csv("window_rows.csv")}
    for row in result.rows:
        c = canonical[row.external_ref]
        assert row.channel == c["channel"]
        assert (row.status, row.check_in.isoformat(), row.nights) == (
            c["status"], c["check_in"], int(c["nights"]),
        )  # fmt: skip
        assert (row.guest_name, row.guest_city) == (c["guest_name"], c["guest_city"])
        m = row.money
        assert [m.list_amount, m.discount, m.commission, m.gst_on_commission, m.fees,
                m.tds, m.payout_reported] == [
            int(c[k]) * 100 for k in ("list_amount", "discount", "commission", "gst", "fees",
                                      "tds", "payout")
        ]  # fmt: skip


def test_layout_is_found_by_content_not_name() -> None:
    data = sample_path(SAMPLE_FILES.index("Agoda statement.csv")).read_bytes()
    result = parse_statement("my renamed export.csv", data, None)
    assert result.layout == "agoda-statement"


def unknown_csv() -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Ref", "Name", "When", "Gross", "Cut", "Paid"])
    writer.writerow(["X1", "Test Guest", "2026-05-01", "4,000.00", "720.00", "3,280.00"])
    return buffer.getvalue().encode()


class FakeReader:
    """Returns a fixed Claude answer and checks what it was sent."""

    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload
        self.calls = 0

    def extract(self, text: str, filename: str) -> dict[str, object]:
        self.calls += 1
        assert "Test Guest" in text
        assert filename == "odd.csv"
        return self.payload


def claude_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "ref": "X1", "guest_name": "Test Guest", "guest_city": "", "check_in": "2026-05-01",
        "nights": 1, "status": "stay", "list_amount": "4,000.00", "discount": "0",
        "commission": "720.00", "gst_on_commission": "0", "fees": "0", "tds": "0",
        "tcs": "0", "payout": "3,280.00",
    }  # fmt: skip
    row.update(overrides)
    return row


def test_unknown_layout_without_claude_is_a_clear_error() -> None:
    with pytest.raises(ReaderUnavailableError, match="simulated"):
        parse_statement("odd.csv", unknown_csv(), None)


def test_unknown_layout_with_claude() -> None:
    reader = FakeReader({"channel": "Travel agent", "rows": [claude_row()]})
    result = parse_statement("odd.csv", unknown_csv(), reader)
    assert (result.method, result.layout, reader.calls) == ("claude", "unknown", 1)
    row = result.rows[0]
    assert (row.channel, row.money.commission, row.forced_flag) == ("ta", 72_000, None)


def test_claude_amount_not_in_source_is_flagged() -> None:
    reader = FakeReader({"channel": "Travel agent", "rows": [claude_row(commission="999.00")]})
    row = parse_statement("odd.csv", unknown_csv(), reader).rows[0]
    assert row.forced_flag is not None
    assert row.forced_flag.reason == REASON_NOT_IN_SOURCE


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        ({"channel": "Expedia", "rows": [claude_row()]}, "which channel"),
        ({"channel": "Agoda", "rows": []}, "No booking lines"),
        ({"channel": "Agoda", "rows": ["junk"]}, "Line 1"),
        ({"channel": "Agoda", "rows": [claude_row(check_in="soon")]}, "Line 1"),
    ],
)
def test_bad_claude_answers(payload: dict[str, object], message: str) -> None:
    with pytest.raises(ParseError, match=message):
        parse_statement("odd.csv", unknown_csv(), FakeReader(payload))


def test_grounding_helpers() -> None:
    printed = source_amounts("Gross 4,000.00 paid 3,280.00 fee -12 total 1,23,456.50")
    assert {"4000", "3280", "-12", "123456.5"} <= printed
    cells = cell_amounts(["Gross", "Paid"], [["4000", "3,280.00"], [None, "800"]])
    assert {"4000", "3280", "800"} <= cells
    assert "4000800" not in cells
    assert grounded({"list_amount": "4000", "payout": "3,280.00", "fees": "12"}, printed)
    assert not grounded({"list_amount": "4100"}, printed)


def test_bad_line_reports_its_number() -> None:
    data = sample_path(SAMPLE_FILES.index("Agoda statement.csv")).read_bytes().decode()
    lines = data.splitlines()
    lines[3] = lines[3].replace(",Departed,", ",Departed,").replace("2026-", "20x6-", 1)
    with pytest.raises(ParseError, match="Line 4"):
        parse_statement("agoda.csv", "\n".join(lines).encode(), None)


def xlsx(rows: list[list[object]]) -> bytes:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    for row in rows:
        ws.append(row)
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def test_register_with_unknown_source_is_rejected() -> None:
    header: list[object] = ["Date", "Bill no", "Guest", "City", "Room", "Nights", "Source",
                             "Payment", "Tariff", "UPI fee", "Amount received"]  # fmt: skip
    line: list[object] = [
        date(2026, 5, 1),
        "HR1",
        "A B",
        "Delhi",
        101,
        1,
        "Expedia",
        "UPI",
        4300,
        17,
        4283,
    ]
    with pytest.raises(ParseError, match="Unknown register source"):
        parse_statement("r.xlsx", xlsx([header, line, header, []]), None)


def test_corrupt_and_empty_files() -> None:
    with pytest.raises(ParseError, match="PDF could not be opened"):
        parse_statement("a.pdf", b"%PDF-1.4 garbage", None)
    with pytest.raises(ParseError, match="Excel file could not be opened"):
        parse_statement("a.xlsx", b"PK\x03\x04garbage", None)
    with pytest.raises(ParseError, match="empty"):
        parse_statement("a.csv", b"", None)
    with pytest.raises(ParseError, match="empty"):
        parse_statement("a.xlsx", xlsx([]), None)


def test_too_much_text_for_claude(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.parser.MAX_TEXT_FOR_LLM", 10)
    with pytest.raises(ParseError, match="too large"):
        parse_statement("odd.csv", unknown_csv(), FakeReader({}))


def test_unknown_pdf_goes_to_claude(tmp_path: Path) -> None:
    path = tmp_path / "odd.pdf"
    pdf = canvas.Canvas(str(path))
    pdf.drawString(72, 720, "Ref X1 Test Guest 2026-05-01 Gross 4,000.00 Cut 720.00 Paid 3,280.00")
    pdf.save()
    with pytest.raises(ReaderUnavailableError):
        parse_statement("odd.pdf", path.read_bytes(), None)


def test_xlsx_zip_bomb_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.parser.MAX_XLSX_UNPACKED_BYTES", 1_000)
    with pytest.raises(ParseError, match="too large once unpacked"):
        parse_statement("r.xlsx", xlsx([list[object](["a"] * 50)] * 50), None)


def test_pdf_page_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.parser.MAX_PDF_PAGES", 2)
    data = sample_path(0).read_bytes()
    with pytest.raises(ParseError, match="at most 2 pages"):
        parse_statement("m.pdf", data, None)
