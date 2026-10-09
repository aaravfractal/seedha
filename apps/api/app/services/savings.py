"""Commission avoided by a coded direct booking (ruling 5).

saving = commission at the ORIGINAL channel's contract rate on the amount,
       + 18% GST on that commission (when that channel charges GST),
       - the UPI fee actually paid on the direct booking
         (0.4% above Rs 2,000, capped at Rs 300).
Each line is rounded half-up to the rupee (ruling 1). Never a flat rate. The
rate used is stored on the saving row so every number can be audited. A
booking whose original channel took no commission claims no saving.

Rahul (originally MakeMyTrip, 22%), Rs 8,600: commission Rs 1,892 + GST Rs 341
= Rs 2,233 avoided; UPI fee Rs 34; net Rs 2,199.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.money import bps_of, gst_on_commission, upi_fee


@dataclass(frozen=True, slots=True)
class SavingLines:
    """One saving, in paise, with the rate that produced it."""

    commission_rate_used: int
    commission_avoided: int
    gst_avoided: int
    upi_fee: int

    @property
    def avoided(self) -> int:
        """Commission + GST the OTA would have taken."""
        return self.commission_avoided + self.gst_avoided

    @property
    def net_saving(self) -> int:
        """Avoided minus the UPI fee paid instead."""
        return self.avoided - self.upi_fee


def compute_saving(amount: int, commission_bps: int, gst_applies: bool) -> SavingLines | None:
    """The saving on a direct booking of `amount` paise, or None if nothing
    was avoided (the guest first came through a commission-free channel)."""
    commission = bps_of(amount, commission_bps)
    if commission == 0:
        return None
    return SavingLines(
        commission_rate_used=commission_bps,
        commission_avoided=commission,
        gst_avoided=gst_on_commission(commission) if gst_applies else 0,
        upi_fee=upi_fee(amount),
    )
