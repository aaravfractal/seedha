"""Per-row statement checks (rule 3)."""

from __future__ import annotations

from app.money import rupees
from app.services.checks import (
    REASON_COMMISSION_ON_CANCELLED,
    REASON_GST_MISSING,
    REASON_GST_RATE,
    REASON_MATH_MISMATCH,
    RawRow,
    check_row,
)


def row(**overrides: object) -> RawRow:
    base: dict[str, object] = {
        "status": "stay",
        "list_amount": rupees(4_200),
        "discount": rupees(504),
        "commission": rupees(813),
        "gst_on_commission": rupees(146),
        "fees": 0,
        "tds": rupees(4),
        "gst_tcs": 0,
        "payout_reported": rupees(2_733),
    }
    base.update(overrides)
    return RawRow(**base)  # type: ignore[arg-type]


def test_clean_row_passes() -> None:
    assert check_row(row(), gst_applies=True).passed


def test_within_one_rupee_passes() -> None:
    assert check_row(row(payout_reported=rupees(2_734)), gst_applies=True).passed


def test_mm48213_payout_mismatch() -> None:
    bad = row(list_amount=rupees(4_870), discount=rupees(488), commission=rupees(964),
              gst_on_commission=rupees(174), payout_reported=rupees(3_120))  # fmt: skip
    result = check_row(bad, gst_applies=True)
    assert result.reason == REASON_MATH_MISMATCH
    assert result.detail == "Payout ₹3,120, but list minus deductions is ₹3,240"


def test_gst_missing() -> None:
    result = check_row(row(gst_on_commission=0), gst_applies=True)
    assert result.reason == REASON_GST_MISSING
    assert result.detail == "GST on commission line missing"


def test_gst_not_required_for_unregistered_agents() -> None:
    agent = row(discount=0, commission=rupees(420), gst_on_commission=0, tds=0,
                payout_reported=rupees(3_780))  # fmt: skip
    assert check_row(agent, gst_applies=False).passed


def test_commission_on_cancelled() -> None:
    cancelled = row(status="cancelled", list_amount=0, discount=0, commission=rupees(680),
                    gst_on_commission=rupees(122), tds=0, payout_reported=-rupees(802))  # fmt: skip
    result = check_row(cancelled, gst_applies=True)
    assert result.reason == REASON_COMMISSION_ON_CANCELLED


def test_wrong_gst_rate() -> None:
    wrong = row(gst_on_commission=rupees(100), payout_reported=rupees(2_779))
    result = check_row(wrong, gst_applies=True)
    assert result.reason == REASON_GST_RATE
