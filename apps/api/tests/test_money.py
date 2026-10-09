"""Money primitives, including the locked line-item rounding rule (ruling 1)."""

from __future__ import annotations

from fractions import Fraction

import pytest

from app.money import (
    LineItems,
    MoneyError,
    bps_of,
    format_inr,
    gst_on_commission,
    line_items_for_booking,
    per_unit_rounded,
    round_half_up_to_rupee,
    rupees,
    share_tenths_of_percent,
    upi_fee,
)


def test_half_rupee_rounds_up_not_to_even() -> None:
    # Python's round(2.5) is 2 (banker's). Statements print Rs 3.
    assert round_half_up_to_rupee(250) == 300
    assert round_half_up_to_rupee(350) == 400
    assert round_half_up_to_rupee(249) == 200
    assert round_half_up_to_rupee(Fraction(24999, 100)) == 200


def test_round_rejects_negative() -> None:
    with pytest.raises(MoneyError):
        round_half_up_to_rupee(-1)


def test_bps_of_and_gst() -> None:
    assert bps_of(rupees(3_400), 1_800) == rupees(612)
    assert gst_on_commission(rupees(612)) == rupees(110)  # 110.16 -> 110
    assert gst_on_commission(rupees(813)) == rupees(146)  # 146.34 -> 146
    with pytest.raises(MoneyError):
        bps_of(100, 10_001)
    with pytest.raises(MoneyError):
        bps_of(-100, 100)


def test_neha_slip_lines_ruling_4() -> None:
    """Booking.com Rs 4,000 list, 15% promo, 18% commission -> Rs 2,678 kept."""
    lines = line_items_for_booking(rupees(4_000), rupees(600), 1_800, True, False)
    assert (lines.discount, lines.commission, lines.gst_on_commission) == (
        rupees(600),
        rupees(612),
        rupees(110),
    )
    assert lines.net_kept == rupees(2_678)


def test_line_item_rounding_rule_is_locked_ruling_1() -> None:
    """Round each line item to the rupee, then subtract (ruling 1).

    MakeMyTrip's 6-month lines: exact commission is Rs 5,04,134.40 and exact
    GST on it Rs 90,744.19. Rounding each line gives net Rs 16,96,642. Keeping
    paise and rounding only the net would give Rs 16,96,641, which we reject.
    """
    list_amount, discount = rupees(26_04_000), rupees(3_12_480)
    exact_commission = Fraction(list_amount - discount) * Fraction(22, 100)
    exact_gst = exact_commission * Fraction(18, 100)
    commission = round_half_up_to_rupee(exact_commission)
    gst = round_half_up_to_rupee(Fraction(commission) * Fraction(18, 100))
    line_rounded = LineItems(list_amount, discount, commission, gst)
    assert (commission, gst) == (rupees(5_04_134), rupees(90_744))
    assert line_rounded.net_kept == rupees(16_96_642)
    net_rounded_once = round_half_up_to_rupee(list_amount - discount - exact_commission - exact_gst)
    assert net_rounded_once == rupees(16_96_641)
    assert line_rounded.net_kept != net_rounded_once


def test_single_row_line_items() -> None:
    lines = line_items_for_booking(rupees(4_200), rupees(504), 2_200, True, False)
    assert lines.commission == rupees(813)  # 813.12
    assert lines.gst_on_commission == rupees(146)  # 146.34
    assert lines.net_kept == rupees(2_737)


def test_discount_cannot_exceed_list() -> None:
    with pytest.raises(MoneyError):
        line_items_for_booking(rupees(100), rupees(101), 0, False, False)


def test_upi_fee_threshold_and_cap() -> None:
    assert upi_fee(rupees(2_000)) == 0
    assert upi_fee(rupees(2_001)) == rupees(8)
    assert upi_fee(rupees(8_600)) == rupees(34)  # 34.4
    assert upi_fee(rupees(75_000)) == rupees(300)
    assert upi_fee(rupees(200_000)) == rupees(300)
    with pytest.raises(MoneyError):
        upi_fee(-1)


def test_direct_booking_fee_lines() -> None:
    lines = line_items_for_booking(rupees(4_300), 0, 0, False, True)
    assert lines.fees == rupees(17)
    assert lines.paid_to_channels == rupees(17)


def test_lineitems_named_totals_ruling_2() -> None:
    lines = LineItems(rupees(100), rupees(10), rupees(20), rupees(4), rupees(1))
    assert lines.paid_to_channels == rupees(25)
    assert lines.lost_vs_list_price == rupees(35)
    assert lines.net_kept == rupees(65)
    assert (lines + lines).net_kept == rupees(130)
    with pytest.raises(MoneyError):
        LineItems(list_amount=-1)


def test_per_unit_rounded() -> None:
    assert per_unit_rounded(rupees(1_696_642), 620) == rupees(2_737)
    assert per_unit_rounded(rupees(685_248), 160) == rupees(4_283)
    assert per_unit_rounded(-rupees(5), 2) == -rupees(3)
    with pytest.raises(MoneyError):
        per_unit_rounded(100, 0)


def test_share_tenths() -> None:
    assert share_tenths_of_percent(160, 1_500) == 107
    assert share_tenths_of_percent(250, 1_500) == 167
    assert share_tenths_of_percent(1_039_108, 6_305_000) == 165
    with pytest.raises(MoneyError):
        share_tenths_of_percent(1, 0)
    with pytest.raises(MoneyError):
        share_tenths_of_percent(-1, 10)


@pytest.mark.parametrize(
    ("paise", "text"),
    [
        (0, "₹0"),
        (rupees(999), "₹999"),
        (rupees(1_000), "₹1,000"),
        (rupees(41_800), "₹41,800"),
        (rupees(1_039_108), "₹10,39,108"),
        (rupees(47_33_012), "₹47,33,012"),
        (rupees(1_23_45_678), "₹1,23,45,678"),
        (-rupees(802), "−₹802"),
    ],
)
def test_format_inr(paise: int, text: str) -> None:
    assert format_inr(paise) == text
