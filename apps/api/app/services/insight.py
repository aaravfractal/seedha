"""The one-line flip insight, in Hindi and English, built from computed ranks.

Plain templates over numbers the ledger already computed, so the sentence is
always true for the data shown and never invents a figure (rule 1).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.ledger import LedgerSummary

ORDINALS_EN = ("1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th")


@dataclass(frozen=True, slots=True)
class Insight:
    """The sentence in both languages plus the rank move it describes."""

    en: str
    hi: str
    channel: str
    rank_by_bookings: int
    rank_by_money_kept: int
    move_en: str


def ordinal(position: int) -> str:
    """1 -> '1st' (positions above 10 fall back to '#n')."""
    return ORDINALS_EN[position - 1] if 1 <= position <= len(ORDINALS_EN) else f"#{position}"


def build_insight(ledger: LedgerSummary) -> Insight | None:
    """Describe what happens to the busiest channel when ranked by money kept."""
    if ledger.room_nights == 0 or not ledger.rank_by_bookings:
        return None
    names = {c.channel.key: c.channel.name for c in ledger.channels}
    top = ledger.rank_by_bookings[0]
    kept_rank = ledger.rank_by_money_kept.index(top) + 1
    name = names[top]
    better = kept_rank - 1
    last = kept_rank == len([c for c in ledger.channels if c.room_nights])
    if better == 0:
        en = f"{name} brought the most bookings and also left you the most per room."
        hi = f"{name} ne sabse zyada bookings di, aur har room par sabse zyada paisa bhi chhoda."
    elif last:
        en = f"{name} brought the most bookings but left you the least per room."
        hi = f"{name} ne sabse zyada bookings di, par har room par sabse kam paisa chhoda."
    else:
        others = "channel" if better == 1 else "channels"
        en = f"{name} brought the most bookings, but {better} {others} left you more per room."
        hi = (
            f"{name} ne sabse zyada bookings di, par {better} {others} ne har room par "
            "zyada paisa chhoda."
        )
    return Insight(
        en=en,
        hi=hi,
        channel=name,
        rank_by_bookings=1,
        rank_by_money_kept=kept_rank,
        move_en=f"{name} drops from 1st to {ordinal(kept_rank)}" if better else "",
    )
