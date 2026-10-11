# R2: inbox, consent, drafts, D6 guard, invoices, PDF tooling (read-only research)

## 1. Guest inbox today
- Models (`apps/api/app/models.py`): Guest 169 (no phone column), Booking 187, Consent 246 (only home of `whatsapp_number`;
  `proof_status` pending/verified/erased), Message 323 (win-back, unique per perk code), InboxMessage 588 (thread = consent_id,
  direction in/out, sent_by guest/owner/away, read_at), InboxAway 615, OwnerSettings 632 (per *subject*, not per property).
- Service `services/inbox.py`: threads = active consents with a number (105); get_thread 404s withdrawn/erased (122);
  `record_inbound` 331 stores only for active-consent numbers, skips STOP; owner sends only inside the 24 h window (382-388),
  STOP line appended (66); sample hotel always uses SimulatedSender (94-99, S2); `draft_reply` 509 = Claude (`ClaudeReplyWording`
  533, prompt 524) if `d6_ok` 74 passes, else `canned_reply` 493. Drafts are NOT stored: computed on `POST /inbox/threads/{id}/draft`
  (routers/inbox.py:351) when the owner taps "Draft with AI" (`components/inbox/ThreadView.tsx:283`, disabled when window closed).
- Per-thread simulate exists: `POST /inbox/threads/{id}/simulate` (routers/inbox.py:373) = webhook path
  (`messages.handle_inbound` STOP, then `record_inbound`). UI: `SimulateDialog` (`components/inbox/Dialogs.tsx:120`).
- STOP: `messages.py:212` withdraws every consent with that number; erasure `proof.py:267` deletes InboxMessage rows.
- Web: `app/(owner)/(screens)/inbox/page.tsx` -> `components/inbox/{Inbox,ThreadView,Profile,Dialogs,format}.tsx`,
  `lib/types-inbox.ts`; BFF prefix `inbox` is owner (`lib/bff.ts:31`). Empty state copy `Inbox.tsx:305-372` (D-090 I1).

### What changes if 8 consents are seeded (and how to avoid it)
| Place | Today | Impact | Fix |
|---|---|---|---|
| `pipeline.py:48` "desk" = any Consent | false | **loop.spec.ts:11 "0 of 8 done" breaks**, test_overview.py:135 | add `Consent.seeded` (bool, default False); step uses `seeded IS false` |
| Proof overview `routers/proof.py:164-190` | 0/0 | pending 8 or proven/sealed 8, bundles 1, consents_this_month 8 (Oct stays) | seal them in one past bundle via `proof.write_bundle(..., LocalOnly(), at)` so pending stays 0 |
| Overview `_pending_proof` overview.py:288 | 0 | "Write tonight's proof for 8 consents" | same: sealed |
| Approvals / `_drafts` overview.py:260 | none | only if Message rows exist | create no Message, no PerkCode (then `eligible_stays` messages.py:53 never matches) |
| Pro `pro.py:88` active consents | 0 | 8 on demo screen | acceptable; test_site_pro_demo.py:70 uses base fixture |
| Repeat 12 / Rs 41,800, ledger | locked | none if stays check_in > 30 Sep (`repeats.py:35-63`, `ledger.py:217`) | date stays Oct, before DEMO_DATE |
| Desk business date `desk.py:107`, in-house `desk.py:127` | DEMO_DATE | none if every seeded stay ends before DEMO_DATE | clamp check_in to > 30 Sep |
| Savings / "book" step | locked | none (all join Saving) | no Saving rows |
- API tests that break if seeding is on in the default fixtures: test_inbox.py:86-95 (threads == []), test_proof_and_ask.py:62-69
  (pending 2, bundles []), test_owner_screens_api.py:124,161-165, test_chain.py:337-379 (bundles[0], proven 1),
  test_site_pro_demo.py:70 and **82-90 (reset: Consent count == 0)**, test_seed_totals.py:173 (14 desk rows), test_desk_flow.py:176.
- **Proposal**: `load_sample(..., with_inbox: bool = False)`; CLI `main()` (seed/load.py:195) and `reset_demo` (site.py:353-375) pass
  True; conftest fixtures stay False; add an `inbox_sample` fixture. Only test_demo_reset changes (count non-seeded == 0, seeded == 8).
  e2e seeds through the CLI (playwright.config.ts:53-54), so e2e sees threads: loop/owner/kiosk/proof-live stay valid with the
  pipeline filter (owner.spec Neha and loop Rahul are other guests; proof-live 81-114 only needs one new pending consent).
- Stays: reuse B1's `seed/closes.py` one-night desk stays (r1-rooms.md:19-27) for 8 of its guests, so rooms never clash; seed
  inbox after closes. Consent rows via `consent.fingerprint()` (consent.py:96) with `WORDING_VERSION` (28), random salt,
  `given_at` = that stay's check-in evening, numbers fictional and unique (e.g. +9190000001xx; avoid 9000000000, 9811122244,
  9876543210, 9123456780, 9811133355/66 used by tests), `checked_out_at` set. Thread times relative to `now` at seed time:
  unread ones within the last few hours so the 24 h reply window is open for the demo; replied ones older.
- Rule 4 holds: each thread is a Desk consent record on a desk booking; no OTA contact is stored.
## 2. Seed and reset
- `seed/load.py:172-192` load_sample (base, history, today, coded history, optional statements, device). Add `load_inbox(session,
  prop, now)` in a new `seed/inbox.py` called last when `with_inbox`. Reset wipes every table except owner_account, otp_challenge,
  owner_settings, staff_invite (site.py:~364) then calls load_sample, so new tables are wiped and re-seeded automatically.

## 3. "Simulate incoming message"
- Add `POST /inbox/simulate` in routers/inbox.py (owner-only via OwnerDep; refuse 403 unless `prop.is_sample`, like reset).
  Pick the next text from a fixed rotating tuple (index = count of seeded-thread inbound rows mod N; no STOP in the set), target a
  seeded active consent (rotate), then the same path as 373-388 (`handle_inbound` + `record_inbound`). 409 if no thread is left.
- Drafts for new messages: today only on request. Simplest: the response (and thread open with unread) triggers the existing
  `/draft` call client-side; keep drafts unstored, never sent (rule 7). Settings control: a small separate component.
## 4. Invoice
- Rows: Booking list_amount, discount, nights, check_in, room_id, channel; extras: **no column exists** (omit the line, never invent).
  Payment: DirectBooking.payment_method (`upi_simulated` link.py:231; `sample_history` models.py:348); OTA rows: "Paid via <channel>";
  register direct/walk-in rows: method not stored -> "Not recorded" (or seed the invoice guest with a DirectBooking, no Saving).
- Business: Property.name/address (seed/spec.py:11-14). GSTIN: real accounts `OwnerSettings.gstin`; the sample hotel's Settings
  shows fictional `SAMPLE_GSTIN` (routers/settings.py:53-55, `_personal` 224). Demo subject cannot write business fields (64-68).
- No GST rate setting exists. Propose `owner_settings.room_gst_bps` (nullable int; NULL -> default 500 = 5%, rooms up to
  Rs 7,500 a night; all sample rack rates are 3,400 to 6,200, spec.py:22-26). Allow demo to change it (not personal data,
  like the notification switches, D-088). Validate in {0, 500, 1200, 1800}.
- Numbering: none exists. New `stay_invoice` table: property_id, booking_id unique, number unique per property
  (`DEODAR/2627/0001`, Indian FY, <= 16 chars), issued_at, gst_bps_used, taxable, cgst, sgst, total (auditable like Saving).
  Re-request returns the same row.
- Maths (paise, rupee lines): total_paid = list_amount - discount (guest's price; = DirectBooking.amount for link bookings).
  **GST inclusive**: taxable = round_half_up(total * 10000 / (10000 + bps)); gst = total - taxable; cgst = round_half_up(gst/2),
  sgst = gst - cgst. Then total equals the booking row exactly (the brief's test). Adding GST on top would make no total match.
- Ambiguity (flag): OTA list_amount may already be GST-inclusive or not, and on OTA prepaid stays the guest paid the OTA. Show
  "Prices include GST", only the hotel's own tariff and discount (never commission/fees, which are the hotel's costs), and the
  footer "Generated by Seedha. Confirm the tax invoice format with your accountant." Sample hotel PDFs carry "Sample" (rule 11;
  a fictional GSTIN on an unlabelled invoice reads as a real record).

## 5. PDF tooling
- Installed: **reportlab 5.0.1** (BSD, apps/api/.venv; dev extra only, pyproject.toml:38; already used by seed/statements.py:21-25
  with `rl_config.invariant = True` :150), pypdfium2 5.14.0, pdfplumber 0.11.10 (to read PDFs back in tests). Web: no pdf-lib,
  jspdf or @react-pdf. Proposal: move reportlab to main dependencies, log a D-entry (AUTONOMOUS.md:9-15 allows free, known libs).
  No fpdf2 check needed. Set PDF author "Seedha" (personal-data test scans PDF metadata, D-096).
- Fonts: core Helvetica and reportlab's Vera have no rupee glyph; bundled fonts are woff2 only (apps/web/lib/fonts). Print "Rs"
  with Indian grouping in the PDF (not `format_inr`, money.py:171, which emits the rupee sign).
- CSP (next.config.ts:7-20): `frame-src 'self'`, `object-src 'none'`, img-src allows blob:, frame-src does not. BFF passes
  content-type and content-disposition through (app/api/[...path]/route.ts:15,74). Simplest safe preview: render the invoice lines
  as HTML from the API JSON; Download = same-origin `/api/inbox/.../invoice.pdf` with `Content-Disposition: attachment`. An inline
  PDF iframe from same origin is allowed by frame-src but may be blocked by Chrome's viewer under `object-src 'none'`; test before use.
## 6. D6 guard
- `MONEY_PATTERN` drafter.py:24-26 rejects rupee sign, rs+digit, INR, %, "rupees", any 3+ digit number. `d6_ok` inbox.py:74 strips
  only link and code. Consequences: AI replies naming "room 204", "2026" or an invoice number fall back to the template.
- Invoice covering message: Claude writes text only (no number); code attaches the invoice by id (chip with file name), never
  inside the AI text. Tests: mocked wording returning an amount -> template; draft text matches no MONEY_PATTERN; PDF text
  (pdfplumber) holds the amounts and its total equals list_amount - discount of the row.
- Send with attachment: `Sender.send` is text only; sample hotel is always simulated. Store `inbox_message.invoice_id` (nullable);
  for a live non-sample sender refuse the attachment (409) until WhatsApp document upload is built.
## 7. Profile and "What Seedha remembers"
- ProfileOut (routers/inbox.py:127-137) has consent date, wording, proof status, stays, perk code; `language=None` (286). No notes
  or preferences fields anywhere. Propose `guest_memory` (consent_id FK, kind `preference`|`note`, text <= 120, source seed|owner,
  created_at); erase in `proof.erase_consent` (267) beside the InboxMessage delete; include in the export (Profile.tsx:8).
  Preferences only (room view, parking, arrival time); never health, religion or payment data; no AI extraction in this box.
  "Last invoice": from stay_invoice via a B4 helper.

## 8. File ownership
- Lead first (one commit, avoids two agents in models.py/migrations): migration `0012_polish_inbox_invoice.py` + models:
  `consent.seeded`, `guest_memory`, `stay_invoice`, `inbox_message.invoice_id`, `owner_settings.room_gst_bps`.
- **B3**: seed/inbox.py, seed/load.py (with_inbox), routers/site.py (reset flag), services/inbox.py, routers/inbox.py
  (simulate, profile, draft attachment field), services/pipeline.py, services/proof.py (erase memory), tests/test_inbox_seed.py,
  test_site_pro_demo.py:82-90, web components/inbox/* (except Invoice*), lib/types-inbox.ts,
  components/settings/SimulateMessage.tsx.
- **B4**: services/invoice.py (`invoice_for_booking`, `last_invoice(consent)`, pdf), routers/invoice.py (prefix `/inbox`, paths
  `/inbox/threads/{id}/invoice[.pdf]`, so lib/bff.ts needs no change), main.py include, routers/settings.py (GST rate PATCH),
  pyproject.toml, tests/test_invoice.py, web components/inbox/InvoicePanel.tsx + its css module, settings GST field in
  components/settings/HotelTabs.tsx. B3 mounts `<InvoicePanel>` in ThreadView after B4 lands (one import line).
