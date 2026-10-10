"""The sample hotel's four earlier coded direct bookings (FRONTEND_MASTER D9, D-080)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SAMPLE_HISTORY_PAYMENT, DirectBooking
from app.money import rupees
from app.services.ledger import load_ledger
from app.services.savings import compute_saving
from seed.coded_history import CODED_STAYS, TOTAL_NET_SAVING


@pytest.mark.usefixtures("sample")
def test_four_coded_bookings_total_12600(client: TestClient, owner: dict[str, str]) -> None:
    savings = client.get("/savings", headers=owner).json()
    assert (savings["count"], savings["total_net_saving"]) == (4, rupees(12_600))
    assert rupees(12_600) == TOTAL_NET_SAVING
    assert {i["code"] for i in savings["items"]} == {
        "DEODAR-KF26", "DEODAR-SB26", "DEODAR-AM26", "DEODAR-IF26",
    }  # fmt: skip


@pytest.mark.usefixtures("sample")
def test_each_saving_uses_the_ruling_5_formula(client: TestClient, owner: dict[str, str]) -> None:
    for item in client.get("/savings", headers=owner).json()["items"]:
        expected = compute_saving(item["amount"], item["commission_rate_used"], True)
        assert expected is not None
        if item["original_channel"] == "Travel agents":
            assert item["gst_avoided"] == 0  # agents carry no GST (D-001)
        else:
            assert item["gst_avoided"] == expected.gst_avoided
        assert item["commission_avoided"] == expected.commission_avoided
        assert item["upi_fee"] == expected.upi_fee
        assert item["net_saving"] == (
            item["commission_avoided"] + item["gst_avoided"] - item["upi_fee"]
        )


def test_history_leaves_the_ledger_and_repeats_untouched(sample: Session) -> None:
    rows = sample.scalars(
        select(DirectBooking).where(DirectBooking.payment_method == SAMPLE_HISTORY_PAYMENT)
    ).all()
    assert len(rows) == len(CODED_STAYS) == 4
    totals = load_ledger(sample, 1).totals
    assert totals.net_kept == rupees(47_33_012)
    assert totals.paid_to_channels == rupees(10_39_108)
    assert all(r.booking.check_in.month >= 10 for r in rows), "stays fall after the ledger range"


@pytest.mark.usefixtures("sample")
def test_history_does_not_tick_the_loop_and_codes_are_spent(
    client: TestClient, owner: dict[str, str]
) -> None:
    steps = {s["key"]: s["done"] for s in client.get("/pipeline", headers=owner).json()["steps"]}
    assert steps["book"] is False
    assert client.get("/repeat", headers=owner).json()["count"] == 12
    page = client.get("/public/link?code=DEODAR-KF26").json()
    assert page["code_status"] == "used"
