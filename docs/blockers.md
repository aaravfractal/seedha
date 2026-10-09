# Blockers

## B-001 Polygon Amoy write (M7) — fallback in place

`eth-account` (needed to sign the testnet transaction that carries the nightly
Merkle root) cannot be installed in this environment: pip reports
"ResolutionImpossible" because every eth-account version depends on
`bitarray>=2.4`, which does not resolve here (Python 3.12, macOS arm64).

Tried: `pip install eth-account` (all versions 0.5 to 0.14 rejected).
Not done on purpose: hand-written transaction signing (untested crypto).

Fallback: the Merkle root of every bundle is computed, stored and verifiable
in the app; the UI says "Stored by Seedha. Not yet on a public chain." and
the API reports `proof_chain: simulated`.

To unblock: provide `PROOF_RPC_URL` and a funded Amoy test key, and allow a
web3 dependency (eth-account or web3.py) on a machine where it installs; the
chain step is isolated in `app/services/proof.py` (`ChainWriter`).
