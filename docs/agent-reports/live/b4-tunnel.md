# B4 · LAN and public link (status: done, not committed)

Worktree `.worktrees/tunnel`, branch `live/tunnel`. config.py untouched.

## Files changed
- `Makefile`: `demo-lan`, `demo-live` targets (thin, `bash scripts/...`), both in `make help`.
- `scripts/demo-common.sh` (new, sourced): load .env then let exports win, seed, build,
  start API on 127.0.0.1:8000, wait for http, `stop_all` (trap, `kill 0`, removes the log).
- `scripts/demo-lan.sh` (new): Wi-Fi IP from en0 or en1 (clear error), PUBLIC_BASE_URL and
  WEB_ORIGIN = `http://$IP:3000`, `next start -H 0.0.0.0 --port 3000`, prints owner, Desk device,
  guest URLs.
- `scripts/demo-live.sh` (new): `brew install cloudflared` hint + exit 1 when missing (before
  anything starts or any trap is set); fresh OWNER_API_TOKEN, SESSION_SECRET (64 hex),
  DESK_DEVICE_KEY via openssl, never printed; SEEDHA_PUBLIC=1, SEEDHA_DEMO empty; warns on
  `~/.cloudflared/config.yml`; tunnel log in `.cache/demo-live/` (already gitignored by `.cache/`,
  so .gitignore unchanged); polls the log for the URL (30 s, log tail on failure); then seed,
  build, API, `next start -H localhost --port 3000`; prints URLs, terminal QR, SLA and new-URL
  warnings. QR uses `qrcode --small URL`: the installed CLI rejects `-t terminal` (choices are
  png, svg, utf8) and prints to the terminal by default.
- `apps/web/lib/requestOrigin.ts` (new) + `requestOrigin.test.ts`: `cookieSecure` (Secure on
  https or x-forwarded-proto https; never on http for localhost, 127/8, ::1, 10/8, 172.16/12,
  192.168/16, *.local; production on other hosts keeps Secure, S12), `isLocalRequest`
  (Host localhost:3000 or 127.0.0.1:3000, no cf-connecting-ip or cf-ray, x-forwarded-host
  equals Host), `refuseRemoteReset`.
- `apps/web/lib/authServer.ts`: `isSecure` now uses `cookieSecure` with the Host and
  x-forwarded-proto (the LAN login bug from r2).
- `apps/web/app/api/[...path]/route.ts`: 403 `reset_local_only` for demo/reset when
  SEEDHA_PUBLIC=1 and the request is not local.
- `apps/api/app/routers/site.py`: `local_reset_only` dependency (runs first) refuses reset when
  SEEDHA_PUBLIC=1 and request.client is not loopback; `is_loopback` helper. Reads the env
  directly (no config.py change).
- `apps/web/components/settings/HotelTabs.tsx`: Reset section shown only when the page host is
  loopback (`useSyncExternalStore`, hidden during SSR).
- `.env.example`: `PUBLIC_BASE_URL=` and `SEEDHA_PUBLIC=` with comments.
- `README-dev.md`: "Phone demo on Wi-Fi (make demo-lan)" and "Public link (make demo-live)".
- Tests: `apps/api/tests/test_public_reset_guard.py`, `apps/api/tests/test_demo_scripts.py`
  (URL regex incl. skipping api.trycloudflare.com, stub cloudflared on PATH, give-up path,
  missing-cloudflared hint and exit 1, no secret echoed). Subprocesses run in a new session.

## How to verify
- Gates run here: tsc, eslint, prettier, node tests (90 pass), ruff, format, mypy, pylint
  9.96, pytest with coverage 97.9%, money coverage 100%, detect-secrets: all pass.
- Sanity run on 3840/8840 (production build, then stopped): POST /api/auth/demo with
  Host 192.168.0.106:3840 → cookie without Secure; with x-forwarded-proto https → Secure;
  Host seedha.example over http → Secure. BFF reset with tunnel headers → 403
  reset_local_only. API reset with remote XFF → 403, from loopback → 200. /settings without a
  cookie → 307 to /login.

## Open issues
- Pre-existing failure, not mine: `lib/personal-data.test.ts` flags
  `docs/LIVE_FEATURES.md:107` (a blocked personal word in the committed brief). The lead
  should reword that line.
- `next build` with Turbopack fails inside a worktree whose node_modules is a symlink
  ("symlink target leaves the configured filesystem roots"). I used `next build --webpack`
  for the sanity run only; the scripts use plain `next build`, which works in the main checkout.
- The Reset button is now hidden on any non-loopback host (LAN phones and any real domain),
  not only in public mode. The API and BFF guards apply only when SEEDHA_PUBLIC=1.
- shellcheck is not installed; scripts pass `bash -n` and are written for bash 3.2 (no `wait -n`).
- Playwright not run (ports 3001/8001 off limits); e2e uses localhost, so Reset stays visible.
- Real tunnel never started; the lead or owner runs `make demo-live` for the manual check.
