"""Per-row statement checks (CLAUDE.md rule 3).

A row fails when gross minus deductions does not equal the payout within
Rs 1, when GST on commission is missing or is not 18%, or when commission is
charged on a cancelled stay. Failed rows are stored with a reason and kept
out of the flip until the owner reviews them.

TDS and GST TCS are withheld from the payout, so they take part in the payout
check, but they are credits and never part of net_kept (rule 2).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.money import PAISE_PER_RUPEE, format_inr, gst_on_commission

TOLERANCE_PAISE = 1 * PAISE_PER_RUPEE

REASON_COMMISSION_ON_CANCELLED = "commission_on_cancelled"
REASON_GST_MISSING = "gst_missing"
REASON_MATH_MISMATCH = "math_mismatch"
REASON_GST_RATE = "gst_rate_mismatch"


@dataclass(frozen=True, slots=True)
class RawRow:
    """Money lines as printed on a statement, in paise."""

    status: str
    list_amount: int
    discount: int
    commission: int
    gst_on_commission: int
    fees: int
    tds: int
    gst_tcs: int
    payout_reported: int


@dataclass(frozen=True, slots=True)
class CheckResult:
    """Outcome of checking one row."""

    passed: bool
    reason: str | None = None
    detail: str | None = None


PASSED = CheckResult(passed=True)


def expected_payout(row: RawRow) -> int:
    """List minus every deduction, including withheld TDS and TCS."""
    return (
        row.list_amount
        - row.discount
        - row.commission
        - row.gst_on_commission
        - row.fees
        - row.tds
        - row.gst_tcs
    )


def check_row(row: RawRow, gst_applies: bool) -> CheckResult:
    """Run every check in priority order and return the first failure."""
    if row.status == "cancelled" and row.commission > 0:
        return CheckResult(False, REASON_COMMISSION_ON_CANCELLED,
                           "Commission charged on a cancelled stay")  # fmt: skip
    if gst_applies and row.commission > 0 and row.gst_on_commission == 0:
        return CheckResult(False, REASON_GST_MISSING, "GST on commission line missing")
    computed = expected_payout(row)
    if abs(computed - row.payout_reported) > TOLERANCE_PAISE:
        detail = (
            f"Payout {format_inr(row.payout_reported)}, but list minus deductions "
            f"is {format_inr(computed)}"
        )
        return CheckResult(False, REASON_MATH_MISMATCH, detail)
    if gst_applies:
        expected_gst = gst_on_commission(row.commission)
        if abs(expected_gst - row.gst_on_commission) > TOLERANCE_PAISE:
            detail = (
                f"GST on commission is {format_inr(row.gst_on_commission)}, "
                f"18% would be {format_inr(expected_gst)}"
            )
            return CheckResult(False, REASON_GST_RATE, detail)
    return PASSED
