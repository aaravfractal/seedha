# Hosting brief (saved word for word, 12 October 2026)

The step-by-step hosting guide follows this brief once the build is done.

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
