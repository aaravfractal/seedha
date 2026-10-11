# Live features brief (saved word for word, 11 October 2026; line 107 uses role wording for the personal-data test)

FINAL BRIEF: LIVE FEATURES + AGENT TEAM + EMAIL REWRITE
This answers your questions and is the complete plan. Save it to
docs/LIVE_FEATURES.md and commit before starting.

A. ANSWERS
1. Yes, run the live-features build now. Time box: 6 hours.
2. Email rewrite runs LAST, after every gate passes, so new commits are
   covered. My GitHub no-reply address is: <paste address from GitHub>
   Set git config user.email to it for this repo right now.
3. Approved outside the repo: the public Amoy RPC and a Cloudflare quick
   tunnel. I installed cloudflared myself. Install nothing else outside
   the repo.
4. Manual steps stay with me: funding the wallet, the live proof write,
   the phone scan on mobile data. Put them in README-dev.md.
5. Never push. I will push master myself on hackathon day.

B. GROUND RULES
- Do not change money code, locked numbers or the 8-step demo.
- Every new feature sits behind a setting and falls back to the current
  simulated mode, so the demo never breaks.
- Testnet only. No secrets in code, logs, commits or chat.
- Copy: no em dashes, no exclamation marks. Design tokens from
  docs/FRONTEND_MASTER.md. Works at 390 and 1440, light and dark,
  accessible. Never lower a threshold or skip a test.

C. TEAM
LEAD (you, main): plans, assigns files so no two agents edit the same
file, merges, runs gates, commits. Only the lead commits. Max 4
background agents at once. Every agent writes a short status file in
docs/agent-reports/live/ and returns only a summary. If an agent passes
about 250k tokens, it writes its status, stops, and a fresh agent
continues from that file.

WAVE 1: RESEARCH (read-only, parallel)
- R1 Chain: does web3/eth-account install from wheels in the API venv?
  If not, use a pinned ethers v6 Node helper. Confirm Amoy chain ID
  80002, a public RPC URL and the explorer URL format.
- R2 Tunnel: how the cloudflared quick tunnel prints its URL; how Next.js
  and the API proxy behave behind it (cookies, CSP, origin).
- R3 Claude: read the existing Claude client and the D6 guard; draft the
  event JSON schema and prompt outline.
Each returns a one-page note; the lead turns them into tasks.

WAVE 2: BUILD (own worktrees)
- B1 Chain writer: generate a fresh testnet key into .env as
  PROOF_PRIVATE_KEY (show me only the address); add PROOF_RPC_URL and
  PROOF_CHAIN_ID=80002 to .env and empty to .env.example; refuse to send
  unless chain ID is exactly 80002; "Write tonight's proof" sends one
  zero-value transaction to the wallet's own address with the Merkle root
  as data; store tx hash and block; Verified after confirmation; fallback
  to local-only when key, balance or RPC is missing; mocked tests.
- B2 Proof UI: button, pending and Verified states, explorer link,
  "Polygon Amoy testnet" labels, low-balance warning in Settings.
- B3 Desk kiosk: full-screen /desk/device for a phone or tablet in
  landscape (QR, green ring and chime on consent, slip on screen,
  "Printer needs paper"), no header or footer; PUBLIC_BASE_URL read at
  runtime for every QR and guest link.
- B4 LAN and public link: make demo-lan (local network, detects Wi-Fi IP,
  prints owner, Desk and guest URLs) and make demo-live (production demo
  plus cloudflared quick tunnel to port 3000, reads the trycloudflare URL,
  sets PUBLIC_BASE_URL, prints the URLs and a terminal QR). Only the web
  app is exposed. In public mode: sample hotel only, owner pages need
  login, "Reset demo data" works only from localhost, OTP demo banner off,
  rate limits on, Ctrl+C stops cleanly. CORS and headers allow the tunnel
  origin only in these modes. If cloudflared is missing, print the
  install command and exit.
After B1 to B4 merge:
- B5 Event extraction: owner pastes event text and the official source
  URL (no automatic fetching or scraping); with ANTHROPIC_API_KEY, Claude
  returns strict JSON (name, start and end date, town, category, likely
  overnight demand low/medium/high, source URL); reject any rupee amounts
  or prices; labelled sample extraction without a key; stored per
  property; mocked tests.
- B6 Event UI: Calendar "Add events", source links, "Add to plan",
  morning WhatsApp preview (simulated send), labels "From your sources"
  and "Sample". The owner sets any rate; Seedha never suggests a rupee
  figure.

WAVE 3: TEST (parallel, tests only)
- T1 Unit and API tests: chain guard, proof write, events, public-mode
  safety.
- T2 Playwright: kiosk states, QR uses PUBLIC_BASE_URL, events flow,
  proof states, the 8-step loop unchanged.

WAVE 4: REVIEW (read-only, parallel, reports only)
- V1 Security: key never logged or committed, chain guard, tunnel
  exposure, input validation on pasted text, rate limits.
- V2 Honesty and copy: testnet labels, no live claims for simulated
  parts, no AI rupee figures, copy rules.
- V3 Design and accessibility: 390 and 1440, light and dark, contrast,
  keyboard, reduced motion.
- V4 Demo reliability: run demo-live and demo-prod end to end; confirm
  fallbacks when the key, wallet balance or tunnel is missing.

WAVE 5: FINISH (lead)
1. Fix every high and medium finding.
2. make check, e2e three times in a row, the 8-step loop on demo-prod.
3. README-dev.md manual checklist: fund the wallet from an Amoy faucet,
   write a real proof, open the explorer link, run make demo-live, scan
   the QR from a phone on mobile data, consent, watch the Desk turn green,
   paste one real event.
4. Reset demo data. Update docs/progress.md. Commit locally.
5. Email rewrite: backup branch and gitignored .archive copy; git
   filter-repo with a mailmap installed in the API venv; map my old name
   and Gmail to "the owner's GitHub name" and the no-reply address for author and
   committer; keep messages, dates, order and files unchanged; verify
   commit count, the name/email/date list line by line, no Gmail left,
   no file diff; make check. Then delete the backup branch locally so it
   can never be pushed.
6. Reply in 8 lines: what works live, what fell back, the wallet address
   to fund, the faucet step, how to run demo-live, review fixes, gates,
   anything needed from me. Then the rewrite results.
