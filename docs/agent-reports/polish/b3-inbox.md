# B3 inbox seed, simulator and drafts: status (polish/inbox worktree, not committed)

## Files
- API: new `seed/inbox_threads.py`; `seed/load.py` (`load_sample(..., *, with_inbox=False, now=None)`, CLI
  `main()` passes True); `routers/site.py` reset passes `with_inbox=True` only; `services/pipeline.py` (Desk
  step ignores `Consent.seeded`); `services/proof.py` (`erase_consent` also deletes the guest's
  `guest_memory`); `services/inbox.py` (topics, templates, language, profile helpers, seeded consent,
  simulate target); `routers/inbox.py` (profile fields, draft `topic`/`attach`, `is_sample`,
  `POST /inbox/simulate`). Tests: new `tests/test_inbox_seed.py` (36), `test_site_pro_demo.py` reset test.
- Web: `components/inbox/{Inbox,ThreadView,Profile}.tsx`, `Inbox.module.css`, `lib/types-inbox.ts`, new
  `lib/inboxRules.ts` + `lib/inboxRules.test.ts`, new `components/settings/SimulateMessage.tsx` (mounted on
  the Settings page under the Notifications tab, sample hotel only), new `e2e/inbox-threads.spec.ts`.

## Seed (sample hotel only, CLI and "Reset demo data"; pytest fixtures stay off)
- 8 guests on `seed/closes.py` desk stays `CL{offset}{room}` (offsets 3 to 6, so all before the business date
  and after 30 Sep; distinct stays, so rooms never clash): Farhan Thapar CL3108 invoice (EN, unread);
  Yamini Khanna CL3101 late checkout (Hinglish, replied); Esha Negi CL4101 early check-in (EN, read);
  Pooja Ahuja CL4201 parking for two cars (HI, unread); Kavya Zutshi CL3201 Diwali (Hinglish, unread);
  Nikhil Chauhan CL3204 Wi-Fi in room 204 (EN, replied); Tarun Zutshi CL5107 refund (HI, read);
  Lalit Rana CL6209 directions from Dehradun with luggage (Hinglish, unread).
- Consent: `seeded=True`, `WORDING_VERSION`, random salt, `consent.fingerprint()`, `given_at` 19:00 IST on
  the stay night (tz-aware, so `record_intact` holds), numbers `+91 90000 00101..108` (unused by tests).
  All 8 sealed by `write_bundle(..., LocalOnly(), last consent + 4 h)`: 1 bundle, 0 pending.
- Messages dated `now - hours` (anchor moved later only if a message would precede its consent); the
  newest guest text is 0.5 to 22 h old, so every 24-hour window is open right after seeding. Owner
  replies carry the STOP line and transport "simulated". No PerkCode, Message, Saving, DirectBooking or
  StayInvoice rows. 2 preferences per guest (`kind="preference"`) plus 2 notes (`kind="note"`), no money.

## API
- `POST /inbox/simulate` (OwnerDep, 10 a minute per client + global ceiling, 403 `not_sample` for a real
  hotel): next text of `SIMULATE_TEXTS` (10, EN/HI/Hinglish, never STOP, no money) to the next seeded
  thread, rotating by the count of seeded inbound rows; via `handle_inbound` + `record_inbound` (the
  webhook path). If no seeded thread is left, a new seeded consent on the newest unconsented desk stay,
  sealed in its own one-leaf local bundle (never sealing real pending consents); 409 `no_sample_guest`
  if none. Returns `{"consent_id": 3, "guest_name": "Farhan Thapar"}`. Never sends, never stores a draft.
- `POST /inbox/threads/{id}/draft` -> `{text, source, label, topic, attach}`; `attach` is
  `{"kind":"stay_invoice","consent_id":id}` for a bill or invoice request (Claude or template; the text
  never names an amount or number, D6 still applies). Topics by fixed keywords: invoice, refund, wifi,
  late_checkout, early_checkin, parking, directions, booking, else other. Templates in Hindi when the
  guest wrote Devanagari, English otherwise; "other" in Latin script keeps the old canned reply.
- Thread detail `profile` adds `stays_count`, `last_invoice` (newest `stay_invoice.number` of the guest's
  bookings), `notes`, `remembers`, and `language` (English/Hindi/Hinglish of the last guest text).
  `GET /inbox/threads` adds `is_sample`. The client export (Profile "Export this guest's data") includes
  the profile, so notes and preferences are exported; Forget/STOP-erasure/data deletion delete them.

## Web
- Inbox: rows show unread badges, "You:" previews for replied threads; opening a thread whose last bubble
  is the guest's (window open) fetches one suggested draft into the editable composer (never sent);
  overflow menu "More inbox actions" > "Simulate incoming message" (sample hotel) opens the thread;
  `/inbox?thread=<id>` opens a thread and the URL follows the selection; "simulated" appears only in the
  send toast (removed from the composer footer). Invoice slot: `data-testid="invoice-slot"`,
  `role=group` "Invoice", text "Stay invoice ready to attach" in `ThreadView.tsx` `InvoiceSlot`; the lead
  mounts B4's `<InvoicePanel consentId={attach.consent_id} />` inside it.
- Profile: Stays on record, Last invoice, preference list, Notes section.

## Existing e2e specs
- No existing spec needed a change. Full suite (46 tests, incl. a11y on /inbox in both themes, loop
  "0 of 8 done", owner Approvals, desk-kiosk, proof-live, live-smoke) passed once on a fresh CLI seed
  against my own servers (API 8900, `next build --webpack` clone on 3900, temporary config in scratch).
- API: only `test_site_pro_demo.py::test_demo_reset` changed: after reset there are 0 non-seeded
  consents (was "0 consents") and exactly 8 seeded ones, and `/inbox/threads` lists 8.
- Settings mount is the import plus 3 lines in the Notifications branch of `settings/page.tsx`
  (`{data.hotel.is_sample ? <SimulateMessage /> : null}` in a fragment); HotelTabs.tsx untouched.

## Verify
- `cd apps/api && .venv/bin/pytest -q tests/test_inbox_seed.py tests/test_site_pro_demo.py tests/test_inbox.py`
- `cd apps/web && node --test lib/inboxRules.test.ts`; e2e: `npx playwright test e2e/inbox-threads.spec.ts`
