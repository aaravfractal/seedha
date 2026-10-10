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

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from app.money import bps_of, gst_on_commission, rupees, upi_fee

# Sample cost to the hotel of the returning-guest perk (breakfast for two, the
# Seedha Site extra). Owner-entered in a real setup; labelled "Sample cost".
SAMPLE_PERK_COST_PER_NIGHT = rupees(400)
MAX_PERK_COST_PER_NIGHT = rupees(5000)


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


@dataclass(frozen=True, slots=True)
class Season:
    """Coded direct bookings booked inside a season, and their net saving."""

    start: date
    end: date
    count: int
    total_net_saving: int


def season_review(booked: Iterable[tuple[date, int]], start: date, end: date) -> Season:
    """Count and sum the savings whose booking date falls in [start, end]."""
    inside = [net for day, net in booked if start <= day <= end]
    return Season(start=start, end=end, count=len(inside), total_net_saving=sum(inside))


@dataclass(frozen=True, slots=True)
class PerkSplit:
    """Where the commission a coded booking avoided went, in paise.

    avoided = upi_fee + perk_cost + kept_after_perk. The guest pays the same
    public rate (rule 6); the perk is a separate line and net_saving
    (ruling 5) is unchanged.
    """

    avoided: int
    upi_fee: int
    perk_cost: int
    kept_after_perk: int


def perk_split(avoided: int, fee: int, nights: int, cost_per_night: int) -> PerkSplit:
    """Split the avoided commission into UPI fee, perk cost and what the hotel keeps."""
    perk_cost = cost_per_night * nights
    return PerkSplit(avoided, fee, perk_cost, avoided - fee - perk_cost)
