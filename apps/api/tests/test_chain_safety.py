"""Chain guard and proof write safety (live features T1).

Adds to test_chain.py: every non-Amoy chain answer is refused, PROOF_CHAIN_ID
must be exactly 80002, the key never leaks, the signed transaction goes from
the wallet to itself with value 0 and only the root, RPC timeouts fall back to
local, and the balance floors hold at their exact boundaries. No network.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import replace
from typing import Any

import httpx
import pytest
from eth_account import Account
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, load_settings
from app.main import create_app
from app.models import Consent, ProofBundle
from app.services.chain import (
    LOW_BALANCE_WEI,
    MIN_SEND_WEI,
    MIN_TIP_WEI,
    AmoyWriter,
    ChainRefusedError,
    RpcError,
    writer_for,
)
from tests.test_chain import (
    ADDRESS,
    ROOT,
    RPC,
    TEST_KEY,
    TX,
    FakeRpc,
    decode_type2,
    make_writer,
)
from tests.test_proof_and_ask import consent_for

KEY_HEX = TEST_KEY[2:]
PHONE = "9876543210"
# Cheap fees so the 0.002 POL floor, not the fee check, decides the boundary.
CHEAP = {"eth_getBlockByNumber": {"number": "0x1", "baseFeePerGas": hex(10**9)}}


def no_key_in(text: str) -> None:
    assert KEY_HEX not in text.lower()
    assert KEY_HEX[:16] not in text.lower()


# Chain guard -------------------------------------------------------------------


@pytest.mark.parametrize(
    "answer",
    ["0x1", "0x89", "0x13881", "0x013882", "0X13882", "0x13882 ", "80002", "", None, 80002,
     ["0x13882"], {"id": "0x13882"}],
)  # fmt: skip
def test_any_chain_answer_but_amoy_is_refused(answer: Any) -> None:
    rpc = FakeRpc(eth_chainId=answer)
    writer = make_writer(rpc)
    assert writer.write(ROOT).reason == "wrong_chain"
    assert rpc.methods() == ["eth_chainId"]
    assert not rpc.sent_raw()
    status = writer.status()
    assert (status.mode, status.reason) == ("local", "wrong_chain")


@pytest.mark.parametrize(
    "chain_id", ["1", "137", "80001", "0x13882", "080002", "80002x", "80 002", "Amoy", "8000"]
)
def test_proof_chain_id_must_be_exactly_80002(
    chain_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PROOF_RPC_URL", RPC)
    monkeypatch.setenv("PROOF_PRIVATE_KEY", TEST_KEY)
    monkeypatch.setenv("PROOF_CHAIN_ID", chain_id)
    settings = load_settings()
    assert not settings.chain_enabled
    assert writer_for(settings) is None
    monkeypatch.setenv("PROOF_CHAIN_ID", "80002")
    assert load_settings().chain_enabled


@pytest.mark.usefixtures("sample")
def test_wrong_chain_id_setting_keeps_api_local_without_rpc(
    settings: Settings, factory: sessionmaker[Session], owner: dict[str, str]
) -> None:
    wrong = replace(settings, proof_rpc_url=RPC, proof_private_key=TEST_KEY, proof_chain_id="137")
    with TestClient(create_app(wrong, factory)) as client:
        consent_for(client, owner, 104, PHONE)
        body = client.post("/proof/bundle", headers=owner).json()
        assert client.app.state.chain_writer is None  # type: ignore[attr-defined]
    assert (body["chain"]["mode"], body["chain"]["reason"], body["chain"]["address"]) == (
        "local", "wrong_chain", None)  # fmt: skip
    assert body["bundles"][0]["chain_status"] == "stored"


# The key never leaks -------------------------------------------------------------


def test_key_absent_from_repr_errors_and_logs(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    rpc = FakeRpc(eth_sendRawTransaction={"error": {"message": "insufficient funds"}})
    writer = make_writer(rpc)
    result = writer.write(ROOT)
    assert result.reason == "rpc_down"
    for text in (repr(writer), str(writer), repr(result), caplog.text,
                 str(ChainRefusedError("rpc_down")), repr(RpcError("nonce too low"))):  # fmt: skip
        no_key_in(text)
    assert not hasattr(writer, "private_key")
    # Malformed keys of every shape are reported without the value.
    for bad in ("0x" + "ab" * 31, "ab" * 33, "0x" + "zz" * 32, "0x" + "00" * 32):
        caplog.clear()
        assert writer_for(replace(load_settings(), proof_rpc_url=RPC, proof_private_key=bad,
                                  proof_chain_id="80002")) is None  # fmt: skip
        assert bad[2:12] not in caplog.text


@pytest.fixture(name="chain_api")
def fixture_chain_api(
    settings: Settings, factory: sessionmaker[Session]
) -> Iterator[tuple[TestClient, FakeRpc]]:
    rpc = FakeRpc()
    app = create_app(replace(settings, proof_rpc_url=RPC, proof_private_key=TEST_KEY,
                             proof_chain_id="80002"), factory)  # fmt: skip
    app.state.chain_writer = make_writer(rpc)
    with TestClient(app) as client:
        yield client, rpc


@pytest.mark.usefixtures("sample")
@pytest.mark.parametrize(
    "override",
    [{}, {"eth_chainId": "0x1"}, {"eth_getBalance": "0x0"},
     {"eth_chainId": httpx.ReadTimeout("slow")}],
)  # fmt: skip
def test_key_absent_from_proof_api_responses(
    chain_api: tuple[TestClient, FakeRpc],
    owner: dict[str, str],
    override: dict[str, Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    client, rpc = chain_api
    rpc.answers.update(override)
    consent_for(client, owner, 104, PHONE)
    texts = [client.get("/proof", headers=owner).text,
             client.post("/proof/bundle", headers=owner).text,
             client.get("/proof", headers=owner).text, caplog.text]  # fmt: skip
    for text in texts:
        no_key_in(text)
    assert PHONE not in texts[1]


# The signed transaction --------------------------------------------------------------


def test_signed_tx_is_from_and_to_the_wallet_with_zero_value_and_only_the_root() -> None:
    rpc = FakeRpc()
    assert make_writer(rpc).write(ROOT).tx_hash == TX
    [raw] = rpc.sent_raw()
    signer = Account.recover_transaction(raw)  # pylint: disable=no-value-for-parameter
    assert signer == ADDRESS
    fields = decode_type2(raw)
    to, value, data, access = fields[5], fields[6], fields[7], fields[8]
    assert "0x" + to.hex() == ADDRESS.lower()
    assert value == b""  # RLP of 0
    assert data == bytes.fromhex(ROOT) and len(data) == 32
    assert access == []
    assert int.from_bytes(fields[2]) >= MIN_TIP_WEI


# RPC failures --------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "error"),
    [("eth_chainId", httpx.ReadTimeout("slow")), ("eth_chainId", httpx.ConnectTimeout("slow")),
     ("eth_getBalance", httpx.ReadTimeout("slow")),
     ("eth_sendRawTransaction", httpx.ReadTimeout("slow")),
     ("eth_getTransactionCount", httpx.RemoteProtocolError("cut"))],
)  # fmt: skip
def test_timeouts_fall_back_to_local(method: str, error: Exception) -> None:
    rpc = FakeRpc(**{method: error})
    writer = make_writer(rpc)
    assert writer.write(ROOT).reason == "rpc_down"
    status = writer.status()
    assert (status.mode, status.reason, status.reachable) == ("local", "rpc_down", False)


@pytest.mark.parametrize("code", [500, 503, 429])
def test_http_errors_fall_back_to_local(code: int) -> None:
    def fail(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(code, json={"error": "server"})

    writer = AmoyWriter(RPC, TEST_KEY, httpx.Client(transport=httpx.MockTransport(fail)),
                        sleep=lambda _s: None)  # fmt: skip
    assert writer.write(ROOT).reason == "rpc_down"
    assert writer.receipt(TX).status == "sent"


@pytest.mark.usefixtures("sample")
def test_rpc_down_through_the_api_stores_locally_and_seals_once(
    chain_api: tuple[TestClient, FakeRpc], owner: dict[str, str], sample: Session
) -> None:
    client, rpc = chain_api
    rpc.answers["eth_chainId"] = httpx.ReadTimeout("slow")
    consent_for(client, owner, 104, PHONE)
    body = client.post("/proof/bundle", headers=owner).json()
    assert (body["bundles"][0]["chain_status"], body["bundles"][0]["chain_tx"]) == ("stored", None)
    assert (body["chain"]["mode"], body["chain"]["reason"]) == ("local", "rpc_down")
    assert (body["proven"], body["pending"]) == (1, 0)
    assert not rpc.sent_raw()
    assert sample.scalars(select(Consent)).one().proof_status == "verified"


# Balance boundaries ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("balance", "sent"),
    [(MIN_SEND_WEI, True), (MIN_SEND_WEI - 1, False), (LOW_BALANCE_WEI, True)],
)
def test_write_floor_is_exactly_0_002_pol(balance: int, sent: bool) -> None:
    rpc = FakeRpc(eth_getBalance=hex(balance), **CHEAP)
    result = make_writer(rpc).write(ROOT)
    assert (result.tx_hash is not None) is sent
    assert result.reason == (None if sent else "low_balance")
    assert len(rpc.sent_raw()) == (1 if sent else 0)


@pytest.mark.parametrize(
    ("balance", "mode", "low", "shown"),
    [(MIN_SEND_WEI, "amoy", True, "0.0020"), (MIN_SEND_WEI - 1, "local", True, "0.0019"),
     (LOW_BALANCE_WEI, "amoy", False, "0.0100"), (LOW_BALANCE_WEI - 1, "amoy", True, "0.0099")],
)  # fmt: skip
def test_status_boundaries_at_0_002_and_0_01_pol(
    balance: int, mode: str, low: bool, shown: str
) -> None:
    status = make_writer(FakeRpc(eth_getBalance=hex(balance))).status()
    assert (status.mode, status.low_balance, status.balance_pol) == (mode, low, shown)
    assert status.reason == (None if mode == "amoy" else "low_balance")


def test_fee_above_balance_is_refused_even_over_the_floor() -> None:
    gas, max_fee = 21_512, 2 * 10**9 + MIN_TIP_WEI
    rpc = FakeRpc(eth_getBalance=hex(MIN_SEND_WEI), eth_estimateGas=hex(10**6), **CHEAP)
    assert gas * max_fee < MIN_SEND_WEI < 10**6 * max_fee
    assert make_writer(rpc).write(ROOT).reason == "low_balance"
    assert not rpc.sent_raw()


# Proof write -------------------------------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_two_writes_in_a_row_do_not_double_seal(
    chain_api: tuple[TestClient, FakeRpc], owner: dict[str, str], sample: Session
) -> None:
    client, rpc = chain_api
    consent_for(client, owner, 104, PHONE)
    first = client.post("/proof/bundle", headers=owner)
    second = client.post("/proof/bundle", headers=owner)
    assert first.status_code == 200
    assert (second.status_code, second.json()["error"]["code"]) == (409, "nothing_pending")
    assert len(rpc.sent_raw()) == 1
    assert sample.scalar(select(func.count(ProofBundle.id))) == 1
    body = client.get("/proof", headers=owner).json()
    assert (body["proven"], body["sealed"], len(body["bundles"])) == (1, 1, 1)


@pytest.mark.usefixtures("sample")
def test_sent_bundle_is_not_rechecked_while_rpc_is_down_then_verifies(
    chain_api: tuple[TestClient, FakeRpc], owner: dict[str, str]
) -> None:
    client, rpc = chain_api
    consent_for(client, owner, 104, PHONE)
    rpc.answers["eth_getTransactionReceipt"] = None
    assert client.post("/proof/bundle", headers=owner).json()["bundles"][0]["chain_status"] == (
        "sent"
    )
    writer = client.app.state.chain_writer  # type: ignore[attr-defined]
    rpc.answers["eth_chainId"] = httpx.ConnectError("down")
    # Force a fresh status instead of the 30 s cache.
    writer._cache = None  # pylint: disable=protected-access
    rpc.calls.clear()
    still = client.get("/proof", headers=owner).json()
    assert still["bundles"][0]["chain_status"] == "sent"
    assert "eth_getTransactionReceipt" not in rpc.methods()
    rpc.answers["eth_chainId"] = "0x13882"
    rpc.answers["eth_getTransactionReceipt"] = {"status": "0x1", "blockNumber": "0x2a"}
    writer._cache = None  # pylint: disable=protected-access
    done = client.get("/proof", headers=owner).json()["bundles"][0]
    assert (done["chain_status"], done["chain_block"], done["chain_tx"]) == ("verified", 42, TX)


@pytest.mark.usefixtures("sample")
def test_local_mode_marks_stored_and_never_calls_a_chain(
    client: TestClient, owner: dict[str, str]
) -> None:
    consent_for(client, owner, 104, PHONE)
    body = client.post("/proof/bundle", headers=owner).json()
    bundle = body["bundles"][0]
    assert (bundle["chain_status"], bundle["chain_tx"], bundle["chain_block"]) == (
        "stored", None, None)  # fmt: skip
    assert (bundle["network_label"], bundle["explorer_url"]) == (None, None)
    assert (body["chain_live"], body["chain"]["reason"], body["proven"]) == (False, "no_key", 1)
