# T1 API tests: status (worktree pt1, branch polish/t1, not committed)

Tests only; no application code changed. Five new files in apps/api/tests/ (43 cases).

## Added
- `test_rooms_sweep.py`: every sold room on all 7 board nights (8 seeded threads loaded): money
  fields and nights equal the stored row; initials; consent_id equals `active_consent` (8 rooms);
  if_direct equals `compute_saving` on the stay's contract (None for walk-in and direct). No guest
  name, short name or WhatsApp number (+91 or 10-digit) in /rooms JSON or slips. consent_id clears
  after STOP and Forget. A slip on every room changes no PerkCode, Message, InboxMessage, Consent,
  Saving, StayInvoice or checkout and queues exactly 3 desk commands. Demo session on a real hotel: 403.
- `test_invoice_sweep.py`: `build_invoice` on all 1,443 finished counted stays at 0/500/1200/1800/2800
  bps: total = list - discount, taxable + cgst + sgst = total, rupee lines; numbers
  DEODAR/2627/0001..1443 with no gaps, reused across rates. API on the 8 seeded threads at each rate:
  totals equal the consented stay, PDF text has the number and "Total paid Rs ...". Flagged rows:
  404 no_completed_stay while pending and after exclude, no invoice row; after accept MM48213 and
  BK55320 invoice, AG77102 stays 404 (a cancellation). STOP/Forget threads: 404. A consent moved to
  another property: 404 on invoice, PDF, messages and draft, and not listed.
- `test_consent_guard.py`: every thread action (messages GET/POST, draft, read, simulate, forget,
  invoice, PDF) is 404 for STOP, erased and unknown ids, with zero sends. Threads are exactly the
  active consents that have a number. No OTA-only statement guest name in /inbox/threads. An unknown
  number gets no row. Seeded consents never mark the Desk step (seed, simulates, reset); a real Desk
  consent does. D6: the real `ClaudeReplyWording` with a fake client (no network) returning
  rupees, Rs, an invoice number, room/phone numbers, 4,283 or a percent, on all 8 threads: template
  used and the AI text never in the response. Clean text is used. max_tokens, APIConnectionError,
  over 400 chars and blank all fall back. Every template in en/hi/hinglish passes d6_ok for each
  seeded guest. 30 simulate turns: never STOP or money, no outbound. Simulates plus template and AI
  drafts: /messages (approvals) unchanged and empty, no outbound, Message or StayInvoice rows.
- `test_reseed.py`: load_sample(with_inbox=True) in two databases gives identical counts (8 verified
  consents, guest_memory = prefs + notes, 1 bundle, 92 closes, 0 messages and invoices). /demo/reset
  twice: same counts, 8 threads, proof 0 pending / 8 proven / 1 bundle, no step done. After the 6
  sample statements each time: 1,500 rows, 3 flagged, Rs 10,39,108, net Rs 47,33,012, MMT ADR Rs
  2,737, direct Rs 4,283, 12 repeat guests Rs 41,800.
- `test_pro_views_recompute.py`: discount split and khata recomputed with plain integer sums over
  booking rows, exact paise. Floor at 5 targets on all 6 stored contracts: kept(floor) == target and
  kept(floor - Rs 1) < target. Displacement rebuilt from the room board API for group = 22, free + 1,
  free, and 1 x 30 nights. 422 for 23 rooms, 0 or 31 nights, rate 0 and negative rooms.

## Real bugs
- None found. Every requirement held on the current code.

## Notes
- With an enabled away text, a simulate would send the owner-approved away reply by design. The
  tests keep it off.

## Checks (the make check-api sequence)
- ruff, format, mypy strict, pylint (app 9.97, tests 9.99), pytest coverage 98.35%, money 100%,
  bandit, pip-audit and detect-secrets (.venv symlink excluded) all pass. No threshold changed.
