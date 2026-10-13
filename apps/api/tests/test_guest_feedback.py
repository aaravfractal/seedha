"""Card-page guest feedback (D-106): the form, verification, rewards, owner
approval and send, STOP, erasure, Needs you, reward-code redemption at
Seedha Link (hotel-funded discount line) and migration 0019."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, DirectBooking, GuestFeedback, PerkCode, Saving, SiteRating
from app.money import bps_of, rupees, upi_fee
from app.ratelimit import RateLimiter
from app.services.messages import handle_inbound
from app.services.savings import compute_saving, perk_split, reward_discount
from app.services.whatsapp import SendResult
from seed.load import load_sample
from tests.conftest import DEMO_DATE, DEVICE_KEY

SAMPLE = "/public/site/deodar-view"
FORM = f"{SAMPLE}/feedback"
LIST = "/site/guest-feedback"
NO_PHONE = "CL2102"  # an ended Desk close stay with no number on file
WITH_PHONE = "CL3101"  # sample inbox thread 2: +91 90000 00102
NUMBER = "+919000000102"
T0 = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)
API_ROOT = Path(__file__).resolve().parent.parent


class Recorder:
    """A sender that records what would have gone out."""

    def __init__(self, ok: bool = True) -> None:
        self.sent: list[tuple[str, str]] = []
        self.ok = ok

    def send(self, to: str, body: str, message_id: int) -> SendResult:
        self.sent.append((to, body))
        return SendResult(ok=self.ok, transport="simulated", provider_id=f"sim-{message_id}",
                          error=None if self.ok else "No")  # fmt: skip


@pytest.fixture(name="hotel")
def fixture_hotel(session: Session) -> Session:
    """The sample hotel as the demo and a reset load it."""
    load_sample(session, DEMO_DATE, with_statements=False, device_key=DEVICE_KEY,
                with_inbox=True, now=T0)  # fmt: skip
    session.commit()
    return session


@pytest.fixture(name="sender")
def fixture_sender(client: TestClient) -> Recorder:
    recorder = Recorder()
    client.app.state.sender = recorder  # type: ignore[attr-defined]
    return recorder


def form(**over: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"name": "Asha Rawat", "overall": 5, "reward": "breakfast"}
    body.update(over)
    return body


def post(client: TestClient, **over: Any) -> Any:
    client.app.state.rate_limiter = RateLimiter()  # type: ignore[attr-defined]
    return client.post(FORM, json=form(**over))


def rows(session: Session) -> list[GuestFeedback]:
    session.expire_all()
    return list(session.scalars(select(GuestFeedback).order_by(GuestFeedback.id)))


def rewards(client: TestClient, owner: dict[str, str], **on: bool) -> None:
    body = {"breakfast": True, "pct5": False, "flat100": False, **on}
    assert client.put("/settings/rewards", headers=owner, json=body).json() == body


def latest(session: Session) -> GuestFeedback:
    return rows(session)[-1]


# --- settings and the public payload --------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_rewards_default_to_breakfast_and_follow_settings(
    client: TestClient, owner: dict[str, str]
) -> None:
    assert client.get("/settings/rewards", headers=owner).json() == {
        "breakfast": True, "pct5": False, "flat100": False,
    }  # fmt: skip
    assert client.get(SAMPLE).json()["rewards"] == [
        {"id": "breakfast", "en": "Free breakfast", "hi": "मुफ़्त नाश्ता"}
    ]
    rewards(client, owner, pct5=True, flat100=True)
    labels = [r["en"] for r in client.get(SAMPLE).json()["rewards"]]
    assert labels == [
        "Free breakfast", "5% off your next direct stay", "₹100 off your next direct stay",
    ]  # fmt: skip
    bad = {"breakfast": "yes", "pct5": False, "flat100": False}
    assert client.put("/settings/rewards", headers=owner, json=bad).status_code == 422
    assert client.get("/settings/rewards").status_code == 401


# --- the form --------------------------------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_unverified_feedback_is_private_and_gets_breakfast_at_most(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    before = client.get(SAMPLE).json()["ratings"]["count"]
    rewards(client, owner, pct5=True)
    res = post(client, reward="pct5", food=3, review="Lovely")
    assert res.json() == {"verified": False, "reward": "breakfast", "state": "saved"}
    row = latest(session)
    assert row.booking_id is None and not row.verified and row.phone is None
    assert row.consent_at is None and row.food == 3 and row.status == "new"
    assert client.get(SAMPLE).json()["ratings"]["count"] == before
    rewards(client, owner, breakfast=False)
    assert post(client, reward="breakfast").json()["reward"] == "none"
    assert post(client, reward="none").json()["reward"] == "none"
    # A reference that does not check out, or a stay not over yet: unverified.
    assert post(client, booking_ref="ZZ0000").json()["verified"] is False
    assert post(client, booking_ref="BK90000").json()["verified"] is False


@pytest.mark.usefixtures("hotel")
def test_phone_is_stored_only_with_consent(client: TestClient, session: Session) -> None:
    assert post(client, whatsapp="+91 90000 00999").status_code == 200
    assert latest(session).phone is None
    assert post(client, whatsapp="90000 00999", consent=True).status_code == 200
    row = latest(session)
    assert row.phone == "+919000000999" and row.consent_wording_version == "card-2026-10"
    assert row.consent_at is not None and row.withdrawn_at is None
    assert post(client, consent=True).status_code == 422  # a tick needs a number


@pytest.mark.usefixtures("hotel")
def test_every_field_is_validated(client: TestClient) -> None:
    bad: list[dict[str, Any]] = [
        {"name": ""}, {"name": "x" * 61}, {"name": "<b>Asha</b>"}, {"overall": 0},
        {"overall": 6}, {"food": 6}, {"review": "x" * 501}, {"review": "a" + chr(0x202E)},
        {"reward": "cash"}, {"whatsapp": "12345"}, {"whatsapp": "+91-90000-00101"},
        {"whatsapp": "+1 415 555 0101"}, {"booking_ref": "CL 2101"}, {"phone_last4": "12a4"},
        {"consent": "yes"}, {"email": "a@b.c"},
    ]  # fmt: skip
    for over in bad:
        assert post(client, **over).status_code == 422, over
    assert client.post(f"{FORM.replace('deodar-view', 'nope')}", json=form()).status_code == 404


@pytest.mark.usefixtures("hotel")
def test_form_is_rate_limited_per_client(client: TestClient) -> None:
    client.app.state.rate_limiter = RateLimiter()  # type: ignore[attr-defined]
    codes = [client.post(FORM, json=form()).status_code for _ in range(6)]
    assert codes == [200] * 5 + [429]


# --- verification and the public rating ------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_verified_stay_rates_once_and_may_choose_a_discount(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    rewards(client, owner, flat100=True)
    before = client.get(SAMPLE).json()["ratings"]["count"]
    res = post(client, booking_ref=NO_PHONE.lower(), reward="flat100", overall=4, review="Calm")
    assert res.json() == {"verified": True, "reward": "flat100", "state": "saved"}
    stay = session.scalars(select(Booking).where(Booking.external_ref == NO_PHONE)).one()
    rating = session.scalars(
        select(SiteRating).where(SiteRating.source == "card", SiteRating.source_ref == stay.id)
    ).one()
    assert rating.stars == 4 and rating.comment == "Calm" and rating.used_at is not None
    assert client.get(SAMPLE).json()["ratings"]["count"] == before + 1
    again = post(client, booking_ref=NO_PHONE)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_rated"
    card = client.post(f"{SAMPLE}/card/verify", json={"booking_ref": NO_PHONE})
    assert card.json() == {"state": "already_rated"}


@pytest.mark.usefixtures("hotel")
def test_a_number_on_file_needs_its_last_four(client: TestClient, session: Session) -> None:
    assert post(client, booking_ref=WITH_PHONE).json()["verified"] is False
    assert post(client, booking_ref=WITH_PHONE, phone_last4="9999").json()["verified"] is False
    long_review = "Good " * 50
    res = post(client, booking_ref=WITH_PHONE, whatsapp=NUMBER, review=long_review.strip())
    assert res.json()["verified"] is True  # digits taken from the WhatsApp number
    stay_id = latest(session).booking_id
    rating = session.scalars(select(SiteRating).where(SiteRating.source_ref == stay_id)).one()
    assert rating.comment == ""  # over 200 characters: stars only in public


@pytest.mark.usefixtures("hotel")
def test_an_open_card_token_cannot_rate_after_feedback(client: TestClient) -> None:
    token = client.post(f"{SAMPLE}/card/verify", json={"booking_ref": NO_PHONE}).json()
    assert post(client, booking_ref=NO_PHONE).json()["verified"] is True
    res = client.post(f"{SAMPLE}/card/rate", json={"stay_token": token["stay_token"], "stars": 1})
    assert res.status_code == 400


# --- owner list, Needs you, seed --------------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_sample_feedback_owner_list_and_needs_you(
    client: TestClient, owner: dict[str, str]
) -> None:
    items = client.get(LIST, headers=owner).json()
    assert [i["booking_ref"] for i in items] == ["CL2105", "CL3201"]  # newest first
    first, second = items
    assert first["verified"] and not first["can_message"] and first["review"].startswith("Sample")
    assert second["can_message"] and second["reward_label"] == "Free breakfast"
    assert "phone" not in second and second["perk_code"] is None
    summary = client.get(SAMPLE).json()["ratings"]
    assert summary == {"count": 2, "average": None, "comments": []}
    needs = {i["id"]: i for i in client.get("/overview", headers=owner).json()["needs_you"]}
    item = needs["guest-feedback"]
    assert item["title"] == "2 new guest feedback" and item["href"] == "/site"
    assert item["icon"] == "inbox"
    for row in items:
        res = client.patch(f"{LIST}/{row['id']}", headers=owner, json={"read": True})
        assert res.json()["read"] is True
    left = {i["id"] for i in client.get("/overview", headers=owner).json()["needs_you"]}
    assert "guest-feedback" not in left


@pytest.mark.usefixtures("hotel")
def test_owner_hides_shows_and_marks_unread(client: TestClient, owner: dict[str, str]) -> None:
    row_id = client.get(LIST, headers=owner).json()[0]["id"]
    hidden = client.patch(f"{LIST}/{row_id}", headers=owner, json={"hidden": True}).json()
    assert hidden["status"] == "hidden"
    shown = client.patch(f"{LIST}/{row_id}", headers=owner, json={"hidden": False, "read": False})
    assert shown.json()["status"] == "new" and shown.json()["read"] is False
    assert client.patch(f"{LIST}/999", headers=owner, json={"read": True}).status_code == 404
    bad = client.patch(f"{LIST}/{row_id}", headers=owner, json={"review": "x"})
    assert bad.status_code == 422


# --- send reward, STOP, erasure ---------------------------------------------------------


@pytest.mark.usefixtures("hotel")
def test_send_reward_needs_owner_and_respects_consent(
    client: TestClient, owner: dict[str, str], sender: Recorder, session: Session
) -> None:
    no_consent, with_consent = client.get(LIST, headers=owner).json()
    url = f"{LIST}/{with_consent['id']}/send-reward"
    assert client.post(url).status_code == 401
    out = client.post(url, headers=owner).json()
    assert out["sent"] is True and out["transport"] == "simulated"
    assert out["feedback"]["status"] == "reward_sent" and out["feedback"]["perk_code"]
    to, body = sender.sent[0]
    assert to == "+919000000105" and out["code"] in body and body.endswith("Reply STOP to opt out.")
    assert f"/link/{out['code']}" in body and "Free breakfast" in body
    again = client.post(url, headers=owner)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_sent"
    # No consent: the code is made for the owner to hand over, nothing is sent.
    quiet = client.post(f"{LIST}/{no_consent['id']}/send-reward", headers=owner).json()
    assert quiet["sent"] is False and quiet["transport"] is None and len(sender.sent) == 1
    perk = session.scalars(select(PerkCode).where(PerkCode.code == quiet["code"])).one()
    assert perk.origin_booking_id is not None and perk.perk == "Free breakfast"
    assert client.post(f"{LIST}/999/send-reward", headers=owner).status_code == 404


@pytest.mark.usefixtures("hotel")
def test_no_reward_failed_send_and_unverified_breakfast(
    client: TestClient, owner: dict[str, str], sender: Recorder, session: Session
) -> None:
    post(client, reward="none")
    none_id = latest(session).id
    res = client.post(f"{LIST}/{none_id}/send-reward", headers=owner)
    assert res.status_code == 409 and res.json()["error"]["code"] == "no_reward"
    post(client, name="  ", whatsapp=NUMBER, consent=True)  # a blank name is refused
    post(client, name="Vik", whatsapp=NUMBER, consent=True)
    row_id = latest(session).id
    sender.ok = False
    failed = client.post(f"{LIST}/{row_id}/send-reward", headers=owner)
    assert failed.status_code == 502 and latest(session).perk_code_id is None  # rolled back
    sender.ok = True
    out = client.post(f"{LIST}/{row_id}/send-reward", headers=owner).json()
    assert out["sent"] is True and "Thank you for your feedback, Vik." in sender.sent[-1][1]
    perk = session.scalars(select(PerkCode).where(PerkCode.code == out["code"])).one()
    assert perk.guest_id is None and perk.origin_booking_id is None


@pytest.mark.usefixtures("hotel")
def test_stop_withdraws_and_blocks_the_send(
    client: TestClient, owner: dict[str, str], sender: Recorder, session: Session
) -> None:
    post(client, name="Vik", whatsapp=NUMBER, consent=True)
    handle_inbound(session, "919000000102", "STOP", "simulated", T0)
    session.commit()
    row = latest(session)
    assert row.withdrawn_at is not None
    out = client.post(f"{LIST}/{row.id}/send-reward", headers=owner).json()
    assert out["sent"] is False and out["feedback"]["withdrawn"] is True and not sender.sent


@pytest.mark.usefixtures("hotel")
def test_data_deletion_blanks_feedback(client: TestClient, session: Session) -> None:
    post(client, name="Vik Negi", whatsapp="+91 90000 00777", consent=True, review="Nice")
    res = client.post("/public/data-deletion",
                      json={"booking_ref": "NONE1", "phone": "+91 90000 00777"})  # fmt: skip
    assert res.status_code == 200
    row = latest(session)
    assert (row.name, row.phone, row.review) == ("", None, "") and row.withdrawn_at is not None
    # The sample CL3201 feedback goes with its Desk consent's erasure.
    client.post("/public/data-deletion", json={"booking_ref": "CL3201", "phone": "9000000105"})
    sample = next(r for r in rows(session) if r.booking and r.booking.external_ref == "CL3201")
    assert (sample.name, sample.phone, sample.review) == ("", None, "")


# --- redemption at Seedha Link ---------------------------------------------------------


def reward_code(client: TestClient, owner: dict[str, str], reward: str, ref: str) -> str:
    rewards(client, owner, **{reward: True})
    assert post(client, booking_ref=ref, reward=reward).json()["reward"] == reward
    row_id = client.get(LIST, headers=owner).json()[0]["id"]
    code: str = client.post(f"{LIST}/{row_id}/send-reward", headers=owner).json()["code"]
    return code


def book(client: TestClient, code: str, day: int = 0) -> Any:
    page = client.get("/public/link", params={"code": code}).json()
    return client.post("/public/link/book", json={
        "code": code, "check_in": page["dates"][day]["check_in"], "nights": 2,
        "room_type": "Standard",
    })  # fmt: skip


@pytest.mark.usefixtures("hotel", "sender")
def test_pct5_code_is_a_hotel_funded_discount_line_once(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    code = reward_code(client, owner, "pct5", NO_PHONE)
    page = client.get("/public/link", params={"code": code}).json()
    assert page["perk"] == "5% off your next direct stay" and page["code_status"] == "valid"
    res = book(client, code)
    assert res.status_code == 200, res.text
    out = res.json()
    list_amount = next(r["nightly_rate"] for r in page["rooms"] if r["room_type"] == "Standard") * 2
    discount = bps_of(list_amount, 500)
    assert out["discount"] == discount and out["amount"] == list_amount - discount
    stay = session.scalars(select(Booking).where(Booking.external_ref == out["reference"])).one()
    assert stay.list_amount == list_amount and stay.discount == discount
    assert stay.fees == upi_fee(list_amount - discount)
    assert stay.net_kept == list_amount - discount - stay.fees
    direct = session.scalars(select(DirectBooking).where(DirectBooking.booking_id == stay.id)).one()
    saving = session.scalars(select(Saving).where(Saving.direct_booking_id == direct.id)).one()
    assert saving.hotel_discount == discount
    assert saving.net_saving == (
        saving.commission_avoided + saving.gst_avoided - saving.upi_fee - discount
    )
    item = client.get("/savings", headers=owner).json()["items"][0]
    assert item["hotel_discount"] == discount and item["perk_cost"] == discount
    used = book(client, code, day=1)
    assert used.status_code == 409 and used.json()["error"]["code"] == "code_used"


@pytest.mark.usefixtures("hotel", "sender")
def test_discount_code_expires_after_twelve_months(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    code = reward_code(client, owner, "flat100", NO_PHONE)
    perk = session.scalars(select(PerkCode).where(PerkCode.code == code)).one()
    perk.created_at = datetime.now(UTC) - timedelta(days=366)
    session.commit()
    res = book(client, code)
    assert res.status_code == 422 and res.json()["error"]["code"] == "code_expired"


@pytest.mark.usefixtures("hotel", "sender")
def test_breakfast_code_changes_no_money(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    code = reward_code(client, owner, "breakfast", NO_PHONE)
    out = book(client, code).json()
    assert out["discount"] == 0 and out["perk_applied"] is True
    stay = session.scalars(select(Booking).where(Booking.external_ref == out["reference"])).one()
    assert stay.discount == 0 and stay.list_amount == out["amount"]
    saving = session.scalars(
        select(Saving)
        .join(DirectBooking, DirectBooking.id == Saving.direct_booking_id)
        .where(DirectBooking.booking_id == stay.id)
    ).one()
    assert saving.hotel_discount == 0
    assert saving.net_saving == saving.commission_avoided + saving.gst_avoided - saving.upi_fee


# --- money units (money code stays 100% covered) ----------------------------------------


def test_reward_discount_and_saving_lines() -> None:
    assert reward_discount(rupees(8600), "pct5") == rupees(430)
    assert reward_discount(rupees(8600), "flat100") == rupees(100)
    assert reward_discount(rupees(50), "flat100") == rupees(50)
    assert reward_discount(rupees(8600), "breakfast") == 0
    assert reward_discount(rupees(8600), None) == 0
    rahul = compute_saving(rupees(8600), 2200, True, rupees(430))
    assert rahul is not None
    assert (rahul.commission_avoided, rahul.gst_avoided) == (rupees(1892), rupees(341))
    assert rahul.upi_fee == upi_fee(rupees(8170)) and rahul.hotel_discount == rupees(430)
    assert rahul.net_saving == rupees(1892 + 341 - 33 - 430)
    walk_in = compute_saving(rupees(8600), 0, False, rupees(100))
    assert walk_in is not None and walk_in.net_saving == -(rupees(100) + upi_fee(rupees(8500)))
    assert compute_saving(rupees(8600), 0, False) is None
    split = perk_split(rupees(2233), rupees(33), 2, rupees(400), rupees(430))
    assert split.perk_cost == rupees(430) and split.kept_after_perk == rupees(2233 - 33 - 430)
    assert perk_split(rupees(2233), rupees(34), 2, rupees(400)).perk_cost == rupees(800)


# --- migration ---------------------------------------------------------------------------


def test_migration_0019_goes_down_and_up(tmp_path: Path) -> None:
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{tmp_path / 'm.db'}")
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "0018")
    command.upgrade(cfg, "head")
