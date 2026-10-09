# Decisions made without Aarav

Each entry: what was decided, why, and where it lives. Newest at the bottom.
Binding inputs: CLAUDE.md, docs/rulings.md (rulings 1 to 7, answers A to D).

## M1 Foundation

**D-001 Travel-agent commission carries no GST.** The locked numbers include
travel agents' commission Rs 68,400 with GST on commission Rs 0, and paid to
channels Rs 10,39,108 only reconciles that way. Rule 2 ("GST = 18% of
commission") is read as applying wherever GST is charged; small agents who
are not GST-registered invoice commission without GST. Modelled as
`channel_contract.gst_applies = false` for travel agents. The rule itself is
unchanged: wherever GST applies it is exactly 18%, rounded per line.
Flagged for confirmation in needs-from-aarav.md.

**D-002 Statement lines (answer B).** 1,500 lines: MakeMyTrip Apr-Jun 410
(330 stays, 79 cancellations, MM48213), MakeMyTrip Jul-Sep 412 (228 stays,
184 cancellations, a monsoon-heavy cancellation story), Booking.com 214 (200
stays, 13 cancellations, BK55320), Agoda 96 (88 stays, 7 cancellations,
AG77102), travel agents 180 (165 stays, 15 cancellations), hotel register 188
(75 walk-in and 113 direct stays). Cancellation lines carry zero money.

**D-003 TDS and TCS are modelled as credits.** Booking rows have `tds` and
`gst_tcs` columns. They are withheld from the payout, so they take part in the
payout math check, but they are never part of net_kept (rule 2). The sample
uses TDS u/s 194-O at 0.1% of the post-discount amount on OTA rows, TCS 0.
Rates are illustrative sample data, not tax advice.

**D-004 What "fails the math check" covers.** Rule 3's payout check (within
Rs 1) plus three related row checks, all flagged and excluded until reviewed:
commission on a cancelled stay, GST on commission missing, GST not 18% of
commission. `booking.math_check_passed` means "every row check passed";
`flag_reason` and `flag_detail` say which failed.

**D-005 Repeat-guest planted amounts.** Commission + GST per return booking
is computed from the contract with per-line rounding, so some integers are
unreachable (e.g. Booking.com cannot produce exactly Rs 3,720). Targets
3,719 / 3,921 / 3,409 / 3,761 were used; the prototype's visible three stay
exactly Rs 3,480 (Rahul S.), Rs 3,120 (Neha Gupta), Rs 4,060 (A. Verma
family) and the 12 still total exactly Rs 41,800.

**D-006 Monthly breakdown (ruling 6).** Room nights by check-in month: Apr
270, May 330, Jun 330, Jul 150, Aug 140, Sep 280 (monsoon dip), split per
channel by largest remainder. Every channel line item sums exactly to its
locked 6-month total. MakeMyTrip's real September "paid" figure (commission +
GST) is Rs 1,09,542. A booking belongs to the month it checks in.

**D-007 Today's in-house stays.** 14 rooms on the demo date, gross Rs 58,800
as in the prototype close slip. Commission, GST and net are computed from the
rows and are not forced to the prototype's Rs 10,900 / Rs 47,900, because
Neha's own booking carries a Rs 600 hotel-funded promo (ruling 4).

**D-008 Demo date.** DEMO_DATE in .env, or the day `make seed` runs. The
loader refuses any date on or before 30 Sep 2026 so Desk activity can never
fall inside the ledger window (answer D).

**D-009 `make seed` loads no statements.** The demo starts at Upload exactly
like the prototype (empty flip: "No statements yet"). `make seed-full` loads
the 1,500 lines directly for tests and quick checks.

**D-010 Owner authentication.** API owner routes require
`Authorization: Bearer OWNER_API_TOKEN`. The browser never sees that token:
the web server's /api/* proxy adds it after checking a signed, httpOnly owner
session cookie (HMAC-SHA256 with SESSION_SECRET, 12 h). Owners log in with
OWNER_PASSCODE. The proxy only forwards an allowlist of API paths. Desk device
routes get DESK_DEVICE_KEY added server-side. `proxy.ts` (Next 16's renamed
middleware) redirects owner pages to /login.

**D-011 Contrast over exact prototype greys.** The prototype's #86868B grey,
#1F8A55 green, #D7372B red and #E8A33D gold text fail 4.5:1 on its light
background. Light mode uses #6E6E73, #1A7A4A, #C4312A and #9A6210 for text;
gold #E8A33D is kept for fills and accents. Dark mode keeps prototype values,
and buttons use dark text on the light-green dark-mode accent.

**D-012 npm audit gate.** eslint-config-next pulls braces <= 3.0.3
(GHSA-vfj7-8cjw-p6xm, regex DoS on hostile glob patterns) and no fixed
version exists. It is a dev-only lint tool that only sees our own patterns.
`scripts/audit-check.mjs` fails on any high/critical advisory except this one
reviewed entry, which expires 31 Dec 2026, and fails on any high/critical in
production dependencies. Downgrading eslint-config-next to 14 (npm's
suggested fix) would break Next 16 linting.

**D-013 Pylint on tests.** Tests are linted with every rule except
missing-function-docstring; the test names state the behaviour. Application,
seed and migration code is linted with all rules on.

**D-014 Web unit tests** run on Node's built-in test runner (`node --test`,
native TypeScript type stripping), so no extra test framework is added.

**D-015 GNU Make 3.81.** macOS ships Make 3.81, which has no .ONESHELL, so
recipe steps are chained with `&&`.

**D-016 Theme preference cookie.** Light/dark choice is stored in a
strictly necessary `seedha_theme` cookie and applied by an inline script
before first paint. No analytics or advertising cookies exist.

**D-017 Ruling 2 wording on the flip stats.** The prototype stat "of room
revenue lost to channels" becomes "of list revenue paid to channels"
(Rs 10,39,108 / Rs 63,05,000 = 16.5%), because the bare word "lost" is not
allowed.

## M2 Statement upload and parser

**D-018 Known PDF layouts are read by plain code.** CLAUDE.md sends PDFs to
Claude. The MakeMyTrip payout PDF is a fixed table, so it is read with
pdfplumber tables first; Claude is used for any PDF, Excel or CSV whose layout
Seedha does not recognise. This keeps every sample number exact, keeps the
demo working without keys, and is closer to rule 1. Layouts are recognised by
their headers, never by file name.

**D-019 Claude output is grounded.** Claude copies amounts as printed (strict
JSON schema, strings). Every non-zero amount it returns must appear in the
source file (per cell for tables, grouping-aware for PDF text) or the row is
flagged `not_in_source` and kept out of the flip. Grounded rows still pass the
same payout check as any other row.

**D-020 Upload limits.** One file per request so the progress shown is real;
10 MB per file; Excel refused if it unpacks to more than 100 MB (zip bombs);
PDFs over 300 pages refused; file type checked against the bytes.

**D-021 Duplicates never double-count.** Same bytes again: "already read",
nothing stored. Same (channel, reference) in another file: skipped and
reported as "already counted".

**D-022 Owner review of flagged rows.** Each flagged row offers "Keep it out"
(excluded) or "Count it anyway" (accepted). Only accepted rows join the
ledger (rule 3).

**D-023 Claude model and failures.** `CLAUDE_MODEL` defaults to
`claude-opus-5` in .env.example. Server-side refusal fallbacks (a beta
feature) are not enabled: a refusal, timeout or API error simply means the
file is reported as unreadable and the owner can export it as CSV. Money is
unaffected either way.

**D-024 One booking builder.** The seed loader and statement upload both
build bookings through `services/rows.to_booking` and `ingest.BookingWriter`,
so checks and money lines can never drift between the two paths.

## M3 Ledger and the flip

**D-025 The flip insight must be true.** The prototype says MakeMyTrip "left
you the least per room", but on the locked data Agoda (Rs 2,598) is below
MakeMyTrip (Rs 2,737). The sentence is built from the computed ranks: "MakeMyTrip
brought the most bookings, but 4 channels left you more per room." (Hindi:
"... par 4 channels ne har room par zyada paisa chhoda."). It contains no rupee
figure. The toast "MakeMyTrip drops from 1st to 5th" is computed the same way.
Templates, not Claude, so it works without a key and can never be wrong.

**D-026 Highlight colour.** The prototype rings the MakeMyTrip row in gold
after the flip. Gold is reserved for money saved, so the ring is pine.

**D-027 "Show the maths".** Each flip row can expand to show list revenue,
discount, commission, GST, fees, net kept and net per room, so every number
on the hero screen is auditable in place.

**D-028 Flip stats.** Four stats as in the prototype; "Lost vs list price
Rs 15,71,988" is the named sub-line under "paid to channels" (ruling 2), and
"Commission-free share 16.7%" is the sub-line under "Direct bookings 10.7%"
(ruling 3).

**D-029 Ledger range.** `start`/`end` query parameters (inclusive check-in
dates), default 1 Apr to 30 Sep 2026, at most 366 days. `/ledger/monthly`
gives per-channel month figures by check-in month for Ask (M7).

## M4 Repeat guests and Saturday move

**D-030 Matching rules.** Names are normalised (honorifics, "family",
punctuation removed; Gurgaon = Gurugram). Surname weighs 0.6 and first name
0.4 (Jaro-Winkler). Two spelled-out surnames must be at least 0.90 alike and
two spelled-out first names at least 0.92 alike, otherwise they are different
people (this keeps Srivastava/Shrivastava and Neha/Neeha, and rejects
Mathur/Marwah and Manish/Mansi). An initial matches its full name at reduced
weight (S. = 0.7, A. = 0.5). Same city +0.10, different city -0.15.
Suggestions start at 0.60; Claude is asked only between 0.60 and 0.80 and can
only remove a suggestion ("different") or annotate it. On the sample data the
matcher finds exactly the 12 planted pairs and nothing else (tested against
the answer key).

**D-031 Sample confidence spread.** Two planted first stays carry another
city (Neha: Delhi, Verma family: Kanpur) so the demo shows 85% and 65%
matches that genuinely need the owner, not a wall of 100%. Only two history
rows changed; no money moved.

**D-032 Order of repeat guests.** Unconfirmed first, least certain first, so
the owner's attention goes where judgement is needed. Dismissed matches
disappear and are not suggested again.

**D-033 The Saturday move is computation.** Extra per Saturday = rooms x
(direct net per room - lowest OTA net per room) = 6 x (4,283 - 2,598) =
Rs 10,110. No forecast of how many Saturdays fill. The owner can change the
room count (1 to 22), and Accept records the decision only: Seedha does not
change OTA settings, and the card says so.

## M5 Desk, consent and slips

**D-034 The guest types their own WhatsApp number.** The prototype's consent
screen has no number field, but a message needs one, and rule 4 forbids using
OTA contacts. The consent page asks the guest for it next to the unticked box;
it is stored only on the consent row and never logged (tested).

**D-035 Perk code at checkout for every guest.** The slip in hand carries the
code (e.g. DEODAR-NG26) whether or not the guest said yes to messages; a
WhatsApp draft still requires an active consent (M6). Checking out twice
returns the same code.

**D-036 The desk's business date** is the latest Desk check-in date, so the
demo works on any day after `make seed`, not only the seeding day.

**D-037 The Desk simulator is a real device client.** It polls
`GET /desk/poll` every 2 s with the device key (added server-side by the web
proxy), runs `show_qr`, `show_ok`, `show_text`, `show_idle`, `set_ring`,
`beep`, `print_slip`, then `POST /desk/ack`. The firmware (M8) speaks the same
protocol. The box never receives guest contact data.

**D-038 Consent links.** 32 random bytes (urlsafe), only the SHA-256 stored,
valid 10 minutes, single use; a new QR for the same booking revokes the old
one. Expired or used links answer 410, unknown ones 404. The API refuses
anything but `agree: true`.

**D-039 New dependency: `qrcode` (npm, MIT)** renders the Desk QR as SVG in
the simulator, as the prototype did with qrcodejs from a CDN.

**D-040 Guest pages have no owner navigation.** `/consent/*` and
`/link/<code>` show only the brand, because guests open them on their phones.

**D-041 "Nothing to compute yet" is not an error.** `GET /scenario/saturday`
returns 200 with `available: false` and a reason before statements exist;
recording a decision then is still a 422.

**D-042 Next 16 Cache Components.** The header and page content sit inside
`<Suspense>` in the root layout so dynamic routes (consent links) stream
without prerender errors.

## M6 Win-back, Seedha Link and savings

**D-043 Drafts are created by events, not by reading.** A draft is made at
checkout (if the guest has an active consent) or when consent arrives after
checkout. `GET /messages` only reads. A unique constraint allows one message
per perk code. (The first version drafted on GET; two screens loading at once
produced duplicates, found in the browser check.)

**D-044 Draft rules.** Template: "Namaste Rahul ji, thank you for staying at
Deodar View. Book your next stay directly with us and breakfast is on us. Code
DEODAR-RS26: <link> Reply STOP to opt out." Claude may reword it, but its text
is used only if it contains the code (outside the link), the link, ends with
"Reply STOP to opt out." and has no ₹/Rs/INR amount, percentage or "rupees";
otherwise the template is used. The link to Seedha Link is included so the
guest can book in one tap.

**D-045 Sending.** Approval re-checks consent at send time. Without WhatsApp
keys the send is SIMULATED (recorded on the message, logged without number or
text, labelled in the UI). Live sends use the Cloud API text message;
`WHATSAPP_API_VERSION` is configurable (default v21.0, to be confirmed).
WhatsApp requires an approved template for business-initiated messages
outside a 24-hour window; see needs-from-aarav.md.

**D-046 STOP.** STOP, STOP ALL, UNSUBSCRIBE and OPT OUT (any case) withdraw
every active consent for that number, block unsent drafts and record an
`optout_event` (no number stored). Inbound webhooks must carry a valid
X-Hub-Signature-256; without `WHATSAPP_APP_SECRET` they are refused (503).
The demo has a labelled "Simulate guest reply STOP (sample)" button.

**D-047 Seedha Link pricing and redemption.** Price = public (rack) rate x
nights; the perk is extra, never a lower rate (rule 6). Two suggested
Friday-to-Sunday stays about a month out; any date up to a year ahead is
accepted by the API. A code is redeemed by one conditional UPDATE so it can
never be used twice; a used, unknown or missing code books with no saving.
The guest's confirmation never shows the hotel's saving.

**D-048 Saving rows** store the original channel and its contract rate;
nothing is claimed when the original channel took no commission (walk-in,
direct).

**D-049 Razorpay is not built yet.** Only simulated UPI is implemented and
labelled. Building Razorpay checkout without test keys would mean untested
payment code; it is listed in needs-from-aarav.md.

**D-050 Playwright e2e** runs its own API (port 8001, fresh `e2e.db`
seeded by the server command itself) and a production build of the web app
(port 3001), with every integration forced to simulated. It is part of
`make check`.

**D-051 Alembic logging.** `migrations/env.py` keeps existing loggers
(`disable_existing_loggers=False`); otherwise an in-process migration silenced
the "SIMULATED" warnings.

**Note on dev caching.** If CSS changes do not show in `next dev`, delete
`apps/web/.next/dev` (Turbopack's persistent cache missed appended rules once;
production builds were unaffected). `make clean` removes it.

## M7 Proof and Ask

**D-052 Merkle tree.** Leaf = SHA-256(fingerprint bytes), parent =
SHA-256(left || right), odd node paired with itself, leaves in consent order.
The proof dialog recomputes the root from the fingerprint and its path on
every view, so "Matches. Not changed." is a live check, not a stored flag.

**D-053 Chain write not built (B-001).** Roots are stored and verified in
Seedha; the UI says "Stored by Seedha. Not yet on a public chain
(simulated)". `eth-account` would not install here.

**D-054 Erasure.** Removes salt and WhatsApp number, sets erased/withdrawn,
replaces the consent row's fingerprint with a random value, unlinks the
bundle item (consent_id = NULL) and blanks message texts. The published
fingerprint and root stay valid but point to no one (CLAUDE.md M7).

**D-055 Ask.** Six fixed questions computed by the same services as the
screens: last month's MakeMyTrip "paid" from the ledger for the previous
calendar month of the desk's business date (September: Rs 1,09,542), best
channel overall and best online channel by net per room, repeat guests and
commission paid twice, payouts for OTA/agent stays from the last 7 days with
sample payout terms (MakeMyTrip on Friday, Booking.com virtual card, Agoda
month end, agents directly), savings this month, tonight's close. Claude may
reword the Hindi sentence only if it carries exactly the same numbers and
the same count of rupee amounts; otherwise the template is shown. English is
available with a toggle.

**D-056 Nightly proof job.** `make proof-nightly` (or `python -m app.jobs
nightly-proof` from cron at midnight) bundles every property's pending
fingerprints; the Proof screen has the same "Write tonight's proof" button.

**D-057 Nav matching.** A path matches a screen only exactly or as a prefix
followed by "/" (so /proof no longer lights up /pro).

## M8 Desk firmware

**D-058 Firmware split.** All logic that does not touch hardware (command
dispatch, dedupe of re-sent commands, a bounded offline ack queue, ESC/POS
framing, UTF-8 to ASCII) is in `lib/desk_core`, plain C++17, unit-tested on
the laptop with Unity (`pio test -e native`). `src/main.cpp` only drives the
TFT, QR, ring, printer, buzzer, button and HTTPS.

**D-059 Contract test.** `apps/api/tests/test_firmware_contract.py` records a
real `/desk/poll` sequence into `firmware/seedha-desk/test/fixtures/poll.json`;
the firmware tests replay it, so API and box cannot drift. The bench mock
server serves the same file.

**D-060 Printer and screen text are ASCII.** Thermal printers use a
single-byte code page and TFT_eSPI's built-in fonts are ASCII, so the API's
slip text spells out ₹ as "Rs", − and · as "-", folds accents, and the
firmware replaces anything else with "?".

**D-061 TLS.** The box verifies the API's certificate against the root CA in
`secrets.h`; plain HTTP is used only if `SEEDHA_API_BASE` starts with
`http://` (bench testing against the mock server). The button reprints the
last slip. Libraries pinned: espressif32 6.10.0 (Arduino 2.x, which TFT_eSPI
2.5.43 supports), ArduinoJson 7.4.3, Adafruit NeoPixel 1.15.5, ricmoo/QRCode
0.0.1.

## M9 Polish for demo

**D-062 Site prices are computed.** Package price = public room rate x nights
+ listed extras (breakfast for two Rs 400 a day, late checkout Rs 500):
Weekend Rs 9,400, Char Dham Rs 4,300, Monsoon midweek Rs 11,900. Reasons
come from the data where possible ("July and August are your emptiest
months"). The setup chat replays the sample hotel's answers and says so;
the site address is labelled a sample.

**D-063 Pro cards.** Audit is computed (commission + GST on flagged
cancelled stays, plus excess over the contract rate on any stay). Pulse and
Rate Watch need outside data (event calendar, OTA screenshots), so they keep
the prototype's examples with a visible "Sample" tag.

**D-064 Plans.** Yearly = 10 x monthly, shown per month rounded half-up
(Rs 1,249 / 2,083 / 3,333; Rs 14,990 / 24,990 / 39,990 a year). "Start with
X" goes to the contact page with the plan noted (no fake sign-up).

**D-065 Demo reset.** Settings has "Reset demo data" (confirm step), allowed
only for a property marked as sample; it deletes every row and reloads the
sample hotel. Settings also shows which connections are live or simulated.

**D-066 No create-on-read races.** Site settings are created with the
property, and `get_config` recovers if two first requests race (savepoint,
then re-read). Found when two screens loaded at once (same lesson as D-043).

**D-067 `make seed` rebuilds the schema in place** (alembic downgrade base,
upgrade head) instead of deleting the file, so a running API immediately
sees the fresh database. `make dev` clears Turbopack's dev cache on start.

## M10 Static and legal pages

**D-068 Legal pages.** About, Privacy (DPDP Act 2023 / Rules 2025), Terms,
Cookies, Delete my data, Security, Contact and FAQ, each with the required
draft notice and last-updated date, key points switchable to Hindi
(Hinglish), and only the placeholders Aarav named. Facts come from CLAUDE.md
and the built behaviour. Points a lawyer must settle (fiduciary roles, legal
basis per activity, retention periods) are stated as open, not invented.

**D-069 Data deletion.** `POST /public/data-deletion` (booking reference +
WhatsApp number) erases a matching active consent with the M7 erasure
service and records only that a request arrived and whether it matched. The
answer is identical either way, so the page cannot be used to learn who
stayed at a hotel.

**D-070 Cookies.** Two strictly necessary cookies (owner session, theme
choice); no analytics or advertising, so no banner. Guest pages set none.

## M11 Final hardening

**D-071 Rate limits.** No new dependency: an in-memory sliding window, one per
process. API public routes, per client address per minute: consent 20 (GET
and POST share a bucket), link page 30, link booking 10, data deletion 5;
each also has a ceiling across all clients of 20 times that. Owner login in
the web app: 10 attempts per 15 minutes per address. Over the limit the
answer is 429 `too_many_requests` with `Retry-After`. The BFF forwards the
caller's address in `X-Forwarded-For`; uvicorn trusts it from loopback
(FORWARDED_ALLOW_IPS). `next start` only fills that header when absent, so in
production a proxy in front of the web app must overwrite it, otherwise a
client can rotate addresses and only the global ceiling applies. Several
processes need a shared store (Redis) instead.

**D-072 Route auth sweep.** A test reads every operation from the OpenAPI
schema, so a new route is covered automatically: anything not in the known
public or device set must answer 401 with no token, a wrong token, or the
device key. (FastAPI 0.143 nests included routers, so `app.routes` alone does
not list them.)

**D-073 Accessibility checks.** Added dev dependency `@axe-core/playwright`
(free, the standard axe engine for Playwright; allowed under answer A). The
e2e suite runs axe with the WCAG 2.0/2.1 A and AA rules on all 27 pages, in
light and dark, at 1440 and 390 px. axe cannot judge everything, so keyboard
behaviour is tested directly: a skip link, and dialogs that take focus, keep
Tab inside, close on Escape and hand focus back (`useDialogFocus`).

**D-074 Flip speed.** Measured on the production build in the e2e suite:
from navigation start to ranked rows with a working toggle, under 1,000 ms
(about 190 ms cold, 85 ms warm locally); re-ranking under 300 ms (about
5 ms), timed inside the page so Playwright's own checks are not counted.
