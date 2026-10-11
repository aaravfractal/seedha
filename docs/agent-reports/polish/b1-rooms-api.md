# B1 rooms API: status (polish/rooms-api worktree, not committed)

## Files
- new `apps/api/seed/closes.py`: 92 fixed fictional one-night desk stays (`source="desk"`, already checked
  out at 11:00 IST next day) on DEMO_DATE-6..-1. Refs are `CL{offset}{room}`. Money comes from
  `money.line_items_for_booking` and each channel's contract. Promo is MMT 12% and Booking.com 10%.
  TDS is 0.1% on OTA rows and goes only into the payout.
- `seed/load.py`: import plus `load_closes(session, prop, demo_date)` after `load_coded_history`.
  "Reset demo data" calls load_sample, so it re-creates the closes.
- new `app/services/rooms.py` and `app/routers/rooms.py` (prefix `/rooms`, OwnerDep), registered in
  `app/main.py`. Reuses `last_night_for`, `in_house`, `owner_initials`, `active_consent` and
  `compute_saving`, plus `checkout_slip` and the desk router's `today`, `slip_out` and `SlipOut`.
  The contract query is copied into `rooms.contract_terms` (keyed by channel_id), so link.py is untouched.
- new `apps/api/tests/test_rooms.py` (22 tests); `apps/web/lib/bff.ts` gets `["rooms","owner"]`, tested
  in `bff.test.ts`.

## Counts changed (seed grew by len(CLOSE_STAYS) = 92; no thresholds changed)
- `test_db_and_cli.py:66` and `test_seed_totals.py:134` add `+ len(CLOSE_STAYS)`.
- `test_seed_totals.py:174` now reads `len(desk) == 14 + len(CLOSE_STAYS)`.
- Unchanged: Rs 10,39,108, MMT net ADR 2,737, direct 4,283, net 47,33,012, 1,500 rows, 3 flagged,
  12 repeat guests / Rs 41,800, and tonight at 14 of 22 sold, 21%. Ask "payouts this week" now includes
  the OTA closes (its test only checks the prefix).
- Nights (sold / net Rs / direct bookings %): 10-07 12/38,494/8, 10-08 15/47,795/13, 10-09 17/55,633/12,
  10-10 19/60,546/11, 10-11 13/44,314/15, 10-12 16/51,245/6, 10-13 14/46,691/21.

## API (money is integer paise)
`GET /rooms/nights` returns 7 nights, oldest first; the last is the business date. by_channel lists
every channel in sort order, zeros included.
```json
{"business_date":"2026-10-13","is_sample":true,"nights":[{"night":"2026-10-13","rooms_sold":14,
 "rooms_total":22,"net_kept":4669100,"direct_bookings_pct":21,
 "by_channel":[{"channel_key":"mmt","channel_name":"MakeMyTrip","rooms":5}, ...],
 "tiles":[{"room":101,"channel_key":"mmt","code":"MMT","sold":true},
          {"room":111,"channel_key":null,"code":null,"sold":false}, ...]}]}
```
`GET /rooms/{night}/{room}` returns the stored booking columns. Errors: 404 `room_empty` (empty or unknown
room), 404 `night_not_on_board` (night outside the 7), 422 `invalid_input` (bad date, or room < 1).
```json
{"night":"2026-10-13","room":104,"booking_id":153,"channel_key":"bcom","channel_name":"Booking.com",
 "channel_kind":"ota","nights":1,"list_amount":400000,"discount":60000,"commission":61200,
 "gst_on_commission":11000,"fees":0,"net_kept":267800,"guest_initials":"NG",
 "consent_status":"not_consented","consent_id":null,"checked_out":false,
 "if_direct":{"extra_kept":70800,"commission_avoided":61200,"gst_avoided":11000,"upi_fee":1400,
              "commission_rate_bps":1800,"label":"Illustration"}}
```
`consent_status` is `consented_at_desk` or `not_consented`. `consent_id` is set only while the consent is
active. `if_direct` is null for walk-in and direct. It uses `compute_saving(list_amount - discount,
contract bps, gst)`.

`POST /rooms/{night}/{room}/slip` returns the desk SlipOut `{title, subtitle, lines[{label,amount,bold}],
footer[], text}`. It comes from `booking_lines` through `checkout_slip`, with the existing perk code if
one exists. It queues show_text, print_slip and show_idle, the same three commands as close-slip. It
never issues a code, never checks out and never drafts a message. The subtitle shows initials
("NG · Room 104"), so no full name appears anywhere in the API.

## For the lead (not edited, B2 owns it)
`apps/web/app/(owner)/home/parts.tsx:271`: change the label text "direct share" to "Direct bookings"
(ruling 3). The value is direct only (`overview.py:208`); keep the number and change only the words.

## Verify
- `cd apps/api && .venv/bin/pytest -q tests/test_rooms.py tests/test_seed_totals.py tests/test_db_and_cli.py`
- Full check-api passed: ruff, format, mypy strict, pylint 9.97 / 9.98 (new files 10.00), pytest exit 0 at
  98.10% coverage, money code 100%, bandit, pip-audit and detect-secrets (with the .venv symlink
  excluded).
- Web: `npx next typegen && npx tsc --noEmit && npx eslint lib --max-warnings=0 && node --test lib/*.test.ts`
  (139 pass).
