# Security review: P1 to P4 (cb7e000..11c15df)

Reviewer: security (read-only). Scope: `git diff cb7e000..HEAD`, CLAUDE.md section 2,
FRONTEND_MASTER D4 to D8, decisions D-071 to D-085, P1 to P4 reports.
Evidence: code reading, API suite (376 passed), curl probes against the running dev servers
(web :3000, API :8000). Probes that changed nothing: an undo that answered 409 and a PATCH to a
missing message.

## Findings

| id | sev | file:line | problem | concrete fix |
|----|-----|-----------|---------|--------------|
| S1 | high | apps/api/app/routers/auth.py:253-256, 289-301; apps/api/app/services/auth.py:167-172; .env.example:26; apps/web/app/api/[...path]/route.ts:33-41; apps/api/app/deps.py:69-73 | Any valid session reaches every owner route of the single property. The BFF checks only the signature and never passes the subject on owner routes. Sign up is open to any number, and an `a<id>` session gets the same power as the hotel's owner. With `SEEDHA_DEMO=1` (the .env.example default) `demo_code` is returned to whoever asks (verified: `POST /api/auth/otp/request` answered `"demo_code":"708195"`). So anyone can sign in as any existing account number, read its name, hotel and onboarding answers, and run the property, whether the property is sample or real. | (a) `.env.example`: `SEEDHA_DEMO=` empty, and have `make demo`/`make e2e` set it. (b) API: return `demo_code` only when `prop.is_sample` is true, and refuse to start with `SEEDHA_DEMO=1` while WhatsApp keys are set or the property is not sample. (c) Link `owner_account` to `property` (owner-approved, or an allowlisted phone). Have the BFF send `X-Seedha-Subject` on owner routes, and add an API dependency that rejects an account not linked to `prop` and rejects `demo` when `not prop.is_sample`. |
| S2 | high (only once WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set) | apps/api/app/services/whatsapp.py:89-91; apps/api/app/routers/messages.py:133-143, 146-156; apps/api/app/routers/public.py:42-46,100 | Direct beta login (anonymous, one tap) can send real WhatsApp messages to any number. The steps: Desk check-in (owner route), open the consent URL, type any number and tick, check out, PATCH the draft to any text that keeps the STOP line, code and link (a phishing URL is allowed), then approve. `sender_for` picks the live sender from the keys alone, not from who is signed in. The same session can also run `POST /desk/test-print` without limit on a real Desk printer. | Pass the subject through (S1c). Use `SimulatedSender` whenever the subject is `demo` or `prop.is_sample`, whatever keys exist. Refuse `PATCH /messages/{id}`, `approve` and `desk/test-print` for `demo` when a real sender or a real device is configured. Allow at most one URL in an edited draft, and it must be the perk link. |
| S3 | medium | apps/web/lib/auth.ts:59-61; apps/web/app/(app)/login/AuthFrame.tsx:70; apps/web/app/(app)/otp/page.tsx:106 | Open redirect after sign in. `safeNext` accepts `/\t/evil.example` and `/\n/evil.example`. Browsers strip tab and newline, so `window.location` lands on `http://evil.example/` (verified with WHATWG `new URL`). Attack: `/login?next=/%09/evil.example`. | Resolve `const u = new URL(raw, location.origin)`, require `u.origin === location.origin`, then use `u.pathname + u.search`. Or allow only `^/[A-Za-z0-9/_-]*$`. Add test cases with `\t`, `\n` and `%09`. |
| S4 | medium | apps/web/app/api/[...path]/route.ts:20-49 | No Origin check on owner POST/PATCH/DELETE through the BFF. The auth routes have one; the BFF does not. Verified: a demo cookie plus `Origin: https://evil.example` reached the API (`POST /api/scenario/saturday/undo` gave 409 from the API, and `PATCH /api/messages/999999` gave 404 from the API). SameSite=Lax blocks cross-site, but same-site origins can still do it: other localhost ports, or sibling subdomains in production. That covers approve-and-send, demo reset and draft edits. | For every method other than GET and HEAD, call `sameOrigin(request.headers, request.url)` (lib/authServer.ts:51) and answer 403 `cross_site`, as the auth routes do. Also do it in `DELETE /api/session` (apps/web/app/api/session/route.ts:10). |
| S5 | medium | apps/api/app/services/drafter.py:22,60 | D6 is not met. The AI-draft guard does not reject numbers of 3 or more digits, so the LLM can write a money figure without ₹ or "Rs". Verified: `MONEY_PATTERN` passes "Your 4500 stay" and "Save 1,200 tonight". This touches rule 1 and rule 6. `edit_problem` (services/messages.py:154-171) reuses the same pattern. | Add `\d[\d,]{2,}` (any run of 3 or more digits, commas allowed) to the AI-draft check, run after the code and link are removed. Fall back to the canned template. Add tests for the two strings above. |
| S6 | medium | apps/api/app/routers/site.py:190-198 | Demo reset (`POST /demo/reset`, open to the anonymous Direct beta session) deletes every table, including `owner_account`, `otp_challenge` and `optout_event`. Any visitor can wipe every signed-up account and clear OTP locks. | Leave `owner_account` and `otp_challenge` out of the wipe, or delete only property-scoped tables. Allow reset only for a session whose subject is `demo` or the sample's own account, with a cooldown, for example 1 per minute per client. |
| S7 | medium | apps/api/app/services/auth.py:132-166,181-211 | Lockout DoS and message pumping on a target number. Anyone can ask for a code for a victim's number (one send every 30 s) and then type 5 wrong codes. The real owner is then locked out for 15 minutes, and this can repeat forever. With a real sender, every request also sends the victim a WhatsApp code. The only limits are per client address, and those can be rotated (S10). | Count wrong tries per (number, client) and per number. Lock only the client that failed, or add a growing back-off. Cap sends per number, for example 5 per hour and 10 per day. Show a "didn't ask for this?" line in the real message. |
| S8 | low | apps/api/app/services/auth.py:151-153 | Tries reset when a new code is issued after the old one expires. That gives up to 5 guesses per 5 minutes per number, not the 5 per 15 minutes the D4 wording suggests. Brute force is still not practical (about 1e-6 per guess). | Keep a rolling count of failures per number, for example 10 per hour, that a new code does not reset. |
| S9 | low (unverified, no concurrency test) | apps/api/app/services/auth.py:200-204 | Wrong tries are counted with read, add one, write and no row lock. Parallel verifies could each read the same `attempts` value and allow more than 5 guesses. | Use `UPDATE otp_challenge SET attempts = attempts + 1 WHERE id=:id RETURNING attempts`, or `with_for_update()` on Postgres. |
| S10 | low | apps/web/lib/ratelimit.ts:46-50; apps/web/lib/authServer.ts:9-16 | The web per-client auth limits key on the last `X-Forwarded-For` entry, and the client controls it when no proxy overwrites it (already noted in D-071). The web layer has no global ceiling, and the API ceiling (otp_send 120/min for everyone) can be filled to block all sign-ins. | Add a global bucket in `overLimit`. Document in README-dev that a proxy in production must overwrite XFF, or read XFF only when `TRUST_PROXY=1`. |
| S11 | low | apps/web/lib/authServer.ts:62-72; apps/web/app/api/[...path]/route.ts:47-54 | Body size. The auth routes call `request.json()` with no cap. The BFF checks only the `Content-Length` header, so a chunked body (no header) is read in full by `arrayBuffer()` (from the code, not probed). | Read the stream with a byte cap (for example 16 KB for auth, 11 MB for the BFF) and answer 413 when it is exceeded. |
| S12 | low | apps/web/lib/session.ts:85-90; apps/web/lib/authServer.ts:128-130 | `Secure` is set only when `request.url` is https. Behind a TLS-terminating proxy the cookie may go out without `Secure` (unverified how Next builds `request.url` behind the proxy). | Set `Secure` whenever `NODE_ENV=production`, or when `x-forwarded-proto` is https. |
| S13 | low | apps/web/lib/session.ts:1-10; apps/web/app/api/auth/logout/route.ts:11-15 | Sessions are stateless. Logout clears only this browser's cookie, a copied cookie stays valid for up to 30 days, and a deleted account's cookie still opens every owner route through the BFF. | Store a per-account `session_epoch` (or a sessions table) in the cookie and check it in the API for each subject (with S1c). Logout bumps the epoch. |
| S14 | low | .env.example:10,12; apps/web/lib/authServer.ts:133-136 | `notConfigured` checks only that the secrets are present. Running with the demo `SESSION_SECRET` or `OWNER_API_TOKEN` from .env.example lets anyone forge sessions. | Refuse to start (API) and answer 503 (web) when a value equals the .env.example demo value or `SESSION_SECRET` is shorter than 32 bytes, unless `SEEDHA_DEMO=1`. |
| S15 | info | apps/api/app/services/auth.py:243-250 | Pre-registration. Sign up on an unverified number overwrites its name and hotel, so an attacker can choose the name a real owner later sees on first sign in. | Clear unverified details at verify time when the flow was sign in, or ask for confirmation in onboarding step 1. |

## Checked and fine

- OTP (D4): 6 digits from `secrets.randbelow` (auth.py:104-106); TTL 300 s; resend 30 s
  (auth.py:142-150); 5 tries then a 15-minute lock (auth.py:201-211); while locked a new code is
  refused (auth.py:137-141); a resend inside the TTL keeps the count (auth.py:151-153); single use
  through `used_at` (auth.py:219); `hmac.compare_digest` on a salted SHA-256 bound to the phone
  (auth.py:99-101,200); a failed try is committed before the error (routers/auth.py:287).
- No code in responses or logs unless `seedha_demo` (auth.py:167-171, routers/auth.py:253-256).
- Enumeration when SEEDHA_DEMO is off: a request always says "sent". `no_account` appears only
  after a correct code. Sign up with a verified number never changes it and gives the same
  answer. (With demo on, see S1.)
- Session cookie: HttpOnly, SameSite=Lax, HMAC-SHA256 over `owner.<exp>.<subject>`, the subject
  checked against a regex, constant-time compare, expiry enforced; the old 2-part format is
  rejected (session.test.ts:43); 12 h browser session or 30 days with remember.
- Auth POST routes: Origin check, per-client limit and config check (`guard`). Onboarding PATCH
  checks Origin. The API auth routes need OWNER_API_TOKEN, and the API listens on 127.0.0.1 only.
- BFF: `overview` is the only new prefix (owner). No path skips the session check except
  `public/` and `health`. Segments are checked against a safe pattern. Tokens are added on the
  server side, and only `content-type` and `content-disposition` are passed back. D-072's route
  sweep covers the new API routes (suite passes).
- Validation: `EditIn` 1 to 2,000 characters plus `edit_problem`; Pydantic limits on sign up,
  onboarding (percent 0 to 50, rooms 1 to 500, cost up to 1 lakh) and OTP. Scenario undo,
  test-print, overview, savings season and ask morning take no client input. Errors use the
  shared `{error:{code,message}}` shape with no stack traces.
- Rule 7: PATCH only edits drafts (`not_a_draft` otherwise) and never sends. Approve is a
  separate owner POST.
- Rule 4: approve requires active consent with a number, and an intact record (messages.py:127-135).
- Rule 1: Ask morning uses fixed templates. `phrased` keeps only LLM text with the same numbers.
- CSP unchanged apart from comments; no new origins. `dangerouslySetInnerHTML` appears only for
  the theme boot script and the Desk QR. The QR is SVG built by the `qrcode` library from the API
  URL, and the URL text is not put into the markup. No `eval` or `new Function`.
- D7: no card, CVV or net-banking fields anywhere (grep of app/ and components/).
- D8: no "two-step", "2FA", "encrypted", "PCI" or "secure" claims in the web app. The onboarding
  WhatsApp step says "(simulated)". The OTP banner says "Demo mode · simulated WhatsApp".
- Secrets: no keys in the repo (pattern grep); only .env.example is tracked, and it has demo
  values only.
- D-071: the public API limits are unchanged and there are no new public routes. The auth routes
  have per-client limits on both the web and API layers, plus API ceilings.
