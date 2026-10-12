# Hosting security review (deploy branch, read-only, 12 Oct 2026)

Scope: master...deploy (38 files), docs/HOSTING.md, H1-H3 reports, CLAUDE.md section 2.
tests/test_hosting.py: 45 passed. No servers or network calls were run.

## Verified, no finding
- Secrets: `.env` and `apps/web/.env*` are ignored. A git grep for Anthropic, Razorpay, Meta,
  AWS and GitHub keys, 0x/64-hex keys and credentialed DB URLs finds only test fixtures
  (`u:p@...`) and the CI throwaway `seedha-ci-only`, which is scoped to the job's service container.
  `.env.example` holds only the published demo values. Production refuses all three, and the
  new variables are empty. railway.json, requirements.txt and the workflow hold no secrets.
- Logs: refusals log `<VARIABLE> <problem>` only (config.py:115-135, main.py:84-88). The startup
  line has booleans only. Alembic and SQLAlchemy mask the URL password. Nothing logs `Settings`.
- Production refusal: missing, demo, "change-me" and <32-char secrets are refused. Origins must be
  https with no `*`. SQLite is refused, and so is an unset DATABASE_URL (it falls back to SQLite).
  OTP banner forced off. Web: `loginSecretsProblem` and `deviceKeyUsable` refuse demo values in a
  production build.
- Headers: next.config.ts is unchanged (CSP `connect-src 'self'`, frame-ancestors, nosniff,
  Referrer-Policy). No `NEXT_PUBLIC_*` anywhere. The BFF forwards only content-type and accept,
  sets `x-seedha-subject` from the signed cookie and refuses unlisted paths. `auth/mode` needs a
  session and returns one boolean.
- CORS: production allows only the checked https list, with no credentials.
- API routes reachable without the owner token (enumerated from the app): `/health`;
  GET/POST `/public/consent/{token}` (43-char token); POST `/public/data-deletion` (ref+phone);
  GET `/public/sample` (in-memory); GET `/public/link`, POST `/public/link/book`;
  GET `/public/site/{slug}` and `/availability`; GET/POST `/webhooks/whatsapp`
  (verify token / HMAC, 503 without secret); `desk/poll`, `desk/ack` (device key). All are
  intended and rate-limited. `/auth/*` needs the owner token.
- Public mode: Claude only for real owners or with the flag (deps.get_settings, may_spend).
  Proofs stay local for demo sessions. Reset gives 403 to any session that is not a real owner;
  the token alone (operator) works. OTP and sign-up are off. The sample hotel always uses
  SimulatedSender. `require_subject_access` keeps the demo subject off non-sample data.
- Chain: chain.py has no diff. The `eth_chainId` == 0x13882 check runs before every send, and
  `chain_enabled` requires PROOF_CHAIN_ID 80002.
- Postgres: the only raw `text()` is the test TRUNCATE (table names from metadata). URL
  normalising keeps the query string (sslmode). Migration 0013 only widens a column.
  `seed.load` refuses a non-empty DB.

## Findings

| id | sev | file:line | problem | smallest fix |
|---|---|---|---|---|
| S-H1 | medium | apps/api/railway.json:7, app/ratelimit.py:96 | With `--forwarded-allow-ips='*'`, uvicorn takes the left-most X-Forwarded-For, so anyone calling the public Railway URL directly picks their own client address. Per-client limits on consent, link, link_book, data_deletion, site and public_sample are bypassed. One script can fill the 20x global ceilings and give every real guest coming through the BFF a 429 during judging (for example consent at 400 a minute). | Make the BFF send a proxy secret header (or an HMAC of OWNER_API_TOKEN). The API should trust X-Forwarded-For only when that header is valid. Otherwise key on the right-most hop that Railway adds (drop `--proxy-headers` and use a small middleware). |
| S-H2 | low | app/main.py:106 | `/docs`, `/redoc` and `/openapi.json` are public on the Railway URL, which maps every route for a direct caller. | `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)` when `settings.production`. |
| S-H3 | low | app/public_mode.py:116-118 | The Desk print limit (6 a minute) is per client only, with no global ceiling. Any Direct-beta visitor, from many addresses, can flood the print command queue that a real Desk polls. | Add `limiter.check(PRINT_BUCKET, "*", Limit(6*GLOBAL_FACTOR, 60))`, as in `rate_limited`. |
| S-H4 | low | apps/web/lib/webEnv.ts:70-72 | `SEEDHA_DEMO=1` on Vercel turns off the web's demo-secret and short-secret refusal. The API never checks the web's SESSION_SECRET, so a demo SESSION_SECRET would let anyone forge sessions. Only the guide stops this. | Make strict mode ignore SEEDHA_DEMO when `SEEDHA_HOSTED=1` or `VERCEL=1`. |
| S-H5 | low | apps/api/app/config.py:52-64 | The `Settings` repr includes owner_api_token, desk_device_key, anthropic_api_key, whatsapp_*, razorpay_key_secret and database_url (password). Nothing logs it today, but one log line or error reporter with locals would leak them. | Add `field(repr=False)` on every secret field (proof_private_key and session_secret already have it). |
| S-H6 | low | apps/api/requirements.txt:4-14 | Most runtime dependencies are `>=` ranges, so each Railway build resolves new versions that pip-audit never saw. | Pin `==` to the audited venv versions (`pip freeze`), keeping the drift test. |
| S-H7 | low | .github/workflows/api-postgres.yml:46-47 | Actions are pinned by tag (`checkout@v4`, `setup-python@v5`), not by commit SHA. | Pin both to full SHAs. |
| S-H8 | low | docs/HOSTING.md:84-88 | The laptop seed puts `DATABASE_PUBLIC_URL` (with its password) on the command line and in shell history. psycopg defaults to `sslmode=prefer` over Railway's public proxy. Sealed variables (DESK_DEVICE_KEY) are not injected by `railway run`, so that path registers no Desk device. | Recommend `railway ssh` only. If the laptop path stays: `read -s` the URL, append `?sslmode=require`, and pass DESK_DEVICE_KEY. |
| S-H9 | low | docs/HOSTING.md:127-140 | The Vercel table marks secrets but does not say to use Vercel's "Sensitive" type, or to scope them to Production only. Preview builds of other branches would otherwise get the live token. | Add: "Type Sensitive, Environment Production only". |
| S-H10 | low | docs/HOSTING.md:42-45 | Per-guest limits depend on Railway appending (not replacing) X-Forwarded-For. This is unverified (H2), and the checklist does not test it. | Add a checklist step: two phones on different networks each get their own consent and link allowance. |

High: none. Medium: S-H1.
