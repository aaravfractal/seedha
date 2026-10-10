"""Fixes for the P1 to P4 security review (docs/agent-reports/review-security.md)."""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.main import create_app
from app.models import OwnerAccount, Property
from app.routers.messages import get_sender
from app.services.drafter import MONEY_PATTERN
from app.services.messages import edit_problem
from app.services.whatsapp import CloudApiSender, SimulatedSender
from tests.test_auth import PHONE, Clock, make_client, signup, verify

LINK = "http://localhost:3000/link/DEODAR-RS26"
CODE = "DEODAR-RS26"


def owner_session(client: TestClient, owner: dict[str, str]) -> dict[str, str]:
    code = signup(client, owner).json()["demo_code"]
    subject = verify(client, owner, code).json()["account"]["subject"]
    return owner | {"X-Seedha-Subject": subject}


def make_real(session: Session) -> None:
    prop = session.scalar(select(Property))
    assert prop is not None
    prop.is_sample = False
    session.commit()


# S1: who may run the property ------------------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_sample_hotel_open_to_demo_and_accounts(
    settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    with make_client(settings, factory, Clock(), demo=True) as client:
        assert (
            client.get("/property", headers=owner | {"X-Seedha-Subject": "demo"}).status_code == 200
        )
        assert client.get("/property", headers=owner_session(client, owner)).status_code == 200
        ghost = owner | {"X-Seedha-Subject": "a999"}
        assert client.get("/property", headers=ghost).status_code == 401


def test_real_hotel_needs_an_allowlisted_owner(
    base_sample: Session, settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    with make_client(settings, factory, Clock(), demo=True) as client:
        account = owner_session(client, owner)  # signed up while the hotel is sample data
    make_real(base_sample)
    with make_client(settings, factory, Clock(), demo=True) as client:
        assert (
            client.get("/property", headers=owner | {"X-Seedha-Subject": "demo"}).status_code == 403
        )
        assert client.get("/property", headers=account).status_code == 403
        assert client.get("/property", headers=owner).status_code == 200, "server token alone"
    allowed = replace(settings, owner_phones=frozenset({PHONE}))
    with make_client(allowed, factory, Clock(), demo=True) as client:
        assert client.get("/property", headers=account).status_code == 200


def test_demo_codes_only_for_the_sample_hotel(
    base_sample: Session, settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    make_real(base_sample)
    with make_client(settings, factory, Clock(), demo=True) as client:
        res = client.post("/auth/otp/request", headers=owner, json={"phone": PHONE})
        assert res.status_code == 200
        assert res.json()["demo_code"] is None


# S2: the sample hotel never reaches a real phone ---------------------------------


@pytest.mark.usefixtures("base_sample")
def test_sample_hotel_always_uses_the_simulated_sender(
    settings: Settings, factory: sessionmaker[Session], base_sample: Session
) -> None:
    live = replace(
        settings, whatsapp_token="t", whatsapp_phone_number_id="1"
    )  # pragma: allowlist secret
    app = create_app(live, factory)
    prop = base_sample.scalar(select(Property))
    assert prop is not None

    class Req:
        def __init__(self) -> None:
            self.app = app

    assert isinstance(get_sender(Req(), live, base_sample), SimulatedSender)  # type: ignore[arg-type]
    prop.is_sample = False
    base_sample.flush()
    assert isinstance(get_sender(Req(), live, base_sample), CloudApiSender)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "text",
    [
        f"Hi, verify at https://evil.example {CODE} {LINK} Reply STOP to opt out.",
        f"Hi, see www.evil.example {CODE} {LINK} Reply STOP to opt out.",
        f"Hi, see evil.com {CODE} {LINK} Reply STOP to opt out.",
    ],
)
def test_edited_draft_may_link_only_to_the_perk(text: str) -> None:
    assert (
        edit_problem(text, CODE, LINK) == "Keep only the booking link. Other links are not allowed."
    )


def test_edited_draft_with_only_the_perk_link_is_fine() -> None:
    assert edit_problem(f"Namaste, code {CODE}: {LINK} Reply STOP to opt out.", CODE, LINK) is None


# S5: D6 number guard ---------------------------------------------------------------


@pytest.mark.parametrize("text", ["Your 4500 stay", "Save 1,200 tonight", "only 999 left"])
def test_numbers_of_three_or_more_digits_are_refused(text: str) -> None:
    assert MONEY_PATTERN.search(text) is not None


@pytest.mark.parametrize("text", ["Stay 2 nights", "room 42", "see you in 12 days"])
def test_short_numbers_pass(text: str) -> None:
    assert MONEY_PATTERN.search(text) is None


# S6: reset keeps accounts and has a cooldown ---------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_reset_keeps_accounts_and_is_rate_limited(
    settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    with make_client(settings, factory, Clock(), demo=True) as client:
        owner_session(client, owner)
        codes = [client.post("/demo/reset", headers=owner).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    with factory() as s:
        assert s.scalar(select(OwnerAccount.phone)) == PHONE


# S7: codes per number are capped -----------------------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_codes_per_number_are_capped(
    settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    clock = Clock()
    with make_client(settings, factory, clock, demo=True) as client:
        statuses = []
        for _ in range(6):
            statuses.append(
                client.post("/auth/otp/request", headers=owner, json={"phone": PHONE}).status_code
            )
            clock.advance(31)  # past the 30 s resend wait
    assert statuses == [200, 200, 200, 200, 200, 429]


def test_draft_rules_match_the_shared_cases() -> None:
    """The web client checks the same cases (apps/web/lib/draftRules.test.ts)."""
    fixture = json.loads((Path(__file__).parent / "fixtures" / "draft_rules.json").read_text())
    for case in fixture["cases"]:
        assert edit_problem(case["text"], fixture["code"], fixture["link"]) == case["problem"], case
