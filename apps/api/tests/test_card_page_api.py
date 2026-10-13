"""Card page API (a guest who scanned the hotel's printed card): verify a past
stay by booking reference (and the last 4 digits of a Desk consent number
when one is on file), rate it once with a 30-minute single-use token, leave a
private note for the owner; the owner's notes list, Needs-you items, reset."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Consent,
    GuestFeedback,
    PerkCode,
    Property,
    SiteFeedback,
    SiteRating,
)
from app.ratelimit import RateLimiter
from app.services.card_page import last4
from app.services.proof import erase_consent
from app.services.site_ratings import issue_token
from seed.load import load_sample
from tests.conftest import DEMO_DATE, DEVICE_KEY

SAMPLE = "/public/site/deodar-view"
VERIFY = f"{SAMPLE}/card/verify"
RATE = f"{SAMPLE}/card/rate"
FEEDBACK = f"{SAMPLE}/card/feedback"
NO_PHONE = "CL2101"  # a Desk close stay two days before the demo date, no number
WITH_PHONE = "CL3108"  # the first sample inbox thread's stay: +91 90000 00101
PHONE_LAST4 = "0101"
IN_HOUSE = "BK90000"  # checked in on the demo date, one night: not over yet
T0 = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)


@pytest.fixture(name="hotel")
def fixture_hotel(session: Session) -> Session:
    """The sample hotel as the demo and a reset load it (inbox threads too)."""
    load_sample(session, DEMO_DATE, with_statements=False, device_key=DEVICE_KEY,
                with_inbox=True, now=T0)  # fmt: skip
    # The two sample feedbacks (D-106) rate CL2101 and CL3108; these tests
    # need those stays unrated, so the sample feedback and ratings go.
    session.execute(delete(GuestFeedback))
    session.execute(delete(SiteRating))
    session.commit()
    return session


def set_clock(client: TestClient, at: datetime) -> None:
    client.app.state.clock = lambda: at  # type: ignore[attr-defined]


def booking(session: Session, ref: str) -> Booking:
    return session.scalars(select(Booking).where(Booking.external_ref == ref)).one()


def verify(client: TestClient, ref: str, phone: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"booking_ref": ref}
    if phone is not None:
        body["phone_last4"] = phone
    res = client.post(VERIFY, json=body)
    assert res.status_code == 200, res.text
    out: dict[str, Any] = res.json()
    return out


def rate(client: TestClient, token: str, stars: int = 5, comment: str = "") -> Any:
    return client.post(RATE, json={"stay_token": token, "stars": stars, "comment": comment})


def ratings_count(client: TestClient) -> int:
    count: int = client.get(SAMPLE).json()["ratings"]["count"]
    return count


# --- verify --------------------------------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_sample_references_are_ended_stays_with_and_without_a_number(session: Session) -> None:
    no_phone, with_phone = booking(session, NO_PHONE), booking(session, WITH_PHONE)
    for stay in (no_phone, with_phone):
        assert stay.status == "stay" and stay.check_in + timedelta(days=stay.nights) <= DEMO_DATE
    numbers = {c.booking_id: c.whatsapp_number for c in session.scalars(select(Consent))}
    assert no_phone.id not in numbers and last4(numbers[with_phone.id]) == PHONE_LAST4


@pytest.mark.usefixtures("hotel")
def test_reference_alone_verifies_a_stay_without_a_number(
    client: TestClient, session: Session
) -> None:
    out = verify(client, NO_PHONE.lower())
    stay = booking(session, NO_PHONE)
    assert out["state"] == "verified" and out["nights"] == 1
    assert out["room_type"] == stay.room.room_type if stay.room else "room_type" not in out
    assert out["next_check_in"] == (DEMO_DATE + timedelta(days=14)).isoformat()
    assert out["perk_code"] is None and "perk_code" in out
    token = out["stay_token"]
    assert len(token) >= 32 and str(stay.id) not in token.split("-")
    row = session.scalars(select(SiteRating).where(SiteRating.source == "card")).one()
    assert row.source_ref == stay.id and row.stars is None and row.token_hash != token


@pytest.mark.usefixtures("hotel")
def test_a_number_on_file_needs_its_last_four_digits(client: TestClient) -> None:
    assert verify(client, WITH_PHONE) == {"state": "needs_phone"}
    assert verify(client, WITH_PHONE, "9999") == {"state": "not_found"}
    out = verify(client, WITH_PHONE, PHONE_LAST4)
    assert out["state"] == "verified" and out["stay_token"]


@pytest.mark.usefixtures("hotel")
def test_unknown_unfinished_and_cancelled_stays(client: TestClient, session: Session) -> None:
    assert verify(client, "NOPE-123") == {"state": "not_found"}
    assert verify(client, "NOPE-123", "1234") == {"state": "not_found"}
    assert verify(client, IN_HOUSE) == {"state": "not_ended"}
    booking(session, NO_PHONE).status = "cancelled"
    session.commit()
    assert verify(client, NO_PHONE) == {"state": "not_found"}


@pytest.mark.usefixtures("hotel")
def test_an_erased_consent_keeps_no_number(client: TestClient, session: Session) -> None:
    consent = session.scalars(
        select(Consent).where(Consent.booking_id == booking(session, WITH_PHONE).id)
    ).one()
    erase_consent(session, consent, T0)
    session.commit()
    assert verify(client, WITH_PHONE)["state"] == "verified"


@pytest.mark.usefixtures("hotel")
@pytest.mark.parametrize(
    "body",
    [
        {"booking_ref": ""},
        {"booking_ref": "x" * 31},
        {"booking_ref": "CL 2101"},
        {"booking_ref": "<b>"},
        {"booking_ref": NO_PHONE, "phone_last4": "123"},
        {"booking_ref": NO_PHONE, "phone_last4": "12a4"},
        {"booking_ref": NO_PHONE, "phone_last4": "12345"},
        {"booking_ref": NO_PHONE, "extra": 1},
    ],
)
def test_verify_refuses_bad_input(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post(VERIFY, json=body).status_code == 422


@pytest.mark.usefixtures("hotel")
def test_unknown_hotel_is_404(client: TestClient) -> None:
    res = client.post("/public/site/no-such-hotel/card/verify", json={"booking_ref": NO_PHONE})
    assert res.status_code == 404


@pytest.mark.usefixtures("hotel")
def test_verify_returns_an_unredeemed_perk_code(client: TestClient, session: Session) -> None:
    stay = booking(session, NO_PHONE)
    assert stay.guest_id is not None
    session.add_all([
        PerkCode(code="DEODAR-OLD1", guest_id=stay.guest_id, origin_booking_id=stay.id,
                 perk="Sample perk", created_at=T0, redeemed_at=T0),
        PerkCode(code="DEODAR-NEW1", guest_id=stay.guest_id, origin_booking_id=stay.id,
                 perk="Sample perk", created_at=T0),
    ])  # fmt: skip
    session.commit()
    assert verify(client, NO_PHONE)["perk_code"] == "DEODAR-NEW1"


# --- rate ----------------------------------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_a_stay_token_rates_once_and_counts_publicly(client: TestClient) -> None:
    before = ratings_count(client)
    token = verify(client, NO_PHONE)["stay_token"]
    assert rate(client, token, 4, "Lovely view").status_code == 204
    again = rate(client, token, 5)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_rated"
    assert verify(client, NO_PHONE) == {"state": "already_rated"}
    assert ratings_count(client) == before + 1


@pytest.mark.usefixtures("hotel")
def test_card_ratings_reach_the_public_summary_from_three(
    client: TestClient, owner: dict[str, str]
) -> None:
    for ref, stars in (("CL2101", 5), ("CL2102", 4), ("CL2104", 3)):
        assert (
            rate(client, verify(client, ref)["stay_token"], stars, f"Note {ref}").status_code == 204
        )
    summary = client.get(SAMPLE).json()["ratings"]
    assert summary["count"] == 3 and summary["average"] == 4.0
    hidden = next(r for r in client.get("/site/ratings", headers=owner).json() if r["stars"] == 3)
    assert hidden["source"] == "card"
    client.patch(f"/site/ratings/{hidden['id']}", headers=owner, json={"hidden": True})
    comments = [c["comment"] for c in client.get(SAMPLE).json()["ratings"]["comments"]]
    assert "Note CL2104" not in comments and len(comments) == 2


@pytest.mark.usefixtures("hotel")
def test_bad_tokens_and_comments(client: TestClient) -> None:
    assert rate(client, "not-a-token").status_code == 400
    token = verify(client, NO_PHONE)["stay_token"]
    assert rate(client, token, 0).status_code == 422
    assert rate(client, token, 6).status_code == 422
    assert rate(client, token, 5, "x" * 201).status_code == 422
    assert rate(client, token, 5, "<script>").status_code == 422
    res = client.post(RATE, json={"stay_token": token, "stars": 5, "booking_id": 1})
    assert res.status_code == 422
    assert rate(client, token, 5).status_code == 204


@pytest.mark.usefixtures("hotel")
def test_a_token_expires_after_thirty_minutes(client: TestClient) -> None:
    set_clock(client, T0)
    token = verify(client, NO_PHONE)["stay_token"]
    set_clock(client, T0 + timedelta(minutes=31))
    assert rate(client, token).status_code == 400
    fresh = verify(client, NO_PHONE)["stay_token"]
    set_clock(client, T0 + timedelta(minutes=60))
    assert rate(client, fresh).status_code == 204


@pytest.mark.usefixtures("hotel")
def test_verifying_again_replaces_the_token(client: TestClient, session: Session) -> None:
    first = verify(client, NO_PHONE)["stay_token"]
    second = verify(client, NO_PHONE)["stay_token"]
    assert first != second and rate(client, first).status_code == 400
    assert rate(client, second).status_code == 204
    assert session.scalar(select(func.count()).select_from(SiteRating)) == 1


@pytest.mark.usefixtures("hotel")
def test_card_and_rate_link_tokens_never_cross(client: TestClient, session: Session) -> None:
    token = verify(client, NO_PHONE)["stay_token"]
    assert client.get(f"/public/rate/{token}").json()["state"] == "invalid"
    assert client.post(f"/public/rate/{token}", json={"stars": 5}).status_code == 404
    prop = session.scalars(select(Property)).one()
    other = issue_token(
        session, prop.id, "desk", booking(session, "CL2102").id, T0, date(2020, 1, 1)
    )
    session.commit()
    assert other is not None and rate(client, other).status_code == 400


@pytest.mark.usefixtures("hotel")
def test_one_rating_per_stay_across_sources(client: TestClient, session: Session) -> None:
    prop = session.scalars(select(Property)).one()
    stay = booking(session, NO_PHONE)
    desk = issue_token(session, prop.id, "desk", stay.id, T0, date(2020, 1, 1))
    session.commit()
    assert desk is not None
    card = verify(client, NO_PHONE)["stay_token"]
    assert rate(client, card, 5).status_code == 204
    assert client.get(f"/public/rate/{desk}").json()["state"] == "used"
    late = client.post(f"/public/rate/{desk}", json={"stars": 1})
    assert late.status_code == 409 and late.json()["error"]["code"] == "already_rated"
    # The other way round: a Desk rating first, then the card page.
    other = booking(session, "CL2102")
    desk2 = issue_token(session, prop.id, "desk", other.id, T0, date(2020, 1, 1))
    session.commit()
    token2 = verify(client, "CL2102")["stay_token"]
    assert client.post(f"/public/rate/{desk2}", json={"stars": 4}).status_code == 204
    assert rate(client, token2).status_code == 409
    assert verify(client, "CL2102") == {"state": "already_rated"}
    given = session.scalar(
        select(func.count()).select_from(SiteRating).where(SiteRating.stars.is_not(None))
    )
    assert given == 2


# --- rate limits ---------------------------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_verify_is_limited_per_client_per_hotel_and_per_client(client: TestClient) -> None:
    codes = [client.post(VERIFY, json={"booking_ref": "NOPE"}).status_code for _ in range(7)]
    assert codes == [200] * 6 + [429]
    others = [
        client.post(f"/public/site/{s}/card/verify", json={"booking_ref": "NOPE"}).status_code
        for s in ("a-hotel", "b-hotel", "c-hotel", "d-hotel")
    ]
    assert others == [404, 404, 404, 429]  # 10 a minute per client across hotels


@pytest.mark.usefixtures("hotel")
def test_rate_and_feedback_are_limited(client: TestClient) -> None:
    rates = [rate(client, "x").status_code for _ in range(11)]
    assert rates == [400] * 10 + [429]
    notes = [client.post(FEEDBACK, json={"message": "Hi"}).status_code for _ in range(6)]
    assert notes == [204] * 5 + [429]


# --- private notes -------------------------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_feedback_is_private_and_never_counted(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    before = client.get(SAMPLE).json()
    assert client.post(FEEDBACK, json={"message": "The geyser in 204 was slow"}).status_code == 204
    after = client.get(SAMPLE)
    assert "geyser" not in after.text and after.json() == before
    assert "geyser" not in str(client.get("/site/ratings", headers=owner).json())
    row = session.scalars(select(SiteFeedback)).one()
    assert row.message == "The geyser in 204 was slow" and row.read_at is None
    assert set(SiteFeedback.__table__.columns.keys()) == {
        "id", "property_id", "message", "created_at", "read_at",
    }  # fmt: skip
    for bad in ("", "x" * 501, "<a href=x>", "Hi" + chr(0x202E)):
        assert client.post(FEEDBACK, json={"message": bad}).status_code == 422
    client.app.state.rate_limiter = RateLimiter()  # type: ignore[attr-defined]
    assert client.post(FEEDBACK, json={"message": "Hi", "name": "x"}).status_code == 422


@pytest.mark.usefixtures("hotel")
def test_owner_reads_notes_newest_first(client: TestClient, owner: dict[str, str]) -> None:
    for i, message in enumerate(("First note", "Second note")):
        set_clock(client, T0 + timedelta(minutes=i))
        assert client.post(FEEDBACK, json={"message": message}).status_code == 204
    notes = client.get("/site/feedback", headers=owner).json()
    assert [n["message"] for n in notes] == ["Second note", "First note"]
    assert set(notes[0]) == {"id", "message", "created_at", "read"}
    assert not any(n["read"] for n in notes)
    marked = client.patch(f"/site/feedback/{notes[1]['id']}", headers=owner, json={"read": True})
    assert marked.status_code == 200 and marked.json()["read"] is True
    unread = client.patch(f"/site/feedback/{notes[1]['id']}", headers=owner, json={"read": False})
    assert unread.json()["read"] is False
    assert (
        client.patch("/site/feedback/9999", headers=owner, json={"read": True}).status_code == 404
    )
    bad = client.patch(f"/site/feedback/{notes[0]['id']}", headers=owner, json={"message": "x"})
    assert bad.status_code == 422


@pytest.mark.usefixtures("hotel")
def test_owner_routes_need_the_owner(client: TestClient, device: dict[str, str]) -> None:
    for headers in ({}, {"Authorization": "Bearer wrong"}, device):
        assert client.get("/site/feedback", headers=headers).status_code == 401
        res = client.patch("/site/feedback/1", headers=headers, json={"read": True})
        assert res.status_code == 401


# --- Needs you and reset -------------------------------------------------------------


def needs(client: TestClient, owner: dict[str, str]) -> dict[str, dict[str, Any]]:
    items = client.get("/overview", headers=owner).json()["needs_you"]
    return {i["id"]: i for i in items}


@pytest.mark.usefixtures("hotel")
def test_needs_you_lists_unread_notes_and_new_ratings(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    assert not {"site-notes", "site-ratings"} & set(needs(client, owner))
    client.post(FEEDBACK, json={"message": "Thank you"})
    client.post(FEEDBACK, json={"message": "Great tea"})
    assert rate(client, verify(client, NO_PHONE)["stay_token"]).status_code == 204
    items = needs(client, owner)
    assert items["site-notes"]["title"] == "Read 2 private notes from guests"
    assert items["site-ratings"]["title"] == "1 new rating this week"
    assert items["site-notes"]["href"] == items["site-ratings"]["href"] == "/site"
    for note in client.get("/site/feedback", headers=owner).json():
        client.patch(f"/site/feedback/{note['id']}", headers=owner, json={"read": True})
    old = session.scalars(select(SiteRating).where(SiteRating.stars.is_not(None))).one()
    old.used_at = datetime.now(UTC) - timedelta(days=8)
    session.commit()
    assert not {"site-notes", "site-ratings"} & set(needs(client, owner))


@pytest.mark.usefixtures("hotel")
def test_reset_clears_notes_and_card_ratings(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    client.post(FEEDBACK, json={"message": "Hello"})
    assert rate(client, verify(client, NO_PHONE)["stay_token"]).status_code == 204
    assert client.post("/demo/reset", headers=owner).status_code == 200
    assert session.scalar(select(func.count()).select_from(SiteFeedback)) == 0
    # Reset restores the two sample feedbacks (D-106) and only their ratings.
    assert session.scalar(select(func.count()).select_from(GuestFeedback)) == 2
    assert session.scalar(select(func.count()).select_from(SiteRating)) == 2
    assert verify(client, NO_PHONE) == {"state": "already_rated"}
    # Unrated references still work after a reset.
    assert verify(client, "CL2102")["state"] == "verified"
    assert verify(client, "CL3101") == {"state": "needs_phone"}


@pytest.mark.usefixtures("hotel")
def test_erasure_blanks_card_comments(client: TestClient, session: Session) -> None:
    token = verify(client, WITH_PHONE, PHONE_LAST4)["stay_token"]
    assert rate(client, token, 5, "Kind staff").status_code == 204
    consent = session.scalars(
        select(Consent).where(Consent.booking_id == booking(session, WITH_PHONE).id)
    ).one()
    erase_consent(session, consent, T0)
    session.commit()
    row = session.scalars(select(SiteRating).where(SiteRating.source == "card")).one()
    assert row.comment == "" and row.stars == 5


def test_last4() -> None:
    cases: dict[str | None, str | None] = {"+91 90000 00101": "0101", "123": None, None: None}
    check: Callable[[str | None], str | None] = last4
    assert {k: check(k) for k in cases} == cases
