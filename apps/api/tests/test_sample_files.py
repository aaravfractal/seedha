"""The committed sample statements are exactly what the writer produces."""

from __future__ import annotations

from pathlib import Path

from app.services.samples import SAMPLE_DIR, SAMPLE_FILES
from seed.statements import write_all


def test_sample_files_regenerate_byte_for_byte(tmp_path: Path) -> None:
    counts = write_all(tmp_path)
    assert counts == {
        "MakeMyTrip Apr to Jun.pdf": 410,
        "MakeMyTrip Jul to Sep.pdf": 412,
        "Booking.com payouts.xlsx": 214,
        "Agoda statement.csv": 96,
        "Travel agent register.xlsx": 180,
        "Hotel register.xlsx": 188,
    }
    for name in SAMPLE_FILES:
        assert (tmp_path / name).read_bytes() == (SAMPLE_DIR / name).read_bytes(), name
