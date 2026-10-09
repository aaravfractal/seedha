"""Money primitives for Seedha.

Business rules enforced here (CLAUDE.md section 2, rules 1 and 2; ruling 1):

* All money is held as integer paise. Floats never touch a money value.
* Percentages are integer basis points (2200 bps = 22%).
* Every line item (discount, commission, GST on commission, fees) is rounded
  half-up to the whole rupee, the way OTA statements print them.
* net_kept = list_amount - discount - commission - gst_on_commission - fees.
* gst_on_commission = 18% of commission. TDS and GST TCS are credits and are
  never subtracted.
* "Paid to channels" = commission + GST on commission + fees.
* "Lost vs list price" = discount + commission + GST on commission + fees.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

PAISE_PER_RUPEE = 100
BPS_DENOMINATOR = 10_000
GST_ON_COMMISSION_BPS = 1_800
UPI_FEE_BPS = 40
UPI_FEE_THRESHOLD_PAISE = 2_000 * PAISE_PER_RUPEE
UPI_FEE_CAP_PAISE = 300 * PAISE_PER_RUPEE
THOUSANDS_DIGITS = 3
INDIAN_GROUP_DIGITS = 2
RUPEE_SIGN = "₹"
MINUS_SIGN = "−"


class MoneyError(ValueError):
    """Raised when a money value or rate is outside its allowed range."""


def rupees(amount: int) -> int:
    """Convert a whole-rupee amount to paise."""
    return amount * PAISE_PER_RUPEE


def _require_non_negative(name: str, value: int | Fraction) -> None:
    if value < 0:
        raise MoneyError(f"{name} must not be negative, got {value}")


def round_half_up_to_rupee(value_paise: Fraction | int) -> int:
    """Round a non-negative paise value to the nearest whole rupee, halves up.

    Python's round() uses banker's rounding, which OTA statements do not use,
    so this is the only rounding helper money code may call.
    """
    _require_non_negative("value_paise", value_paise)
    value = Fraction(value_paise)
    whole_rupees = (value + Fraction(PAISE_PER_RUPEE, 2)) // PAISE_PER_RUPEE
    return int(whole_rupees) * PAISE_PER_RUPEE


def bps_of(amount_paise: int, rate_bps: int) -> int:
    """Return rate_bps of amount_paise as a line item rounded to the rupee."""
    _require_non_negative("amount_paise", amount_paise)
    if not 0 <= rate_bps <= BPS_DENOMINATOR:
        raise MoneyError(f"rate_bps must be between 0 and 10000, got {rate_bps}")
    return round_half_up_to_rupee(Fraction(amount_paise * rate_bps, BPS_DENOMINATOR))


def gst_on_commission(commission_paise: int) -> int:
    """GST on commission is 18% of commission, rounded to the rupee."""
    return bps_of(commission_paise, GST_ON_COMMISSION_BPS)


def upi_fee(amount_paise: int) -> int:
    """UPI fee: 0.4% on payments above Rs 2,000, capped at Rs 300, else zero."""
    _require_non_negative("amount_paise", amount_paise)
    if amount_paise <= UPI_FEE_THRESHOLD_PAISE:
        return 0
    return min(bps_of(amount_paise, UPI_FEE_BPS), UPI_FEE_CAP_PAISE)


@dataclass(frozen=True, slots=True)
class LineItems:
    """The money lines of one booking or one aggregate, all in paise."""

    list_amount: int
    discount: int = 0
    commission: int = 0
    gst_on_commission: int = 0
    fees: int = 0

    def __post_init__(self) -> None:
        for name in ("list_amount", "discount", "commission", "gst_on_commission", "fees"):
            _require_non_negative(name, getattr(self, name))

    @property
    def paid_to_channels(self) -> int:
        """Commission + GST on commission + fees (what channels took)."""
        return self.commission + self.gst_on_commission + self.fees

    @property
    def lost_vs_list_price(self) -> int:
        """Hotel-funded discount + paid to channels (gap to the list price)."""
        return self.discount + self.paid_to_channels

    @property
    def net_kept(self) -> int:
        """List amount minus every rounded deduction. May be negative for
        adjustment lines such as commission charged on a cancelled stay."""
        return self.list_amount - self.lost_vs_list_price

    def __add__(self, other: LineItems) -> LineItems:
        return LineItems(
            list_amount=self.list_amount + other.list_amount,
            discount=self.discount + other.discount,
            commission=self.commission + other.commission,
            gst_on_commission=self.gst_on_commission + other.gst_on_commission,
            fees=self.fees + other.fees,
        )


ZERO_LINES = LineItems(list_amount=0)


def line_items_for_booking(
    list_amount: int,
    discount: int,
    commission_bps: int,
    gst_applies: bool,
    upi_payment: bool,
) -> LineItems:
    """Compute a booking's line items from its channel terms (ruling 1).

    Commission is charged on the amount after the hotel-funded discount.
    Each line is rounded to the rupee before net is taken.
    """
    if discount > list_amount:
        raise MoneyError("discount cannot exceed list amount")
    commission = bps_of(list_amount - discount, commission_bps)
    gst = gst_on_commission(commission) if gst_applies else 0
    fees = upi_fee(list_amount - discount) if upi_payment else 0
    return LineItems(
        list_amount=list_amount,
        discount=discount,
        commission=commission,
        gst_on_commission=gst,
        fees=fees,
    )


def per_unit_rounded(total_paise: int, units: int) -> int:
    """Average per unit (e.g. net ADR per room night), rounded to the rupee.

    A negative total (only possible when adjustment lines outweigh stays) is
    rounded on its magnitude so the sign never changes the rounding.
    """
    if units <= 0:
        raise MoneyError("units must be positive")
    magnitude = round_half_up_to_rupee(Fraction(abs(total_paise), units))
    return -magnitude if total_paise < 0 else magnitude


def share_tenths_of_percent(part: int, whole: int) -> int:
    """part / whole as tenths of a percent, rounded half-up (107 = 10.7%)."""
    if whole <= 0:
        raise MoneyError("whole must be positive")
    if part < 0:
        raise MoneyError("part must not be negative")
    scaled = Fraction(part * 1000, whole)
    return int((scaled + Fraction(1, 2)) // 1)


def format_inr(amount_paise: int) -> str:
    """Format paise as whole rupees with Indian digit grouping: Rs 10,39,108.

    Only for display edges (slips, WhatsApp answers). Assumes a whole-rupee
    value; any paise remainder is rounded half-up first.
    """
    negative = amount_paise < 0
    whole = round_half_up_to_rupee(abs(amount_paise)) // PAISE_PER_RUPEE
    digits = str(whole)
    if len(digits) > THOUSANDS_DIGITS:
        head, tail = digits[:-THOUSANDS_DIGITS], digits[-THOUSANDS_DIGITS:]
        groups: list[str] = []
        while len(head) > INDIAN_GROUP_DIGITS:
            groups.insert(0, head[-INDIAN_GROUP_DIGITS:])
            head = head[:-INDIAN_GROUP_DIGITS]
        digits = ",".join([head, *groups, tail])
    return f"{MINUS_SIGN if negative else ''}{RUPEE_SIGN}{digits}"
