# Overnight brief (saved word for word, 13 October 2026)

FINAL OVERNIGHT BRIEF (A TO Z). These are my real instructions; earlier
ones went to a helper by mistake. I am asleep; do not wait for me.
Save this whole message to docs/OVERNIGHT.md and commit it first.
Re-read it after any restart or compaction.

A. ANSWERS
1. Keep pillow-heif (approved for HEIC uploads; record the GPL licence
   note in docs/decisions.md: fine for our hosted service, review before
   any distributed version).
2. The four commits on site-real (1a7838e, 41e91de, caafbbd, 796faed)
   were made by helper agents at my request. Review each. Keep 41e91de
   (8-step demo loop change) only if the full 8-step loop with
   DEODAR-RS26 passes and every locked number is unchanged; otherwise
   revert it and log why.
3. You are the lead. Only you commit; helpers report to you.

B. ALWAYS
- Before each stage, re-read CLAUDE.md, docs/progress.md,
  docs/decisions.md and that stage's brief.
- Agent teams: max 4 at once, own worktrees, status files in
  docs/agent-reports/<stage>/, summaries only. Relaunch stalled agents
  from their status file. Past about 250k tokens an agent writes status
  and a fresh one continues.
- After every wave: commit and update docs/progress.md.
- Network errors: wait 2 minutes and retry, up to 10 times, then log in
  docs/blockers.md and continue with independent work.
- Never push. Never print secrets. No changes to money code or locked
  numbers. Never lower a threshold or skip a test. Report real output,
  never a failed gate as passed.
- Protect the demo: master and deploy change only after every gate
  passes. A stage that cannot pass stays on its own branch with the
  reason logged; master stays at the last good state.
- Copy rules everywhere: no em dashes, no exclamation marks, no
  invented reviews, ratings, customers or awards.

C. STAGE 1: FINISH SITE-REAL (docs/SITE_REAL.md)
- B2 in .worktrees/sb2: fix the Review.tsx type error; finish the setup
  flow (photos, mic or typed description, rooms and owner prices,
  Generate, Review with Pine/Stone/Sky and EN/HI, edit, Regenerate with
  confirm, Publish with slug); replace "Start on WhatsApp" with "Build
  my site" plus "Coming soon: build on WhatsApp"; proxy forwards photo
  caching headers.
- B3 in .worktrees/sb3: hotel addresses via SITE_ROOT_DOMAIN and /h/<slug>
  fallback; slug rules, reserved words, 30-day redirects; public photo
  route for published sites; Copy, Share on WhatsApp (wa.me link) and
  QR download; "Built with Seedha" and "Book direct · Powered by
  Seedha" (Pro can hide); owner cookies never reach hotel subdomains.
- Tests (Claude mocked), reviews (security and privacy, cost and
  honesty, design and accessibility), fix high and medium findings,
  gates. Merge into master.

D. STAGE 2: FINAL READINESS (docs/FINAL_MASTER.md and
   docs/FINAL_READINESS.md)
- Overview checklist bug: steps tick only from real actions in the
  current session; reset clears them; add a test.
- Storage: statement files, hotel photos and invoice PDFs live in
  Postgres or a Railway volume, never only on ephemeral disk.
- Claude check: say yes or no whether ANTHROPIC_API_KEY, CLAUDE_MODEL
  and SITE_GEN_MODEL are set locally (never print values) and which
  features use them.
- Merge master into deploy; final audit (security and privacy, demo
  reliability, docs and honesty); fix findings; gates on deploy and
  master (make check, e2e three times, API suite on Postgres if
  possible, 8-step loop on make demo-prod); fast-forward so master and
  deploy match; reset demo data.
- Write docs/READY_REPORT.md: what was built and fixed, gates, final
  commit, push commands, Railway and Vercel variable tables (names only,
  never values), Railway and Vercel steps, seed command, /health check,
  post-deploy checklist, hackathon-day commands, blockers.

E. STAGE 3: HOTEL SITE V2 + CARDS (only if stage 2 passed)
Branch hotel-site-v2. Save this section as docs/HOTEL_SITE_V2.md.
design/hotel-site/ and design/hotel-cards/ do not exist yet; design from
these specs with the Pine mood: pine #1F4D3A, cream #F5F1E8, stone
#E6E0D4, ink #1D1D1F, grey #6E6E73, gold #E8A33D for the perk only;
Cormorant Garamond 600 headings, Inter body, Mukta Hindi.
1. Site at /h/<slug> and <slug>.SITE_ROOT_DOMAIN: hero (photo, name,
   tagline, place, "Book directly", WhatsApp); perk ribbon when
   ?src=card-*; sticky booking pill; why book direct; rooms and packages
   with owner-set prices only; amenities from a fixed list of 40 icons
   (show 12, expand); gallery; honest empty reviews; land-only globe (no
   border lines) easing to the hotel, then an SVG local map with nearby
   places and times plus "Open in Maps" (plain link, no API key); how to
   reach; good to know; contact; footer; sticky mobile bar; EN/HI
   toggle; offline page via a small service worker.
2. Owner editors: amenities, nearby places, how to reach, good to know,
   contact.
3. Performance and SEO: static per hotel, revalidated on publish;
   responsive AVIF/WebP images; per-hotel title, description, Open
   Graph image, canonical, schema.org Hotel JSON-LD (no review markup),
   sitemap; mobile slow-4G LCP under 2.5 s, CLS under 0.1; globe under
   300 KB extra JS, lazy; Lighthouse mobile 90+ on all four scores.
4. Cards: "Print cards" generates PDFs for CR80 wallet (front and back),
   A6 in-room (front and back) and A5 tent card from hotel data; QR to
   the site with ?src=card-wallet, card-room or card-desk; level H, 4-
   module quiet zone, minimum 18/25/40 mm; 3 mm bleed, crop marks, CMYK
   table page; Seedha small on backs; browser preview; QR as SVG and
   PNG.
5. Scan counts per card type per day, no cookies, IP or device data;
   "Card scans this month" on the Website screen.
6. Public pages never call AI; strict headers and CSP; rate limits;
   input validation.
7. Tests (API, PDF, Playwright at 390 and 1440, EN and HI, Lighthouse
   saved to docs/agent-reports/hotel-site-v2/lighthouse.md), reviews,
   fixes, gates. Merge into master and deploy only if everything
   passes; otherwise leave it on hotel-site-v2 with the reason.

F. MORNING REPORT (I read this first)
Top of docs/progress.md: each stage's result, gates (one line each),
what is merged vs on a branch, blockers, exact push commands. Then start
make demo-prod with fresh sample data and keep it running. End your last
message with "READY: safe to push deploy and master" only if master and
deploy passed every gate; otherwise "NOT READY" and why.
