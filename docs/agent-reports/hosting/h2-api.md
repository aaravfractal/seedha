# H2 API deployment (Railway + Railway Postgres): status

Status: done, uncommitted in worktree h2 (branch deploy-h2). No Render or Neon files.

## Changes
- `apps/api/railway.json`: builder RAILPACK; start `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`; healthcheckPath `/health` (timeout 300 s); restart ON_FAILURE, 5 retries.
- `apps/api/.python-version` (3.12) and `apps/api/requirements.txt` (mirrors pyproject dependencies; a test fails on drift, so H1's Postgres driver must go in both).
- `app/main.py`: module-level `app = LazyApp()` builds the app on first use (nothing happens at import). An unsafe production config fails the lifespan startup, so uvicorn exits. `--factory app.main:create_app` (Makefile) works as before.
- `app/config.py`: `SEEDHA_ENV=production`. The API refuses to start, and logs only the variable name, if SESSION_SECRET, OWNER_API_TOKEN or DESK_DEVICE_KEY is missing, is a .env.example demo value or contains "change-me", or is under 32 characters; if WEB_ORIGIN/PUBLIC_BASE_URL is not all https or contains `*`; or if DATABASE_URL is SQLite. CORS uses the comma list from PUBLIC_BASE_URL + WEB_ORIGIN. The OTP demo banner is forced off.
- `app/public_mode.py`, `deps.py`, `routers/proof.py`: in production every client counts as remote, so loopback grants nothing. Claude and testnet writes are used only by a real owner (bearer token + verified account in OWNER_PHONES + ALLOW_OWNER_ACCOUNTS=1), or by everyone when ALLOW_CLAUDE_FOR_DEMO=1 / ALLOW_DEMO_PROOF_WRITES=1. Demo proofs stay local with reason `public_mode`. Desk printing stays open, limited to 6 a minute. The chain guard is untouched.
- `routers/site.py`: in production, reset refuses any session that is not a real owner (`403 reset_owner_only`, including the demo subject). A token call with no session (the operator) is allowed. The existing limit of 2 a minute applies.
- `routers/auth.py`: in production, OTP request, verify and sign-up return `403 accounts_off` unless ALLOW_OWNER_ACCOUNTS=1. Direct beta login works.
- `.env.example`: SEEDHA_ENV, ALLOW_OWNER_ACCOUNTS, ALLOW_CLAUDE_FOR_DEMO, ALLOW_DEMO_PROOF_WRITES, plus API_BASE_URL and SEEDHA_HOSTED for H3. All empty.
- `tests/test_hosting.py`: 45 tests. The rest of the suite is unchanged and passes with SEEDHA_ENV unset.

## Client address behind Railway
Chain: browser -> Vercel BFF (sets X-Forwarded-For to the client) -> Railway edge (appends its hop) -> API. uvicorn's default trusts only 127.0.0.1, but the API's peer is Railway's proxy, whose address is not fixed. Without `--forwarded-allow-ips='*'` every guest would share one rate-limit bucket. With `*`, uvicorn takes the left-most entry, which is the address the BFF set. A direct caller can forge that entry, but in production that only picks their own per-client bucket: the 20x global ceiling still applies, and a forged 127.0.0.1 gets no Claude, no chain write and no reset. Tested through uvicorn's ProxyHeadersMiddleware.

## Railway steps (for docs/HOSTING.md)
1. railway.com -> New Project -> Deploy PostgreSQL (adds service "Postgres").
2. In the same project: New -> GitHub Repo -> this repo. Service Settings -> Source: branch `deploy`, Root Directory `apps/api`. Config-as-code file path: `/apps/api/railway.json` (it does not follow the root directory).
3. Variables (API service). Paste secrets as sealed variables. Never commit them.

| Name | Secret | Example format | Purpose |
|---|---|---|---|
| DATABASE_URL | ref | `${{Postgres.DATABASE_URL}}` | Railway Postgres (postgresql://, H1 normalises) |
| SEEDHA_ENV | no | `production` | Hosted safety checks |
| OWNER_API_TOKEN | yes | 64 hex (`openssl rand -hex 32`) | BFF -> API owner auth; same value on Vercel |
| SESSION_SECRET | yes | 64 hex | Same value as Vercel; the API only checks it is safe |
| DESK_DEVICE_KEY | yes | 64 hex | Desk auth; same on Vercel; seeded as a hash |
| WEB_ORIGIN | no | `https://seedha.vercel.app` | CORS (comma list ok, https only) |
| PUBLIC_BASE_URL | no | `https://seedha.vercel.app` | QR and guest links (first entry) |
| DEMO_DATE | no | `2026-10-13` (optional) | Sample in-house date (after 30 Sep 2026) |
| ANTHROPIC_API_KEY / CLAUDE_MODEL | yes / no | `sk-ant-...` / model id (optional) | Claude; demo visitors get it only with the flag |
| ALLOW_CLAUDE_FOR_DEMO | no | empty or `1` | Let visitors spend Claude credits |
| PROOF_RPC_URL / PROOF_PRIVATE_KEY / PROOF_CHAIN_ID | no / yes / no | https Amoy RPC / testnet-only key / `80002` | Optional Amoy writes |
| ALLOW_DEMO_PROOF_WRITES | no | empty or `1` | Let visitors' proofs go on chain |
| ALLOW_OWNER_ACCOUNTS / OWNER_PHONES | no | empty / `98xxxxxxxx` | Real owner sign-in (off for the demo) |
| WHATSAPP_*, RAZORPAY_* | yes | empty | Empty = simulated |

Do not set PORT; Railway sets it. If the build log shows a Python other than 3.12, set RAILPACK_PYTHON_VERSION=3.12.
4. Settings -> Networking -> Generate Domain -> `https://<name>.up.railway.app`. This is Vercel's API_BASE_URL.
5. Seed once. This is a fresh start; it refuses a database that already has data, so it never wipes anything. Use `railway login && railway link`, then `railway ssh --service <api service>` and run `python -m seed.load` in the container. Alternative from your laptop in apps/api: `railway run --service <api service> sh -c 'DATABASE_URL="<Postgres DATABASE_PUBLIC_URL>" .venv/bin/python -m seed.load'`. A plain `railway run` injects the internal URL, which your laptop cannot reach.
6. Verify: `curl -s https://<name>.up.railway.app/health` returns `{"status":"ok",...}` (simulated/live per integration). The deploy log shows "PRODUCTION mode: sample hotel only..." and never a secret. A refusal reads "Refusing to start in production: <VARIABLE> <problem>".
7. Fresh demo data later: `curl -X POST -H "Authorization: Bearer $OWNER_API_TOKEN" https://<name>.up.railway.app/demo/reset` (2 a minute, accounts kept). In-app reset works only for a real owner account.
8. Roll back: API service -> Deployments -> pick the last good deployment -> Redeploy. Migrations only go forward, so if the bad deploy added one, restore the database too: Postgres service -> Backups (if your plan has them; take one before each deploy), or `pg_dump` / `pg_restore` with DATABASE_PUBLIC_URL.

## Notes for the lead and H3
- The web login should show the API's message for `403 accounts_off`, and reset for `403 reset_owner_only`.
- Unverified (no Railway access): Railpack picks requirements.txt and reads .python-version; Railway's proxy appends to X-Forwarded-For. Check on the first deploy: rate limits are per guest when two phones each get their own allowance.
