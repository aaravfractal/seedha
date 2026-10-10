"""Owner sign in with a WhatsApp code, sign up, Direct beta login, /me and
onboarding (FRONTEND_MASTER D4)."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app
from app.models import ChannelContract, OtpChallenge, OwnerAccount, Property
from app.services.auth import AuthError, hash_code, mask_phone, new_code, normalise_phone

PHONE = "9876543210"
START = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)


@pytest.fixture(name="clock")
def fixture_clock() -> Clock:
    return Clock()


def make_client(
    settings: Settings, factory: sessionmaker[Session], clock: Clock, *, demo: bool
) -> TestClient:
    app = create_app(replace(settings, seedha_demo=demo), factory)
    app.state.clock = clock
    return TestClient(app)


@pytest.fixture(name="demo_client")
def fixture_demo_client(
    settings: Settings, factory: sessionmaker[Session], clock: Clock
) -> Iterator[TestClient]:
    with make_client(settings, factory, clock, demo=True) as c:
        yield c


@pytest.fixture(name="prod_client")
def fixture_prod_client(
    settings: Settings, factory: sessionmaker[Session], clock: Clock
) -> Iterator[TestClient]:
    with make_client(settings, factory, clock, demo=False) as c:
        yield c


def send(client: TestClient, owner: dict[str, str], phone: str = PHONE) -> Any:
    return client.post("/auth/otp/request", headers=owner, json={"phone": phone})


def verify(client: TestClient, owner: dict[str, str], code: str, phone: str = PHONE) -> Any:
    return client.post("/auth/otp/verify", headers=owner, json={"phone": phone, "code": code})


def wrong(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


def signup(client: TestClient, owner: dict[str, str], **extra: Any) -> Any:
    body = {"name": "Meera Rawat", "hotel": "Pine Crest Homestay", "phone": PHONE,
            "terms": True} | extra  # fmt: skip
    return client.post("/auth/signup", headers=owner, json=body)


def signed_up(client: TestClient, owner: dict[str, str]) -> dict[str, str]:
    """Sign up and verify; returns headers for that account's session."""
    code = signup(client, owner).json()["demo_code"]
    account = verify(client, owner, code).json()["account"]
    return owner | {"X-Seedha-Subject": account["subject"]}


# --- Units ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "phone"),
    [
        ("9876543210", "9876543210"),
        ("+91 98765 43210", "9876543210"),
        ("91-98765-43210", "9876543210"),
        ("098765 43210", "9876543210"),
        ("6000000000", "6000000000"),
    ],
)
def test_phone_normalises(raw: str, phone: str) -> None:
    assert normalise_phone(raw) == phone


@pytest.mark.parametrize(
    "raw", ["5876543210", "987654321", "98765432101", "+1 9876543210", "abcdefghij", ""]
)
def test_phone_rejects_non_indian_mobiles(raw: str) -> None:
    with pytest.raises(AuthError) as err:
        normalise_phone(raw)
    assert err.value.code == "invalid_phone"


def test_mask_and_code_shape() -> None:
    assert mask_phone("9876543210") == "+91 98765 •••10"
    codes = {new_code() for _ in range(200)}
    assert all(len(c) == 6 and c.isdigit() for c in codes)
    assert len(codes) > 150


# --- Request ---------------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_demo_code_only_with_seedha_demo(
    demo_client: TestClient, prod_client: TestClient, owner: dict[str, str],
    caplog: pytest.LogCaptureFixture,
) -> None:  # fmt: skip
    caplog.set_level(logging.WARNING, logger="seedha.auth")
    shown = send(demo_client, owner).json()
    assert shown["demo_code"] and len(shown["demo_code"]) == 6
    assert shown["masked_phone"] == "+91 98765 •••10"
    assert (shown["expires_in"], shown["resend_in"], shown["tries_left"]) == (300, 30, 5)

    caplog.clear()
    hidden = send(prod_client, owner, "9123456780").json()
    assert hidden["sent"] is True
    assert hidden["demo_code"] is None
    assert "code not logged" in caplog.text
    assert "9123456780" not in caplog.text


@pytest.mark.usefixtures("sample")
def test_code_is_stored_only_as_a_salted_hash(
    demo_client: TestClient, owner: dict[str, str], session: Session
) -> None:
    code = send(demo_client, owner).json()["demo_code"]
    row = session.scalars(select(OtpChallenge)).one()
    assert code not in (row.code_hash, row.salt)
    assert row.code_hash == hash_code(row.salt, PHONE, code)


@pytest.mark.usefixtures("sample")
def test_request_validates_the_number(demo_client: TestClient, owner: dict[str, str]) -> None:
    for phone in ("5876543210", "12345", "98765 4321x"):
        res = send(demo_client, owner, phone)
        assert (res.status_code, res.json()["error"]["code"]) == (422, "invalid_phone"), phone
    assert send(demo_client, owner, "+91 98765 43210").status_code == 200


@pytest.mark.usefixtures("sample")
def test_resend_only_after_30_seconds(
    demo_client: TestClient, owner: dict[str, str], clock: Clock
) -> None:
    first = send(demo_client, owner).json()["demo_code"]
    clock.advance(29)
    early = send(demo_client, owner)
    assert (early.status_code, early.json()["error"]["code"]) == (429, "resend_wait")
    assert early.headers["retry-after"] == "1"
    clock.advance(1)
    second = send(demo_client, owner).json()["demo_code"]
    if first != second:
        assert verify(demo_client, owner, first).status_code == 401, "the old code is replaced"
    assert verify(demo_client, owner, second).status_code == 200


# --- Verify ----------------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_code_must_be_six_digits(
    demo_client: TestClient, owner: dict[str, str], session: Session
) -> None:
    send(demo_client, owner)
    for code in ("12345", "1234567", "12a456", ""):
        res = verify(demo_client, owner, code)
        assert (res.status_code, res.json()["error"]["code"]) == (422, "invalid_code"), code
    assert session.scalars(select(OtpChallenge.attempts)).one() == 0, "format errors cost no try"


@pytest.mark.usefixtures("sample")
def test_code_expires_after_300_seconds(
    demo_client: TestClient, owner: dict[str, str], clock: Clock
) -> None:
    code = send(demo_client, owner).json()["demo_code"]
    clock.advance(300)
    res = verify(demo_client, owner, code)
    assert (res.status_code, res.json()["error"]["code"]) == (410, "expired")


@pytest.mark.usefixtures("sample")
def test_code_works_once(demo_client: TestClient, owner: dict[str, str], clock: Clock) -> None:
    code = send(demo_client, owner).json()["demo_code"]
    clock.advance(299)
    first = verify(demo_client, owner, code)
    assert first.json() == {"verified": True, "account": None}, "no account for this number yet"
    again = verify(demo_client, owner, code)
    assert (again.status_code, again.json()["error"]["code"]) == (404, "no_code")


@pytest.mark.usefixtures("sample")
def test_five_wrong_tries_lock_for_15_minutes(
    demo_client: TestClient, owner: dict[str, str], clock: Clock
) -> None:
    code = send(demo_client, owner).json()["demo_code"]
    for left in (4, 3, 2, 1):
        res = verify(demo_client, owner, wrong(code))
        assert res.status_code == 401
        assert res.headers["x-tries-left"] == str(left)
        assert f"{left} {'try' if left == 1 else 'tries'} left" in res.json()["error"]["message"]
    fifth = verify(demo_client, owner, wrong(code))
    assert (fifth.status_code, fifth.json()["error"]["code"]) == (429, "locked")
    assert fifth.json()["error"]["message"] == "Too many tries. Try again in 15 minutes."
    assert fifth.headers["retry-after"] == "900"

    right = verify(demo_client, owner, code)
    assert (right.status_code, right.json()["error"]["code"]) == (429, "locked")
    clock.advance(60)
    assert send(demo_client, owner).json()["error"]["code"] == "locked", "no new code while locked"

    clock.advance(15 * 60)
    fresh = send(demo_client, owner).json()
    assert fresh["tries_left"] == 5
    assert verify(demo_client, owner, fresh["demo_code"]).status_code == 200


@pytest.mark.usefixtures("sample")
def test_resend_does_not_reset_tries(
    demo_client: TestClient, owner: dict[str, str], clock: Clock
) -> None:
    code = send(demo_client, owner).json()["demo_code"]
    for _ in range(3):
        verify(demo_client, owner, wrong(code))
    clock.advance(30)
    assert send(demo_client, owner).json()["tries_left"] == 2


@pytest.mark.usefixtures("sample")
def test_verify_without_a_code(demo_client: TestClient, owner: dict[str, str]) -> None:
    res = verify(demo_client, owner, "123456")
    assert (res.status_code, res.json()["error"]["code"]) == (404, "no_code")


@pytest.mark.usefixtures("sample")
def test_verify_is_rate_limited_per_client(demo_client: TestClient, owner: dict[str, str]) -> None:
    statuses = [verify(demo_client, owner, "123456", f"98765432{i:02d}").status_code
                for i in range(11)]  # fmt: skip
    assert statuses[:10] == [404] * 10
    assert statuses[10] == 429


# --- Sign up, /me, demo, logout ----------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_signup_needs_ticked_terms(
    demo_client: TestClient, owner: dict[str, str], session: Session
) -> None:
    for terms in (False, None, "yes"):
        assert signup(demo_client, owner, terms=terms).status_code == 422
    assert signup(demo_client, owner, name="M").status_code == 422
    assert signup(demo_client, owner, phone="12345").status_code == 422
    res = signup(demo_client, owner)
    assert res.status_code == 200 and res.json()["demo_code"]
    account = session.scalars(select(OwnerAccount)).one()
    assert (account.name, account.hotel_name, account.phone) == (
        "Meera Rawat",
        "Pine Crest Homestay",
        PHONE,
    )
    assert account.updates_opt_in is False, "updates default to off"
    assert account.verified_at is None


@pytest.mark.usefixtures("sample")
def test_signup_then_verify_then_me(
    demo_client: TestClient, owner: dict[str, str], session: Session
) -> None:
    code = signup(demo_client, owner, updates=True).json()["demo_code"]
    body = verify(demo_client, owner, code).json()
    assert body["account"]["onboarded"] is False
    subject = body["account"]["subject"]
    me = demo_client.get("/me", headers=owner | {"X-Seedha-Subject": subject}).json()
    assert me["kind"] == "owner"
    assert (me["name"], me["masked_phone"]) == ("Meera Rawat", "+91 98765 •••10")
    assert me["property_is_sample"] is True
    assert session.scalars(select(OwnerAccount)).one().updates_opt_in is True


@pytest.mark.usefixtures("sample")
def test_signup_cannot_overwrite_a_verified_account(
    demo_client: TestClient, owner: dict[str, str], clock: Clock, session: Session
) -> None:
    signed_up(demo_client, owner)
    clock.advance(30)
    assert signup(demo_client, owner, name="Someone Else").status_code == 200
    assert session.scalars(select(OwnerAccount)).one().name == "Meera Rawat"


@pytest.mark.usefixtures("sample")
def test_me_needs_token_and_subject(demo_client: TestClient, owner: dict[str, str]) -> None:
    assert demo_client.get("/me").status_code == 401
    assert demo_client.get("/me", headers={"X-Seedha-Subject": "demo"}).status_code == 401
    assert demo_client.get("/me", headers=owner).status_code == 401
    for subject in ("a999", "admin", "a", "a1x"):
        res = demo_client.get("/me", headers=owner | {"X-Seedha-Subject": subject})
        assert (res.status_code, res.json()["error"]["code"]) == (401, "session_ended"), subject


@pytest.mark.usefixtures("sample")
def test_demo_login_opens_only_a_sample_hotel(
    demo_client: TestClient, owner: dict[str, str], session: Session
) -> None:
    res = demo_client.post("/auth/demo", headers=owner)
    assert res.json() == {"subject": "demo", "name": "Rajesh", "hotel_name": "Hotel Deodar View",
                          "onboarded": True}  # fmt: skip
    me = demo_client.get("/me", headers=owner | {"X-Seedha-Subject": "demo"}).json()
    assert (me["kind"], me["property_rooms"], me["masked_phone"]) == ("demo", 22, None)

    session.scalars(select(Property)).one().is_sample = False
    session.commit()
    refused = demo_client.post("/auth/demo", headers=owner)
    assert (refused.status_code, refused.json()["error"]["code"]) == (403, "not_sample")


def test_auth_routes_refuse_without_the_owner_token(demo_client: TestClient) -> None:
    for path, body in (("/auth/otp/request", {"phone": PHONE}),
                       ("/auth/otp/verify", {"phone": PHONE, "code": "123456"}),
                       ("/auth/demo", {}), ("/auth/logout", {}),
                       ("/auth/signup", {"name": "Ab", "hotel": "Cd", "phone": PHONE,
                                         "terms": True})):  # fmt: skip
        assert demo_client.post(path, json=body).status_code == 401, path


def test_logout(demo_client: TestClient, owner: dict[str, str]) -> None:
    assert demo_client.post("/auth/logout", headers=owner).json() == {"ok": True}


# --- Onboarding ----------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_onboarding_saves_on_the_account_only(
    demo_client: TestClient, owner: dict[str, str], session: Session
) -> None:
    headers = signed_up(demo_client, owner)
    before = demo_client.get("/onboarding", headers=headers).json()
    assert before["contracts"] == {"mmt": 22.0, "bcom": 18.0, "agoda": 20.0, "ta": 10.0}
    assert (before["property_name"], before["done"], before["sample"]) == (
        "Pine Crest Homestay",
        False,
        False,
    )
    contracts_before = sorted(session.scalars(select(ChannelContract.commission_bps)))

    steps: list[dict[str, Any]] = [
        {"property_name": "Pine Crest", "town": "Mukteshwar", "rooms": 12},
        {"contracts": {"mmt": 24, "bcom": 17.5}},
        {"cost_per_room": 850},
        {"connect_whatsapp": True, "finish": True},
    ]
    for step in steps:
        res = demo_client.patch("/onboarding", headers=headers, json=step)
        assert res.status_code == 200 and res.json()["saved"] is True
    after = res.json()
    assert after["contracts"] == {"mmt": 24.0, "bcom": 17.5, "agoda": 20.0, "ta": 10.0}
    assert (after["town"], after["rooms"], after["cost_per_room"]) == ("Mukteshwar", 12, 850)
    assert (after["whatsapp_connected"], after["whatsapp_mode"], after["done"]) == (
        True,
        "simulated",
        True,
    )
    account = session.scalars(select(OwnerAccount)).one()
    session.refresh(account)
    assert account.cost_per_room == 85_000, "stored in paise"
    assert sorted(session.scalars(select(ChannelContract.commission_bps))) == contracts_before
    prop = session.scalars(select(Property)).one()
    assert (prop.name, prop.rooms_count) == ("Hotel Deodar View", 22)
    me = demo_client.get("/me", headers=headers).json()
    assert me["onboarded"] is True


@pytest.mark.usefixtures("sample")
def test_onboarding_validation(demo_client: TestClient, owner: dict[str, str]) -> None:
    headers = signed_up(demo_client, owner)
    for bad in ({"rooms": 0}, {"rooms": 501}, {"contracts": {"mmt": 51}},
                {"contracts": {"mmt": -1}}, {"contracts": {"mmt": 22.555}},
                {"cost_per_room": -5}, {"town": "x"}):  # fmt: skip
        assert demo_client.patch("/onboarding", headers=headers, json=bad).status_code == 422, bad


@pytest.mark.usefixtures("sample")
def test_onboarding_never_changes_the_sample_hotel(
    demo_client: TestClient, owner: dict[str, str], session: Session
) -> None:
    demo = owner | {"X-Seedha-Subject": "demo"}
    shown = demo_client.get("/onboarding", headers=demo).json()
    assert shown["sample"] is True
    assert (shown["property_name"], shown["rooms"]) == ("Hotel Deodar View", 22)
    assert shown["contracts"] == {"mmt": 22.0, "bcom": 18.0, "agoda": 20.0, "ta": 10.0}
    contracts_before = sorted(session.scalars(select(ChannelContract.commission_bps)))
    res = demo_client.patch("/onboarding", headers=demo,
                            json={"rooms": 5, "contracts": {"mmt": 5}, "finish": True})  # fmt: skip
    assert res.status_code == 200
    assert res.json()["saved"] is False
    assert res.json()["contracts"]["mmt"] == 22.0
    assert sorted(session.scalars(select(ChannelContract.commission_bps))) == contracts_before
    assert session.scalars(select(OwnerAccount)).all() == []
