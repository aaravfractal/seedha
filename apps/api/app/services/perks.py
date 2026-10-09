"""Perk codes for returning guests (rule 6: a perk, never a lower public rate).

Format PREFIX-INITIALS+YY, e.g. DEODAR-NG26 for Neha Gupta in 2026. Codes are
unique; a clash gets a digit before the year (DEODAR-NG226).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Guest, PerkCode
from app.services.matcher import normalise_tokens

MAX_SUFFIX = 99


def initials(name: str) -> str:
    """First letters of the first and last name: 'A. Verma family' -> 'AV'."""
    tokens = normalise_tokens(name) or ["guest"]
    first, last = tokens[0], tokens[-1]
    return (first[0] + (last[0] if len(tokens) > 1 else "")).upper()


def code_candidates(prefix: str, name: str, year: int) -> list[str]:
    """The preferred code first, then numbered fallbacks."""
    stem, yy = f"{prefix}-{initials(name)}", f"{year % 100:02d}"
    return [f"{stem}{yy}", *(f"{stem}{n}{yy}" for n in range(2, MAX_SUFFIX + 1))]


def issue_perk(
    session: Session, prefix: str, perk_text: str, guest: Guest, booking: Booking, now: datetime
) -> PerkCode:
    """The guest's unused perk code from this stay, or a new unique one."""
    existing = session.scalar(select(PerkCode).where(PerkCode.origin_booking_id == booking.id))
    if existing is not None:
        return existing
    taken = set(session.scalars(select(PerkCode.code)))
    for code in code_candidates(prefix, guest.display_name, now.year):
        if code not in taken:
            perk = PerkCode(code=code, guest_id=guest.id, origin_booking_id=booking.id,
                            perk=perk_text, created_at=now)  # fmt: skip
            session.add(perk)
            session.flush()
            return perk
    raise RuntimeError("No perk code left for these initials")
