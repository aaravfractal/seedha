"""API added for the owner screens (FRONTEND_MASTER P2): Saturday undo, draft
edit, proof entry states (verified, pending, deleted, mismatch), Season in
review on savings, and the 8 AM line."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Consent, Message, Property
from app.money import rupees
from app.routers.messages import language_of
from app.services.ask import morning_line
from app.services.desk import utc_now
from app.services.drafter import MAX_LENGTH, STOP_LINE
from app.services.messages import edit_problem
from app.services.proof import erase_consent, record_intact
from app.services.savings import season_review
from seed.coded_history import TOTAL_NET_SAVING

CODE = "DEODAR-RS26"
LINK = "http://localhost:3000/link/DEODAR-RS26"


def consent_at_desk(client: TestClient, owner: dict[str, str], room: int, number: str) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": room}).json()["url"]
    res = client.post(f"/public/consent/{url.rsplit('/', 1)[-1]}",
                      json={"agree": True, "whatsapp": number})  # fmt: skip
    assert res.status_code == 200


def rahul_draft(client: TestClient, owner: dict[str, str]) -> dict[str, object]:
    consent_at_desk(client, owner, 207, "9876543210")
    client.post("/desk/checkout", headers=owner, json={"room": 207})
    draft: dict[str, object] = client.get("/messages", headers=owner).json()["messages"][0]
    return draft


# --- Saturday move: Undo ----------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_undo_takes_back_an_accepted_move(client: TestClient, owner: dict[str, str]) -> None:
    nothing = client.post("/scenario/saturday/undo", headers=owner)
    assert (nothing.status_code, nothing.json()["error"]["code"]) == (409, "nothing_to_undo")

    accepted = client.post(
        "/scenario/saturday", headers=owner, json={"decision": "accepted", "rooms": 5}
    ).json()
    assert accepted["decision"] == "accepted"
    undone = client.post("/scenario/saturday/undo", headers=owner).json()
    assert (undone["decision"], undone["decided_at"], undone["rooms"]) == (None, None, 5)
    assert undone["extra_per_saturday"] == rupees(1_685) * 5

    card = client.get("/scenario/saturday", headers=owner).json()
    assert (card["decision"], card["rooms"]) == (None, 5)

    again = client.post("/scenario/saturday/undo", headers=owner)
    assert (again.status_code, again.json()["error"]["code"]) == (409, "nothing_to_undo")


@pytest.mark.usefixtures("sample")
def test_saturday_before_and_after(client: TestClient, owner: dict[str, str]) -> None:
    card = client.get("/scenario/saturday", headers=owner).json()
    assert (card["before_per_saturday"], card["after_per_saturday"]) == (
        rupees(15_588), rupees(25_698),
    )  # fmt: skip
    assert card["after_per_saturday"] - card["before_per_saturday"] == card["extra_per_saturday"]


@pytest.mark.usefixtures("sample")
def test_undo_also_takes_back_not_now(client: TestClient, owner: dict[str, str]) -> None:
    client.post("/scenario/saturday", headers=owner, json={"decision": "later", "rooms": 6})
    assert client.post("/scenario/saturday/undo", headers=owner).json()["decision"] is None
    redo = client.post(
        "/scenario/saturday", headers=owner, json={"decision": "accepted", "rooms": 6}
    )
    assert redo.json()["decision"] == "accepted"
    assert client.post("/scenario/saturday/undo").status_code == 401


# --- Approvals: Edit keeps STOP, the code and the link -----------------------------


def test_edit_rules() -> None:
    good = f"Namaste Rahul ji, come back soon. Code {CODE}: {LINK} {STOP_LINE}"
    assert edit_problem(good, CODE, LINK) is None
    assert edit_problem("", CODE, LINK) == "The message cannot be empty."
    assert "under 600" in (edit_problem(good + "x" * MAX_LENGTH, CODE, LINK) or "")
    assert edit_problem(good.replace(STOP_LINE, ""), CODE, LINK) == (
        'Keep "Reply STOP to opt out." in the message.'
    )
    assert "booking link" in (edit_problem(good.replace(LINK, ""), CODE, LINK) or "")
    only_in_link = f"Namaste Rahul ji. {LINK} {STOP_LINE}"
    assert edit_problem(only_in_link, CODE, LINK) == f"Keep the code {CODE} in the message."
    for money in ("₹500 off", "20% off", "Rs 4000 only"):
        assert "not a price" in (edit_problem(f"{money}. {good}", CODE, LINK) or "")


def test_language_label() -> None:
    assert language_of("Namaste Neha ji") == "English"
    assert language_of("नमस्ते नेहा जी") == "Hindi"


@pytest.mark.usefixtures("sample")
def test_owner_edits_a_draft_and_nothing_is_sent(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    draft = rahul_draft(client, owner)
    assert (draft["perk"], draft["link"], draft["language"]) == (
        "Free breakfast on your next direct stay", LINK, "English",
    )  # fmt: skip
    text = f"Namaste Rahul ji, we kept your table by the window. Code {CODE}: {LINK} {STOP_LINE}"
    res = client.patch(f"/messages/{draft['id']}", headers=owner, json={"text": f"  {text}  "})
    assert res.status_code == 200, res.text
    edited = res.json()["messages"][0]
    assert (edited["body"], edited["status"], edited["sent_at"], edited["transport"]) == (
        text, "draft", None, None,
    )  # fmt: skip
    assert res.json()["pending"] == 1

    no_stop = client.patch(
        f"/messages/{draft['id']}", headers=owner, json={"text": text.replace(STOP_LINE, "")}
    )
    assert (no_stop.status_code, no_stop.json()["error"]["code"]) == (422, "invalid_edit")
    assert STOP_LINE in no_stop.json()["error"]["message"]
    sample.expire_all()
    stored = sample.scalars(select(Message)).one()
    assert stored.body == text, "a refused edit changes nothing"

    client.post(f"/messages/{draft['id']}/approve", headers=owner)
    late = client.patch(f"/messages/{draft['id']}", headers=owner, json={"text": text})
    assert (late.status_code, late.json()["error"]["code"]) == (409, "not_a_draft")
    missing = client.patch("/messages/999", headers=owner, json={"text": text})
    assert missing.status_code == 404
    assert client.patch(f"/messages/{draft['id']}", json={"text": text}).status_code == 401


@pytest.mark.usefixtures("sample")
def test_edit_needs_text(client: TestClient, owner: dict[str, str]) -> None:
    draft = rahul_draft(client, owner)
    assert client.patch(f"/messages/{draft['id']}", headers=owner, json={}).status_code == 422
    blank = client.patch(f"/messages/{draft['id']}", headers=owner, json={"text": "   "})
    assert (blank.status_code, blank.json()["error"]["code"]) == (422, "invalid_edit")


# --- Consent proof: entry states ---------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_proof_entries_pending_then_verified(client: TestClient, owner: dict[str, str]) -> None:
    consent_at_desk(client, owner, 104, "9876543210")
    before = client.get("/proof", headers=owner).json()
    assert [(e["bundle_id"], e["guest_name"], e["status"]) for e in before["entries"]] == [
        (None, "Neha Gupta", "pending")
    ]
    assert (before["sealed"], before["mismatches"]) == (0, 0)
    after = client.post("/proof/bundle", headers=owner).json()
    bundle_id = after["bundles"][0]["id"]
    assert [(e["bundle_id"], e["status"]) for e in after["entries"]] == [(bundle_id, "verified")]
    assert (after["sealed"], after["mismatches"]) == (1, 0)
    assert "Neha" not in str(after["bundles"]), "bundles carry hashes only (rule 9)"


@pytest.mark.usefixtures("sample")
def test_a_changed_record_is_a_mismatch_and_blocks_sending(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    draft = rahul_draft(client, owner)
    client.post("/proof/bundle", headers=owner)
    consent = sample.scalars(select(Consent)).one()
    assert record_intact(consent)
    consent.given_at = consent.given_at - timedelta(days=1)  # someone edits the record
    sample.commit()
    assert not record_intact(consent)

    overview = client.get("/proof", headers=owner).json()
    assert [e["status"] for e in overview["entries"]] == ["mismatch"]
    assert overview["mismatches"] == 1
    dialog = client.get(f"/proof/consents/{consent.id}", headers=owner).json()
    assert (dialog["status"], dialog["matches"]) == ("mismatch", False)
    refused = client.post(f"/messages/{draft['id']}/approve", headers=owner)
    assert (refused.status_code, refused.json()["error"]["code"]) == (409, "consent_mismatch")
    assert client.get("/messages", headers=owner).json()["messages"][0]["status"] == "draft"


@pytest.mark.usefixtures("sample")
def test_a_swapped_fingerprint_is_a_mismatch(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_at_desk(client, owner, 104, "9876543210")
    client.post("/proof/bundle", headers=owner)
    consent = sample.scalars(select(Consent)).one()
    consent.fingerprint = "ab" * 32
    consent.salt = None  # nothing left to recompute: only the sealed leaf can tell
    sample.commit()
    overview = client.get("/proof", headers=owner).json()
    assert [e["status"] for e in overview["entries"]] == ["mismatch"]


@pytest.mark.usefixtures("sample")
def test_an_erased_entry_is_deleted_and_unnamed(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_at_desk(client, owner, 104, "9876543210")
    client.post("/proof/bundle", headers=owner)
    consent = sample.scalars(select(Consent)).one()
    erase_consent(sample, consent, utc_now())
    sample.commit()
    assert record_intact(consent), "no salt left: nothing to compare"
    entry = client.get("/proof", headers=owner).json()["entries"][0]
    assert entry == {
        "bundle_id": entry["bundle_id"], "consent_id": None, "guest_name": None,
        "given_at": None, "status": "deleted",
    }  # fmt: skip


# --- Savings: Season in review -----------------------------------------------------


def test_season_review_counts_bookings_inside_the_season() -> None:
    start, end = date(2026, 4, 1), date(2026, 9, 30)
    booked = [(date(2026, 3, 31), 100), (start, 200), (end, 300), (date(2026, 10, 1), 400)]
    season = season_review(booked, start, end)
    assert (season.count, season.total_net_saving) == (2, 500)
    assert season_review([], start, end).count == 0


@pytest.mark.usefixtures("sample")
def test_season_in_review_is_the_four_coded_bookings(
    client: TestClient, owner: dict[str, str]
) -> None:
    savings = client.get("/savings", headers=owner).json()
    assert savings["season"] == {
        "start": "2026-04-01", "end": "2026-09-30", "count": 4,
        "total_net_saving": rupees(12_600),
    }  # fmt: skip
    assert savings["season"]["total_net_saving"] == TOTAL_NET_SAVING


# --- Ask: the 8 AM line --------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_morning_line_uses_the_close_numbers(client: TestClient, owner: dict[str, str]) -> None:
    line = client.get("/ask/morning", headers=owner).json()
    close = client.post("/ask/todays_close", headers=owner).json()
    rooms, net = line["figures"]
    assert (rooms, net) == (close["figures"][0], close["figures"][2])
    assert line["hi"] == f"Suprabhat Rajesh ji. Kal {rooms} room bike, aapke paas {net} bache."
    assert line["en"].startswith("Good morning, Rajesh ji.")
    assert line["source"] == "From your statements"
    assert client.get("/ask/morning").status_code == 401


def test_morning_line_on_a_quiet_day(sample: Session) -> None:
    prop = sample.scalars(select(Property)).one()
    quiet = morning_line(sample, prop, date(2020, 1, 1))
    assert quiet.figures == ()
    assert quiet.hi == "Suprabhat Rajesh ji. Kal koi room nahi bika."
