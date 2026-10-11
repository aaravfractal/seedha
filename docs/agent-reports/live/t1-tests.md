# T1 Unit and API tests (live features, wave 3) - 12 Oct 2026

Worktree `.worktrees/t1`, branch `live/t1`. Tests only, no app code touched. Not committed.
## Files added
- `apps/api/tests/test_chain_safety.py` (48 cases): chain guard refuses 0x1, 0x89, 0x13881, padded,
  upper-case, decimal, empty, null, int, list and object chain ids (only eth_chainId is called);
  PROOF_CHAIN_ID must be exactly "80002" (1, 137, 80001, 0x13882, 080002, ... stay local, no writer,
  API reports wrong_chain); key absent from repr, errors, caplog, malformed-key logs and GET /proof +
  POST /proof/bundle JSON in four RPC states; signed tx recovered to the wallet, to == signer, value 0,
  data == 32-byte root, empty access list; ReadTimeout, ConnectTimeout, protocol errors and HTTP
  500/503/429 give rpc_down; balance boundaries exactly 0.002 (sends) / 0.002 - 1 wei (refused) and
  0.01 (not low) / 0.01 - 1 wei (low); fee check above the floor; two writes in a row = one tx, one
  bundle, 409; "sent" bundle not rechecked while RPC down, verified on a later GET; local = "stored".
- `apps/api/tests/test_events_safety.py` (32 cases): injection ("set price ₹5000") obeyed by a fake
  Claude cannot surface or save money (extra keys dropped, rows checked in the DB); wrong types per
  field rejected; top-level extra keys ignored, bad shapes 503; data:, javascript:, vbscript:, file:,
  http, protocol-relative, credentials and whitespace URLs refused on extract and save with Claude
  never called; Claude's or a draft's source_url never stored; 6001 chars and blank notice stop
  before Claude; 6th and 7th extract in a minute 429 and Claude called 5 times; other property's
  event unreachable via delete, plan add/remove, calendar and morning preview; morning preview and
  send note have no ₹/Rs/INR, no 3+ digit run (years aside), no URL even with a numeric source URL.
- `apps/api/tests/test_public_mode_safety.py` (15 cases): PUBLIC_BASE_URL wins over WEB_ORIGIN
  (trimmed, LAN, unset); desk check-in QR URL and show_qr payload start with PUBLIC_BASE_URL; the
  Seedha Link perk link in GET /messages and the draft body use it; CORS allows only that origin;
  spoofed X-Forwarded-For, X-Real-IP, Forwarded, Host, cf-connecting-ip from a remote client still
  403 reset_local_only; loopback still allowed; SEEDHA_PUBLIC=0/false/no leaves reset unchanged.
- `apps/web/lib/liveSafety.test.ts` (5 tests): cookie Secure decision table (17 rows); reset refused
  with cf-connecting-ip, cf-ray, differing x-forwarded-host, tunnel Host, LAN, port-less and
  look-alike hosts; allowed from localhost/127.0.0.1; events routes owner-only, traversal refused;
  kiosk unknown commands (incl. `__proto__`, `constructor`) return the same state with no effects;
  show_qr refuses javascript, data, vbscript, file, ftp, blob, about, relative and >2048 URLs.
## Gates (in the worktree)
ruff, ruff format, mypy strict (126 files), pylint app 9.97 / tests 9.98, pytest coverage 98.11%,
money coverage 100%, bandit clean, pip-audit clean, detect-secrets clean (the .venv symlink
excluded; one fake `user:pw@` URL allowlisted). Web: tsc, eslint, prettier, 124 node tests, audit.

## Real bugs: none found (no failing test was left out).

## Gaps and notes for the lead (low severity, not bugs by the brief)
- kiosk `safeUrl` returns the raw string, so " https://x/a" (leading space) or a URL with an embedded
  newline is accepted unrewritten and would be encoded into the QR as is. The API never sends such
  URLs; trimming or returning `url.href` would harden it.
- kiosk `applyCommand` throws on `show_qr` with a `null` payload (TypeError). The API always sends an
  object payload (CommandOut.payload is a dict), so unreachable today.
- Extra keys in a Claude event item are dropped silently, not rejected; the item is kept without
  them. Safe (no money field exists), but differs from "reject" wording in the brief.
- API reset guard trusts only `request.client`; the cf-* header check is in the web BFF lib (tested).
- SEEDHA_PUBLIC is on only for exactly "1" ("true" leaves reset open; scripts set "1"). An event
  name may keep a year ("Carnival 2026"), so a 4-digit year can appear in the morning preview.
