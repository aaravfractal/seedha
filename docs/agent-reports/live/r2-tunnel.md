# R2 · Tunnel, LAN and public base URL (read-only research)

## 1. cloudflared quick tunnel
- Not installed on this Mac (`which cloudflared` → not found). B4 must print
  `brew install cloudflared` and exit 1 when `command -v cloudflared` fails.
- Run: `cloudflared tunnel --no-autoupdate --url http://localhost:3000 2>"$LOG"`.
  The URL goes to stderr inside a box ("Your quick Tunnel has been created! Visit it at ...").
  Regex (skips `api.trycloudflare.com` from error lines): `https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com`
- Capture in `scripts/demo-live.sh`: start cloudflared in the background, then poll
  `/usr/bin/grep -oE "$RE" "$LOG" | head -1` every 0.5 s up to 30 s; on timeout print the log tail and exit.
- Clean stop: run the script under `set -m` or as the Makefile's `trap 'kill 0' EXIT INT TERM` pattern
  (Makefile:116,121) so cloudflared, uvicorn and next die together; also `rm -f "$LOG"`.
- Caveats for the printout: quick tunnels have no SLA, a new random URL each run, ~200 in-flight request
  cap, no SSE. A `~/.cloudflared/config.yml` makes quick tunnels refuse to start: warn if present.

## 2. Headers behind the tunnel (Next 16.4.0, `next start`)
- cloudflared keeps the public Host (`x.trycloudflare.com`) unless `--http-host-header` is set: do NOT set it.
  It adds `CF-Connecting-IP`, `X-Forwarded-For` (Cloudflare appends the real IP last), `X-Forwarded-Proto: https`, `CF-Ray`.
- Next fills `x-forwarded-host/proto/for` only if missing (node_modules/next/dist/server/base-server.js:564-567),
  so `x-forwarded-host` = tunnel Host and XFF keeps Cloudflare's value.
- `request.url` in route handlers is built from the listen hostname and port, NOT Host
  (router-utils/resolve-routes.js:116-118): `https://localhost:3000/...` behind the tunnel,
  `http://0.0.0.0:3000/...` with `-H 0.0.0.0`.
- BFF Origin check, `sameOrigin()` (apps/web/lib/authServer.ts:55-65), compares Origin to x-forwarded-host,
  then Host. It works through the tunnel with no change. Used at app/api/[...path]/route.ts:28 and authServer.ts:166.
- Cookie (lib/session.ts:100-104, `isSecure` at authServer.ts:137-142): tunnel → `x-forwarded-proto: https` → Secure. OK.
  **LAN bug:** with `-H 0.0.0.0` the request.url host is `0.0.0.0`, so a production build sets `Secure`
  over plain http. Phones on `http://192.168.x.x:3000` drop the cookie and owner login fails.
  Fix: decide on the `host` header (localhost, 127.0.0.1 or a private IP → not secure unless proto is https),
  or add `SEEDHA_LAN=1` → secure only when proto is https. SameSite=Lax is fine (same-site everywhere).
- proxy.ts:17-19 redirects to `/login` with request.url, but Next relativises same-origin
  redirects (server/web/adapter.js:361-375). OK.
- CSP (next.config.ts:7-20) is all `'self'`: connect-src and form-action follow whatever host serves the page.
  No change needed. Do not add `upgrade-insecure-requests` (it would break LAN http).
- No server actions are in use, so `serverActions.allowedOrigins` is not needed.
- API CORS (apps/api/app/main.py:83-88) is `[WEB_ORIGIN]` only. The browser never calls the API (BFF only),
  and the API stays on 127.0.0.1:8000 (Makefile:107), so CORS is a formality. Set WEB_ORIGIN = public URL in live mode.
- Rate limits: `clientAddress` takes the last XFF entry (lib/ratelimit.ts:50-54), which is the real client
  through Cloudflare. The API trusts XFF from the loopback BFF (apps/api/app/ratelimit.py:8-13). They already work.
  On LAN a phone can send its own XFF (Next does not overwrite it). The existing global ceiling covers this (authServer.ts:37-39).

## 3. Reset "only from localhost"
- Reset today: POST demo/reset (apps/api/app/routers/site.py:318-343) needs an owner session, sample only, rate-limited.
  UI is in components/settings/HotelTabs.tsx:32-39,105-125. BFF maps `demo` → owner (lib/bff.ts:35).
- The socket IP cannot be trusted: cloudflared connects from 127.0.0.1. Recommended check in the BFF
  (route.ts, before forwarding `demo/reset`), when `SEEDHA_PUBLIC=1`: allow only if `host` is
  `localhost:3000` or `127.0.0.1:3000`, AND there is no `cf-connecting-ip` or `cf-ray` (Cloudflare always sets
  these and a client cannot strip them), AND `x-forwarded-host` equals `host`. Otherwise 403 `reset_local_only`.
  Also hide the button when `/api/auth/me` (or a small flag route) says the request is remote. The API can
  refuse too, via `SEEDHA_PUBLIC=1` + `request.client.host` not loopback, since the BFF forwards the real IP.

## 4. OTP banner and secrets in public mode
- The banner shows only when the API returns `demo_code` (SEEDHA_DEMO=1; apps/api/app/config.py:42-44,91;
  web otp/page.tsx:145,199-204, login/AuthFrame.tsx:117). demo-live must export `SEEDHA_DEMO=` (empty).
- **Trap:** with SEEDHA_DEMO empty, a production build refuses the published demo secrets
  (authServer.ts:144-158), so even Direct beta login 503s. demo-live must export fresh per-run
  `OWNER_API_TOKEN`, `SESSION_SECRET` (≥32 chars) and `DESK_DEVICE_KEY` (`openssl rand -hex 24`) to BOTH
  processes, and seed after exporting them (load_sample stores the device key, site.py:342).

## 5. PUBLIC_BASE_URL: where links are built
All guest URLs are built by the API from `settings.web_origin`, read once at API start. Nothing is a baked NEXT_PUBLIC_*:
- Desk consent QR: services/desk.py:159 (called from routers/desk.py:194). DeskDevice.tsx:118-124 renders `p.url` with
  `qrcode`. The desk page iframe uses only `pathname` (app/(app)/desk/page.tsx:148).
- Seedha Link in drafts: services/messages.py:149-151 (`perk_link`), via messages.py:90,185,
  routers/messages.py:105,125,162, routers/public.py:103, routers/desk.py:211.
- Inbox link: routers/inbox.py:266,342 (+331,348,388).
- Web side: site/Review.tsx:89 uses `window.location.origin` (runtime, fine). layout.tsx:12-21 metadataBase
  reads WEB_ORIGIN at build time (OG only, cosmetic).
- **Minimal change:** config.py:77 → `web_origin=_env("PUBLIC_BASE_URL") or _env("WEB_ORIGIN", "http://localhost:3000")`
  (or a separate `public_base_url` field used by the link builders, with CORS keeping web_origin). Start the API
  only after the tunnel URL is known. Caveat: draft bodies store the link text (messages.py:90), so a new tunnel URL
  leaves old drafts pointing at the old URL. demo-live seeds fresh, so this is fine.
- No seed data embeds `/link/` or localhost (grep of apps/api/seed is clean).

## 6. LAN (make demo-lan)
- IP: `IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)`. Here en0 = 192.168.0.106 and en1 is empty (exit 1).
  Fail with a clear message if both are empty.
- Web: `npx next start -H 0.0.0.0 --port 3000`; API unchanged on 127.0.0.1 (Makefile:107).
  Export PUBLIC_BASE_URL=WEB_ORIGIN=`http://$IP:3000`. macOS may prompt the firewall for node the first time.

## 7. Terminal QR (nothing to install)
- apps/web has `qrcode` 1.5.4 (package.json:15) with a CLI at node_modules/.bin/qrcode and renderer/terminal-small.js:
  `apps/web/node_modules/.bin/qrcode -t terminal -s "$URL"` (or `node -e "require('qrcode').toString(u,{type:'terminal',small:true},...)"`, 17 lines tested).
- The API venv has no segno or qrcode. Use the node one.

## Files B3/B4 touch
Makefile (demo-lan, demo-live, help); new scripts/demo-live.sh and scripts/demo-lan.sh; apps/api/app/config.py:77;
.env.example (PUBLIC_BASE_URL, SEEDHA_PUBLIC); apps/web/lib/authServer.ts (isSecure);
apps/web/app/api/[...path]/route.ts and lib/bff.ts (local-only reset); apps/api/app/routers/site.py (reset guard);
components/settings/HotelTabs.tsx (hide reset); README-dev.md. B3 adds app/desk/device (kiosk) plus a
proxy.ts matcher entry, because device access needs an owner session (lib/bff.ts:15-17).
