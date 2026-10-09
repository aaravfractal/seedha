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

## B-002 ESP32 device build (M8) — PlatformIO registry download failing

`pio run -e seedha_desk` needs the `platformio/espressif32 @ 6.10.0`
platform (several hundred MB). Three attempts failed on the same download:
1. stalled with no progress (lock held, 1 MB cached);
2. broke at 50% ("Connection broken: BrokenPipeError(32, 'Broken pipe')"),
   then stalled while the Mac slept;
3. "Read timed out" from `dl.registry.nm1.platformio.org` on every mirror,
   ending in `PackageException: Could not install package
   'platformio/espressif32 @ 6.10.0' for 'darwin_arm64'`.

What works: the firmware core compiles and its 5 native tests pass under
`-Wall -Wextra -Werror` (`pio test -e native`), replaying a real API poll;
the bench mock server is tested from the API suite. `make check` runs the
device build as part of `check-firmware`, so it stays red until this clears.

To unblock: run `make firmware` on a stable connection (one-time download),
then fix any warnings it reports in `src/main.cpp`. I will retry in M11.
