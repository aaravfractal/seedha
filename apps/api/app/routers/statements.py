"""Statement upload, the sample statements, and owner review of flagged rows."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Booking, Channel, StatementFile
from app.services.ingest import MAX_UPLOAD_BYTES, IngestOutcome, ingest_statement
from app.services.llm import statement_reader
from app.services.parser import ParseError, ReaderUnavailableError, StatementReader
from app.services.recover import dispute_for, disputes
from app.services.samples import SAMPLE_FILES, sample_path

router = APIRouter(prefix="/statements", tags=["statements"])


class FileOut(BaseModel):
    """One uploaded statement."""

    id: int
    filename: str
    file_type: str
    parse_method: str
    row_count: int
    flagged_count: int
    is_sample: bool
    uploaded_at: datetime


class FlaggedRowOut(BaseModel):
    """A line kept out of the flip until the owner reviews it (rule 3)."""

    id: int
    channel: str
    external_ref: str
    reason: str
    detail: str
    review_status: str


class StatementsOut(BaseModel):
    """Everything the Upload screen shows."""

    files: list[FileOut]
    rows: int
    flagged: int
    pending_review: int
    flagged_rows: list[FlaggedRowOut]


class OutcomeOut(BaseModel):
    """Result of reading one file."""

    filename: str
    status: str
    file_id: int | None
    layout: str | None
    method: str | None
    rows: int
    flagged: int
    duplicates: int
    message: str
    flagged_refs: list[str]


class SampleFileOut(BaseModel):
    """A sample statement offered by the "Use sample statements" button."""

    index: int
    filename: str


class ReviewIn(BaseModel):
    """Owner decision on a flagged row."""

    decision: Literal["accept", "exclude"]
    note: str | None = Field(default=None, max_length=200)


class DisputeOut(BaseModel):
    """A dispute letter filled by code from the stored line (Seedha Recover)."""

    booking_id: int
    channel: str
    external_ref: str
    reason: str
    review_status: str
    audit_claim: int
    other_claim: int
    subject: str
    text: str


class RecoverOut(BaseModel):
    """Every dispute. audit_claim equals the Seedha Audit figure on Pro."""

    audit_claim: int
    other_claim: int
    disputes: list[DisputeOut]


def get_reader(request: Request, settings: SettingsDep) -> StatementReader | None:
    """Claude reader, overridable in tests via app.state.statement_reader."""
    override: StatementReader | None = getattr(request.app.state, "statement_reader", None)
    return override if override is not None else statement_reader(settings)


ReaderDep = Annotated[StatementReader | None, Depends(get_reader)]


def statement_summary(session: Session, property_id: int) -> StatementsOut:
    """Files, row counts and every flagged row of uploaded statements."""
    files = session.scalars(
        select(StatementFile)
        .where(StatementFile.property_id == property_id, StatementFile.parse_method != "seed")
        .order_by(StatementFile.id)
    ).all()
    flagged = session.execute(
        select(Booking, Channel.name)
        .join(Channel, Channel.id == Booking.channel_id)
        .where(
            Booking.property_id == property_id,
            Booking.source == "statement",
            Booking.math_check_passed.is_(False),
        )
        .order_by(Booking.id)
    ).all()
    rows = session.scalar(
        select(func.count()).where(
            Booking.property_id == property_id, Booking.source == "statement"
        )
    )
    return StatementsOut(
        files=[FileOut.model_validate(f, from_attributes=True) for f in files],
        rows=rows or 0,
        flagged=len(flagged),
        pending_review=sum(1 for b, _ in flagged if b.review_status == "pending"),
        flagged_rows=[
            FlaggedRowOut(
                id=b.id,
                channel=name,
                external_ref=b.external_ref,
                reason=b.flag_reason or "",
                detail=b.flag_detail or "",
                review_status=b.review_status,
            )  # fmt: skip
            for b, name in flagged
        ],
    )


def run_ingest(
    session: Session, property_id: int, filename: str, data: bytes,
    reader: StatementReader | None, is_sample: bool,
) -> OutcomeOut:  # fmt: skip
    """Ingest and translate parse failures into clear 422/503 errors."""
    try:
        outcome: IngestOutcome = ingest_statement(
            session, property_id, filename, data, reader, is_sample=is_sample
        )
    except ParseError as exc:
        raise ApiError(422, "unreadable_statement", str(exc)) from exc
    except ReaderUnavailableError as exc:
        raise ApiError(503, "needs_claude", str(exc)) from exc
    return OutcomeOut.model_validate(outcome, from_attributes=True)


@router.get("", response_model=StatementsOut)
def list_statements(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> StatementsOut:
    """Uploaded files and flagged rows."""
    return statement_summary(session, prop.id)


@router.post("", response_model=OutcomeOut)
async def upload_statement(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    reader: ReaderDep,
    file: Annotated[UploadFile, File(description="PDF, XLSX or CSV statement")],
) -> OutcomeOut:
    """Read one uploaded statement. Send files one at a time for progress."""
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError(413, "file_too_large", "Files must be 10 MB or smaller")
    if not data:
        raise ApiError(422, "empty_file", "This file is empty")
    return run_ingest(session, prop.id, file.filename or "statement", data, reader, False)


@router.get("/samples", response_model=list[SampleFileOut])
def list_samples(_owner: OwnerDep) -> list[SampleFileOut]:
    """The six fictional sample statements."""
    return [SampleFileOut(index=i, filename=name) for i, name in enumerate(SAMPLE_FILES)]


@router.post("/samples/{index}", response_model=OutcomeOut)
def load_sample_statement(
    index: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep, reader: ReaderDep
) -> OutcomeOut:
    """Read sample statement number `index` exactly as if it were uploaded."""
    if not 0 <= index < len(SAMPLE_FILES):
        raise ApiError(404, "no_such_sample", f"Sample index must be 0 to {len(SAMPLE_FILES) - 1}")
    path = sample_path(index)
    return run_ingest(session, prop.id, path.name, path.read_bytes(), reader, True)


@router.post("/rows/{booking_id}/review", response_model=StatementsOut)
def review_row(
    booking_id: int, body: ReviewIn, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> StatementsOut:
    """Owner keeps a flagged row out, or accepts it into the flip (rule 3)."""
    booking = session.get(Booking, booking_id)
    if booking is None or booking.property_id != prop.id or booking.math_check_passed:
        raise ApiError(404, "no_such_flagged_row", "No flagged row with that id")
    booking.review_status = "accepted" if body.decision == "accept" else "excluded"
    session.flush()
    return statement_summary(session, prop.id)


@router.get("/disputes", response_model=RecoverOut)
def list_disputes(_owner: OwnerDep, session: SessionDep, prop: PropertyDep) -> RecoverOut:
    """Dispute letters for flagged and above-contract lines. Nothing is sent."""
    return RecoverOut.model_validate(disputes(session, prop), from_attributes=True)


@router.get("/rows/{booking_id}/dispute", response_model=DisputeOut)
def get_dispute(
    booking_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> DisputeOut:
    """The dispute letter for one line. Drafting it is not a review (rule 3)."""
    found = dispute_for(session, prop, booking_id)
    if found is None:
        raise ApiError(404, "no_dispute", "Nothing to dispute on that row")
    return DisputeOut.model_validate(found, from_attributes=True)
