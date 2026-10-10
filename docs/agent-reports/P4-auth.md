# P4 Auth and onboarding (fe/auth worktree)

Passcode login removed. WhatsApp OTP sign in, sign up, OTP screen, 4-step onboarding and
Direct beta login built per D4, D8, D16. Nothing committed.

## Files
API (apps/api): `app/models.py` (+OwnerAccount, OtpChallenge), `migrations/versions/0007_owner_auth.py`
(named pk/uq/ck constraints), `app/services/auth.py` (new), `app/routers/auth.py` (new),
`app/main.py` (router), `app/config.py` (`seedha_demo`), `tests/test_auth.py` (new, 33 tests).
Web (apps/web): `app/login/{page.tsx,AuthFrame.tsx,auth.module.css}`, `app/signup/page.tsx`,
`app/otp/page.tsx`, `app/onboard/page.tsx`, `app/demo/page.tsx`,
`app/api/auth/{otp/request,otp/verify,signup,demo,me,logout,onboarding}/route.ts`,
`app/api/session/route.ts` (DELETE sign out only; POST passcode gone), `lib/session.ts` (+test),
`lib/auth.ts` (+test), `lib/authServer.ts` (+test), `lib/ratelimit.ts` (comment, LOGIN_LIMIT
removed), `proxy.ts` (+/onboard). Root: `.env.example`, `README-dev.md` (sign-in section).

## API endpoints (all need OWNER_API_TOKEN: only the web server calls them, so none are PUBLIC;
the route-auth sweep covers them unchanged)
- `POST /auth/otp/request {phone}`: accepts +91/91/0 prefixes, spaces, dashes; must match
  `^[6-9]\d{9}$` (422 invalid_phone). Resend not before 30 s (429 resend_wait + Retry-After).
  Locked number: 429 locked. Returns masked_phone, expires_in 300, resend_in 30, tries_left,
  `demo_code` only when SEEDHA_DEMO=1. Per-client limit 6/min.
- `POST /auth/otp/verify {phone, code}`: 6 digits (422, costs no try), expires 300 s (410),
  single use (404 no_code after use), salted SHA-256 stored, `hmac.compare_digest`. Wrong:
  401 wrong_code + `X-Tries-Left`; 5th wrong: 429 locked for 15 min (Retry-After 900); a resend
  does not reset tries while the code is valid; a new code is refused while locked. Success:
  `{verified, account: {subject "a<id>", name, hotel_name, onboarded} | null}` (null = no
  account for this number; web answers 404 no_account). Per-client limit 10/min.
- `POST /auth/signup {name, hotel, phone, terms: true, updates=false}`: terms must be literally
  true. Creates an unverified account (a verified account is never overwritten) and sends a code.
- `POST /auth/demo`: subject "demo"; 403 not_sample unless `property.is_sample`.
- `GET /me`, `GET/PATCH /onboarding` need `X-Seedha-Subject` (demo or a<id>) with the token, else
  401 session_ended. `POST /auth/logout` acknowledges (sessions are stateless signed cookies).
- Onboarding (safe approach): answers (property name, town, rooms 1 to 500, contracts in %
  0 to 50 with 2 decimals stored as bps, defaults MMT 22 / Booking 18 / Agoda 20 / agents 10,
  optional cost per occupied room stored in paise, simulated WhatsApp connect, finish) are saved
  on the owner_account row only, never on property or channel_contract. For the demo subject
  GET shows the sample hotel's seeded values and PATCH saves nothing (`saved: false`, note shown).
  Tests prove contracts and property are unchanged.

## OTP logging decision (non-demo)
D4 says "otherwise log it server-side only". Logging a live sign-in code puts a credential into
log storage, so in non-demo mode the API logs only `SIMULATED WhatsApp code issued for +91 98765
•••10 (code not logged)` and never returns the code. With SEEDHA_DEMO=1 the code goes to the
banner and to the log line labelled SEEDHA_DEMO=1. Consequence: without SEEDHA_DEMO=1 and with no
real sender, OTP sign in cannot complete; Direct beta login still works for the sample hotel.

## Session
Cookie `seedha_owner` = `<expires>.<subject>.<hmac>` (subject signed; old 2-part cookies are
rejected, so existing sessions must sign in again). HttpOnly, SameSite=Lax, Secure on https.
"Keep me signed in on this device for 30 days" (ticked by default, as in the design): Max-Age
30 days and a 30-day signature. Unticked: browser-session cookie, signature 12 h. Sign out:
`POST /api/auth/logout` or the existing `DELETE /api/session` clears it. Auth POSTs refuse a
foreign Origin (403). Web per-client limits (lib/authServer.ts): send 10, verify 10, demo 60 per
15 min, copy "Too many tries. Wait N minutes and try again." The BFF is unchanged: any valid
session (demo or account) reaches the single property's owner routes.

## Checks (in worktree)
- API: ruff check + format --check clean; mypy `Success: no issues found in 86 source files`;
  pytest `346 passed`. Alembic upgrade head, downgrade base, upgrade head on mig-test.db: OK.
- Web: tsc clean; eslint 0 warnings; prettier all formatted; node --test 31 pass, 0 fail.
- Curl smoke (API 8017, `next dev --webpack` 3017; Turbopack refuses the symlinked node_modules):
  signup, wrong code (4 left), verify with 30-day cookie, /me, onboarding PATCH, BFF ledger 200,
  demo cookie, cross-site 403, logout clears cookie, /onboard redirects without session. No
  screenshots taken (Playwright not allowed here).

## E2E for the lead
API needs `SEEDHA_DEMO=1` in the e2e env; drop OWNER_PASSCODE/E2E_PASSCODE from playwright.config.
- Sign in (deterministic): `goto("/login")`, `click("#beta-login")`, `waitForURL("**/home")`.
  Also `/demo` has the same `#beta-login` button.
- OTP sign up: `/signup`, fill `#su-name`, `#su-hotel`, `#su-phone` ("9876543210"), check
  `#su-terms`, click `#signup-submit` -> `/otp`; read `#demo-code` text, fill `#otp-code`, click
  `#otp-verify` -> `/onboard` (`#onboard-next` x4, last label "Continue to upload" -> `/upload`).
  OTP sign in later: `/login`, fill `#phone`, click `#send-code`, then the same `/otp` steps.
- Lockout (replaces the passcode spec): `/login`, fill `#phone` "9123456789", click `#send-code`,
  `waitForURL("**/otp")`; 5 times fill `#otp-code` with a code different from `#demo-code`
  and click `#otp-verify`; expect `#otp-error` to contain "Too many tries. Try again in 15
  minutes." and `#otp-tries` to read "0 of 5 tries left". Web-limit variant: POST
  `/api/auth/otp/verify` `{phone:"9123456780", code:"123456"}` 11 times; the 11th is 429 with
  "Too many tries. Wait 15 minutes and try again." Both share the verify bucket (10 per 15 min per
  client), so do not run both against one server, and keep other OTP verifies in e2e few.
- Login error copy/selector: `#login-error` (invalid number: "Enter a 10-digit mobile number
  starting with 6, 7, 8 or 9.").

## Env changes
`.env.example`: removed OWNER_PASSCODE; added `SEEDHA_DEMO=1` with comment. Existing local `.env`
files need `SEEDHA_DEMO=1` added to see the demo code. OWNER_PASSCODE is no longer read anywhere.

## Not done / for others
- Makefile `demo` echo still says "log in with OWNER_PASSCODE" (Makefile not in my scope).
- `app/terms/page.tsx` says "Keep your passcode and Desk device key private"; `docs/decisions.md`
  D-071 and progress mention the passcode; e2e and playwright.config still use the passcode.
- TopNav/footer from the root layout still render on auth pages (layout owned by the shell builder).
- The shell's "session ended" screen and sign-out button can call `POST /api/auth/logout` and
  link `#beta-login` on `/login`. `/api/auth/me` gives name, hotel, kind for the avatar/chip.
- No real WhatsApp OTP sender (needs an approved Meta authentication template).
