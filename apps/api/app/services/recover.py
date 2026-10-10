"""Seedha Recover: a dispute letter for each statement line worth querying.

The letter is a fixed template filled by code from the stored row and the
channel contract; no model writes any of it (rule 1, D6). Commission claims
come from the same per-line function as Seedha Audit, so the Recover total
always equals the Audit figure. A payout shortfall or an overcharged GST line
is shown separately. TDS and GST TCS are credits and never claimed (rule 2).
Drafting a dispute is not a review: the row stays out of the flip until the
owner decides (rule 3). Nothing is sent; the owner copies the text into the
channel's extranet (rule 8). The letter carries the booking reference only,
never the guest's name.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, Property
from app.money import format_inr, gst_on_commission
from app.services.checks import (
    REASON_COMMISSION_ON_CANCELLED,
    REASON_GST_MISSING,
    REASON_GST_RATE,
    REASON_MATH_MISMATCH,
    RawRow,
    expected_payout,
)
from app.services.pro import AuditLine, audit_lines

PERCENT = 100


@dataclass(frozen=True, slots=True)
class Dispute:
    """A ready-to-copy letter and the money it asks for, in paise."""

    booking_id: int
    channel: str
    external_ref: str
    reason: str
    review_status: str
    audit_claim: int
    other_claim: int
    subject: str
    text: str


@dataclass(frozen=True, slots=True)
class RecoverResult:
    """Every dispute with its two totals.

    audit_claim equals Seedha Audit's figure; other_claim is a payout
    shortfall or overcharged GST, which Audit does not count.
    """

    audit_claim: int
    other_claim: int
    disputes: list[Dispute]


def format_rate(bps: int) -> str:
    """2200 -> "22%", 1850 -> "18.5%"."""
    whole, rest = divmod(bps, PERCENT)
    return f"{whole}%" if rest == 0 else f"{bps / PERCENT:g}%"


def _raw(b: Booking) -> RawRow:
    return RawRow(b.status, b.list_amount, b.discount, b.commission, b.gst_on_commission,
                  b.fees, b.tds, b.gst_tcs, b.payout_reported)  # fmt: skip


def printed_lines(b: Booking) -> list[str]:
    """The statement lines exactly as stored, credits marked as credits."""
    lines = [f"Room amount: {format_inr(b.list_amount)}"]
    if b.discount:
        lines.append(f"Discount: {format_inr(b.discount)}")
    lines.append(f"Commission: {format_inr(b.commission)}")
    gst = format_inr(b.gst_on_commission) if b.gst_on_commission else "not shown"
    lines.append(f"GST on commission: {gst}")
    if b.fees:
        lines.append(f"Fees: {format_inr(b.fees)}")
    if b.tds:
        lines.append(f"TDS: {format_inr(b.tds)} (a tax credit, not part of this claim)")
    if b.gst_tcs:
        lines.append(f"GST TCS: {format_inr(b.gst_tcs)} (a tax credit, not part of this claim)")
    lines.append(f"Payout: {format_inr(b.payout_reported)}")
    return lines


def flag_paragraph(b: Booking) -> tuple[str, int]:
    """What is wrong with a flagged line, and any amount outside Audit."""
    computed = expected_payout(_raw(b))
    gap = computed - b.payout_reported
    if b.flag_reason == REASON_COMMISSION_ON_CANCELLED:
        both = b.commission + b.gst_on_commission
        return (
            f"This stay was cancelled, but commission of {format_inr(b.commission)} and GST of "
            f"{format_inr(b.gst_on_commission)} were charged on it. Please reverse both, "
            f"{format_inr(both)} in total.",
            0,
        )
    if b.flag_reason == REASON_GST_MISSING:
        return (
            f"The statement shows commission of {format_inr(b.commission)} with no GST on "
            f"commission line. Room amount minus the printed lines is {format_inr(computed)}, "
            f"and the payout is {format_inr(gap)} below that. 18% GST on the commission would "
            f"be {format_inr(gst_on_commission(b.commission))}. Please send the tax invoice "
            "that shows GST on commission for this booking.",
            0,
        )
    if b.flag_reason == REASON_MATH_MISMATCH and gap > 0:
        return (
            f"Room amount minus these lines is {format_inr(computed)}, but the payout was "
            f"{format_inr(b.payout_reported)}, {format_inr(gap)} less. Please pay the "
            f"{format_inr(gap)}, or send the line that explains it.",
            gap,
        )
    if b.flag_reason == REASON_GST_RATE:
        due = gst_on_commission(b.commission)
        over = b.gst_on_commission - due
        if over > 0:
            return (
                f"GST on commission is {format_inr(b.gst_on_commission)}, but 18% of "
                f"{format_inr(b.commission)} is {format_inr(due)}. Please refund the "
                f"{format_inr(over)} charged above 18%.",
                over,
            )
        return (
            f"GST on commission is {format_inr(b.gst_on_commission)}, but 18% of "
            f"{format_inr(b.commission)} is {format_inr(due)}. Please send a corrected "
            "tax invoice.",
            0,
        )
    return (
        "These lines do not add up to the payout. Please send a corrected statement for "
        "this booking.",
        0,
    )


def over_rate_paragraph(line: AuditLine) -> str:
    """Commission above the contract rate, with GST on the excess."""
    b = line.booking
    excess = b.commission - line.contract_commission
    rate = format_rate(line.contract_bps or 0)
    return (
        f"Our contract rate is {rate} of the amount after discount, which is "
        f"{format_inr(line.contract_commission)}. The commission charged is "
        f"{format_inr(b.commission)}, {format_inr(excess)} more. With 18% GST on that, "
        f"please refund {format_inr(line.claim)}."
    )


def build_dispute(b: Booking, channel: str, prop: Property, line: AuditLine | None) -> Dispute:
    """Fill the fixed template for one statement line."""
    paragraphs: list[str] = []
    other = 0
    flagged = not b.math_check_passed and b.review_status != "accepted"
    if flagged:
        text, other = flag_paragraph(b)
        paragraphs.append(text)
    if line is not None and line.kind == "over_rate":
        paragraphs.append(over_rate_paragraph(line))
    audit_claim = line.claim if line is not None else 0
    total = audit_claim + other
    stay = f"{b.check_in.day} {b.check_in:%B %Y}, {b.nights} night{'' if b.nights == 1 else 's'}"
    parts = [
        f"Dear {channel} partner team,",
        f"{prop.name}, {prop.city}. Booking {b.external_ref}, check-in {stay}"
        f"{' (cancelled)' if b.status == 'cancelled' else ''}.",
        "As printed on your statement:\n" + "\n".join(printed_lines(b)),
        *paragraphs,
    ]
    if total:
        parts.append(f"Total to claim back: {format_inr(total)}.")
    parts.append(f"Regards,\n{prop.owner_name}\n{prop.name}")
    return Dispute(
        booking_id=b.id,
        channel=channel,
        external_ref=b.external_ref,
        reason=b.flag_reason if flagged and b.flag_reason else (line.kind if line else ""),
        review_status=b.review_status,
        audit_claim=audit_claim,
        other_claim=other,
        subject=f"Statement correction for booking {b.external_ref}",
        text="\n\n".join(parts),
    )


def disputes(session: Session, prop: Property) -> RecoverResult:
    """A dispute for every flagged line not accepted and every Audit line."""
    by_booking = {line.booking.id: line for line in audit_lines(session, prop.id)}
    flagged_ids = set(
        session.scalars(
            select(Booking.id).where(
                Booking.property_id == prop.id,
                Booking.source == "statement",
                Booking.math_check_passed.is_(False),
                Booking.review_status != "accepted",
            )
        )
    )
    ids = sorted(flagged_ids | set(by_booking))
    rows = session.execute(
        select(Booking, Channel.name)
        .join(Channel, Channel.id == Booking.channel_id)
        .where(Booking.id.in_(ids))
        .order_by(Booking.id)
    ).all()
    found = [build_dispute(b, name, prop, by_booking.get(b.id)) for b, name in rows]
    return RecoverResult(
        audit_claim=sum(d.audit_claim for d in found),
        other_claim=sum(d.other_claim for d in found),
        disputes=found,
    )


def dispute_for(session: Session, prop: Property, booking_id: int) -> Dispute | None:
    """The dispute for one line, or None when that line has nothing to query."""
    return next((d for d in disputes(session, prop).disputes if d.booking_id == booking_id), None)
