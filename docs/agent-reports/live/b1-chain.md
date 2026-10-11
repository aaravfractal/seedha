# B1 Chain writer (Polygon Amoy testnet) - 11 Oct 2026

## Files changed (worktree live/proof-api, not committed)
- apps/api/app/services/chain.py (new): AmoyWriter, WriteResult, Confirmation, ChainStatus,
  local_status, writer_for. Chain guard (eth_chainId == 0x13882), balance floor 0.002 POL and
  balance >= gas*maxFee, pending nonce under a threading.Lock with one retry on "nonce too low",
  EIP-1559 type 2 to own address, value 0, data = 0x+root, tip = max(node, 30 gwei),
  maxFee = 2*baseFee + tip, gas = eth_estimateGas or 30000. 10 s timeouts. Every error returns
  a reason; nothing raises to the owner; the key and raw tx are never logged.
- apps/api/app/services/proof.py: ChainWriter protocol now write() -> WriteResult, confirm(),
  receipt(); LocalOnly(reason); write_bundle sets "sent" when a tx exists; new publish_bundle
  (write, commit, poll receipt 2 s x 10), recheck_sent, apply_confirmation.
- apps/api/app/routers/proof.py: BundleOut + chain_block, network_label; ProofOut + chain
  (ChainOut). One writer per app in app.state.chain_writer (status cache 30 s). GET /proof
  re-checks "sent" bundles once (3 s timeout), skipped while the RPC is known down.
- apps/api/app/config.py: proof_chain_id (PROOF_CHAIN_ID); chain_enabled needs URL, key and
  "80002"; proof_private_key is field(repr=False). web_origin line untouched.
- apps/api/app/models.py: ProofBundle.chain_block. Migration 0010_proof_chain_block.py
  (also maps the old unused "written" status to "sent").
- apps/api/app/jobs.py: nightly job uses writer_for(settings) and publish_bundle.
- apps/api/pyproject.toml: eth-account==0.14.0, hexbytes==2.0.0.
- scripts/proof_wallet.py (new), apps/api/tests/test_chain.py (new, 31 tests).

## Pins installed into the shared venv (wheels only, matches r1-chain.md exactly)
eth-account 0.14.0, eth-keys 0.8.0, eth-keyfile 0.10.0, eth-rlp 3.0.0, rlp 5.0.0, eth-utils 6.0.0,
eth-typing 6.0.0, eth-hash 0.8.0, eth-abi 6.0.0, hexbytes 2.0.0, bitarray 3.12.0, ckzg 2.1.8,
cytoolz 1.2.0, toolz 1.2.0, py_ecc 8.0.0, pycryptodome 3.24.0, parsimonious 0.10.0,
regex 2026.9.29. pip-audit: no known vulnerabilities. Nothing else upgraded or removed.
B-001 in docs/blockers.md can be closed by the lead.

## .env.example lines for the lead
PROOF_RPC_URL=
PROOF_PRIVATE_KEY=
PROOF_CHAIN_ID=
(Comment suggestion: "Polygon Amoy testnet only. PROOF_CHAIN_ID must be 80002. Create the
key with: apps/api/.venv/bin/python scripts/proof_wallet.py")

## API contract (for B2)
- bundle.chain_status: "stored" | "sent" | "verified" | "failed"; chain_block int | null;
  network_label "Polygon Amoy testnet" when chain_tx exists else null; explorer_url unchanged.
- proof.chain: {mode, network_label, address, balance_pol, low_balance, reason, address_url}.
  mode is "amoy" only when configured AND reachable AND right chain AND balance >= 0.002 POL;
  otherwise "local" with reason. low_balance (< 0.01 POL) can be true while mode is "amoy".
  address is shown whenever a key is configured (even if the RPC is down). chain_live ==
  (mode == "amoy").
- Consent proof_status unchanged: pending -> verified when sealed in a bundle (local root),
  whatever the chain outcome. A "failed" tx leaves consents verified locally.

## How to verify
cd apps/api && .venv/bin/pytest -q tests/test_chain.py, then the full check-api list. All passed:
ruff, ruff format, mypy strict (118 files), pylint 9.96 app / 9.98 tests, pytest coverage 97.98%
(chain.py 100%), money coverage 100%, bandit clean, pip-audit clean, detect-secrets clean.
Manual (lead, after merge on master): apps/api/.venv/bin/python scripts/proof_wallet.py, fund the
printed address at https://faucet.polygon.technology, restart the API, Write tonight's proof.

## Open issues
- `apps/api/.venv` symlink shows as untracked in this worktree, so `git ls-files -co` in the
  Makefile's detect-secrets line picks it up here; I excluded it when scanning. Not on master.
- The shared venv's editable install still points at the main checkout; `pip install -e` was not
  re-run (pins are already installed).
- POST /proof/bundle can take up to ~20 s while waiting for the receipt; the UI should show a
  busy state. Live Amoy fees/chain id were never contacted (all mocked, per the rules).
- Pre-existing pylint W0621 in services/proof.py (fingerprint shadowing) left as is.
