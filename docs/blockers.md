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

## B-002 ESP32 device build (M8) — resolved in M11

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

M11 update: the platform installed on the fourth attempt (M9); the Xtensa
toolchain (`espressif/toolchain-xtensa-esp32 @ 8.4.0+2021r2-patch5`, 92 MB)
then stalled at "Downloading 0%" twice for over 15 minutes each. The same
file downloads fine with curl (about 400 KB/s from the registry's mirror),
so the stall is in PlatformIO's downloader, not the network.

Resolved: with the PlatformIO core moved into the repo (B-003) the platform
and toolchain downloaded on the next attempt. The build then failed once on
TFT_eSPI's "TOUCH_CS not defined" `#warning` (our -Werror applies because
main.cpp includes the header); the board has no touch panel, so
`-DDISABLE_ALL_LIBRARY_WARNINGS=1` turns off that library's setup notices.
`pio run -e seedha_desk`: SUCCESS, zero warnings, RAM 14.5%, flash 74.8%.

## B-003 Files written outside the repo (M8) — needs Aarav

PlatformIO stores platforms and toolchains in `~/.platformio` unless told
otherwise, and I did not redirect it in M8. It created `~/.platformio`
(about 20 MB: the espressif32 and native platforms, SCons, a download cache)
on 9 Oct 2026 at 20:46. That breaks the rule against writing outside the
repo folder. Setting up pre-commit also created `~/.cache/pre-commit` (56 KB).
Installs also added entries to the npm, pip and Playwright caches, which
already existed in the home folder before this project.

Fixed for the future: the Makefile now sets `PLATFORMIO_CORE_DIR` to
`firmware/seedha-desk/.pio-core` (gitignored), so firmware builds stay
inside the repo. I have not deleted `~/.platformio` or `~/.cache/pre-commit`,
because deleting outside the repo is also off-limits. Aarav: remove them
if you want (`rm -rf ~/.platformio ~/.cache/pre-commit`); nothing in the
repo needs them now.
