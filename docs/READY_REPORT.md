# Ready report (overnight run, 13 October 2026)

Read this first. Everything below was checked on this laptop; nothing was
pushed and no cloud account was touched.

## 1. Where things stand

- **master = deploy = b1d5424** at the time the gates ran (this report is a
  docs-only commit on top; master and deploy are fast-forwarded to it).
- **Stage 1, Seedha Site real mode:** merged (photos and one-tap generation,
  setup and review, addresses and sharing, the public hotel page). Reviews
  V1 to V3 fixed.
- **Stage 2, final readiness:** done.
  - Overview checklist: steps tick only from real actions in the current
    session, reset clears them (41e91de, D-103, tested).
  - Storage: hotel photos are stored in the database (site_photo); statement
    files are parsed in memory and only the parsed rows and a SHA-256 are
    kept; invoice PDFs are rebuilt from booking rows on request. Nothing lives
    only on the ephemeral disk.
  - Final audit: security and privacy (A1b), demo reliability (A2b), docs and
    honesty (A3b). The one medium finding (A1b-1, heavy uploads blocking the
    API) is fixed: statement uploads are rate limited (10 a minute) and both
    statement and photo uploads run in the thread pool. All A3b doc findings
    are fixed (README, README-dev, HOSTING, website copy, FAQ). Reports:
    `docs/agent-reports/final/`.
- **Stage 3, Hotel Site V2 + cards:** on its own branch `hotel-site-v2`
  (see docs/progress.md for its final state). Not part of master or deploy
  unless docs/progress.md says it was merged after passing every gate.

## 2. Claude check (local .env, names only)

| Variable | Set locally | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | everything below; empty means labelled samples |
| `CLAUDE_MODEL` | yes | statement rows from PDFs and unknown layouts, guest-name tie-breaks (0.6 to 0.8 only), Ask phrasing around computed numbers, win-back drafts, the inbox and assistant replies, Calendar "Add events" extraction |
| `SITE_GEN_MODEL` | yes | Seedha Site one-tap text (3 a day, `SITE_GEN_MONTHLY_TOKEN_CAP` default 300000) |
| `EVENT_SCAN_MODEL` | no | only the unfinished event-discovery branch |

Because `SITE_GEN_MODEL` is set, Generate on the laptop calls Claude (about
9 s, spends credit, 3 runs a day). Unset it for the instant labelled Sample.
Claude never writes a rupee figure: every money value is computed by code.

## 3. Gates (deploy at b1d5424, master identical)

- `make check`: passed. pylint 9.98 (app) and 9.99 (tests), API coverage 98%,
  money code 100%, pip-audit clean, web tests 205/205, npm audit gate passed,
  e2e 78/78, detect-secrets 0 in 212 commits, firmware build SUCCESS.
- e2e three runs in a row: 78/78, 78/78, 78/78.
- API suite on Postgres 16.2 (temporary local server, removed afterwards):
  1,309 passed, 0 failed.
- The 8-step loop on `make demo-prod` (Playwright, from fresh data each
  time): 3 of 3 passed.
- Demo data reset afterwards.

## 4. Push commands (you run these)

```bash
cd ~/Projects/seedha-real
git status                      # clean, on deploy
git log --oneline -1 master     # same commit as deploy
git log --oneline -1 deploy
git remote -v                   # add your GitHub remote first if empty:
# git remote add origin git@github.com:<you>/seedha.git
git push -u origin master
git push -u origin deploy
# optional, only if you want the stage 3 branch on GitHub too:
# git push -u origin hotel-site-v2
```

The commit email has not been rewritten (the no-reply address was never
given). If you want that, do it before the first push.

## 5. Railway (API and Postgres)

Full steps: docs/HOSTING.md sections 1 to 3. In short:

1. New project, Deploy PostgreSQL.
2. New, GitHub repo, this repository; branch `deploy`; Root Directory
   `apps/api`; config file `/apps/api/railway.json`.
3. Generate a domain: `https://<api>.up.railway.app`.
4. Variables (names only; values never go in the repo):

| Name | Secret | Note |
|---|---|---|
| `DATABASE_URL` | yes | `${{Postgres.DATABASE_URL}}` reference |
| `SEEDHA_ENV` | no | `production` |
| `SESSION_SECRET` | yes | same as Vercel |
| `OWNER_API_TOKEN` | yes | same as Vercel |
| `DESK_DEVICE_KEY` | yes | same as Vercel |
| `WEB_ORIGIN` | no | the Vercel https URL |
| `PUBLIC_BASE_URL` | no | the Vercel https URL |
| `PROOF_RPC_URL` | no | optional, Amoy testnet |
| `PROOF_CHAIN_ID` | no | optional, `80002` |
| `PROOF_PRIVATE_KEY` | yes | optional, testnet-only key |
| `ANTHROPIC_API_KEY` | yes | optional |
| `CLAUDE_MODEL` | no | optional, with the key |
| `SITE_GEN_MODEL` | no | optional, with the key |
| `SITE_GEN_MONTHLY_TOKEN_CAP` | no | optional, default 300000 |
| `SITE_ROOT_DOMAIN` | no | optional, only with a custom domain |
| `ALLOW_CLAUDE_FOR_DEMO` | no | leave empty |
| `ALLOW_DEMO_PROOF_WRITES` | no | leave empty |
| `ALLOW_OWNER_ACCOUNTS` | no | leave empty |

Do not set `PORT`. Leave WhatsApp and Razorpay unset (simulated).

5. Seed once, after the first healthy deploy:

```bash
railway login
railway link
railway ssh --service <api-service>
python -m seed.load
```

6. Health: `curl -s https://<api>.up.railway.app/health` returns
   `{"status":"ok", ...}`.

## 6. Vercel (web)

Full steps: docs/HOSTING.md section 4. Import the repo, production branch
`deploy`, Root Directory `apps/web`, Next.js, `npm ci`, `npm run build`,
Node 24.x.

| Name | Secret | Note |
|---|---|---|
| `API_BASE_URL` | no | the Railway URL |
| `SESSION_SECRET` | yes | same as Railway |
| `OWNER_API_TOKEN` | yes | same as Railway |
| `DESK_DEVICE_KEY` | yes | same as Railway |
| `SEEDHA_HOSTED` | no | `1` |
| `WEB_ORIGIN` | no | optional, the Vercel URL |
| `PUBLIC_CONTACT_EMAIL`, `PUBLIC_PRIVACY_EMAIL`, `PUBLIC_SECURITY_EMAIL` | no | optional role addresses |
| `SITE_ROOT_DOMAIN` | no | optional, same as Railway |

Never prefix a secret or `API_BASE_URL` with `NEXT_PUBLIC_`. Check
`https://<project>.vercel.app/api/health` returns the same JSON as Railway.

## 7. Post-deploy checklist

docs/HOSTING.md "Post-deploy checklist" items 1 to 8: health on both,
Direct beta login, the 8-step demo on the live URL (1,500 rows and 3
flagged; Rs 10,39,108 paid to channels; MakeMyTrip 1st to 5th; 12 repeat
guests and Rs 41,800; Desk consent on room 207; DEODAR-RS26; Savings Rs 2,233
avoided and Rs 2,199 net; "8 of 8 done"), Desk on a phone, proof on Amoy
only if funded, per-guest rate limits, no Claude spend for visitors, and
the Seedha Site checks.

## 8. Hackathon day

```bash
make demo-prod     # laptop demo: http://localhost:3000 (Direct beta login)
make demo-live     # public https link through a Cloudflare quick tunnel
make seed          # fresh sample data on the laptop (or Settings, Reset demo data)
# hosted reset before each judging slot (2 a minute):
curl -X POST -H "Authorization: Bearer <OWNER_API_TOKEN>" https://<api>.up.railway.app/demo/reset
```

Before presenting:
- Reset demo data so Home shows "0 of 8 done".
- On the website, click "Necessary only" on the cookie banner (it covers
  part of the Seedha Pass section at 1440 px).
- Proof shows "Local only" unless the Amoy RPC answers on the venue network.
- After rehearsing a site build, reset (the Website screen otherwise resumes
  at the setup step).
- Generate uses Claude while `SITE_GEN_MODEL` is set (3 a day).

## 9. Blockers and known lows

- Amoy RPC unreachable from this laptop: proofs stay "Local only" here.
- Commit email rewrite not done (no address was given).
- Event discovery is unfinished and stays on its own branch (not in the
  overnight brief).
- B14: "See Event Radar (Beta)" kept as your exact Pulse copy.
- Audit lows left open (none blocks the demo): A1b-2 (per-route limit on
  Claude routes; safe while `ALLOW_CLAUDE_FOR_DEMO` is empty), A1b-3 and
  A1b-4 (spelled-out amounts such as "two thousand" are not caught by the
  Ask and site text guards), A2b-5 (the "redeemed twice" e2e test depends on
  the loop test before it).
