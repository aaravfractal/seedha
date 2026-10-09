"""Turn an uploaded statement into checked bookings.

Duplicate protection: a file whose SHA-256 was already imported is not read
again, and a line whose (channel, reference) already exists is skipped, so
uploading the same statement twice can never double-count money.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import PurePath

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, ChannelContract, Room, StatementFile
from app.services.parser import ParseResult, StatementReader, parse_statement
from app.services.rows import to_booking

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_FILENAME = 200


@dataclass(slots=True)
class IngestOutcome:
    """What happened to one file, for the Upload screen."""

    filename: str
    status: str
    file_id: int | None = None
    layout: str | None = None
    method: str | None = None
    rows: int = 0
    flagged: int = 0
    duplicates: int = 0
    message: str = ""
    flagged_refs: list[str] = field(default_factory=list)


def clean_filename(name: str) -> str:
    """Base name only, trimmed, never empty."""
    base = PurePath(name.replace("\\", "/")).name.strip()
    return base[:MAX_FILENAME] or "statement"


def already_imported(session: Session, property_id: int, digest: str) -> StatementFile | None:
    """An earlier upload of exactly the same bytes."""
    return session.scalar(
        select(StatementFile).where(
            StatementFile.property_id == property_id, StatementFile.sha256 == digest
        )
    )


class BookingWriter:
    """Writes parsed rows for one property, skipping lines already stored."""

    def __init__(self, session: Session, property_id: int) -> None:
        self.session = session
        self.property_id = property_id
        channels = session.scalars(select(Channel).where(Channel.property_id == property_id))
        self.channels = {c.key: c for c in channels}
        contracts = session.scalars(
            select(ChannelContract).where(
                ChannelContract.channel_id.in_([c.id for c in self.channels.values()])
            )
        )
        by_id = {c.id: c.key for c in self.channels.values()}
        self.gst_applies = {by_id[c.channel_id]: c.gst_applies for c in contracts}
        rooms = session.scalars(select(Room).where(Room.property_id == property_id))
        self.rooms = {r.number: r.id for r in rooms}

    def existing_refs(self, channel_id: int, refs: list[str]) -> set[str]:
        """References from this list already stored for the channel."""
        found = self.session.scalars(
            select(Booking.external_ref).where(
                Booking.channel_id == channel_id, Booking.external_ref.in_(refs)
            )
        )
        return set(found)

    def write(self, result: ParseResult, file_id: int, source: str) -> tuple[list[Booking], int]:
        """Add new bookings; return them and the number of duplicates skipped."""
        added: list[Booking] = []
        duplicates = 0
        by_channel: dict[str, list[str]] = {}
        for row in result.rows:
            by_channel.setdefault(row.channel, []).append(row.external_ref)
        seen = {
            key: self.existing_refs(self.channels[key].id, refs) for key, refs in by_channel.items()
        }
        for row in result.rows:
            if row.external_ref in seen[row.channel]:
                duplicates += 1
                continue
            seen[row.channel].add(row.external_ref)
            booking = to_booking(
                row,
                property_id=self.property_id,
                channel_id=self.channels[row.channel].id,
                gst_applies=self.gst_applies[row.channel],
                source=source,
                room_id=self.rooms.get(row.room) if row.room is not None else None,
            )
            booking.statement_file_id = file_id
            added.append(booking)
        self.session.add_all(added)
        self.session.flush()
        return added, duplicates


def ingest_statement(
    session: Session,
    property_id: int,
    filename: str,
    data: bytes,
    reader: StatementReader | None,
    is_sample: bool = False,
) -> IngestOutcome:
    """Parse, check and store one statement file. Errors propagate to the caller."""
    name = clean_filename(filename)
    digest = hashlib.sha256(data).hexdigest()
    earlier = already_imported(session, property_id, digest)
    if earlier is not None:
        return IngestOutcome(
            filename=name,
            status="already_imported",
            file_id=earlier.id,
            layout=earlier.parse_method,
            rows=earlier.row_count,
            flagged=earlier.flagged_count,
            message="This exact file was already read. Nothing was counted twice.",
        )
    result = parse_statement(name, data, reader)
    record = StatementFile(
        property_id=property_id,
        filename=name,
        file_type=name.rsplit(".", 1)[-1].lower(),
        sha256=digest,
        parse_method=f"{result.method}:{result.layout}",
        is_sample=is_sample,
    )
    session.add(record)
    session.flush()
    added, duplicates = BookingWriter(session, property_id).write(result, record.id, "statement")
    flagged = [b for b in added if not b.math_check_passed]
    record.row_count = len(added)
    record.flagged_count = len(flagged)
    return IngestOutcome(
        filename=name,
        status="imported",
        file_id=record.id,
        layout=result.layout,
        method=result.method,
        rows=len(added),
        flagged=len(flagged),
        duplicates=duplicates,
        flagged_refs=[b.external_ref for b in flagged],
    )
