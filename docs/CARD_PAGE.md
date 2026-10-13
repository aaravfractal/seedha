# Card link page brief (saved word for word, 13 October 2026)

FINAL BUILD: MINI-SITE + CARD LINK PAGE WITH FEEDBACK AND BOOK AGAIN,
REMOVE HARDWARE, THEN DEPLOY. Save this to docs/CARD_PAGE.md and commit
first. Fully automatic: do not wait for me.

LEAN AND PARALLEL
Reuse existing code (/h/<slug>, ratings, Seedha Link, perks, QR, scan
counts). Plan once with an exact file list per agent; agents own
non-overlapping files and run at the same time; read only listed files;
mock all external calls; each agent runs only its own tests; make check
runs once at the end; reports under 15 lines; commit after each merge
and update docs/progress.md.

AGENTS (run together)
- A1 API (.worktrees/ma1): finish fields and Postgres-safe migrations,
  editors, verified-guest ratings, scan counts per src, Card QR
  endpoint, plus PART 2 API below.
- A2 Card page UI: PART 2 web below.
- A3 No hardware: PART 3 below.
Then one read-only reviewer (security, privacy, honesty, accessibility,
performance). Lead fixes high and medium findings.

PART 1: CARD QR (A1)
QR for <PUBLIC_BASE_URL>/h/<slug>?src=card-wallet, card-room and
card-desk; error correction H; 4-module quiet zone; SVG and PNG at print
resolution; preview on the Website screen.

PART 2: CARD LINK PAGE (A1 API + A2 web)
When /h/<slug> opens with ?src=card-*, show a welcome panel at the top
before the normal mini-site:
- "Thanks for staying at Hotel Deodar View" (hotel name from data).
- Rate your stay: guest enters the booking reference from their slip
  (and the last 4 digits of the phone used, if on file); verified guests
  give 1 to 5 stars plus an optional short comment; one rating per stay.
  Unverified visitors can send private feedback to the hotel only (never
  counted in the public rating). Rate-limit and validate every input.
- Public rating shows average and count only after 3 verified ratings;
  otherwise "New on Seedha, no ratings yet". Owner can hide abusive
  comments, never edit stars.
- Book again: "Book direct next time: free breakfast" (perk from the
  hotel's settings) opens Seedha Link with dates, room and perk prefilled;
  if the guest has a code from the slip, it applies. Public rate only,
  never a lower price.
- Owner sees new feedback and ratings in the app (Overview "Needs you"
  and the Website screen).
- Sample data for Hotel Deodar View: card page works with the demo
  booking references of the sample guests; zero public ratings by
  default; reset demo data restores this.

PART 3: REMOVE HARDWARE FROM EVERYTHING USERS SEE (A3)
- Website, owner app, pricing, Plans, Pro, FAQ, About, legal, README.md:
  remove the ESP32 box, device renders, printer, paper, LED ring,
  firmware, "hardware cost", "Desk included with yearly plans",
  "Simulate no paper", "Test print" and owner-facing device keys.
- Rename "Seedha Desk" to "Front desk". The consent flow stays as a
  front-desk screen on any phone or tablet (/desk/device), with the slip
  shown on screen or sent by WhatsApp.
- Keep firmware/ and the device API in the repo but out of public pages,
  navigation, README features and the demo path; log in
  docs/decisions.md.
- A test fails if public pages or README mention ESP32, printer, LED
  ring, firmware or hardware cost.

RULES
No changes to money code or locked numbers. No invented ratings,
reviews or customers. Prices only from owner input. Public pages never
call AI. Never print secrets. Copy: no em dashes, no exclamation marks.

GATES
make check, e2e once, the API suite on Postgres, the 8-step loop on
make demo-prod (Front desk screen instead of the device), Lighthouse
mobile 90+ on /h/deodar-view?src=card-wallet.

DEPLOY (approved; only if every gate passed)
Record ROLLBACK_COMMIT (current deploy). Merge into master, then master
into deploy; push master to main and push deploy. Watch Railway and
Vercel until both succeed. Verify live: /health, the home page,
/h/deodar-view and /h/deodar-view?src=card-wallet at mobile size, a
verified rating with a sample booking reference, Book again opening
Seedha Link with the perk, and the 8-step loop on the hosted URLs. Then
reset hosted demo data with the hosted OWNER_API_TOKEN (never print it).
If any live check fails, roll back to ROLLBACK_COMMIT and say why.

FINISH: SEND ME
1. The live card link: https://seedha-demo.vercel.app/h/deodar-view?src=card-wallet
2. A sample booking reference I can use to test "Rate your stay".
3. Where to download the card QR (PNG and SVG).
4. A 6-line summary and hardware mentions removed (count).
5. "LIVE: deployed and verified" or "ROLLED BACK" with the reason.

---

# Plan (lead)

State when saved: hotel-minisite has the V2 mini-site, room details, card
QR panel (SVG/PNG, level H, preview), scan counts, verified ratings via
one-time links (A1, A2, A3 merged). Running: review fixer (mini-fix:
rating time gate, erasure, rate page, two e2e regressions), H1
(nohw-public: website, plans, README, decisions, guard test) and H2
(nohw-owner: Front desk rename, device states removed, loop spec). These
two together are agent A3 of this brief.

Next, when a slot frees:
- C1 API (worktree cp1): booking-reference verification (booking
  external ref plus phone last 4 when a consent number is on file; stay
  ended; one rating per stay shared with the link tokens), private
  feedback table and routes (migration 0018, Postgres-safe), owner
  feedback list and read flag, "Needs you" items, Book again prefill
  data (room, dates, perk, public rate only). Files: services/site_ratings.py,
  new services/site_feedback.py, routers/ratings.py, models.py, migration
  0018, overview needs-you hook, tests/test_card_page_api.py.
- C2 web (worktree cp2): welcome panel on /h/<slug>?src=card-* (thanks,
  rate your stay form, private feedback, Book again link into /link with
  prefill), owner feedback list on the Website screen and Overview item.
  Files: new components/site/v2/CardWelcome.tsx (+css), small mount in
  HotelSiteV2.tsx, app/(app)/link/page.tsx prefill read, new
  components/site/ratings/FeedbackList.tsx, Overview needs-you rendering,
  e2e/card-page.spec.ts.
Then reviewer, fixes, gates, deploy.
