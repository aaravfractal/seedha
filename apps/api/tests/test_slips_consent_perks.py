"""Slips (ruling 4), consent rules (rules 4, 5, 9) and perk codes, as units."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, PerkCode
from app.money import LineItems, rupees
from app.services.consent import ConsentError, fingerprint, normalise_mobile
from app.services.ledger import ChannelInfo, LedgerRow, summarise
from app.services.perks import code_candidates, initials, issue_perk
from app.services.scenario import ScenarioError, saturday_move
from app.services.slips import (
    CheckoutInput,
    CloseInput,
    Slip,
    SlipLine,
    checkout_slip,
    close_slip,
)


def neha_input(**overrides: object) -> CheckoutInput:
    base: dict[str, object] = {
        "hotel": "Deodar View, Mussoorie", "guest_name": "Neha Gupta", "room": 104,
        "channel_name": "Booking.com", "channel_kind": "ota",
        "lines": LineItems(rupees(4_000), rupees(600), rupees(612), rupees(110)),
        "perk_text": "Free breakfast", "perk_code": "DEODAR-NG26",
    }  # fmt: skip
    base.update(overrides)
    return CheckoutInput(**base)  # type: ignore[arg-type]


def test_neha_slip_matches_ruling_4() -> None:
    slip = checkout_slip(neha_input())
    assert slip.lines == [
        SlipLine("Room (via Booking.com)", rupees(4_000)),
        SlipLine("Discount", -rupees(600)),
        SlipLine("Commission", -rupees(612)),
        SlipLine("GST on commission", -rupees(110)),
        SlipLine("Hotel kept", rupees(2_678), bold=True),
    ]
    assert slip.subtitle == "Neha Gupta · Room 104"
    assert slip.footer[-1] == "DEODAR-NG26"
    text = slip.as_text()
    assert "Hotel kept" in text and "Rs 2,678" in text and "-Rs 612" in text


def test_walk_in_slip_has_no_commission_lines() -> None:
    slip = checkout_slip(
        neha_input(
            guest_name="Arjun Mehta",
            room=112,
            channel_name="Walk-in",
            channel_kind="walkin",
            lines=LineItems(rupees(3_400)),
            perk_code=None,
        )  # fmt: skip
    )
    labels = [line.label for line in slip.lines]
    assert labels == ["Room (Walk-in)", "Booked directly. Hotel kept"]
    assert slip.lines[-1].amount == rupees(3_400)
    assert not any("Commission" in label or "GST" in label for label in labels)
    assert "code" not in " ".join(slip.footer)


def test_agent_and_fee_lines() -> None:
    agent = checkout_slip(
        neha_input(
            channel_name="Travel agents",
            channel_kind="agent",
            lines=LineItems(rupees(3_800), 0, rupees(380)),
            room=None,
        )  # fmt: skip
    )
    assert [x.label for x in agent.lines] == [
        "Room (via Travel agents)",
        "Commission",
        "Hotel kept",
    ]
    assert agent.subtitle == "Neha Gupta"
    fee = checkout_slip(neha_input(lines=LineItems(rupees(4_000), 0, 0, 0, rupees(16))))
    assert [x.label for x in fee.lines] == ["Room (via Booking.com)", "Payment fees", "Hotel kept"]


def test_close_slip() -> None:
    slip = close_slip(
        CloseInput(
            hotel="Deodar View",
            day=date(2026, 10, 13),
            rooms_sold=14,
            direct_rooms=3,
            lines=LineItems(
                rupees(58_800), rupees(1_000), rupees(9_000), rupees(1_600), rupees(50)
            ),
            saved_this_month=rupees(2_199),
        )  # fmt: skip
    )
    labels = {line.label: line.amount for line in slip.lines}
    assert labels["Gross"] == rupees(58_800)
    assert labels["Commission + GST"] == -rupees(10_600)
    assert labels["Net kept"] == rupees(47_150)
    assert "Direct bookings: 21%" in labels
    assert slip.footer == ["Saved this month: ₹2,199"]
    empty = close_slip(CloseInput("Deodar View", date(2026, 10, 13), 0, 0, LineItems(0), 0))
    assert not any(line.label.startswith("Direct") for line in empty.lines)


@pytest.mark.parametrize(
    ("raw", "clean"),
    [("9876543210", "+919876543210"), ("+91 98765 43210", "+919876543210"),
     ("91-98765-43210", "+919876543210"), ("(98765) 43210", "+919876543210")],
)  # fmt: skip
def test_mobile_numbers(raw: str, clean: str) -> None:
    assert normalise_mobile(raw) == clean


@pytest.mark.parametrize("bad", ["12345", "5876543210", "+1 415 555 0100", "98765432101"])
def test_bad_mobile_numbers(bad: str) -> None:
    with pytest.raises(ConsentError):
        normalise_mobile(bad)


def test_fingerprint_is_salted_and_stable() -> None:
    at = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)
    a = fingerprint("salt-a", 7, at, "consent-v1")
    assert a == fingerprint("salt-a", 7, at, "consent-v1")
    assert a != fingerprint("salt-b", 7, at, "consent-v1")
    assert a != fingerprint("salt-a", 7, at + timedelta(seconds=1), "consent-v1")
    assert len(a) == 64


def test_perk_codes() -> None:
    assert initials("Neha Gupta") == "NG"
    assert initials("A. Verma family") == "AV"
    assert initials("Madonna") == "M"
    assert initials("") == "G"
    codes = code_candidates("DEODAR", "Rahul Sharma", 2026)
    assert codes[:3] == ["DEODAR-RS26", "DEODAR-RS226", "DEODAR-RS326"]


def test_slip_text_without_footer() -> None:
    slip = Slip(title="T", subtitle="S", lines=[SlipLine("Gross", rupees(10))])
    assert slip.as_text(width=20) == "T\nS\n" + "-" * 20 + "\nGross          Rs 10"


def test_saturday_move_room_range() -> None:
    infos = [ChannelInfo("ota", "OTA", "ota", 1), ChannelInfo("d", "Direct", "direct", 2)]
    rows = [LedgerRow("ota", True, 1, LineItems(rupees(3_000))),
            LedgerRow("d", True, 1, LineItems(rupees(4_000)))]  # fmt: skip
    ledger = summarise(infos, rows, rooms_count=10)
    assert saturday_move(ledger, 10).extra_per_saturday == rupees(10_000)
    for rooms in (0, 11):
        with pytest.raises(ScenarioError, match="between 1 and 10"):
            saturday_move(ledger, rooms)


def test_perk_codes_can_run_out(monkeypatch: pytest.MonkeyPatch, sample: Session) -> None:
    monkeypatch.setattr("app.services.perks.MAX_SUFFIX", 2)
    booking = sample.scalars(select(Booking).where(Booking.source == "desk")).first()
    assert booking is not None and booking.guest is not None
    for code in code_candidates("DEODAR", booking.guest.display_name, 2026):
        sample.add(
            PerkCode(code=code, guest_id=booking.guest.id, origin_booking_id=booking.id, perk="x")
        )
    sample.flush()
    other = sample.scalars(select(Booking).where(Booking.source == "desk")).all()[1]
    assert other.guest is not None
    other.guest.display_name = booking.guest.display_name
    with pytest.raises(RuntimeError, match="No perk code left"):
        issue_perk(sample, "DEODAR", "perk", other.guest, other, datetime(2026, 10, 13, tzinfo=UTC))
