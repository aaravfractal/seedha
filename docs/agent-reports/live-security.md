# V1 Security review: live features (12 Oct 2026, read-only)

Scope: proof key and chain writer, demo-live/demo-lan tunnel exposure, public-mode reset and cookie
logic, Event Radar input, Desk kiosk, CSP. Security unit tests re-run: test_chain_safety, test_chain,
test_public_mode_safety, test_public_reset_guard and test_events_safety all pass.

## Verified clean
- Key never committed: no `.env` was ever added in any commit. `git log --all -p` adds no 0x-prefixed
  64-hex value, and the real PROOF_PRIVATE_KEY value (with or without 0x) appears nowhere in history,
  the working tree (outside .env) or the session tmp dirs. `.env` is gitignored (.gitignore:2) and is mode 0600.
  In .env: PROOF_PRIVATE_KEY, PROOF_RPC_URL and PROOF_CHAIN_ID are set; ANTHROPIC_API_KEY and WhatsApp are unset.
- Key never logged or returned: `Settings.proof_private_key` is `repr=False` (config.py:41). `AmoyWriter.__repr__`
  shows the address only. Logs carry reasons and tx hashes only (chain.py:235,240). A malformed key is
  logged without the value (chain.py:308). httpx exceptions are chained, never logged. ChainOut has no key field.
  proof_wallet.py prints only the address and the faucet URL.
- Chain guard: `chain_enabled` needs PROOF_CHAIN_ID == "80002" exactly (config.py:74). `eth_chainId` must equal
  "0x13882" before every send (chain.py:206). The tx hardcodes chainId 80002 (chain.py:216), so with a
  mainnet RPC in .env the API refuses with wrong_chain, and EIP-155 means a lying RPC cannot replay the tx on
  mainnet either. Floor 0.002 POL and balance >= gas*maxFee are checked (chain.py:208,213). Pending nonce
  is fetched under a lock with one retry. 10 s RPC timeouts, 3 s on status, receipt wait capped at 20 s.
- Tunnel: the API binds 127.0.0.1 (demo-common.sh:42), next binds localhost (demo-live.sh:77). Fresh
  OWNER_API_TOKEN, SESSION_SECRET and DESK_DEVICE_KEY come from openssl and are never echoed. SEEDHA_DEMO is
  empty, so there is no OTP banner. The cloudflared log is deleted on exit.
- Reset guard: the BFF refuses unless Host is localhost:3000 or 127.0.0.1:3000 with no cf-connecting-ip or
  cf-ray header (Cloudflare sets these and a client cannot strip them). The API guard runs on the XFF that
  the BFF sets from the last hop, so the client cannot spoof it. SEEDHA_PUBLIC is honoured only when it is
  exactly "1", on both sides (route.ts:26, site.py:337). The BFF rebuilds the headers it forwards, so a
  client cannot inject x-seedha-subject.
- Cookie Secure is set on https or x-forwarded-proto https. It is skipped only on http for loopback or
  private hosts.
- Events: the URL must be https, have a host, carry no credentials or whitespace, and be at most 500
  chars. The text is capped at 6,000. `</notice>` look-alikes are stripped before Claude sees the text.
  Claude's source_url is never stored. React escapes the name, town and host, and `href` renders only
  when isHttpsUrl passes, with rel="noopener noreferrer".
- Kiosk: safeUrl now refuses whitespace and control characters, and a null payload no longer throws.
  Both T1 notes are already fixed (kiosk.ts:45,68). The QR SVG comes from the qrcode library and holds
  path data only. Web Audio starts only after a tap.
- CSP (next.config.ts:7-20) is still all 'self', with no new external origins. In production there is
  no unsafe-eval.

## Findings
| id | sev | file:line | problem | smallest fix |
|----|-----|-----------|---------|--------------|
| S1 | medium | apps/web/app/api/auth/demo/route.ts:14; apps/api/app/deps.py:80; routers/statements.py:182, assistant.py:80, ask.py:82, inbox.py:351 | On a public tunnel, anyone who taps Direct beta login gets full owner rights on the sample hotel. Claude-backed routes have no rate limit: statement PDF upload (10 MB body, sent to Claude), assistant, ask and inbox draft. Once ANTHROPIC_API_KEY is set (the README checklist step), any stranger can spend the owner's Claude credits without limit. Only /events/extract is limited. | When SEEDHA_PUBLIC=1, have `statement_reader`/`get_phraser`/`get_assistant_phraser`/inbox drafter/`get_event_reader` return None (sample or fixed-text fallback) unless `is_loopback(request.client.host)`. Alternatively, add one shared `claude` bucket, e.g. Limit(10, 60) global, to every Claude dependency. |
| S2 | medium | apps/api/app/routers/proof.py:205-222 | Any tunnel visitor can write a proof: create a consent through Desk check-in and the consent page, then POST /proof/bundle. Each write spends about 0.002 POL. There is no rate limit, and each call holds a worker for up to 20 s. Testnet POL has no cash value, but a funded wallet drains in minutes, and the live "Verified on Amoy" demo then falls back to Local only. | When SEEDHA_PUBLIC=1 and the client is not loopback, use `LocalOnly("public_mode")` in write_tonight (or add a `proof_write` Limit(2, 60) with a global ceiling). The nightly job is unaffected. |
| S3 | medium | scripts/demo-lan.sh:18-20 | demo-lan keeps the .env secrets. SESSION_SECRET, OWNER_API_TOKEN and DESK_DEVICE_KEY all equal the published .env.example values, and SEEDHA_DEMO=1 stays on. Anyone on a shared venue Wi-Fi can forge a session cookie for any subject (including `a<id>` owner accounts), see OTP codes, reset the demo and use S1/S2. The cookie also travels over plain http. | Copy demo-live's three `openssl rand` lines and `export SEEDHA_PUBLIC=1` into demo-lan.sh after load_env. With SEEDHA_PUBLIC=1, the reset guard then also covers the LAN, since the Host must be localhost:3000. |
| S4 | low | apps/web/app/api/[...path]/route.ts:15-54 (desk/poll, desk/ack) | Any sample-owner session on the tunnel can poll and ack the shared device queue. The commands are drained, so the real kiosk misses show_qr. This is demo disruption only: there is no data beyond the fictional sample. | Accept it for a sample-only demo, or refuse `device` access when SEEDHA_PUBLIC=1 and the request is not local, except from the kiosk tab's session. |
| S5 | low | sample-owner routes (settings.py:296,346; site; messages) | Tunnel visitors can rename the hotel, add staff, edit the site and approve drafts. Sends are simulated today (WhatsApp unset). With WhatsApp keys set, approve would send real messages to consented sample guests. All of it is undone by a local reset. | Note this in README-dev: do not set WHATSAPP_* while running demo-live. Optionally refuse `messages/*/approve` with real sends in public mode. |
| S6 | low | apps/api/app/routers/proof.py:200-201; services/proof.py:183-194 | Every GET /proof makes one uncached receipt RPC for each "sent" bundle. Public visitors refreshing the page can get the laptop rate-limited by the public Amoy RPC. | Cache recheck results for 30 s, like `status()`. |
| S7 | low | scripts/proof_wallet.py:54-57 | If .env already exists with mode 0644 (Makefile `env` target cp), O_TRUNC keeps 0644 until `chmod` runs after the key is written. That leaves a brief window, and the script follows a symlinked .env. | `os.fchmod(fd, 0o600)` right after `os.open`, before writing. |
| S8 | low | apps/api/app/services/chain.py:150-154 | PROOF_RPC_URL may be plain http. Nothing secret is lost, because signed txs are public, but a MITM could fake the chain ID or balance. The chainId-80002 signature still prevents mainnet spend. | Refuse a non-https RPC URL in `chain_enabled`. |
| S9 | low | scripts/demo-common.sh:26-28 | `set -a` exports all of .env (PROOF_PRIVATE_KEY, ANTHROPIC_API_KEY) into the Next process too. Nothing is NEXT_PUBLIC_, so nothing reaches the client, but this is wider than needed. | `env -u PROOF_PRIVATE_KEY -u ANTHROPIC_API_KEY npx next start ...` in demo-live and demo-lan. |
| S10 | low | apps/api/app/services/events.py:102-104 | `_plain` collapses whitespace but keeps other control and bidi characters (U+0000, U+202E) in name and town. React escapes them, so there is no XSS, but they can visually spoof a card. | Drop `unicodedata.category(c)[0] == "C"` characters in `_plain`. |
| S11 | low | apps/api/app/routers/events.py:173-176 | The extract limit is keyed by subject, and every tunnel visitor shares "demo". One visitor can therefore lock out the presenter for a minute (5/min). Cost is bounded, which is good. | Accept, or key by `request.client.host` when SEEDHA_PUBLIC=1. |

## T1 low notes, assessed
- safeUrl leading space or newline, and the null show_qr payload: already fixed in kiosk.ts (45, 68). Closed.
- Extra keys in Claude items are dropped, not rejected: safe, because no money field can survive. Keep.
- The API reset guard trusts only request.client: correct, since the BFF overwrites XFF with the last hop. Keep.
- SEEDHA_PUBLIC=true leaves reset open: the scripts set "1". Low risk; document it in .env.example.
- A year kept in an event name: allowed by design (YEAR is stripped before the money check). Keep.

## Verdict
No high findings. S1 and S2 can cost the owner money (Claude) or break the testnet demo when the tunnel
is public. S3 makes demo-lan as open as the tunnel but with forgeable sessions. All three are small fixes
that gate on SEEDHA_PUBLIC=1 and a loopback client, the same pattern as the existing reset guard.
