# H3 web deployment (Vercel) status

## Changes (apps/web only, uncommitted)
- `lib/webEnv.ts` (+ `webEnv.test.ts`): one place for web env. `apiBaseUrl()` reads
  `API_BASE_URL`, falls back to `API_URL`, then `http://localhost:8000` (trailing
  slash dropped); `siteOrigin()` for `metadataBase`: `WEB_ORIGIN`, `PUBLIC_BASE_URL`,
  `https://$VERCEL_PROJECT_PRODUCTION_URL`, then localhost; `isHosted()`
  (`SEEDHA_HOSTED=1`); `loginSecretsProblem()` (moved from authServer, same rule);
  `deviceKeyUsable()` (new: the demo `DESK_DEVICE_KEY` is refused in a production
  build unless `SEEDHA_DEMO=1`; the BFF answers 503 `desk_not_configured`).
- BFF `app/api/[...path]/route.ts` and `lib/authServer.ts` use `apiUrl()`. No
  `NEXT_PUBLIC_*` var exists; the API URL and secrets are server-only (checked: the
  production build's `.next/static` has no API URL and no `localhost:3000`).
- Reset: `refuseRemoteReset(path, headers, public, hosted)`: hosted wins (no "this
  machine" on Vercel; owner session + API decide); demo-live (`SEEDHA_PUBLIC=1`, no
  `SEEDHA_HOSTED`) still local-only. New `GET /api/auth/mode` (owner session) returns
  `{hosted}`; Settings shows "Reset demo data" via `showResetButton()` (sample hotel and
  (this laptop or hosted)). Unset flags = master behaviour.
- Vercel headers: Vercel overwrites `X-Forwarded-For` (also sets `X-Real-IP`,
  `X-Vercel-Forwarded-For`) with the client IP, so `clientAddress()` (last XFF hop) is
  right; test added. `sameOrigin` uses `x-forwarded-host`/`host` (Vercel sets both to
  the public domain); cookies are `Secure` (`x-forwarded-proto: https`). CSP
  `connect-src 'self'` unchanged.
- `package.json` (+ lockfile root) `engines.node: ">=24 <27"` (local Node 26; Next 16
  needs >=20.9; Vercel picks the newest supported major in range). No `vercel.json`
  and no `outputFileTracingRoot`: apps/web is self-contained (own lockfile, no imports
  outside it) and the build shows no workspace-root warning.
- For the lead: add `API_BASE_URL=` and `SEEDHA_HOSTED=` to `.env.example`. On Railway
  the API sees Railway's proxy as the peer: H2 must trust its forwarded header or the
  per-guest limits collapse to one bucket.

## Web env vars (Vercel: Settings > Environment Variables, Production)
| Name | Secret | Example format | Purpose |
|---|---|---|---|
| `API_BASE_URL` | no | `https://<service>.up.railway.app` | Railway API root; server-side proxy only |
| `OWNER_API_TOKEN` | yes | 64 hex (`openssl rand -hex 32`) | Same value as on Railway; sent by the proxy only |
| `SESSION_SECRET` | yes | 64 hex, at least 32 chars | Signs the owner session cookie (web only) |
| `DESK_DEVICE_KEY` | yes | 48 hex (`openssl rand -hex 24`) | Same value as on Railway; Desk simulator |
| `SEEDHA_HOSTED` | no | `1` | Hosted mode: Reset shown to a signed-in owner |
| `SEEDHA_DEMO` | no | empty | Empty: no OTP banner, demo secrets refused |
| `SEEDHA_PUBLIC` | no | empty | Leave empty on Vercel (demo-live only) |
| `WEB_ORIGIN` | no | `https://<project>.vercel.app` | Open Graph base (optional; Vercel URL is the fallback) |
| `PUBLIC_CONTACT_EMAIL`, `PUBLIC_PRIVACY_EMAIL`, `PUBLIC_SECURITY_EMAIL` | no | role address | Legal pages (prerendered: set before build) |

Never set `API_URL`/`API_BASE_URL` with a `NEXT_PUBLIC_` prefix.

## Vercel steps
1. vercel.com > Add New > Project > Import the GitHub repo.
2. Production Branch: `deploy` (Settings > Git, if not asked on import).
3. Root Directory: `apps/web`. Framework Preset: Next.js.
4. Install Command (override): `npm ci`. Build Command: `npm run build` (`next build`,
   Turbopack). Output: default.
5. Node.js Version (Settings > Build and Deployment): 24.x (or newer if listed and in
   the engines range).
6. Function Region (Settings > Functions): the region nearest the Railway region
   (e.g. `sin1` for Railway Southeast Asia, `bom1` Mumbai), so each proxy hop is short.
7. Add the env vars above for Production (and Preview if used), then Deploy.

## PUBLIC_BASE_URL (both sides)
1. After the first deploy note the production URL `https://<project>.vercel.app`.
2. Railway (API service) variables: `PUBLIC_BASE_URL` and `WEB_ORIGIN` = that URL
   (QR codes, Seedha Link, consent links, CORS). Redeploy the API.
3. Vercel: optionally `WEB_ORIGIN` = that URL, then Redeploy (build-time Open Graph).
   Without it the build uses `VERCEL_PROJECT_PRODUCTION_URL`.

## Verify
- `https://<project>.vercel.app/api/health` returns the API health JSON (proxy works).
- `/login` shows no OTP code banner; Direct beta login opens Hotel Deodar View.
- Settings > Hotel shows "Reset demo data" when signed in; signed out, `/settings`
  redirects to `/login`.
- Desk check-in QR and guest links start with the Vercel URL, not localhost.
- DevTools Network: every call goes to the Vercel origin `/api/*`, never `railway.app`.
- Response headers include the CSP with `connect-src 'self'`.

## Roll back
- Deployments > pick the last good Production deployment > Instant Rollback (or
  "Promote to Production"). Auto-promotion pauses until you promote again.
- Or revert the commit on `deploy` and push; Vercel redeploys. Env var changes need
  a Redeploy to take effect.

## Checks run
typegen, `tsc --noEmit`, eslint (0 warnings), prettier, `node --test lib/*.test.ts`
(180 pass), audit gate, and `next build` in an APFS clone with placeholder production
env (`SEEDHA_HOSTED=1`, random secrets, Railway-style `API_BASE_URL`): exit 0, no warnings.
