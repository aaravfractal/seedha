"""Polygon Amoy testnet writer for the nightly Merkle root (rule 9).

One zero-value EIP-1559 transaction from the proof wallet to itself carries
the 32-byte root as its data. Nothing else goes on-chain: no name, phone or
booking detail, only the root of salted fingerprints.

Safety: every send first checks that the RPC really is chain 80002 and that
the wallet holds enough test POL. Any refusal or network problem returns a
reason and leaves the root stored locally; nothing is raised to the owner.
The private key is never logged, returned or put in an error message, and
neither is the signed transaction.
"""

from __future__ import annotations

import logging
import math
import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal
from typing import Any, Literal

import httpx
from eth_account import Account

from app.config import Settings

logger = logging.getLogger("seedha.chain")

AMOY_CHAIN_ID = 80002
AMOY_CHAIN_HEX = "0x13882"
NETWORK_LABEL = "Polygon Amoy testnet"
EXPLORER_TX = "https://amoy.polygonscan.com/tx/"
EXPLORER_ADDRESS = "https://amoy.polygonscan.com/address/"
WEI_PER_POL = 10**18
GWEI = 10**9
MIN_TIP_WEI = 30 * GWEI
FALLBACK_GAS = 30_000
MIN_SEND_WEI = 2 * 10**15  # 0.002 POL: below this a write is refused
LOW_BALANCE_WEI = 10**16  # 0.01 POL: the Settings warning
RPC_TIMEOUT_S = 10.0
CONFIRM_WAIT_S = 20.0
POLL_INTERVAL_S = 2.0
STATUS_CACHE_S = 30.0
_ROOT = re.compile(r"[0-9a-f]{64}")

Mode = Literal["amoy", "local"]
Reason = Literal["no_key", "wrong_chain", "rpc_down", "low_balance"]


class ChainRefusedError(Exception):
    """A write that must not or cannot go out. `reason` is safe to show."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class RpcError(ChainRefusedError):
    """The node answered with a JSON-RPC error (message kept for nonce retry)."""

    def __init__(self, message: str) -> None:
        super().__init__("rpc_down")
        self.rpc_message = message


@dataclass(frozen=True, slots=True)
class WriteResult:
    """A transaction hash when the root was sent, else the refusal reason."""

    tx_hash: str | None
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class Confirmation:
    """'verified' (status 0x1), 'failed' (0x0) or 'sent' (no receipt yet)."""

    status: str
    block: int | None = None


@dataclass(frozen=True, slots=True)
class ChainStatus:
    """What the proof screen and Settings show about the wallet."""

    mode: Mode
    address: str | None
    balance_pol: str | None
    low_balance: bool
    reachable: bool
    reason: Reason | None

    @property
    def address_url(self) -> str | None:
        """Explorer page of the proof wallet."""
        return f"{EXPLORER_ADDRESS}{self.address}" if self.address else None


def format_pol(wei: int) -> str:
    """Wei as POL with 4 decimals, rounded down (never overstate a balance)."""
    pol = (Decimal(wei) / Decimal(WEI_PER_POL)).quantize(Decimal("0.0001"), rounding=ROUND_DOWN)
    return f"{pol:.4f}"


def _hex_int(value: Any) -> int:
    if not isinstance(value, str) or not value.startswith("0x"):
        raise ChainRefusedError("rpc_down")
    return int(value, 16)


def _with_0x(value: str) -> str:
    return value if value.startswith("0x") else f"0x{value}"


class AmoyWriter:
    """Writes Merkle roots to Polygon Amoy (chain 80002) over JSON-RPC."""

    def __init__(
        self,
        rpc_url: str,
        private_key: str,
        http: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._url = rpc_url
        self._account = Account.from_key(private_key)  # pylint: disable=no-value-for-parameter
        self._http = http or httpx.Client(timeout=RPC_TIMEOUT_S)
        self._sleep = sleep
        self._clock = clock
        self._lock = threading.Lock()
        self._cache: tuple[float, ChainStatus] | None = None
        self._ids = 0

    def __repr__(self) -> str:
        return f"AmoyWriter(address={self.address})"

    @property
    def address(self) -> str:
        """Checksummed address of the proof wallet (public)."""
        address: str = self._account.address
        return address

    # JSON-RPC -------------------------------------------------------------

    def _rpc(self, method: str, params: list[Any], timeout: float = RPC_TIMEOUT_S) -> Any:
        self._ids += 1
        body = {"jsonrpc": "2.0", "id": self._ids, "method": method, "params": params}
        try:
            response = self._http.post(self._url, json=body, timeout=timeout)
            response.raise_for_status()
            reply = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ChainRefusedError("rpc_down") from exc
        if not isinstance(reply, dict):
            raise ChainRefusedError("rpc_down")
        if reply.get("error") is not None:
            error = reply["error"]
            message = error.get("message", "") if isinstance(error, dict) else str(error)
            raise RpcError(str(message))
        return reply.get("result")

    def _check_chain(self, timeout: float = RPC_TIMEOUT_S) -> None:
        if self._rpc("eth_chainId", [], timeout) != AMOY_CHAIN_HEX:
            raise ChainRefusedError("wrong_chain")

    def _balance(self, timeout: float = RPC_TIMEOUT_S) -> int:
        return _hex_int(self._rpc("eth_getBalance", [self.address, "latest"], timeout))

    def _nonce(self) -> int:
        return _hex_int(self._rpc("eth_getTransactionCount", [self.address, "pending"]))

    def _fees(self) -> tuple[int, int]:
        """(maxFeePerGas, maxPriorityFeePerGas) in wei."""
        tip = max(_hex_int(self._rpc("eth_maxPriorityFeePerGas", [])), MIN_TIP_WEI)
        block = self._rpc("eth_getBlockByNumber", ["latest", False])
        if not isinstance(block, dict):
            raise ChainRefusedError("rpc_down")
        base_fee = _hex_int(block.get("baseFeePerGas"))
        return 2 * base_fee + tip, tip

    def _gas(self, data: str) -> int:
        call = {"from": self.address, "to": self.address, "value": "0x0", "data": data}
        try:
            return _hex_int(self._rpc("eth_estimateGas", [call]))
        except ChainRefusedError:
            return FALLBACK_GAS

    # Writing -------------------------------------------------------------

    def _send(self, tx: dict[str, Any]) -> str:
        signed = self._account.sign_transaction(tx)
        raw = _with_0x(signed.raw_transaction.hex())
        result = self._rpc("eth_sendRawTransaction", [raw])
        if not isinstance(result, str):
            raise ChainRefusedError("rpc_down")
        return _with_0x(result)

    def _write_locked(self, root: str) -> str:
        if not _ROOT.fullmatch(root):
            raise ChainRefusedError("bad_root")
        self._check_chain()
        balance = self._balance()
        if balance < MIN_SEND_WEI:
            raise ChainRefusedError("low_balance")
        data = f"0x{root}"
        max_fee, tip = self._fees()
        gas = self._gas(data)
        if balance < gas * max_fee:
            raise ChainRefusedError("low_balance")
        tx: dict[str, Any] = {
            "type": 2, "chainId": AMOY_CHAIN_ID, "nonce": self._nonce(), "to": self.address,
            "value": 0, "data": data, "gas": gas, "maxFeePerGas": max_fee,
            "maxPriorityFeePerGas": tip,
        }  # fmt: skip
        try:
            return self._send(tx)
        except RpcError as exc:
            if "nonce too low" not in exc.rpc_message.lower():
                raise
            tx["nonce"] = self._nonce()
            return self._send(tx)

    def write(self, root: str) -> WriteResult:
        """Send the root; on any refusal return the reason (never raises)."""
        with self._lock:
            self._cache = None
            try:
                tx_hash = self._write_locked(root)
            except ChainRefusedError as exc:
                logger.warning("Proof root kept local: %s", exc.reason)
                if exc.reason == "rpc_down":  # spare the page a second slow call
                    down = ChainStatus("local", self.address, None, False, False, "rpc_down")
                    self._cache = (self._clock(), down)
                return WriteResult(None, exc.reason)
        logger.warning("Proof root sent to %s: %s", NETWORK_LABEL, tx_hash)
        return WriteResult(tx_hash)

    # Confirmation --------------------------------------------------------

    def receipt(self, tx_hash: str, timeout: float = RPC_TIMEOUT_S) -> Confirmation:
        """One receipt lookup. Unknown or unreachable stays 'sent'."""
        try:
            result = self._rpc("eth_getTransactionReceipt", [tx_hash], timeout)
            if not isinstance(result, dict):
                return Confirmation("sent")
            block = _hex_int(result.get("blockNumber"))
            ok = result.get("status") == "0x1"
        except ChainRefusedError:
            return Confirmation("sent")
        return Confirmation("verified" if ok else "failed", block)

    def confirm(self, tx_hash: str, wait_s: float = CONFIRM_WAIT_S) -> Confirmation:
        """Poll the receipt every 2 s for up to `wait_s` seconds."""
        attempts = max(1, math.ceil(wait_s / POLL_INTERVAL_S))
        for attempt in range(attempts):
            found = self.receipt(tx_hash)
            if found.status != "sent":
                return found
            if attempt < attempts - 1:
                self._sleep(POLL_INTERVAL_S)
        return Confirmation("sent")

    # Status --------------------------------------------------------------

    def _fresh_status(self, timeout: float) -> ChainStatus:
        try:
            self._check_chain(timeout)
            balance = self._balance(timeout)
        except ChainRefusedError as exc:
            wrong = exc.reason == "wrong_chain"
            reason: Reason = "wrong_chain" if wrong else "rpc_down"
            return ChainStatus("local", self.address, None, False, wrong, reason)
        low: Reason | None = "low_balance" if balance < MIN_SEND_WEI else None
        return ChainStatus("local" if low else "amoy", self.address, format_pol(balance),
                           balance < LOW_BALANCE_WEI, True, low)  # fmt: skip

    def status(self, timeout: float = 3.0) -> ChainStatus:
        """Wallet status, cached for 30 s so a slow RPC never slows the page."""
        now = self._clock()
        if self._cache is not None and now - self._cache[0] < STATUS_CACHE_S:
            return self._cache[1]
        fresh = self._fresh_status(timeout)
        self._cache = (now, fresh)
        return fresh


def local_status(settings: Settings) -> ChainStatus:
    """Status when no writer can be built: chain ID wrong, or key/RPC missing."""
    configured = bool(settings.proof_rpc_url and settings.proof_private_key)
    wrong = configured and bool(settings.proof_chain_id) and not settings.chain_enabled
    reason: Reason = "wrong_chain" if wrong else "no_key"
    return ChainStatus("local", None, None, False, False, reason)


def writer_for(settings: Settings) -> AmoyWriter | None:
    """The Amoy writer when the chain is fully configured, else None."""
    if not settings.chain_enabled:
        return None
    try:
        return AmoyWriter(settings.proof_rpc_url, settings.proof_private_key)
    except (ValueError, TypeError):
        # A malformed key. Never echo it: report only that it is unusable.
        logger.warning("PROOF_PRIVATE_KEY is not a valid key: proofs stay local")
        return None
