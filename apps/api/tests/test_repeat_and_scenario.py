"""Repeat guests and the Saturday move (CLAUDE.md M4 check, ruling 7)."""

from __future__ import annotations

import csv
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, Consent, RepeatMatch
from app.money import LineItems, rupees
from app.services.ledger import ChannelInfo, LedgerRow, summarise
from app.services.matcher import (
    GuestKey,
    StayRef,
    find_candidates,
    name_score,
    normalise_city,
    normalise_tokens,
    score,
)
from app.services.scenario import ScenarioError, saturday_move

DATA = Path(__file__).resolve().parent.parent / "seed" / "data"


# --- matcher units -------------------------------------------------------------


def test_normalising_names_and_cities() -> None:
    assert normalise_tokens("Mr. A. Verma family") == ["a", "verma"]
    assert normalise_tokens("Smt Neha  Gupta") == ["neha", "gupta"]
    assert normalise_city("Gurgaon") == "gurugram"
    assert normalise_city("  New   Delhi ") == "delhi"
    assert normalise_city(None) is None


@pytest.mark.parametrize(
    ("a", "b", "same"),
    [
        ("Rahul S.", "Rahul S.", True),
        ("Neha Gupta", "Neha Gupta", True),
        ("A. Verma family", "Anil Verma", True),
        ("Deepak Rawat", "D. Rawat", True),
        ("Ankit Srivastava", "Ankit Shrivastava", True),
        ("Manish Tandon", "Mansi Tandon", False),
        ("Aakash Mathur", "Aakash Marwah", False),
        ("Ritika Pandey", "Payal Pandey", False),
        ("Rahul S.", "Rohit S.", False),
        ("", "Neha Gupta", False),
    ],
)
def test_name_score_separates_people(a: str, b: str, same: bool) -> None:
    assert (name_score(a, b) >= 0.6) is same


def test_single_token_names_use_surname_only() -> None:
    assert name_score("Gupta", "Neha Gupta") == pytest.approx(0.6)


def test_city_moves_the_score() -> None:
    same_city = score(GuestKey("Neha Gupta", "Gurugram"), GuestKey("Neha Gupta", "Gurgaon"))
    other_city = score(GuestKey("Neha Gupta", "Gurugram"), GuestKey("Neha Gupta", "Delhi"))
    no_city = score(GuestKey("Neha Gupta", None), GuestKey("Neha Gupta", "Delhi"))
    assert same_city == 1.0
    assert other_city == pytest.approx(0.85)
    assert no_city == 1.0


class FakeBreaker:
    """Answers with a fixed opinion and records the calls."""

    def __init__(self, answer: str) -> None:
        self.answer = answer
        self.asked: list[tuple[str, str]] = []

    @property
    def calls(self) -> int:
        return len(self.asked)

    def same_person(self, a: GuestKey, b: GuestKey) -> str:
        self.asked.append((a.name, b.name))
        return self.answer


def stay(booking_id: int, day: int, name: str, city: str | None = None) -> StayRef:
    return StayRef(booking_id, date(2026, 5, day), GuestKey(name, city))


def test_tie_break_only_in_the_borderline_band() -> None:
    returns = [stay(1, 20, "A. Verma", "Lucknow"), stay(2, 20, "Neha Gupta", "Delhi")]
    earlier = [stay(10, 1, "Anil Verma", "Kanpur"), stay(11, 1, "Neha Gupta", "Delhi")]
    breaker = FakeBreaker("different")
    found = find_candidates(returns, earlier, breaker)
    assert [c.return_booking_id for c in found] == [2]
    assert breaker.calls == 1
    kept = find_candidates(returns, earlier, FakeBreaker("same"))
    assert {c.llm_opinion for c in kept} == {"same", None}


def test_earlier_stay_must_be_before_the_return() -> None:
    assert not find_candidates([stay(1, 1, "Neha Gupta")], [stay(2, 9, "Neha Gupta")])
    assert not find_candidates([stay(1, 1, "Neha Gupta")], [stay(1, 1, "Neha Gupta")])


# --- repeat API ------------------------------------------------------------------


@pytest.fixture(name="repeats")
def fixture_repeats(client: TestClient, owner: dict[str, str], sample: Session) -> dict[str, Any]:
    _ = sample
    res = client.get("/repeat", headers=owner)
    assert res.status_code == 200
    body: dict[str, Any] = res.json()
    return body


def test_twelve_repeat_guests_and_41800_paid_twice(repeats: dict[str, Any]) -> None:
    assert repeats["count"] == 12
    assert repeats["paid_twice_total"] == rupees(41_800)
    assert repeats["confirmed"] == 0
    assert all(m["status"] == "suggested" and m["not_new_demand"] for m in repeats["matches"])


@pytest.mark.usefixtures("repeats")
def test_matches_are_exactly_the_planted_pairs(sample: Session) -> None:
    with (DATA / "repeat_key.csv").open(encoding="utf-8") as handle:
        key = {r["window_ref"]: r["history_ref"] for r in csv.DictReader(handle)}
    stored = sample.scalars(select(RepeatMatch)).all()
    pairs = {(m.return_booking.external_ref, m.earlier_booking.external_ref) for m in stored}
    assert pairs == set(key.items())


def test_least_certain_suggestions_come_first(repeats: dict[str, Any]) -> None:
    names = [m["guest_name"] for m in repeats["matches"][:3]]
    assert names == ["A. Verma family", "Neha Gupta", "Deepak Rawat"]
    confidences = [m["confidence"] for m in repeats["matches"]]
    assert confidences == sorted(confidences)


def test_prototype_examples(repeats: dict[str, Any]) -> None:
    by_name = {m["guest_name"]: m for m in repeats["matches"]}
    rahul = by_name["Rahul S."]
    assert (rahul["paid_twice"], rahul["confidence"]) == (rupees(3_480), 92)
    assert (rahul["first"]["channel"], rahul["first"]["check_in"][:7]) == ("MakeMyTrip", "2025-05")
    assert rahul["returned"]["check_in"][:7] == "2026-05"
    assert by_name["Neha Gupta"]["paid_twice"] == rupees(3_120)
    assert by_name["A. Verma family"]["paid_twice"] == rupees(4_060)
    assert by_name["A. Verma family"]["confidence"] < 80


def test_matching_never_touches_consent_ruling_7(repeats: dict[str, Any], sample: Session) -> None:
    assert repeats["count"] == 12
    assert sample.scalar(select(func.count()).select_from(Consent)) == 0


@pytest.mark.usefixtures("sample")
def test_confirm_and_dismiss_need_the_owner(client: TestClient, owner: dict[str, str]) -> None:
    first = client.get("/repeat", headers=owner).json()["matches"][0]
    res = client.post(f"/repeat/{first['id']}", headers=owner, json={"decision": "confirm"})
    assert res.json()["confirmed"] == 1
    again = client.get("/repeat", headers=owner).json()
    assert again["count"] == 12  # scanning again keeps decisions and adds nothing
    gone = client.post(f"/repeat/{first['id']}", headers=owner, json={"decision": "dismiss"})
    assert gone.json()["count"] == 11
    assert client.get("/repeat", headers=owner).json()["count"] == 11
    steps = client.get("/pipeline", headers=owner).json()["steps"]
    assert next(s for s in steps if s["key"] == "rep")["done"]


@pytest.mark.usefixtures("sample")
def test_repeat_bad_input(client: TestClient, owner: dict[str, str]) -> None:
    assert (
        client.post("/repeat/99999", headers=owner, json={"decision": "confirm"}).status_code == 404
    )
    assert client.post("/repeat/1", headers=owner, json={"decision": "maybe"}).status_code == 422
    assert client.get("/repeat").status_code == 401
    assert client.post("/repeat/1", json={"decision": "confirm"}).status_code == 401


@pytest.mark.usefixtures("base_sample")
def test_no_repeats_before_upload(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/repeat", headers=owner).json()
    assert (body["count"], body["paid_twice_total"]) == (0, 0)


@pytest.mark.usefixtures("sample")
def test_claude_tie_breaker_can_drop_a_borderline_match(
    client: TestClient, owner: dict[str, str]
) -> None:
    client.app.state.tie_breaker = FakeBreaker("different")  # type: ignore[attr-defined]
    body = client.get("/repeat", headers=owner).json()
    assert body["count"] == 11
    assert "A. Verma family" not in {m["guest_name"] for m in body["matches"]}


# --- Saturday move ----------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_saturday_move_numbers(client: TestClient, owner: dict[str, str]) -> None:
    body = client.get("/scenario/saturday", headers=owner).json()
    assert body["available"] is True
    assert body["rooms"] == 6
    assert body["channel_name"] == "Agoda"
    assert body["channel_net_adr"] == rupees(2_598)
    assert body["direct_net_adr"] == rupees(4_283)
    assert body["extra_per_room"] == rupees(1_685)
    assert body["extra_per_saturday"] == rupees(10_110)
    assert body["decision"] is None
    four = client.get("/scenario/saturday?rooms=4", headers=owner).json()
    assert four["extra_per_saturday"] == rupees(6_740)


@pytest.mark.usefixtures("sample")
def test_saturday_decision_is_recorded(client: TestClient, owner: dict[str, str]) -> None:
    res = client.post(
        "/scenario/saturday", headers=owner, json={"decision": "accepted", "rooms": 6}
    )
    assert res.json()["decision"] == "accepted"
    body = client.get("/scenario/saturday", headers=owner).json()
    assert (body["decision"], body["rooms"]) == ("accepted", 6)


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize("rooms", ["0", "23", "abc"])
def test_saturday_bad_rooms(client: TestClient, owner: dict[str, str], rooms: str) -> None:
    assert client.get(f"/scenario/saturday?rooms={rooms}", headers=owner).status_code == 422


@pytest.mark.usefixtures("base_sample")
def test_saturday_without_statements(client: TestClient, owner: dict[str, str]) -> None:
    res = client.get("/scenario/saturday", headers=owner)
    assert res.status_code == 200
    assert res.json()["available"] is False
    assert res.json()["reason"] == "No OTA sales in this period yet"
    assert res.json()["extra_per_saturday"] is None
    blocked = client.post(
        "/scenario/saturday", headers=owner, json={"decision": "accepted", "rooms": 6}
    )
    assert (blocked.status_code, blocked.json()["error"]["code"]) == (422, "no_saturday_move")
    assert client.get("/scenario/saturday").status_code == 401
    bad = client.post(
        "/scenario/saturday", headers=owner, json={"decision": "accepted", "rooms": 0}
    )
    assert bad.status_code == 422


def test_saturday_move_needs_direct_sales() -> None:
    infos = [ChannelInfo("ota", "OTA", "ota", 1), ChannelInfo("d", "Direct", "direct", 2)]
    rows = [LedgerRow("ota", True, 1, LineItems(rupees(4_000)))]
    with pytest.raises(ScenarioError, match="direct"):
        saturday_move(summarise(infos, rows, rooms_count=10), 2)
    no_ota = [LedgerRow("d", True, 1, LineItems(rupees(4_000)))]
    with pytest.raises(ScenarioError, match="OTA"):
        saturday_move(summarise(infos, no_ota, rooms_count=10), 2)


def test_repeat_rows_count_only_checked_stays(sample: Session) -> None:
    flagged = sample.scalars(select(Booking).where(Booking.external_ref == "MM48213")).one()
    assert not flagged.math_check_passed
