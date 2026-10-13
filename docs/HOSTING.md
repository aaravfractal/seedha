# Hosting brief (saved word for word, 12 October 2026)

The step-by-step hosting guide follows this brief once the build is done.

**Change of plan (owner, same day):** Railway instead of Render and Neon.
The API and its Postgres both run in one Railway project (DATABASE_URL from
Railway's reference variable); the web stays a new Vercel project with
API_BASE_URL set to the Railway service URL. Railway config (railway.json
or Procfile) for apps/api with Python 3.12, start command "alembic upgrade
head && uvicorn app.main:app --host 0.0.0.0 --port $PORT" and the existing
health check; the one-off seed runs with Railway's run feature. No Render
files remain. Everything else in the brief below stands.

HOSTING BUILD: VERCEL (WEB) + RENDER (API) + NEON (POSTGRES)
Work on a new branch "deploy". Do not change master's demo behaviour,
money code or locked numbers. Do not create cloud accounts or push; I do
those. Save this brief to docs/HOSTING.md and commit on the branch.

TEAM (only the lead commits; max 3 background agents; status files in
docs/agent-reports/hosting/)
- H1 Postgres compatibility: make the API run on Postgres as well as
  SQLite via DATABASE_URL. Fix any SQLite-only SQL, types or migrations.
  Add a GitHub Actions workflow that runs the full API test suite against
  a Postgres service container on every push, so compatibility is
  proven without installing Postgres locally.
- H2 API deployment: render.yaml (or a Dockerfile) for apps/api with
  Python 3.12, start command running alembic upgrade head then uvicorn on
  $PORT, health check on the existing health endpoint, a one-off seed
  command for the sample hotel, and production settings: CORS and allowed
  origins from env, secure cookies, rate limits on, sample hotel only,
  "Reset demo data" disabled in production except for a logged-in owner,
  public visitors never trigger paid Claude calls.
- H3 Web deployment: Vercel settings for apps/web (root directory,
  build command, Node version) in docs/HOSTING.md; the web app calls the
  API only through its server-side proxy using API_BASE_URL and the API
  token from env, so browsers never talk to the API directly;
  PUBLIC_BASE_URL set to the Vercel URL for QR and guest links.
- Then a read-only security reviewer: secrets only in host env vars,
  nothing secret in the repo, headers, CORS, rate limits, public-mode
  safety, testnet-only chain guard.

DELIVER
1. docs/HOSTING.md: step-by-step for me with screenshots-free plain
   steps: create the Neon database; create the Render service from the
   repo and branch; create a new Vercel project from the repo and branch
   with root apps/web; the exact list of environment variables for each
   service (names, which are secret, example formats, never real values);
   how to run the seed once; how to verify; how to roll back.
2. A post-deploy checklist: health check passes, Direct beta login,
   the full 8-step demo on the live URL, Desk on a phone via the live URL,
   proof write on Amoy if the wallet is funded.
3. make check and the Postgres CI workflow passing on the branch.
Commit locally on "deploy" and give me a 6-line summary.

---

# Hosting guide: Railway (API and Postgres) and Vercel (web)

Plain steps, in order. You create the accounts and push; nothing here
creates them for you. Never paste a real secret into a file in this repo:
secrets live only in the Railway and Vercel variable screens.

## 0. Before you start

- Push the `deploy` branch to GitHub. The workflow
  `.github/workflows/api-postgres.yml` runs the full API test suite on
  Postgres 16 and on SQLite on every push to `deploy` and `master`; wait
  for both jobs to pass (the Postgres job takes about 25 minutes).
- Generate three secrets once, on your laptop, and keep them in a password
  manager. Use the same three values on Railway and Vercel.

  ```bash
  openssl rand -hex 32   # SESSION_SECRET
  openssl rand -hex 32   # OWNER_API_TOKEN
  openssl rand -hex 32   # DESK_DEVICE_KEY
  ```

- Choose the Vercel project name now (for example `seedha-demo`). Its
  address will be `https://<project>.vercel.app`, and the API needs it
  before its first start: with `SEEDHA_ENV=production` the API refuses to
  start without an https `WEB_ORIGIN`.

## 1. Railway: project and Postgres

1. railway.com, New Project, Deploy PostgreSQL. This adds a service named
   `Postgres`.
2. In the same project: New, GitHub Repo, choose this repository.
3. On the new service: Settings, Source: branch `deploy`, Root Directory
   `apps/api`. Config-as-code file path: `/apps/api/railway.json` (Railway
   does not look for it under the root directory on its own).
   The config builds with Railpack (Python 3.12 from `.python-version`,
   packages from `requirements.txt`), starts with
   `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`,
   and checks health on `/health`. The two proxy flags make the API see each
   guest's own address behind Railway's proxy, so rate limits work per
   guest. The API trusts that forwarded address only on requests that
   carry the web server's proof header (derived from `OWNER_API_TOKEN`); a
   direct caller of the Railway URL is limited by the address Railway's
   proxy recorded, and the API docs pages are off in production.
4. Settings, Networking, Generate Domain. Note the URL,
   `https://<api>.up.railway.app`. This is `API_BASE_URL` for Vercel.

## 2. Railway: API variables

API service, Variables. Mark the secret ones as sealed.

| Name | Value | Secret |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable) | yes |
| `SEEDHA_ENV` | `production` | no |
| `SESSION_SECRET` | generated: `openssl rand -hex 32` (same as Vercel) | yes |
| `OWNER_API_TOKEN` | generated: `openssl rand -hex 32` (same as Vercel) | yes |
| `DESK_DEVICE_KEY` | generated: `openssl rand -hex 32` (same as Vercel) | yes |
| `WEB_ORIGIN` | `https://<project>.vercel.app` (the name chosen in step 0) | no |
| `PUBLIC_BASE_URL` | `https://<project>.vercel.app` (the name chosen in step 0) | no |
| `PROOF_RPC_URL` | `https://rpc-amoy.polygon.technology` (optional) | no |
| `PROOF_CHAIN_ID` | `80002` (optional; any other value keeps proofs local) | no |
| `PROOF_PRIVATE_KEY` | the testnet-only key from your local `.env` (optional) | yes |
| `ANTHROPIC_API_KEY` | your key (optional; empty means labelled samples) | yes |
| `CLAUDE_MODEL` | the model id, only with `ANTHROPIC_API_KEY` | no |
| `ALLOW_CLAUDE_FOR_DEMO` | leave empty: visitors never spend your Claude credits | no |
| `ALLOW_DEMO_PROOF_WRITES` | leave empty: visitors never spend testnet POL | no |
| `ALLOW_OWNER_ACCOUNTS` | leave empty: sample hotel only, Direct beta login | no |
| `SITE_GEN_MODEL` | the model id for Seedha Site text (optional, for example `claude-haiku-5-5`; only with `ANTHROPIC_API_KEY`; visitors still get the labelled Sample unless `ALLOW_CLAUDE_FOR_DEMO=1`). Read by the API | no |
| `SITE_GEN_MONTHLY_TOKEN_CAP` | optional, default `300000` tokens a month across all hotels. Read by the API | no |
| `SITE_ROOT_DOMAIN` | optional, section 8 (empty: hotel sites live at `/h/<slug>`). The API uses it for the address, QR and share text | no |

Do not set `PORT` (Railway sets it). Leave the WhatsApp and Razorpay
variables unset so messages and UPI stay simulated. If the build log shows
a Python other than 3.12, add `RAILPACK_PYTHON_VERSION=3.12`.

With `SEEDHA_ENV=production` the API refuses to start, and names the
variable in the log (never its value), if a secret is missing, shorter
than 32 characters or one of the published demo values, if an origin is
not https, or if the database is SQLite.

## 3. Railway: seed the sample hotel once

Wait until the API's deployment shows healthy (the deploy log says
production mode and `/health` answers), then seed:

The seed refuses a database that already has data, so it never wipes
anything. Install the Railway CLI, then:

```bash
railway login
railway link                       # pick the project and the API service
railway ssh --service <api-service>
python -m seed.load                # inside the container
```

Use `railway ssh` only: it runs inside the API container with its own
variables, so the database password never appears on your command line and
the Desk device key is registered from the sealed variable.

## 4. Vercel: web project

1. vercel.com, Add New, Project, import this repository.
2. Production branch `deploy` (Settings, Git, if not asked on import).
3. Root Directory `apps/web`, Framework Preset Next.js.
4. Install Command `npm ci`, Build Command `npm run build`.
5. Node.js Version 24.x (Settings, Build and Deployment).
6. Function Region near the Railway region (Settings, Functions).
7. Variables (Production):

| Name | Value | Secret |
|---|---|---|
| `API_BASE_URL` | `https://<api>.up.railway.app` (from step 1.4) | no |
| `SESSION_SECRET` | the same value as on Railway | yes |
| `OWNER_API_TOKEN` | the same value as on Railway | yes |
| `DESK_DEVICE_KEY` | the same value as on Railway | yes |
| `SEEDHA_HOSTED` | `1` | no |
| `WEB_ORIGIN` | `https://<project>.vercel.app` (optional, after the first deploy) | no |
| `PUBLIC_CONTACT_EMAIL`, `PUBLIC_PRIVACY_EMAIL`, `PUBLIC_SECURITY_EMAIL` | role addresses (optional) | no |
| `SITE_ROOT_DOMAIN` | optional, section 8; the same value as on Railway. The web proxy reads it to tell a hotel host from the app host | no |

Mark `SESSION_SECRET`, `OWNER_API_TOKEN` and `DESK_DEVICE_KEY` as
Sensitive and scope them to Production only (not Preview or Development).
Never prefix `API_BASE_URL` or any secret with `NEXT_PUBLIC_`. Do not set
`SEEDHA_DEMO` or `SEEDHA_PUBLIC` on Vercel. Browsers only ever call the
Vercel origin; the web server calls Railway through its proxy.

8. Deploy. Check that the production URL `https://<project>.vercel.app`
   is the one set on Railway in step 2. If Vercel gave a different address,
   update `WEB_ORIGIN` and `PUBLIC_BASE_URL` on Railway and redeploy the
   API; optionally set `WEB_ORIGIN` on Vercel too and redeploy.

## 5. Verify

- `curl -s https://<api>.up.railway.app/health` returns `{"status":"ok", ...}`.
  The deploy log says production mode and never shows a secret.
- `https://<project>.vercel.app/api/health` returns the same JSON (the proxy works).
- In the browser's Network panel every call goes to the Vercel origin, never to `railway.app`.

## 6. Fresh demo data later

Signed-in visitors on the hosted demo cannot reset it. You can, with the
token:

```bash
curl -X POST -H "Authorization: Bearer $OWNER_API_TOKEN" https://<api>.up.railway.app/demo/reset
```

(2 a minute.) Run it before each judging session so the 8-step demo
starts at "0 of 8 done".

## 7. Roll back

- API: Railway, API service, Deployments, pick the last good deployment,
  Redeploy. Migrations only go forward: if the bad deploy added one,
  restore the database too (Postgres service Backups if your plan has
  them, or `pg_dump` and `pg_restore` with `DATABASE_PUBLIC_URL`; take a
  dump before each deploy).
- Web: Vercel, Deployments, the last good production deployment, Instant
  Rollback (or Promote to Production). Variable changes need a redeploy.

## 8. Custom domain (hotel addresses)

Without a custom domain every published hotel site lives at
`https://<project>.vercel.app/h/<slug>`, which already works. With one,
each hotel also gets `https://<slug>.<your-domain>` (for example
`deodar-view.example.in`). The app itself stays on the apex or on
`app.<your-domain>`; `www`, `app`, `api`, `admin`, `mail`, `docs`,
`status` and the app's route names can never be hotel addresses.
Items marked (unconfirmed) were not checked against the live Vercel
dashboard; follow what the dashboard shows.

1. Buy the domain from any registrar (for example `example.in`).
2. Vercel, the web project, Settings, Domains: add `example.in`,
   `www.example.in` (choose "redirect to example.in") and the wildcard
   `*.example.in`. Optionally add `app.example.in` if the app should live
   there instead of the apex.
3. DNS. The wildcard needs Vercel's nameservers: at the registrar, set
   the nameservers to the ones Vercel shows for the domain (usually
   `ns1.vercel-dns.com` and `ns2.vercel-dns.com`). Vercel then creates the
   apex, `www` and wildcard records itself. If you keep another DNS host
   for the apex and `www` only, use the records the dashboard shows: an
   `A` record for the apex (the IP shown; historically `76.76.21.21`,
   unconfirmed whether it is now project specific) and a `CNAME` for
   `www` to the value shown (historically `cname.vercel-dns.com`). A
   wildcard on another DNS host is not supported by Vercel (unconfirmed
   for every plan), so hotel subdomains need step 3's nameservers.
4. Certificates: Vercel issues and renews HTTPS certificates itself,
   including the wildcard one, once DNS points at Vercel. Wait until each
   domain shows "Valid Configuration" (exact wording unconfirmed); this
   can take from minutes to a few hours while DNS spreads.
5. Variables. `SITE_ROOT_DOMAIN=example.in` (no scheme, no `*.`) on both:
   - Vercel (Production): the proxy reads it on every request to tell a
     hotel host from the app host. Never as `NEXT_PUBLIC_`.
   - Railway (API): the owner's address, the QR code and the WhatsApp
     share text use it, and Seedha Link buttons on hotel pages point back
     to `WEB_ORIGIN`.
   Set `WEB_ORIGIN` and `PUBLIC_BASE_URL` on Railway (and `WEB_ORIGIN` on
   Vercel) to the app host, `https://example.in` or
   `https://app.example.in`, never to a hotel subdomain.
6. Redeploy both: Railway API (Deployments, Redeploy) and Vercel
   (Deployments, Redeploy the latest production one). Variable changes do
   nothing until then.
7. Test:
   - `https://example.in/login` signs in as before.
   - Website shows the sample hotel's address as
     `deodar-view.example.in`. Visitors on Direct beta login cannot publish
     on the shared demo (the API refuses it), so a real owner publish can be
     checked only with a real owner account (`ALLOW_OWNER_ACCOUNTS=1` and
     the number in `OWNER_PHONES`): publish that hotel and open its
     address on a phone over mobile data.
   - `https://deodar-view.example.in/` shows the sample hotel's fixed
     sample page (hosted, never a visitor's build); a booking button opens
     Seedha Link on the app host.
   - `https://no-such-hotel.example.in/` answers 404 with "This hotel
     site isn't live yet" (`curl -sI` shows `HTTP/2 404`).
   - Owner pages 404 on a hotel host: `curl -sI
     https://deodar-view.example.in/login` and `/home` and `/api/site`
     all show 404.
   - Rename the address and check the old one answers 308 to the new one
     (for 30 days).
   - In the browser's cookie panel, the `seedha_owner` cookie belongs to
     the app host only (no Domain attribute), so hotel hosts never get it.

## Post-deploy checklist

1. Health: the Railway `/health` and the Vercel `/api/health` both return ok.
2. Sign in: `https://<project>.vercel.app/login` shows no sign-in code
   banner; Direct beta login opens Hotel Deodar View with the Sample hotel
   badge.
3. The 8-step demo on the live URL (reset first, section 6): Upload sample
   statements (1,500 rows, 3 flagged); the flip (₹10,39,108 paid to
   channels, MakeMyTrip 1st to 5th); repeat guests (12, ₹41,800); Desk
   consent on room 207; checkout slip with DEODAR-RS26; approve the
   win-back; `/link/DEODAR-RS26` with simulated UPI; Savings ₹2,233 avoided,
   ₹2,199 net. Home says "8 of 8 done".
4. Desk on a phone: open `https://<project>.vercel.app/desk/device` on a
   phone or tablet over mobile data, sign in, tap Sound on; check in a room
   on the laptop; scan the QR with a second phone and agree; the Desk turns
   green and the slip shows. The QR link starts with the Vercel URL.
5. Proof on Amoy (only if the wallet is funded and `PROOF_*` are set): set
   `ALLOW_DEMO_PROOF_WRITES=1` on Railway for the test (the hosted demo has
   no real owner sign-in) and remove it right after; on Proof press "Write tonight's proof"; it shows Sent,
   then Verified with a block number and an explorer link. Otherwise it
   says Local only with the reason.
6. Rate limits per guest: from two phones on different networks, the
   consent page works on both; from one, repeated fast reloads of a public
   page eventually get "Too many tries" on that phone only.
7. Safety: as a signed-in visitor, the Calendar's Add events shows a
   labelled sample extraction (no Claude spend) and proof writes stay local.
8. Seedha Site: Website, Build my site, add 4 photos, a few lines and room
   prices; Generate shows Sample text (no Claude spend); Review shows your
   build in the owner preview. Publish is refused on the shared demo by
   design. `https://<project>.vercel.app/h/deodar-view` shows the fixed
   sample page, never a visitor's photos or text. Copy, Share on WhatsApp
   (a wa.me link) and the QR download appear only after a publish, so they
   and a real owner publish can be checked only with a real owner account
   (`ALLOW_OWNER_ACCOUNTS=1` and the number in `OWNER_PHONES`).
