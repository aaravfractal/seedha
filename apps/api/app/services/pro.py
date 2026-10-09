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


def audit(session: Session, property_id: int) -> AuditResult:
    """Claimable commission on cancelled stays and above-contract lines."""
    rates = contract_rates(session, property_id)
    claim = 0
    cancelled = 0
    over = 0
    for b in session.scalars(
        select(Booking).where(Booking.property_id == property_id, Booking.source == "statement")
    ):
        if b.flag_reason == REASON_COMMISSION_ON_CANCELLED and b.review_status != "accepted":
            claim += b.commission + b.gst_on_commission
            cancelled += 1
            continue
        if b.status != "stay" or b.channel_id not in rates:
            continue
        due = bps_of(b.list_amount - b.discount, rates[b.channel_id])
        if b.commission > due:
            excess = b.commission - due
            claim += excess + gst_on_commission(excess)
            over += 1
    return AuditResult(claim, cancelled, over)


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
