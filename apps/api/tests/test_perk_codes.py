"""Perk code format (D-076): a random part on every new code, except the two
demo codes of the sample hotel; and no guest name before a code is accepted."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Guest, PerkCode
from app.services import perks
from app.services.perks import CODE_ALPHABET, DEMO_CODES, issue_perk, random_part

NOW = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)
NEW_CODE = re.compile(r"DEODAR-[A-Z]{1,2}26-[2-9A-HJKMNP-Z]{4}")


def desk_stays(session: Session) -> list[Booking]:
    stays = list(session.scalars(select(Booking).where(Booking.source == "desk")))
    assert len(stays) >= 3 and all(b.guest is not None for b in stays)
    return stays


def guest_named(session: Session, name: str) -> tuple[Guest, Booking]:
    for booking in desk_stays(session):
        if booking.guest is not None and booking.guest.display_name == name:
            return booking.guest, booking
    raise AssertionError(name)


def test_alphabet_has_no_confusable_characters() -> None:
    assert not set(CODE_ALPHABET) & set("0O1IL")
    assert len(set(CODE_ALPHABET)) == len(CODE_ALPHABET) == 31
    samples = {random_part() for _ in range(200)}
    assert all(len(s) == 4 and set(s) <= set(CODE_ALPHABET) for s in samples)
    assert len(samples) > 190, "the random part varies"


def test_demo_codes_are_kept_on_the_sample_hotel(sample: Session) -> None:
    for name, code in (("Neha Gupta", "DEODAR-NG26"), ("Rahul Sharma", "DEODAR-RS26")):
        guest, booking = guest_named(sample, name)
        perk = issue_perk(sample, "DEODAR", "perk", guest, booking, NOW, sample_property=True)
        assert perk.code == code
    assert frozenset({"DEODAR-NG26", "DEODAR-RS26"}) == DEMO_CODES


def test_other_sample_guests_get_the_random_part(sample: Session) -> None:
    guest, booking = guest_named(sample, "Arjun Mehta")
    perk = issue_perk(sample, "DEODAR", "perk", guest, booking, NOW, sample_property=True)
    assert NEW_CODE.fullmatch(perk.code), perk.code
    assert perk.code.startswith("DEODAR-AM26-")


def test_a_real_hotel_never_gets_a_demo_code(sample: Session) -> None:
    guest, booking = guest_named(sample, "Rahul Sharma")
    perk = issue_perk(sample, "DEODAR", "perk", guest, booking, NOW, sample_property=False)
    assert perk.code != "DEODAR-RS26"
    assert NEW_CODE.fullmatch(perk.code), perk.code


def test_a_taken_demo_code_falls_back_to_the_random_part(sample: Session) -> None:
    guest, booking = guest_named(sample, "Rahul Sharma")
    other_guest, other = guest_named(sample, "Neha Gupta")
    sample.add(PerkCode(code="DEODAR-RS26", guest_id=other_guest.id,
                        origin_booking_id=other.id, perk="x"))  # fmt: skip
    sample.flush()
    perk = issue_perk(sample, "DEODAR", "perk", guest, booking, NOW, sample_property=True)
    assert perk.code.startswith("DEODAR-RS26-")


def test_reissuing_returns_the_same_code(sample: Session) -> None:
    guest, booking = guest_named(sample, "Arjun Mehta")
    first = issue_perk(sample, "DEODAR", "perk", guest, booking, NOW)
    assert issue_perk(sample, "DEODAR", "perk", guest, booking, NOW).code == first.code


def test_collisions_retry_and_can_run_out(monkeypatch: pytest.MonkeyPatch, sample: Session) -> None:
    guest, booking = guest_named(sample, "Arjun Mehta")
    other_guest, other = guest_named(sample, "Neha Gupta")
    sample.add(PerkCode(code="DEODAR-AM26-2222", guest_id=other_guest.id,
                        origin_booking_id=other.id, perk="x"))  # fmt: skip
    sample.flush()
    parts = iter(["2222", "3333"])
    monkeypatch.setattr(perks, "random_part", lambda: next(parts, "2222"))
    assert issue_perk(sample, "DEODAR", "perk", guest, booking, NOW).code == "DEODAR-AM26-3333"

    _, third = guest_named(sample, "Rahul Sharma")
    monkeypatch.setattr(perks, "random_part", lambda: "2222")
    with pytest.raises(RuntimeError, match="Could not find an unused perk code"):
        issue_perk(sample, "DEODAR", "perk", guest, third, NOW)


def test_the_longest_code_fits_the_column() -> None:
    longest = f"{'X' * 20}-AB26-{'Z' * 4}"
    assert len(longest) == PerkCode.__table__.c.code.type.length  # type: ignore[attr-defined]


@pytest.mark.usefixtures("sample")
def test_link_page_never_names_the_guest(client: TestClient, owner: dict[str, str]) -> None:
    for room in (104, 207):  # Neha and Rahul check out: their codes now exist
        assert client.post("/desk/checkout", headers=owner, json={"room": room}).status_code == 200
    for raw, status in (
        ("DEODAR-RS26", "valid"),
        ("deodar-ng26", "valid"),
        ("DEODAR-XX26", "unknown"),
    ):
        page = client.get(f"/public/link?code={raw}").json()
        assert page["code_status"] == status
        assert "guest_short_name" not in page
        text = json.dumps(page)
        assert "Rahul" not in text and "Neha" not in text


@pytest.mark.usefixtures("sample")
def test_name_only_after_a_booking_accepts_the_code(
    client: TestClient, owner: dict[str, str]
) -> None:
    client.post("/desk/checkout", headers=owner, json={"room": 207})
    page = client.get("/public/link").json()
    stay = {
        "check_in": page["dates"][0]["check_in"],
        "nights": 2,
        "room_type": "Deluxe Valley View",
    }
    plain = client.post("/public/link/book", json=stay).json()
    assert (plain["perk_applied"], plain["guest_short_name"]) == (False, None)
    coded = client.post("/public/link/book", json={**stay, "code": "DEODAR-RS26"}).json()
    assert (coded["perk_applied"], coded["guest_short_name"]) == (True, "Rahul ji")
