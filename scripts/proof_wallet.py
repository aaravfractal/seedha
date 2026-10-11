"""Create the Seedha proof wallet (Polygon Amoy testnet only).

Run with the API venv:  apps/api/.venv/bin/python scripts/proof_wallet.py [path/to/.env]

Writes a fresh key to .env as PROOF_PRIVATE_KEY (and PROOF_CHAIN_ID=80002 and
the public Amoy RPC URL if they are missing), sets the file to mode 0600 and
prints ONLY the public address and the faucet URL. The key is never printed
or logged. Refuses if PROOF_PRIVATE_KEY already has a value.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from eth_account import Account

DEFAULT_ENV = Path(__file__).resolve().parent.parent / ".env"
FAUCET_URL = "https://faucet.polygon.technology"
DEFAULTS = {
    "PROOF_CHAIN_ID": "80002",
    "PROOF_RPC_URL": "https://rpc-amoy.polygon.technology",
}


def _values(lines: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for line in lines:
        name, sep, value = line.partition("=")
        if sep and not line.lstrip().startswith("#"):
            found[name.strip()] = value.strip().strip("'\"")
    return found


def create_wallet(env_path: Path) -> str:
    """Append a new key to env_path and return the wallet's public address."""
    text = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    lines = text.splitlines()
    values = _values(lines)
    if values.get("PROOF_PRIVATE_KEY"):
        raise SystemExit("PROOF_PRIVATE_KEY already has a value; nothing changed.")
    account = Account.create()
    key = account.key.hex()
    key = key if key.startswith("0x") else f"0x{key}"
    # An empty PROOF_PRIVATE_KEY= line (from .env.example) is replaced in place.
    lines = [line for line in lines if line.partition("=")[0].strip() != "PROOF_PRIVATE_KEY"]
    lines.append(f"PROOF_PRIVATE_KEY={key}")
    for name, value in DEFAULTS.items():
        if not values.get(name):
            lines = [line for line in lines if line.partition("=")[0].strip() != name]
            lines.append(f"{name}={value}")
    # Create with 0600 before any secret is written.
    fd = os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    env_path.chmod(0o600)
    address: str = account.address
    return address


def main(argv: list[str]) -> None:
    """CLI entry point: prints only the address and the faucet URL."""
    env_path = Path(argv[1]).resolve() if len(argv) > 1 else DEFAULT_ENV
    address = create_wallet(env_path)
    print(f"Proof wallet address (Polygon Amoy testnet): {address}")  # noqa: T201
    print(f"Fund it with test POL: {FAUCET_URL}")  # noqa: T201


if __name__ == "__main__":
    main(sys.argv)
