"""Proof (Merkle root, verification, erasure) and Ask (CLAUDE.md M7 check)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import make_engine, make_session_factory
from app.jobs import nightly_proof
from app.models import Base, Consent, Message, ProofBundle, ProofBundleItem
from app.money import format_inr, rupees
from app.services.ask import Answer, ClaudePhraser, numbers_in, phrased, previous_month
from app.services.desk import utc_now
from app.services.ledger import load_ledger
from app.services.proof import ProofError, erase_consent, merkle_path, merkle_root, verify_path
from seed.load import load_sample
from tests.conftest import DEMO_DATE

DUMMY_KEY = "dummy"  # pragma: allowlist secret (never sent)
FPS = [hashlib.sha256(f"consent-{i}".encode()).hexdigest() for i in range(5)]


def test_single_leaf_root_is_its_hash() -> None:
    assert merkle_root(FPS[:1]) == hashlib.sha256(bytes.fromhex(FPS[0])).hexdigest()


@pytest.mark.parametrize("count", [1, 2, 3, 4, 5])
def test_every_leaf_verifies_and_tampering_fails(count: int) -> None:
    leaves = FPS[:count]
    root = merkle_root(leaves)
    for index, fp in enumerate(leaves):
        path = merkle_path(leaves, index)
        assert verify_path(fp, path, root)
        assert not verify_path(FPS[(index + 1) % 5] if count > 1 else "00" * 32, path, root)


def test_empty_bundle_is_refused() -> None:
    with pytest.raises(ProofError):
        merkle_root([])


def consent_for(client: TestClient, owner: dict[str, str], room: int, number: str) -> None:
    url = client.post("/desk/checkin", headers=owner, json={"room": room}).json()["url"]
    client.post(f"/public/consent/{url.rsplit('/', 1)[-1]}",
                json={"agree": True, "whatsapp": number})  # fmt: skip


@pytest.mark.usefixtures("sample")
def test_write_tonights_proof(client: TestClient, owner: dict[str, str], sample: Session) -> None:
    consent_for(client, owner, 104, "9876543210")
    consent_for(client, owner, 207, "9123456780")
    before = client.get("/proof", headers=owner).json()
    assert (before["pending"], before["proven"], before["bundles"]) == (2, 0, [])
    assert before["consents_this_month"] == 2
    assert before["chain_live"] is False

    after = client.post("/proof/bundle", headers=owner).json()
    assert (after["pending"], after["proven"]) == (0, 2)
    bundle = after["bundles"][0]
    assert (bundle["item_count"], bundle["chain_status"], bundle["chain_tx"]) == (2, "stored", None)
    fps = [c.fingerprint for c in sample.scalars(select(Consent).order_by(Consent.given_at))]
    assert bundle["merkle_root"] == merkle_root(fps)

    again = client.post("/proof/bundle", headers=owner)
    assert (again.status_code, again.json()["error"]["code"]) == (409, "nothing_pending")

    consent = sample.scalars(select(Consent)).first()
    assert consent is not None
    dialog = client.get(f"/proof/consents/{consent.id}", headers=owner).json()
    assert (dialog["status"], dialog["matches"], len(dialog["path"])) == ("verified", True, 1)
    assert dialog["fingerprint"] == consent.fingerprint
    published = str(bundle) + str(dialog["path"])
    assert "9876543210" not in published and "Neha" not in published


@pytest.mark.usefixtures("sample")
def test_pending_consent_dialog_and_errors(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_for(client, owner, 104, "9876543210")
    consent = sample.scalars(select(Consent)).one()
    dialog = client.get(f"/proof/consents/{consent.id}", headers=owner).json()
    assert (dialog["status"], dialog["bundle"], dialog["matches"]) == ("pending", None, None)
    assert client.get("/proof/consents/999", headers=owner).status_code == 404
    assert client.get("/proof").status_code == 401
    assert client.post("/proof/bundle").status_code == 401


@pytest.mark.usefixtures("sample")
def test_erasure_unlinks_but_keeps_the_proof(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    consent_for(client, owner, 104, "9876543210")
    client.post("/desk/checkout", headers=owner, json={"room": 104})
    client.post("/proof/bundle", headers=owner)
    consent = sample.scalars(select(Consent)).one()
    original = consent.fingerprint
    erase_consent(sample, consent, utc_now())
    sample.commit()
    item = sample.scalars(select(ProofBundleItem)).one()
    bundle = sample.scalars(select(ProofBundle)).one()
    assert item.consent_id is None and item.fingerprint == original
    assert merkle_root([item.fingerprint]) == bundle.merkle_root
    assert (consent.salt, consent.whatsapp_number) == (None, None)
    assert consent.erased_at is not None and not consent.is_active
    assert consent.fingerprint != original
    message = sample.scalars(select(Message)).one()
    assert message.body == "[erased at the guest's request]"
    assert message.status == "blocked"
    dialog = client.get(f"/proof/consents/{consent.id}", headers=owner).json()
    assert (dialog["bundle"], dialog["status"]) == (None, "erased")


def test_nightly_job(tmp_path: Path, owner: dict[str, str]) -> None:
    _ = owner
    url = f"sqlite:///{tmp_path / 'nightly.db'}"
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as session:
        load_sample(session, DEMO_DATE, with_statements=False)
        session.commit()
    assert nightly_proof(url) == 0
    engine.dispose()


# --- Ask ----------------------------------------------------------------------------


def ask(client: TestClient, owner: dict[str, str], key: str) -> dict[str, Any]:
    res = client.post(f"/ask/{key}", headers=owner)
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    assert body["source"] == "From your statements"
    return body


@pytest.mark.usefixtures("sample")
def test_ask_numbers_equal_ledger_numbers(
    client: TestClient, owner: dict[str, str], sample: Session
) -> None:
    questions = client.get("/ask", headers=owner).json()
    assert [q["hi"] for q in questions][0] == "Pichle mahine MakeMyTrip ko kitna diya?"
    assert len(questions) == 6

    start, end = previous_month(DEMO_DATE)
    september = load_ledger(sample, 1, start, end)
    mmt_paid = next(c for c in september.channels if c.channel.key == "mmt").lines.paid_to_channels
    paid = ask(client, owner, "paid_last_month")
    assert paid["figures"] == [format_inr(mmt_paid)] == ["₹1,09,542"]
    assert (
        paid["answer"]
        == "September mein MakeMyTrip ko ₹1,09,542 diye. Commission plus GST on commission."
    )

    best = ask(client, owner, "best_channel")
    assert best["answer"] == (
        "Walk-in: har room par ₹4,500 bache. Online mein Direct sabse accha: ₹4,283 har room."
    )

    repeats = ask(client, owner, "repeat_guests")
    assert repeats["answer"] == "12 guests. Unpar ₹41,800 commission dobara diya."

    close = ask(client, owner, "todays_close")
    assert close["answer"].startswith("Aaj: 14 rooms. Gross ₹58,800.")
    assert "Direct bookings 21%" in close["answer"]

    saved = ask(client, owner, "saved_direct")
    assert saved["answer"].startswith("Abhi tak koi coded direct booking nahi")

    payouts = ask(client, owner, "payouts_this_week")
    assert payouts["answer"].startswith("MakeMyTrip: ₹")
    assert "Friday ko" in payouts["answer"]
    assert "virtual card" in payouts["answer"]


@pytest.mark.usefixtures("sample")
def test_ask_saved_after_a_coded_booking(client: TestClient, owner: dict[str, str]) -> None:
    consent_for(client, owner, 207, "9876543210")
    client.post("/desk/checkout", headers=owner, json={"room": 207})
    page = client.get("/public/link?code=DEODAR-RS26").json()
    booking = {
        "code": "DEODAR-RS26",
        "check_in": page["dates"][0]["check_in"],
        "nights": 2,
        "room_type": "Deluxe Valley View",
    }
    client.post("/public/link/book", json=booking)
    saved = ask(client, owner, "saved_direct")
    assert saved["answer"] == "Is mahine ₹2,199 bache, 1 coded direct booking se."


@pytest.mark.usefixtures("base_sample")
def test_ask_before_statements(client: TestClient, owner: dict[str, str]) -> None:
    assert ask(client, owner, "best_channel")["answer"].startswith("Abhi statements nahi aaye")
    assert ask(client, owner, "paid_last_month")["figures"] == []
    assert (
        ask(client, owner, "repeat_guests")["answer"]
        == "0 guests. Unpar ₹0 commission dobara diya."
    )
    assert client.post("/ask/what", headers=owner).status_code == 404
    assert client.post("/ask/best_channel").status_code == 401


@dataclass
class FakePhraser:
    """Returns a fixed rewording."""

    text: str | None
    seen: list[str] = field(default_factory=list)

    def phrase(self, question: str, answer: str) -> str | None:
        self.seen.append(f"{question}|{answer}")
        return self.text


ANSWER = Answer(
    hi="12 guests. Unpar ₹41,800 commission dobara diya.", en="", figures=("12", "₹41,800")
)


def test_claude_may_only_reword() -> None:
    same = "Aapke 12 guests wapas aaye; unpar ₹41,800 commission dobara gaya."
    assert phrased(ANSWER, "q", FakePhraser(same)) == same
    assert phrased(ANSWER, "q", FakePhraser("12 guests, ₹42,000 dobara.")) == ANSWER.hi
    assert phrased(ANSWER, "q", FakePhraser("Twelve guests, ₹41,800.")) == ANSWER.hi
    assert phrased(ANSWER, "q", FakePhraser(None)) == ANSWER.hi
    assert phrased(ANSWER, "q", None) == ANSWER.hi
    assert numbers_in("₹1,09,542 and 21%") == ["1,09,542", "21"]


@pytest.mark.usefixtures("sample")
def test_ask_uses_phraser_override(client: TestClient, owner: dict[str, str]) -> None:
    client.app.state.phraser = FakePhraser("Bas 12 guests, aur ₹41,800 dobara.")  # type: ignore[attr-defined]
    assert ask(client, owner, "repeat_guests")["answer"] == "Bas 12 guests, aur ₹41,800 dobara."


@dataclass
class Block:
    """Response block."""

    type: str
    text: str = ""


@dataclass
class FakeMessage:
    """Response message."""

    stop_reason: str
    content: list[Block]


class FakeCreate:
    """client.messages.create."""

    def __init__(self, result: FakeMessage | Exception) -> None:
        self.result = result

    def create(self, **kwargs: Any) -> FakeMessage:
        assert "Keep every number" in kwargs["system"]
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def phraser_with(result: FakeMessage | Exception) -> ClaudePhraser:
    client = cast(anthropic.Anthropic, type("C", (), {"messages": FakeCreate(result)})())
    return ClaudePhraser(api_key=DUMMY_KEY, model="claude-opus-5", client=client)


def test_claude_phraser_paths() -> None:
    assert phraser_with(FakeMessage("end_turn", [Block("text", "x")])).phrase("q", "a") == "x"
    assert phraser_with(FakeMessage("max_tokens", [])).phrase("q", "a") is None
    error = anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x.test"))
    assert phraser_with(error).phrase("q", "a") is None


def test_rupees_helper_used_in_answers() -> None:
    assert format_inr(rupees(41_800)) == "₹41,800"
