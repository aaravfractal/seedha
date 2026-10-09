"""Write the six sample statement files from the canonical rows (fictional).

Run: python -m seed.statements   (writes seed/statements/*)

Each file uses its own layout, the way real exports differ: MakeMyTrip as a
PDF payout statement, Booking.com and the two registers as Excel, Agoda as
CSV. Output is byte-for-byte deterministic so file hashes stay stable.
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from collections.abc import Callable, Iterable
from datetime import date, datetime, timedelta
from pathlib import Path

from openpyxl import Workbook
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.samples import SAMPLE_DIR, SAMPLE_FILES
from seed.load import read_csv
from seed.spec import PROPERTY

OUT_DIR = SAMPLE_DIR
FIXED_TIME = datetime(2026, 10, 1, 9, 0, 0)
Row = dict[str, str]

MMT_HEADERS = (
    "Booking ID",
    "Guest",
    "City",
    "Check-in",
    "Nights",
    "Status",
    "Room charges",
    "Hotel promo",
    "Commission",
    "GST on commission",
    "TDS",
    "TCS",
    "Net payable",
)
BCOM_HEADERS = (
    "Reservation number",
    "Guest name",
    "Guest city",
    "Arrival",
    "Departure",
    "Status",
    "Room price",
    "Promotion discount",
    "Commission",
    "GST on commission",
    "TDS",
    "Payout amount",
)
AGODA_HEADERS = (
    "Booking ID",
    "Guest Name",
    "Guest City",
    "Check-in Date",
    "Check-out Date",
    "Booking Status",
    "Selling Rate (INR)",
    "Hotel Promotion (INR)",
    "Commission (INR)",
    "GST on Commission (INR)",
    "TDS (INR)",
    "Net Amount (INR)",
)
TA_HEADERS = (
    "Date",
    "Voucher no",
    "Agent",
    "Guest",
    "City",
    "Nights",
    "Room",
    "Status",
    "Tariff",
    "Commission",
    "Amount received",
)
REGISTER_HEADERS = (
    "Date",
    "Bill no",
    "Guest",
    "City",
    "Room",
    "Nights",
    "Source",
    "Payment",
    "Tariff",
    "UPI fee",
    "Amount received",
)
AGENTS = ("Himalayan Trails", "Doon Holidays", "Valley Tours & Travels", "Mussoorie Escapes")


def money(value: str) -> str:
    """Rupees as printed on an Indian statement: 4,200.00 (or -802.00)."""
    amount = int(value)
    sign = "-" if amount < 0 else ""
    return f"{sign}{abs(amount):,.2f}"


def departure(row: Row) -> date:
    """Check-out date of a canonical row."""
    return date.fromisoformat(row["check_in"]) + timedelta(days=int(row["nights"]))


def rows_for(rows: Iterable[Row], name: str) -> list[Row]:
    """Canonical rows that belong to one file."""
    return [r for r in rows if r["file"] == name]


# --- PDF (MakeMyTrip) -------------------------------------------------------


def mmt_line(row: Row) -> list[str]:
    """One MakeMyTrip PDF table line."""
    status = "Cancelled" if row["status"] == "cancelled" else "Confirmed"
    check_in = date.fromisoformat(row["check_in"]).strftime("%d-%b-%Y")
    return [
        row["external_ref"],
        row["guest_name"],
        row["guest_city"],
        check_in,
        row["nights"],
        status,
        money(row["list_amount"]),
        money(row["discount"]),
        money(row["commission"]),
        money(row["gst"]),
        money(row["tds"]),
        money(row["tcs"]),
        money(row["payout"]),
    ]


def write_mmt_pdf(path: Path, rows: list[Row], period: str) -> None:
    """A landscape payout statement with a gridded table, header on each page."""
    rl_config.invariant = True
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(path),
        pagesize=landscape(A4),
        title="MakeMyTrip payout",
        author="MakeMyTrip (sample)",
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24,
    )
    table = Table([list(MMT_HEADERS), *[mmt_line(r) for r in rows]], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, -1), "Helvetica", 7),
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
            ]
        )
    )
    story = [
        Paragraph("MakeMyTrip Hotel Payout Statement (SAMPLE DATA)", styles["Title"]),
        Paragraph(
            f"Property: {PROPERTY['name']}, {PROPERTY['city']} &nbsp; Period: {period}",
            styles["Normal"],
        ),
        Paragraph(
            "Amounts in INR. TDS u/s 194-O and TCS are withheld and claimable as credit.",
            styles["Normal"],
        ),
        Spacer(1, 8),
        table,
    ]
    doc.build(story)


# --- Excel ------------------------------------------------------------------


def write_xlsx(path: Path, sheet: str, headers: tuple[str, ...], lines: list[list[object]]) -> None:
    """One sheet, header row first, fixed document timestamps."""
    workbook = Workbook()
    ws = workbook.active
    assert ws is not None  # noqa: S101  (a new workbook always has one sheet)
    ws.title = sheet
    ws.append(list(headers))
    for line in lines:
        ws.append(line)
    workbook.properties.created = FIXED_TIME
    workbook.properties.modified = FIXED_TIME
    workbook.properties.creator = "Seedha sample data"
    buffer = io.BytesIO()
    workbook.save(buffer)
    path.write_bytes(_normalise_zip(buffer.getvalue()))


def _normalise_zip(data: bytes) -> bytes:
    """Rewrite the xlsx zip with fixed entry timestamps for stable hashes."""
    out = io.BytesIO()
    with (
        zipfile.ZipFile(io.BytesIO(data)) as source,
        zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as target,
    ):
        for info in source.infolist():
            fixed = zipfile.ZipInfo(info.filename, date_time=(2026, 10, 1, 9, 0, 0))
            fixed.compress_type = zipfile.ZIP_DEFLATED
            content = source.read(info.filename)
            if info.filename == "docProps/core.xml":
                content = re.sub(
                    rb"(<dcterms:(?:created|modified)[^>]*>)[^<]*(</dcterms:)",
                    rb"\g<1>2026-10-01T09:00:00Z\g<2>",
                    content,
                )
            target.writestr(fixed, content)
    return out.getvalue()


def bcom_line(row: Row) -> list[object]:
    """One Booking.com sheet line (numeric reservation number)."""
    status = "cancelled_by_guest" if row["status"] == "cancelled" else "ok"
    arrival = date.fromisoformat(row["check_in"])
    return [
        int(row["external_ref"][2:]),
        row["guest_name"],
        row["guest_city"],
        arrival,
        departure(row),
        status,
        int(row["list_amount"]),
        int(row["discount"]),
        int(row["commission"]),
        int(row["gst"]),
        int(row["tds"]),
        int(row["payout"]),
    ]


def ta_line(row: Row, index: int) -> list[object]:
    """One travel agent register line; agents rotate through a fixed list."""
    status = "Cancelled" if row["status"] == "cancelled" else "Stayed"
    return [
        date.fromisoformat(row["check_in"]),
        row["external_ref"],
        AGENTS[index % len(AGENTS)],
        row["guest_name"],
        row["guest_city"],
        int(row["nights"]),
        int(row["room"]) if row["room"] else None,
        status,
        int(row["list_amount"]),
        int(row["commission"]),
        int(row["payout"]),
    ]


def register_line(row: Row) -> list[object]:
    """One hotel register line."""
    upi = row["channel"] == "direct"
    return [
        date.fromisoformat(row["check_in"]),
        row["external_ref"],
        row["guest_name"],
        row["guest_city"],
        int(row["room"]),
        int(row["nights"]),
        "Direct" if upi else "Walk-in",
        "UPI" if upi else "Cash",
        int(row["list_amount"]),
        int(row["fees"]),
        int(row["payout"]),
    ]


# --- CSV (Agoda) --------------------------------------------------------------


def agoda_line(row: Row) -> list[str]:
    """One Agoda CSV line (numeric booking id)."""
    status = "Cancelled" if row["status"] == "cancelled" else "Departed"
    return [
        row["external_ref"][2:],
        row["guest_name"],
        row["guest_city"],
        row["check_in"],
        departure(row).isoformat(),
        status,
        f"{int(row['list_amount']):.2f}",
        f"{int(row['discount']):.2f}",
        f"{int(row['commission']):.2f}",
        f"{int(row['gst']):.2f}",
        f"{int(row['tds']):.2f}",
        f"{int(row['payout']):.2f}",
    ]


def write_agoda_csv(path: Path, rows: list[Row]) -> None:
    """Agoda statement as UTF-8 CSV with Unix line endings."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(AGODA_HEADERS)
    writer.writerows(agoda_line(r) for r in rows)
    path.write_text(buffer.getvalue(), encoding="utf-8")


def write_all(out_dir: Path = OUT_DIR) -> dict[str, int]:
    """Write every sample file; return rows per file."""
    rows = read_csv("window_rows.csv")
    out_dir.mkdir(parents=True, exist_ok=True)
    writers: dict[str, Callable[[Path, list[Row]], None]] = {
        "MakeMyTrip Apr to Jun.pdf": lambda p, r: write_mmt_pdf(p, r, "01-Apr-2026 to 30-Jun-2026"),
        "MakeMyTrip Jul to Sep.pdf": lambda p, r: write_mmt_pdf(p, r, "01-Jul-2026 to 30-Sep-2026"),
        "Booking.com payouts.xlsx": lambda p, r: write_xlsx(
            p, "Payouts", BCOM_HEADERS, [bcom_line(x) for x in r]
        ),
        "Agoda statement.csv": write_agoda_csv,
        "Travel agent register.xlsx": lambda p, r: write_xlsx(
            p, "Agent bookings", TA_HEADERS, [ta_line(x, i) for i, x in enumerate(r)]
        ),
        "Hotel register.xlsx": lambda p, r: write_xlsx(
            p, "Register", REGISTER_HEADERS, [register_line(x) for x in r]
        ),
    }
    counts: dict[str, int] = {}
    for name in SAMPLE_FILES:
        mine = rows_for(rows, name)
        writers[name](out_dir / name, mine)
        counts[name] = len(mine)
    return counts


if __name__ == "__main__":
    print(write_all())  # noqa: T201
