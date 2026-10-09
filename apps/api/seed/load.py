"""Load the fictional sample hotel into the database.

Run: python -m seed.load [--with-statements]

Default: property, rooms, channels, contracts, 2025 history and today's
in-house stays. The Apr to Sep 2026 statements are left for the Upload screen
(the demo starts there). --with-statements also loads the 1,500 statement
lines straight from the canonical CSV, for tests and for jumping ahead.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
from collections.abc import Iterable
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import load_settings
from app.db import make_engine, make_session_factory, session_scope
from app.models import (
    Booking,
    Channel,
    ChannelContract,
    Guest,
    Property,
    Room,
    StatementFile,
)
from app.money import LineItems, rupees
from app.services.checks import RawRow, check_row
from app.services.ledger import DEFAULT_END
from seed.spec import CHANNELS, HISTORY_FILE, PROPERTY, ROOM_TYPES, ROOMS

DATA_DIR = Path(__file__).resolve().parent / "data"
IST = ZoneInfo("Asia/Kolkata")
TODAY_FILE = "In-house today (sample)"


class SeedError(RuntimeError):
    """Raised when the sample data cannot be loaded safely."""


def resolve_demo_date(configured: date | None) -> date:
    """The in-house date. Must fall after the ledger window (decision D)."""
    demo_date = configured or datetime.now(IST).date()
    if demo_date <= DEFAULT_END:
        raise SeedError(f"DEMO_DATE {demo_date} must be after {DEFAULT_END}")
    return demo_date


def read_csv(name: str) -> list[dict[str, str]]:
    """Read one of the generated seed CSVs."""
    with (DATA_DIR / name).open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def load_base(session: Session) -> Property:
    """Property, rooms, channels and contracts."""
    prop = Property(is_sample=True, **PROPERTY)
    session.add(prop)
    session.flush()
    for number, room_type in ROOMS:
        session.add(Room(property_id=prop.id, number=number, room_type=room_type,
                         rack_rate=rupees(ROOM_TYPES[room_type])))  # fmt: skip
    for spec in CHANNELS:
        channel = Channel(property_id=prop.id, key=spec.key, name=spec.name,
                          kind=spec.kind, sort_order=spec.sort_order)  # fmt: skip
        session.add(channel)
        session.flush()
        session.add(
            ChannelContract(
                channel_id=channel.id,
                commission_bps=spec.commission_bps,
                gst_applies=spec.gst_applies,
                upi_fee_applies=spec.upi_fee_applies,
                valid_from=date(2025, 1, 1),
            )
        )
    session.flush()
    return prop


def file_record(session: Session, prop: Property, name: str, method: str) -> StatementFile:
    """A statement_file row for sample data that did not come through upload."""
    record = StatementFile(
        property_id=prop.id,
        filename=name,
        file_type=Path(name).suffix.lstrip(".") or "sample",
        sha256=hashlib.sha256(name.encode()).hexdigest(),
        parse_method=method,
        is_sample=True,
    )
    session.add(record)
    session.flush()
    return record


def booking_from_row(
    row: dict[str, str],
    prop: Property,
    channels: dict[str, Channel],
    rooms: dict[int, Room],
    gst_applies: dict[str, bool],
    source: str,
) -> Booking:
    """Convert one CSV row (rupees) into a checked Booking (paise)."""
    raw = RawRow(
        status=row["status"],
        list_amount=rupees(int(row["list_amount"])),
        discount=rupees(int(row["discount"])),
        commission=rupees(int(row["commission"])),
        gst_on_commission=rupees(int(row["gst"])),
        fees=rupees(int(row["fees"])),
        tds=rupees(int(row["tds"])),
        gst_tcs=rupees(int(row["tcs"])),
        payout_reported=rupees(int(row["payout"])),
    )
    result = check_row(raw, gst_applies[row["channel"]])
    lines = LineItems(raw.list_amount, raw.discount, raw.commission,
                      raw.gst_on_commission, raw.fees)  # fmt: skip
    room = rooms.get(int(row["room"])) if row["room"] else None
    return Booking(
        property_id=prop.id,
        channel_id=channels[row["channel"]].id,
        room_id=room.id if room else None,
        external_ref=row["external_ref"],
        source=source,
        status=row["status"],
        check_in=date.fromisoformat(row["check_in"]),
        nights=int(row["nights"]),
        guest_name=row["guest_name"],
        guest_city=row["guest_city"] or None,
        list_amount=raw.list_amount,
        discount=raw.discount,
        commission=raw.commission,
        gst_on_commission=raw.gst_on_commission,
        fees=raw.fees,
        net_kept=lines.net_kept,
        tds=raw.tds,
        gst_tcs=raw.gst_tcs,
        payout_reported=raw.payout_reported,
        math_check_passed=result.passed,
        flag_reason=result.reason,
        flag_detail=result.detail,
        review_status="none" if result.passed else "pending",
    )


class RowLoader:
    """Turns CSV rows into bookings for one property."""

    def __init__(self, session: Session, prop: Property) -> None:
        self.session = session
        self.prop = prop
        channels = session.scalars(select(Channel).where(Channel.property_id == prop.id))
        self.channels = {c.key: c for c in channels}
        rooms = session.scalars(select(Room).where(Room.property_id == prop.id))
        self.rooms = {r.number: r for r in rooms}
        contracts = session.scalars(select(ChannelContract)).all()
        key_by_id = {c.id: c.key for c in self.channels.values()}
        self.gst_applies = {
            key_by_id[c.channel_id]: c.gst_applies for c in contracts if c.channel_id in key_by_id
        }

    def load(self, rows: Iterable[dict[str, str]], source: str) -> list[Booking]:
        """Add every row under one statement_file per file name."""
        files: dict[str, StatementFile] = {}
        bookings: list[Booking] = []
        for row in rows:
            name = row["file"]
            if name not in files:
                files[name] = file_record(self.session, self.prop, name, "seed")
            booking = booking_from_row(row, self.prop, self.channels, self.rooms,
                                       self.gst_applies, source)  # fmt: skip
            booking.statement_file_id = files[name].id
            bookings.append(booking)
        self.session.add_all(bookings)
        self.session.flush()
        for record in files.values():
            mine = [b for b in bookings if b.statement_file_id == record.id]
            record.row_count = len(mine)
            record.flagged_count = sum(1 for b in mine if not b.math_check_passed)
        return bookings


def load_today(loader: RowLoader, demo_date: date) -> None:
    """Today's in-house stays, each with a guest record (Desk register)."""
    rows = read_csv("today_rows.csv")
    for row in rows:
        row["check_in"] = demo_date.isoformat()
    bookings = loader.load(rows, "desk")
    for row, booking in zip(rows, bookings, strict=True):
        guest = Guest(property_id=loader.prop.id, display_name=row["guest_name"],
                      short_name=row["short_name"], city=row["guest_city"])  # fmt: skip
        loader.session.add(guest)
        loader.session.flush()
        booking.guest_id = guest.id


def load_sample(session: Session, demo_date: date, with_statements: bool) -> Property:
    """Load the whole sample hotel into an empty database."""
    if session.scalar(select(Property.id).limit(1)) is not None:
        raise SeedError("database already has data; run make reset first")
    prop = load_base(session)
    loader = RowLoader(session, prop)
    loader.load(read_csv("history_rows.csv"), "history")
    load_today(loader, demo_date)
    if with_statements:
        loader.load(read_csv("window_rows.csv"), "statement")
    return prop


def main() -> None:
    """CLI entry: load the sample hotel into DATABASE_URL."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-statements", action="store_true")
    args = parser.parse_args()
    settings = load_settings()
    engine = make_engine(settings.database_url)
    demo_date = resolve_demo_date(settings.demo_date)
    with session_scope(make_session_factory(engine)) as session:
        prop = load_sample(session, demo_date, args.with_statements)
        print(f"Loaded sample hotel {prop.name} (demo date {demo_date})")  # noqa: T201


__all__ = ["HISTORY_FILE", "TODAY_FILE", "load_sample", "main"]

if __name__ == "__main__":
    main()
