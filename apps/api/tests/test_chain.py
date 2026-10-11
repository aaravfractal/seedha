"""Polygon Amoy writer: chain guard, refusals, confirmation, wallet script.

No network: every JSON-RPC call is answered by httpx.MockTransport. The key
is the public EIP-155 test-vector key, never a real one.
"""

from __future__ import annotations

import importlib.util
import json
import stat
from collections.abc import Callable, Iterator
from dataclasses import replace
from pathlib import Path
from types import ModuleType
from typing import Any

import httpx
import pytest
import rlp  # type: ignore[import-untyped]
from eth_account import Account
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, load_settings
from app.db import make_engine, make_session_factory
from app.jobs import nightly_proof
from app.main import create_app
from app.models import Base, Consent, ProofBundle
from app.services.chain import (
    MIN_TIP_WEI,
    AmoyWriter,
    format_pol,
    local_status,
    writer_for,
)
from app.services.desk import utc_now
from app.services.proof import LocalOnly, merkle_root, publish_bundle
from seed.load import load_sample
from tests.conftest import DEMO_DATE
from tests.test_proof_and_ask import consent_for

TEST_KEY = "0x" + "46" * 32
ADDRESS = Account.from_key(TEST_KEY).address  # pylint: disable=no-value-for-parameter
RPC = "https://rpc.example.test"
ROOT = "ab" * 32
TX = "0x" + "cd" * 32
POL = 10**18
REPO_ROOT = Path(__file__).resolve().parents[3]


class FakeRpc:
    """Answers JSON-RPC by method; records every call."""

    def __init__(self, **overrides: Any) -> None:
        self.answers: dict[str, Any] = {
            "eth_chainId": "0x13882",
            "eth_getBalance": hex(POL),
            "eth_getTransactionCount": "0x7",
            "eth_maxPriorityFeePerGas": hex(2 * 10**9),
            "eth_getBlockByNumber": {"number": "0x10", "baseFeePerGas": hex(40 * 10**9)},
            "eth_estimateGas": hex(21_512),
            "eth_sendRawTransaction": TX,
            "eth_getTransactionReceipt": {"status": "0x1", "blockNumber": "0x1a2b"},
        }
        self.answers.update(overrides)
        self.calls: list[tuple[str, list[Any]]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        method, params = body["method"], body["params"]
        self.calls.append((method, params))
        answer = self.answers.get(method)
        if callable(answer):
            answer = answer(params)
        if isinstance(answer, Exception):
            raise answer
        if isinstance(answer, dict) and "error" in answer:
            return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], **answer})
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": answer})

    def methods(self) -> list[str]:
        return [m for m, _ in self.calls]

    def sent_raw(self) -> list[str]:
        return [p[0] for m, p in self.calls if m == "eth_sendRawTransaction"]


def make_writer(rpc: FakeRpc, clock: Callable[[], float] = lambda: 0.0) -> AmoyWriter:
    client = httpx.Client(transport=httpx.MockTransport(rpc))
    return AmoyWriter(RPC, TEST_KEY, client, sleep=lambda _s: None, clock=clock)


def down(_params: list[Any]) -> Exception:
    return httpx.ConnectError("down")


def decode_type2(raw: str) -> list[Any]:
    payload = bytes.fromhex(raw[2:])
    assert payload[0] == 2
    decoded: list[Any] = rlp.decode(payload[1:])
    return decoded


# Settings --------------------------------------------------------------------


def chain_settings(**changes: Any) -> Settings:
    base = replace(load_settings(), proof_rpc_url=RPC, proof_private_key=TEST_KEY,
                   proof_chain_id="80002")  # fmt: skip
    return replace(base, **changes)


def test_settings_repr_hides_the_key() -> None:
    settings = chain_settings()
    assert TEST_KEY not in repr(settings) and "46464646" not in repr(settings)
    assert "46464646" not in repr(make_writer(FakeRpc()))
    assert settings.chain_enabled


@pytest.mark.parametrize(
    ("changes", "reason"),
    [({"proof_chain_id": "137"}, "wrong_chain"), ({"proof_chain_id": ""}, "no_key"),
     ({"proof_private_key": ""}, "no_key"), ({"proof_rpc_url": ""}, "no_key")],
)  # fmt: skip
def test_chain_needs_all_three_and_amoy(changes: dict[str, str], reason: str) -> None:
    settings = chain_settings(**changes)
    assert not settings.chain_enabled
    assert writer_for(settings) is None
    status = local_status(settings)
    assert (status.mode, status.reason, status.address) == ("local", reason, None)


def test_malformed_key_stays_local(caplog: pytest.LogCaptureFixture) -> None:
    bad = "0x" + "notakey"
    assert writer_for(chain_settings(proof_private_key=bad)) is None
    assert "notakey" not in caplog.text
    assert isinstance(writer_for(chain_settings()), AmoyWriter)


# Refusals --------------------------------------------------------------------


def test_wrong_chain_is_refused_before_anything_else() -> None:
    rpc = FakeRpc(eth_chainId="0x89")  # Polygon mainnet
    result = make_writer(rpc).write(ROOT)
    assert (result.tx_hash, result.reason) == (None, "wrong_chain")
    assert rpc.methods() == ["eth_chainId"]


def test_low_balance_is_refused() -> None:
    rpc = FakeRpc(eth_getBalance=hex(10**15))  # 0.001 POL
    assert make_writer(rpc).write(ROOT).reason == "low_balance"
    assert not rpc.sent_raw()


def test_balance_below_the_fee_is_refused() -> None:
    rpc = FakeRpc(eth_getBalance=hex(3 * 10**15), eth_estimateGas=hex(10**6))
    assert make_writer(rpc).write(ROOT).reason == "low_balance"
    assert not rpc.sent_raw()


def test_rpc_down_is_refused_and_logs_no_secret(caplog: pytest.LogCaptureFixture) -> None:
    rpc = FakeRpc(eth_chainId=down)
    writer = make_writer(rpc)
    assert writer.write(ROOT).reason == "rpc_down"
    assert "46464646" not in caplog.text
    # The page then reports the RPC as down without calling it again.
    status = writer.status()
    assert (status.mode, status.reason, status.reachable) == ("local", "rpc_down", False)
    assert rpc.methods() == ["eth_chainId"]


def test_http_error_and_rpc_error_are_refused() -> None:
    def fail(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(502)

    writer = AmoyWriter(RPC, TEST_KEY, httpx.Client(transport=httpx.MockTransport(fail)))
    assert writer.write(ROOT).reason == "rpc_down"
    rpc = FakeRpc(eth_sendRawTransaction={"error": {"code": -32000, "message": "underpriced"}})
    assert make_writer(rpc).write(ROOT).reason == "rpc_down"
    assert make_writer(FakeRpc(eth_getBlockByNumber=None)).write(ROOT).reason == "rpc_down"
    assert make_writer(FakeRpc(eth_getBalance="12")).write(ROOT).reason == "rpc_down"
    assert make_writer(FakeRpc(eth_sendRawTransaction=None)).write(ROOT).reason == "rpc_down"
    assert make_writer(FakeRpc(eth_chainId={"error": "boom"})).write(ROOT).reason == "rpc_down"


def test_non_dict_reply_is_refused() -> None:
    def odd(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[1, 2])

    writer = AmoyWriter(RPC, TEST_KEY, httpx.Client(transport=httpx.MockTransport(odd)))
    assert writer.write(ROOT).reason == "rpc_down"


def test_bad_root_is_refused_without_rpc() -> None:
    rpc = FakeRpc()
    assert make_writer(rpc).write("not-a-root").reason == "bad_root"
    assert not rpc.calls


# Happy path ------------------------------------------------------------------


def test_transaction_carries_only_the_root_to_its_own_address() -> None:
    rpc = FakeRpc()
    result = make_writer(rpc).write(ROOT)
    assert (result.tx_hash, result.reason) == (TX, None)
    [raw] = rpc.sent_raw()
    assert raw.startswith("0x02")
    chain_id, nonce, tip, max_fee, gas, to, value, data, _access = decode_type2(raw)[:9]
    assert int.from_bytes(chain_id) == 80002
    assert int.from_bytes(nonce) == 7
    assert int.from_bytes(tip) == MIN_TIP_WEI  # 2 gwei from the node, raised to 30
    assert int.from_bytes(max_fee) == 2 * 40 * 10**9 + MIN_TIP_WEI
    assert int.from_bytes(gas) == 21_512
    assert "0x" + to.hex() == ADDRESS.lower()
    assert int.from_bytes(value) == 0
    assert data.hex() == ROOT
    assert ("eth_getTransactionCount", [ADDRESS, "pending"]) in rpc.calls


def test_node_tip_above_minimum_and_gas_fallback() -> None:
    rpc = FakeRpc(eth_maxPriorityFeePerGas=hex(50 * 10**9),
                  eth_estimateGas={"error": {"message": "nope"}})  # fmt: skip
    assert make_writer(rpc).write(ROOT).tx_hash == TX
    fields = decode_type2(rpc.sent_raw()[0])
    assert int.from_bytes(fields[2]) == 50 * 10**9
    assert int.from_bytes(fields[4]) == 30_000


def test_nonce_too_low_retries_once_with_a_fresh_nonce() -> None:
    nonces = iter(["0x7", "0x8"])
    sends: list[int] = []

    def send(_params: list[Any]) -> Any:
        sends.append(1)
        if len(sends) == 1:
            return {"error": {"code": -32000, "message": "nonce too low"}}
        return TX

    rpc = FakeRpc(eth_getTransactionCount=lambda _p: next(nonces), eth_sendRawTransaction=send)
    assert make_writer(rpc).write(ROOT).tx_hash == TX
    first, second = rpc.sent_raw()
    assert int.from_bytes(decode_type2(first)[1]) == 7
    assert int.from_bytes(decode_type2(second)[1]) == 8


def test_nonce_too_low_twice_gives_up() -> None:
    rpc = FakeRpc(eth_sendRawTransaction={"error": {"message": "nonce too low"}})
    assert make_writer(rpc).write(ROOT).reason == "rpc_down"
    assert len(rpc.sent_raw()) == 2


# Confirmation ----------------------------------------------------------------


def test_confirm_polls_until_the_receipt() -> None:
    answers = iter([None, None, {"status": "0x1", "blockNumber": "0x64"}])
    rpc = FakeRpc(eth_getTransactionReceipt=lambda _p: next(answers))
    found = make_writer(rpc).confirm(TX)
    assert (found.status, found.block) == ("verified", 100)
    assert rpc.methods().count("eth_getTransactionReceipt") == 3


def test_confirm_failed_and_timeout() -> None:
    failed = make_writer(FakeRpc(eth_getTransactionReceipt={"status": "0x0", "blockNumber": "0x5"}))
    assert (failed.confirm(TX).status, failed.confirm(TX).block) == ("failed", 5)
    rpc = FakeRpc(eth_getTransactionReceipt=None)
    assert make_writer(rpc).confirm(TX).status == "sent"
    assert rpc.methods().count("eth_getTransactionReceipt") == 10  # every 2 s for 20 s
    assert make_writer(FakeRpc(eth_getTransactionReceipt=down)).receipt(TX).status == "sent"
    assert make_writer(FakeRpc(eth_getTransactionReceipt={"status": "0x1"})).receipt(TX).status == (
        "sent"
    )


# Status ----------------------------------------------------------------------


def test_status_balance_and_cache() -> None:
    now = [0.0]
    rpc = FakeRpc(eth_getBalance=hex(5 * 10**15 + 99))
    writer = make_writer(rpc, clock=lambda: now[0])
    status = writer.status()
    assert (status.mode, status.balance_pol, status.low_balance, status.reason) == (
        "amoy", "0.0050", True, None)  # fmt: skip
    assert status.address == ADDRESS
    assert status.address_url == f"https://amoy.polygonscan.com/address/{ADDRESS}"
    writer.status()
    assert rpc.methods().count("eth_getBalance") == 1  # cached
    now[0] = 31.0
    writer.status()
    assert rpc.methods().count("eth_getBalance") == 2


def test_status_reasons() -> None:
    low = make_writer(FakeRpc(eth_getBalance=hex(10**15))).status()
    assert (low.mode, low.reason, low.balance_pol) == ("local", "low_balance", "0.0010")
    wrong = make_writer(FakeRpc(eth_chainId="0x1")).status()
    assert (wrong.mode, wrong.reason, wrong.reachable) == ("local", "wrong_chain", True)
    flush = make_writer(FakeRpc(eth_getBalance=hex(2 * POL))).status()
    assert (flush.balance_pol, flush.low_balance) == ("2.0000", False)
    assert format_pol(123_456_789_000_000_000) == "0.1234"


# Proof service and API -------------------------------------------------------


@pytest.fixture(name="chain_client")
def fixture_chain_client(
    settings: Settings, factory: sessionmaker[Session]
) -> Iterator[tuple[TestClient, FakeRpc]]:
    rpc = FakeRpc()
    app = create_app(replace(settings, proof_rpc_url=RPC, proof_private_key=TEST_KEY,
                             proof_chain_id="80002"), factory)  # fmt: skip
    app.state.chain_writer = make_writer(rpc)
    with TestClient(app) as client:
        yield client, rpc


@pytest.mark.usefixtures("sample")
def test_write_tonight_on_amoy_verified_with_block(
    chain_client: tuple[TestClient, FakeRpc], owner: dict[str, str], sample: Session
) -> None:
    client, rpc = chain_client
    consent_for(client, owner, 104, "9876543210")
    before = client.get("/proof", headers=owner).json()
    assert before["chain_live"] is True
    assert before["chain"] == {
        "mode": "amoy", "network_label": "Polygon Amoy testnet", "address": ADDRESS,
        "balance_pol": "1.0000", "low_balance": False, "reason": None,
        "address_url": f"https://amoy.polygonscan.com/address/{ADDRESS}",
    }  # fmt: skip
    after = client.post("/proof/bundle", headers=owner).json()
    bundle = after["bundles"][0]
    assert (bundle["chain_status"], bundle["chain_tx"], bundle["chain_block"]) == (
        "verified", TX, 0x1A2B)  # fmt: skip
    assert bundle["network_label"] == "Polygon Amoy testnet"
    assert bundle["explorer_url"] == f"https://amoy.polygonscan.com/tx/{TX}"
    assert after["proven"] == 1
    fps = [c.fingerprint for c in sample.scalars(select(Consent))]
    data = decode_type2(rpc.sent_raw()[0])[7]
    assert data.hex() == merkle_root(fps) == bundle["merkle_root"]
    assert b"9876543210" not in bytes.fromhex(rpc.sent_raw()[0][2:])


@pytest.mark.usefixtures("sample")
def test_timeout_stays_sent_then_get_rechecks(
    chain_client: tuple[TestClient, FakeRpc], owner: dict[str, str]
) -> None:
    client, rpc = chain_client
    consent_for(client, owner, 104, "9876543210")
    rpc.answers["eth_getTransactionReceipt"] = None
    sent = client.post("/proof/bundle", headers=owner).json()["bundles"][0]
    assert (sent["chain_status"], sent["chain_tx"], sent["chain_block"]) == ("sent", TX, None)
    still = client.get("/proof", headers=owner).json()["bundles"][0]
    assert still["chain_status"] == "sent"
    rpc.answers["eth_getTransactionReceipt"] = {"status": "0x1", "blockNumber": "0x99"}
    done = client.get("/proof", headers=owner).json()["bundles"][0]
    assert (done["chain_status"], done["chain_block"]) == ("verified", 0x99)


@pytest.mark.usefixtures("sample")
def test_failed_receipt_and_refusal_stay_local(
    chain_client: tuple[TestClient, FakeRpc], owner: dict[str, str]
) -> None:
    client, rpc = chain_client
    consent_for(client, owner, 104, "9876543210")
    rpc.answers["eth_getTransactionReceipt"] = {"status": "0x0", "blockNumber": "0x3"}
    failed = client.post("/proof/bundle", headers=owner).json()
    assert failed["bundles"][0]["chain_status"] == "failed"
    assert failed["proven"] == 1  # the root is still stored and verifiable locally

    consent_for(client, owner, 207, "9123456780")
    rpc.answers["eth_chainId"] = "0x89"
    refused = client.post("/proof/bundle", headers=owner).json()
    newest = refused["bundles"][0]
    assert (newest["chain_status"], newest["chain_tx"], newest["network_label"]) == (
        "stored", None, None)  # fmt: skip
    assert (refused["chain"]["reason"], refused["chain_live"]) == ("wrong_chain", False)


@pytest.mark.usefixtures("sample")
def test_without_key_chain_is_local(client: TestClient, owner: dict[str, str]) -> None:
    proof = client.get("/proof", headers=owner).json()
    assert proof["chain"] == {
        "mode": "local", "network_label": "Polygon Amoy testnet", "address": None,
        "balance_pol": None, "low_balance": False, "reason": "no_key", "address_url": None,
    }  # fmt: skip
    assert proof["chain_live"] is False


def test_local_only_never_confirms() -> None:
    local = LocalOnly("rpc_down")
    assert (local.write(ROOT).tx_hash, local.write(ROOT).reason) == (None, "rpc_down")
    assert local.confirm(TX).status == local.receipt(TX).status == "sent"


def test_nightly_job_uses_the_writer(
    tmp_path: Path, settings: Settings, owner: dict[str, str]
) -> None:
    url = f"sqlite:///{tmp_path / 'nightly.db'}"
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    factory = make_session_factory(engine)
    with factory() as session:
        load_sample(session, DEMO_DATE, with_statements=False)
        session.commit()
    with TestClient(create_app(settings, factory)) as client:
        consent_for(client, owner, 104, "9876543210")
    assert nightly_proof(url, make_writer(FakeRpc())) == 1
    with factory() as session:
        bundle = session.scalars(select(ProofBundle)).one()
        assert (bundle.chain_status, bundle.chain_block) == ("verified", 0x1A2B)
    engine.dispose()


def test_publish_bundle_local(sample: Session, client: TestClient, owner: dict[str, str]) -> None:
    consent_for(client, owner, 104, "9876543210")
    sample.expire_all()
    prop_id = sample.scalars(select(Consent)).one().booking.property_id
    bundle = publish_bundle(sample, prop_id, LocalOnly(), utc_now())
    assert (bundle.chain_status, bundle.chain_tx) == ("stored", None)


# Wallet script ---------------------------------------------------------------


def wallet_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "proof_wallet", REPO_ROOT / "scripts" / "proof_wallet.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_wallet_script_writes_key_and_prints_only_the_address(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    env = tmp_path / ".env"
    env.write_text("OWNER_API_TOKEN=x\nPROOF_PRIVATE_KEY=\nPROOF_RPC_URL=\n", encoding="utf-8")
    wallet = wallet_module()
    wallet.main(["proof_wallet.py", str(env)])
    out = capsys.readouterr().out
    lines = env.read_text(encoding="utf-8").splitlines()
    values = dict(line.split("=", 1) for line in lines)
    key = values["PROOF_PRIVATE_KEY"]
    address = Account.from_key(key).address  # pylint: disable=no-value-for-parameter
    assert out.splitlines() == [
        f"Proof wallet address (Polygon Amoy testnet): {address}",
        "Fund it with test POL: https://faucet.polygon.technology",
    ]
    assert key[2:] not in out
    assert values["PROOF_CHAIN_ID"] == "80002"
    assert values["PROOF_RPC_URL"] == "https://rpc-amoy.polygon.technology"
    assert values["OWNER_API_TOKEN"] == "x"
    assert [line.split("=")[0] for line in lines].count("PROOF_PRIVATE_KEY") == 1
    assert stat.S_IMODE(env.stat().st_mode) == 0o600


def test_wallet_script_refuses_an_existing_key(tmp_path: Path) -> None:
    env = tmp_path / ".env"
    original = f"PROOF_PRIVATE_KEY={TEST_KEY}\nPROOF_RPC_URL=https://mine.example\n"
    env.write_text(original, encoding="utf-8")
    with pytest.raises(SystemExit):
        wallet_module().create_wallet(env)
    assert env.read_text(encoding="utf-8") == original


def test_wallet_script_creates_a_missing_file(tmp_path: Path) -> None:
    env = tmp_path / "new.env"
    address = wallet_module().create_wallet(env)
    assert address.startswith("0x") and len(address) == 42
    assert stat.S_IMODE(env.stat().st_mode) == 0o600
    assert wallet_module().DEFAULT_ENV == REPO_ROOT / ".env"
