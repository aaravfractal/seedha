"""Perk codes for returning guests (rule 6: a perk, never a lower public rate).

Format PREFIX-INITIALS+YY-XXXX, e.g. DEODAR-RS26-7KQ2. The random part makes
codes hard to guess (decisions D-075, D-076); it uses no character that reads
like another (no 0/O, 1/I/L).

The sample hotel keeps its two demo codes, DEODAR-NG26 and DEODAR-RS26, so the
demo script works. Only a sample property gets them; every other code,
including any other guest of the sample hotel, has the random part.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Guest, PerkCode
from app.services.matcher import normalise_tokens

# Digits and capitals, minus the ones that read like each other.
CONFUSABLE = "01OIL"
CODE_ALPHABET = "".join(c for c in string.digits + string.ascii_uppercase if c not in CONFUSABLE)
RANDOM_LENGTH = 4
DEMO_CODES = frozenset({"DEODAR-NG26", "DEODAR-RS26"})
MAX_ATTEMPTS = 50


def initials(name: str) -> str:
    """First letters of the first and last name: 'A. Verma family' -> 'AV'."""
    tokens = normalise_tokens(name) or ["guest"]
    first, last = tokens[0], tokens[-1]
    return (first[0] + (last[0] if len(tokens) > 1 else "")).upper()


def code_stem(prefix: str, name: str, year: int) -> str:
    """The readable part: 'DEODAR-RS26'."""
    return f"{prefix}-{initials(name)}{year % 100:02d}"


def random_part() -> str:
    """Four characters from CODE_ALPHABET, from the OS random source."""
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(RANDOM_LENGTH))


def issue_perk(  # noqa: PLR0913  (each argument is a distinct fact)
    session: Session, prefix: str, perk_text: str, guest: Guest, booking: Booking,
    now: datetime, *, sample_property: bool = False,
) -> PerkCode:  # fmt: skip
    """The guest's unused perk code from this stay, or a new unique one."""
    existing = session.scalar(select(PerkCode).where(PerkCode.origin_booking_id == booking.id))
    if existing is not None:
        return existing
    stem = code_stem(prefix, guest.display_name, now.year)
    taken = set(session.scalars(select(PerkCode.code)))
    candidates = [stem] if sample_property and stem in DEMO_CODES else []
    candidates += [f"{stem}-{random_part()}" for _ in range(MAX_ATTEMPTS)]
    for code in candidates:
        if code not in taken:
            perk = PerkCode(code=code, guest_id=guest.id, origin_booking_id=booking.id,
                            perk=perk_text, created_at=now)  # fmt: skip
            session.add(perk)
            session.flush()
            return perk
    raise RuntimeError("Could not find an unused perk code")
