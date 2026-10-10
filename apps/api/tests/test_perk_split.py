"""Split the Commission: what the OTA would have taken, the perk's cost to the
hotel, and what the hotel keeps beyond that. Ruling 5 numbers stay locked."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.money import rupees
from app.services.savings import SAMPLE_PERK_COST_PER_NIGHT, perk_split
from seed.coded_history import TOTAL_NET_SAVING
from tests.test_winback_flow import consent_and_checkout


def test_perk_split_adds_up() -> None:
    split = perk_split(rupees(2_233), rupees(34), 2, SAMPLE_PERK_COST_PER_NIGHT)
    assert (split.perk_cost, split.kept_after_perk) == (rupees(800), rupees(1_399))
    assert split.upi_fee + split.perk_cost + split.kept_after_perk == split.avoided


def test_a_perk_dearer_than_the_saving_shows_a_loss() -> None:
    split = perk_split(rupees(500), 0, 3, rupees(400))
    assert split.kept_after_perk == -rupees(700)


def rahul_books(client: TestClient, owner: dict[str, str]) -> None:
    consent_and_checkout(client, owner, 207, "9876543210")
    draft = client.get("/messages", headers=owner).json()["messages"][0]
    client.post(f"/messages/{draft['id']}/approve", headers=owner)
    first = client.get("/public/link?code=DEODAR-RS26").json()["dates"][0]
    res = client.post("/public/link/book", json={
        "code": "DEODAR-RS26", "check_in": first["check_in"], "nights": 2,
        "room_type": "Deluxe Valley View",
    })  # fmt: skip
    assert res.status_code == 200, res.text


@pytest.mark.usefixtures("sample")
def test_rahul_split_keeps_ruling_5_numbers(client: TestClient, owner: dict[str, str]) -> None:
    rahul_books(client, owner)
    savings = client.get("/savings", headers=owner).json()
    item = next(i for i in savings["items"] if i["code"] == "DEODAR-RS26")
    assert item["commission_avoided"] + item["gst_avoided"] == rupees(2_233)
    assert (item["net_saving"], item["amount"], item["nights"]) == (rupees(2_199), rupees(8_600), 2)
    assert (item["perk_cost"], item["kept_after_perk"]) == (rupees(800), rupees(1_399))
    assert item["perk"] == "Free breakfast on your next direct stay"
    assert (savings["perk_cost_per_night"], savings["perk_cost_is_sample"]) == (rupees(400), True)
    assert savings["total_net_saving"] == TOTAL_NET_SAVING + rupees(2_199)


@pytest.mark.usefixtures("sample")
def test_owner_entered_perk_cost(client: TestClient, owner: dict[str, str]) -> None:
    rahul_books(client, owner)
    savings = client.get("/savings?perk_cost_per_night=250", headers=owner).json()
    item = next(i for i in savings["items"] if i["code"] == "DEODAR-RS26")
    assert (item["perk_cost"], item["kept_after_perk"]) == (rupees(500), rupees(1_699))
    assert (savings["perk_cost_per_night"], savings["perk_cost_is_sample"]) == (rupees(250), False)
    assert item["net_saving"] == rupees(2_199)
    for bad in ("-1", "5001", "abc"):
        res = client.get(f"/savings?perk_cost_per_night={bad}", headers=owner)
        assert res.status_code == 422
