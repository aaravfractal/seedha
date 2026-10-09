"""Guest data-deletion requests (M10, DPDP erasure)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, ErasureRequest


def consent_neha(client: TestClient, owner: dict[str, str]) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": 104}).json()["url"]
    client.post(
        f"/public/consent/{url.rsplit('/', 1)[-1]}", json={"agree": True, "whatsapp": "9876543210"}
    )


@pytest.mark.usefixtures("sample")
def test_matching_request_erases_and_answers_like_a_miss(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_neha(client, owner)
    neha = select(Booking).where(Booking.guest_name == "Neha Gupta", Booking.source == "desk")
    ref = sample.scalars(neha).one().external_ref
    miss = client.post(
        "/public/data-deletion", json={"booking_ref": "NOPE123", "phone": "9876543210"}
    )
    hit = client.post(
        "/public/data-deletion", json={"booking_ref": ref.lower(), "phone": "+91 98765 43210"}
    )
    assert miss.status_code == hit.status_code == 200
    assert miss.json()["message"] == hit.json()["message"]
    sample.expire_all()
    consent = sample.scalars(select(Consent)).one()
    assert (
        consent.erased_at is not None and consent.whatsapp_number is None and consent.salt is None
    )
    outcomes = [
        r.outcome for r in sample.scalars(select(ErasureRequest).order_by(ErasureRequest.id))
    ]
    assert outcomes == ["no_match", "erased"]
    again = client.post("/public/data-deletion", json={"booking_ref": ref, "phone": "9876543210"})
    assert again.status_code == 200
    state = client.get("/desk/state", headers=owner).json()["guests"][0]
    assert state["consent"] is False


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    "body",
    [
        {"booking_ref": "AB", "phone": "9876543210"},
        {"booking_ref": "BK90000", "phone": "12345678901"},
        {"booking_ref": "BK90000"},
        {"phone": "9876543210"},
    ],
)
def test_bad_deletion_requests(client: TestClient, body: dict[str, str]) -> None:
    assert client.post("/public/data-deletion", json=body).status_code == 422
