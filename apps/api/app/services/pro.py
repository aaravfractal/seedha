"""Seedha Pro previews, computed from the owner's data where it can be.

Audit: money a channel owes back, from statement lines Seedha flagged:
commission charged on a cancelled stay, and commission above the contract
rate on a stay (plus the GST on the excess). Pulse and Rate Watch need
outside data (event calendars, OTA screenshots) and are labelled samples.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Channel, ChannelContract, Consent
from app.money import bps_of, gst_on_commission
from app.services.checks import REASON_COMMISSION_ON_CANCELLED


@dataclass(frozen=True, slots=True)
class AuditResult:
    """Money to claim back, in paise, and how many lines it comes from."""

    claim: int
    cancelled_lines: int
    over_rate_lines: int


def contract_rates(session: Session, property_id: int) -> dict[int, int]:
    """Commission bps by channel id."""
    rows = session.execute(
        select(ChannelContract.channel_id, ChannelContract.commission_bps)
        .join(Channel, Channel.id == ChannelContract.channel_id)
        .where(Channel.property_id == property_id)
    ).all()
    return dict(rows)


@dataclass(frozen=True, slots=True)
class AuditLine:
    """One statement line with money to claim back, in paise.

    kind is "cancelled" (commission and its GST on a cancelled stay) or
    "over_rate" (commission above the contract rate, plus GST on the excess).
    """

    booking: Booking
    kind: str
    claim: int
    contract_bps: int | None
    contract_commission: int


def audit_lines(session: Session, property_id: int) -> list[AuditLine]:
    """Every claimable line. Seedha Audit and Seedha Recover both sum this."""
    rates = contract_rates(session, property_id)
    lines: list[AuditLine] = []
    for b in session.scalars(
        select(Booking)
        .where(Booking.property_id == property_id, Booking.source == "statement")
        .order_by(Booking.id)
    ):
        rate = rates.get(b.channel_id)
        if b.flag_reason == REASON_COMMISSION_ON_CANCELLED and b.review_status != "accepted":
            claim = b.commission + b.gst_on_commission
            lines.append(AuditLine(b, "cancelled", claim, rate, 0))
            continue
        if b.status != "stay" or rate is None:
            continue
        due = bps_of(b.list_amount - b.discount, rate)
        if b.commission > due:
            excess = b.commission - due
            lines.append(AuditLine(b, "over_rate", excess + gst_on_commission(excess), rate, due))
    return lines


def audit(session: Session, property_id: int) -> AuditResult:
    """Claimable commission on cancelled stays and above-contract lines."""
    lines = audit_lines(session, property_id)
    return AuditResult(
        claim=sum(line.claim for line in lines),
        cancelled_lines=sum(1 for line in lines if line.kind == "cancelled"),
        over_rate_lines=sum(1 for line in lines if line.kind == "over_rate"),
    )


def active_consents(session: Session, property_id: int) -> int:
    """Consents that are neither withdrawn nor erased."""
    return len(
        session.scalars(
            select(Consent.id)
            .join(Booking, Booking.id == Consent.booking_id)
            .where(
                Booking.property_id == property_id,
                Consent.withdrawn_at.is_(None),
                Consent.erased_at.is_(None),
            )
        ).all()
    )
