"""One statement line in canonical form, and how it becomes a Booking.

Both the seed loader and statement upload build bookings here, so the money
lines and the checks (rule 3) are applied by exactly one piece of code.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date

from app.models import Booking
from app.money import LineItems
from app.services.checks import CheckResult, RawRow, check_row


@dataclass(frozen=True, slots=True)
class ParsedRow:
    """A statement line after parsing: identity, stay facts and money (paise)."""

    channel: str
    external_ref: str
    status: str
    check_in: date
    nights: int
    guest_name: str
    guest_city: str | None
    money: RawRow
    room: int | None = None
    forced_flag: CheckResult | None = None

    def flagged(self, reason: str, detail: str) -> ParsedRow:
        """Copy of this row marked as failing a check (e.g. not found in source)."""
        return replace(self, forced_flag=CheckResult(False, reason, detail))


def to_booking(
    row: ParsedRow,
    property_id: int,
    channel_id: int,
    gst_applies: bool,
    source: str,
    room_id: int | None = None,
) -> Booking:
    """Build a Booking with its checks applied. Flagged rows await review."""
    result = row.forced_flag or check_row(row.money, gst_applies)
    m = row.money
    return Booking(
        property_id=property_id,
        channel_id=channel_id,
        room_id=room_id,
        external_ref=row.external_ref,
        source=source,
        status=row.status,
        check_in=row.check_in,
        nights=row.nights,
        guest_name=row.guest_name,
        guest_city=row.guest_city,
        list_amount=m.list_amount,
        discount=m.discount,
        commission=m.commission,
        gst_on_commission=m.gst_on_commission,
        fees=m.fees,
        net_kept=LineItems(
            m.list_amount, m.discount, m.commission, m.gst_on_commission, m.fees
        ).net_kept,
        tds=m.tds,
        gst_tcs=m.gst_tcs,
        payout_reported=m.payout_reported,
        math_check_passed=result.passed,
        flag_reason=result.reason,
        flag_detail=result.detail,
        review_status="none" if result.passed else "pending",
    )
