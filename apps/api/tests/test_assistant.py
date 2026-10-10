"""Seedha Assistant: every number equals the ledger; Claude may only reword."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Property
from app.money import format_inr
from app.services.assistant import match_intent
from app.services.ledger import load_ledger
from seed.coded_history import TOTAL_NET_SAVING


@dataclass
class Rewording:
    """A fake Claude that returns fixed text."""

    text: str

    def phrase(self, question: str, answer: str) -> str | None:
        _ = (question, answer)
        return self.text


def ask(client: TestClient, owner: dict[str, str], question: str) -> Any:
    res = client.post("/assistant", headers=owner, json={"question": question})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.parametrize(
    ("question", "intent"),
    [
        ("What did I keep after commission?", "net_kept"),
        ("How much did channels take?", "paid_to_channels"),
        ("Which channel leaves me the most per room?", "channel_adr"),
        ("How much did I pay MakeMyTrip last month?", "paid_last_month"),
        ("What share of bookings is direct?", "direct_share"),
        ("How many repeat guests paid commission twice?", "repeat_guests"),
        ("How much have coded direct bookings saved?", "savings"),
        ("What if I hold Saturday rooms off the lowest channel?", "saturday_move"),
        ("When do this week's payouts arrive?", "payouts_this_week"),
        ("How did today close?", "todays_close"),
        ("Will it snow in Mussoorie?", None),
    ],
)
def test_intents(question: str, intent: str | None) -> None:
    found = match_intent(question)
    assert (found.key if found else None) == intent


@pytest.mark.usefixtures("sample")
def test_numbers_equal_the_ledger(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    prop = sample.query(Property).one()
    ledger = load_ledger(sample, prop.id)
    totals = ledger.totals

    kept = ask(client, owner, "What did I keep after commission?")
    assert kept["figures"] == [format_inr(totals.net_kept), format_inr(totals.list_amount),
                               format_inr(totals.paid_to_channels),
                               format_inr(totals.lost_vs_list_price)]  # fmt: skip
    assert kept["figures"][0] == "₹47,33,012"
    assert kept["figures"][2] == "₹10,39,108"
    assert kept["footer"] == "From your statements"
    assert kept["worded_by"] == "code"
    labels = [s["label"] for s in kept["sources"]]
    assert labels[0] == "Ledger, 1 Apr to 30 Sep 2026"
    assert labels[1].startswith("6 statements, 1,500 rows, 3 flagged")
    assert "What did I keep after commission?" not in kept["suggestions"]

    adr = ask(client, owner, "Which channel leaves me the most per room?")
    assert "MakeMyTrip ₹2,737" in str(adr["answer"]) and "Direct ₹4,283" in str(adr["answer"])
    names = [c.channel.name for c in ledger.channels]
    order = [str(adr["answer"]).index(n) for n in names if n in str(adr["answer"])]
    assert len(order) == len(names)

    share = ask(client, owner, "What share of bookings is direct?")
    assert share["figures"] == ["10.7%", "16.7%"]

    repeat = ask(client, owner, "How many repeat guests paid commission twice?")
    assert repeat["figures"] == ["12", "₹41,800"]

    saved = ask(client, owner, "How much have coded direct bookings saved?")
    assert saved["figures"] == ["4", format_inr(TOTAL_NET_SAVING)]

    move = ask(client, owner, "What if I hold Saturday rooms off the lowest channel?")
    scenario = client.get("/scenario/saturday", headers=owner).json()
    assert move["figures"][1] == format_inr(scenario["extra_per_saturday"])


@pytest.mark.usefixtures("sample")
def test_unknown_question_is_honest(client: TestClient, owner: dict[str, str]) -> None:
    body = ask(client, owner, "Will it snow next week?")
    assert body["intent"] == "unknown"
    assert body["figures"] == [] and body["sources"] == []
    assert str(body["answer"]).startswith("I can answer questions about")
    assert len(body["suggestions"]) == 6


@pytest.mark.usefixtures("sample")
def test_claude_may_reword_only_with_the_same_numbers(
    client: TestClient, owner: dict[str, str]
) -> None:
    plain = ask(client, owner, "What share of bookings is direct?")
    client.app.state.assistant_phraser = Rewording(  # type: ignore[attr-defined]
        "About 11% of bookings are direct.")  # fmt: skip
    changed = ask(client, owner, "What share of bookings is direct?")
    assert (changed["answer"], changed["worded_by"]) == (plain["answer"], "code")

    client.app.state.assistant_phraser = Rewording(  # type: ignore[attr-defined]
        "You booked 10.7% direct, and 16.7% paid no commission at all.")  # fmt: skip
    reworded = ask(client, owner, "What share of bookings is direct?")
    assert reworded["worded_by"] == "claude"
    assert reworded["figures"] == plain["figures"]


@pytest.mark.usefixtures("sample")
def test_intro_and_validation(client: TestClient, owner: dict[str, str]) -> None:
    intro = client.get("/assistant", headers=owner).json()
    assert intro["greeting"].startswith("Namaste Rajesh ji")
    assert len(intro["suggestions"]) == 6
    assert client.post("/assistant", headers=owner, json={"question": ""}).status_code == 422
    assert client.post("/assistant", json={"question": "hi"}).status_code == 401
