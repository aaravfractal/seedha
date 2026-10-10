"""Seedha Recover: code-filled dispute letters for flagged statement lines."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Property
from app.money import rupees
from app.services.checks import REASON_GST_RATE, REASON_MATH_MISMATCH
from app.services.pro import AuditLine
from app.services.recover import build_dispute, format_rate


def by_ref(client: TestClient, owner: dict[str, str]) -> dict[str, dict[str, object]]:
    body = client.get("/statements/disputes", headers=owner).json()
    return {d["external_ref"]: d for d in body["disputes"]}


@pytest.mark.usefixtures("sample")
def test_recover_total_equals_pro_audit(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/statements/disputes", headers=owner).json()
    pro = client.get("/pro", headers=owner).json()
    assert body["audit_claim"] == pro["audit_claim"] == rupees(802)
    assert body["other_claim"] == rupees(120)
    refs = {d["external_ref"]: (d["reason"], d["audit_claim"], d["other_claim"])
            for d in body["disputes"]}  # fmt: skip
    assert refs == {
        "AG77102": ("commission_on_cancelled", rupees(802), 0),
        "MM48213": ("math_mismatch", 0, rupees(120)),
        "BK55320": ("gst_missing", 0, 0),
    }


@pytest.mark.usefixtures("sample")
def test_letters_are_filled_by_code(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    letters = by_ref(client, owner)
    ag = str(letters["AG77102"]["text"])
    assert "commission of ₹680 and GST of ₹122" in ag and "Total to claim back: ₹802." in ag
    mm = str(letters["MM48213"]["text"])
    assert "Room amount minus these lines is ₹3,240" in mm and "₹120 less" in mm
    assert "TDS: ₹4 (a tax credit, not part of this claim)" in mm
    bk = str(letters["BK55320"]["text"])
    assert "GST on commission: not shown" in bk and "payout is ₹128 below" in bk
    assert "Total to claim back" not in bk
    for b in sample.scalars(select(Booking).where(Booking.math_check_passed.is_(False))):
        letter = str(letters[b.external_ref]["text"])
        assert b.guest_name not in letter
        assert b.guest_name.split()[0] not in letter
        assert "!" not in letter and "—" not in letter


@pytest.mark.usefixtures("sample")
def test_drafting_is_not_a_review(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    row = sample.scalars(select(Booking).where(Booking.external_ref == "AG77102")).one()
    one = client.get(f"/statements/rows/{row.id}/dispute", headers=owner)
    assert one.status_code == 200 and one.json()["subject"].endswith("AG77102")
    sample.expire_all()
    assert (row.review_status, row.math_check_passed) == ("pending", False)
    assert client.get("/statements", headers=owner).json()["pending_review"] == 3


@pytest.mark.usefixtures("sample")
def test_no_dispute_for_a_clean_or_accepted_row(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    clean = sample.scalars(select(Booking).where(Booking.external_ref == "MM90942")).one()
    assert client.get(f"/statements/rows/{clean.id}/dispute", headers=owner).status_code == 404
    assert client.get("/statements/rows/999999/dispute", headers=owner).status_code == 404
    ag = sample.scalars(select(Booking).where(Booking.external_ref == "AG77102")).one()
    client.post(f"/statements/rows/{ag.id}/review", headers=owner, json={"decision": "accept"})
    body = client.get("/statements/disputes", headers=owner).json()
    assert "AG77102" not in {d["external_ref"] for d in body["disputes"]}
    assert body["audit_claim"] == client.get("/pro", headers=owner).json()["audit_claim"] == 0


@pytest.mark.usefixtures("sample")
def test_over_rate_line_matches_audit(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    row = sample.scalars(select(Booking).where(Booking.external_ref == "MM90942")).one()
    row.commission += rupees(100)
    row.net_kept -= rupees(100)
    sample.commit()
    body = client.get("/statements/disputes", headers=owner).json()
    assert body["audit_claim"] == client.get("/pro", headers=owner).json()["audit_claim"]
    over = by_ref(client, owner)["MM90942"]
    assert (over["reason"], over["audit_claim"]) == ("over_rate", rupees(118))
    assert "Our contract rate is 22%" in str(over["text"])
    assert "please refund ₹118" in str(over["text"])


def stay(**changes: object) -> Booking:
    fields: dict[str, object] = {
        "id": 1, "external_ref": "XX1", "status": "stay", "check_in": date(2026, 5, 1),
        "nights": 2, "guest_name": "Test Guest", "list_amount": rupees(5000),
        "discount": 0, "commission": rupees(1000), "gst_on_commission": rupees(180),
        "fees": rupees(50), "tds": 0, "gst_tcs": rupees(25), "payout_reported": rupees(3745),
        "math_check_passed": False, "flag_reason": REASON_GST_RATE, "review_status": "pending",
    }  # fmt: skip
    fields.update(changes)
    return Booking(**fields)


PROP = Property(name="Test Hotel", city="Almora", owner_name="Owner")


def test_gst_overcharge_is_claimed_outside_audit() -> None:
    d = build_dispute(stay(gst_on_commission=rupees(200), payout_reported=rupees(3725)),
                      "Agoda", PROP, None)  # fmt: skip
    assert (d.audit_claim, d.other_claim) == (0, rupees(20))
    assert "refund the ₹20 charged above 18%" in d.text
    assert "GST TCS: ₹25 (a tax credit" in d.text and "Fees: ₹50" in d.text
    assert "2 nights" in d.text


def test_gst_undercharge_and_overpaid_lines_claim_nothing() -> None:
    low = build_dispute(stay(gst_on_commission=rupees(100)), "Agoda", PROP, None)
    assert low.other_claim == 0 and "corrected tax invoice" in low.text
    overpaid = build_dispute(stay(flag_reason=REASON_MATH_MISMATCH, payout_reported=rupees(4000)),
                             "Agoda", PROP, None)  # fmt: skip
    assert overpaid.other_claim == 0 and "corrected statement" in overpaid.text
    assert "Total to claim back" not in overpaid.text


def test_over_rate_on_a_clean_row() -> None:
    b = stay(math_check_passed=True, flag_reason=None, review_status="none")
    line = AuditLine(b, "over_rate", rupees(118), 1800, rupees(900))
    d = build_dispute(b, "Agoda", PROP, line)
    assert (d.reason, d.audit_claim, d.other_claim) == ("over_rate", rupees(118), 0)
    assert "18% of the amount after discount, which is ₹900" in d.text


def test_format_rate() -> None:
    assert (format_rate(2200), format_rate(1850), format_rate(1825)) == ("22%", "18.5%", "18.25%")
