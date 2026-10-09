"""The six fictional sample statements behind "Use sample statements"."""

from __future__ import annotations

from pathlib import Path

from app.config import API_ROOT

SAMPLE_DIR = API_ROOT / "seed" / "statements"
SAMPLE_FILES: tuple[str, ...] = (
    "MakeMyTrip Apr to Jun.pdf",
    "MakeMyTrip Jul to Sep.pdf",
    "Booking.com payouts.xlsx",
    "Agoda statement.csv",
    "Travel agent register.xlsx",
    "Hotel register.xlsx",
)


def sample_path(index: int) -> Path:
    """Path of sample file number `index` (0-based). IndexError if out of range."""
    return SAMPLE_DIR / SAMPLE_FILES[index]
