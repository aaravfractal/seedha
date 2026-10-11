# R1 research: room board, rooms API, Pro cards (read-only; paths relative to apps/api or apps/web)

## 1. "Last night" today
- Web: `app/(owner)/home/parts.tsx:252-310` `LastNight` renders tiles as plain `<li>`, not buttons (legend
  `ROOM_LEGEND` :18, "Sample close" pill :280, "Print close slip on Desk" posts `desk/close-slip`). Data comes from
  `useShell("/home")` (`home/page.tsx:15,87`); the type is in `lib/types-overview.ts`.
- Copy bug: `parts.tsx:271` says "direct share N%", which ruling 3 forbids. The value counts direct only
  (`services/overview.py:208`), so the label should read "Direct bookings N%".
- API: `GET /overview` (`routers/overview.py:238`) calls `services/overview.py:201 last_night_for(session, prop, day)`,
  which already accepts any day. B1 can call it per night without editing it. It uses `services/desk.py:127 in_house()`
  (desk stays covering the day) and sums stored `ledger.booking_lines(b).net_kept` (`ledger.py:189`). Business date:
  `desk.py:107` = latest desk check_in = DEMO_DATE (`seed/load.py:56,158-169`).
- Per-room data exists: `Booking.room_id` (`models.py:218`) points to `Room.number` (22 rooms: 101-112 and 201-210,
  `seed/spec.py:28`), with channel_id, nights, check_in and the line items. `ChannelContract` (`models.py:131`) holds
  commission_bps, gst_applies and upi_fee_applies.
- **Gap: the seed has ONE night only.** `seed/generate.py:741 TODAY_GUESTS` is 14 one-night stays on DEMO_DATE. No
  rows exist for DEMO_DATE-6 to DEMO_DATE-1.
- Fix (B1): a new `seed/closes.py`, built like `seed/coded_history.py`.
  - Rows: a fixed tuple of one-night `source="desk"` stays with checked_out_at set and a Guest each. Lines come from
    `money.line_items_for_booking` (`money.py:123`) and the contract. Refs must not clash with `MM9xxxx`.
  - Wiring: called from `load_sample` (`seed/load.py:172-185`), so "Reset demo data" re-creates them.
  - Safe: post-30 Sep rows never touch locked totals (`ledger.py:35`, ruling D); business_date and 14 Desk guests stay.
  - Changes: count tests `test_seed_totals.py:134,174`, `test_db_and_cli.py:66` move by N; Ask payouts (`ask.py:145`)
    grows (test checks prefix only, `test_proof_and_ask.py:180`). One-night stays: per-night net = booking net.

## 2. Ruling 5 "if this room had been direct": reuse, do not rewrite
- Use `services/savings.py:49 compute_saving(amount, commission_bps, gst_applies) -> SavingLines | None`. It returns
  commission_avoided, gst_avoided, upi_fee and net_saving, with the fee from `money.py:72 upi_fee`. Rahul's
  Rs 2,233 / Rs 2,199 are locked by a test.
- Contract lookup: `link.py:143 original_terms` is keyed by perk. B1 copies its query keyed by `booking.channel_id`
  into its own service and does not edit link.py.
- Amount = `list_amount - discount` (the commission base, `money.py:137`). `extra_kept` = `net_saving`. Walk-in and
  direct give None, so the API sends `if_direct: null`. Label "Illustration".

## 3. Initials and consent
- Names: `Guest.display_name/short_name` (`models.py:169`; no phone or email column). Initials:
  `services/overview.py:66 owner_initials(name)` ("Neha Gupta" -> "NG"). Return initials only.
- Consent: `Consent.booking_id/guest_id`, active = not withdrawn and not erased (`models.py:246-269`).
  `consent.py:110 active_consent(session, guest_id)` is the rule 4 / ruling 7 gate, also used by `desk.py:202`.
- The base seed has no consents; they come from the Desk demo or B3's 8 guests. Send `consent_status`
  (consented, withdrawn or none) and `consent_id` only while active. "Message guest" shows only then.

## 4. Actions to reuse
- Open in Desk: `app/(app)/desk/page.tsx` keeps the room in useState (:23, :31) and reads no query param. B2 adds
  `?room=` (useSearchParams inside Suspense). `POST /desk/checkin {room}` (`routers/desk.py:186`) works tonight only.
- Message guest: `GET /inbox/threads/{consent_id}/messages` (`inbox.py:324`). `components/inbox/Inbox.tsx` has no deep
  link, so B3 adds `/inbox?thread=<consent_id>`.
- Print slip: no per-room slip exists without side effects (`POST /desk/checkout` issues a perk, checks the guest out
  and drafts a message). Proposal: `POST /rooms/{night}/{room}/slip`. It builds `slips.checkout_slip(CheckoutInput)`
  (`slips.py:70,87`) from `booking_lines(b)` with the existing PerkCode if any (never a new one), then enqueues
  `print_slip` as `routers/desk.py:222-230` does. Walk-in slips show no commission lines (ruling 4).

## 5. Proposed API (B1: `routers/rooms.py`, `services/rooms.py`, prefix `/rooms`)
- Dependencies `OwnerDep, SessionDep, PropertyDep` (`app/deps.py`), as `overview.py:238`. Money is integer paise
  only, like every other endpoint; the web formats with `lib/format.ts inr`.
- `GET /rooms/nights`: `{business_date, rooms_total, is_sample, nights:[{date, rooms_sold, rooms_total, net_kept,
  direct_bookings_pct, by_channel:{key:n}, rooms:[{number, channel_key, code, booking_id|null}]}]}`. 7 nights,
  oldest first; the last is business_date.
- `GET /rooms/{night}/{room}`: `{night, room, room_type, booking_id, channel_key, channel_name, channel_kind, nights,
  check_in, list_amount, discount, commission, gst_on_commission, fees, net_kept, guest_initials, consent_status,
  consent_id|null, checked_out, if_direct:{commission_rate_bps, commission_avoided, gst_avoided, upi_fee,
  extra_kept, label}|null}`. Money is the stored booking columns. 404 for an empty room or an out-of-range night,
  422 for a bad date.
- Wiring: `main.py:114-139`; add `["rooms","owner"]` to `web/lib/bff.ts` RULES (else the proxy refuses it);
  `test_route_auth.py:39` auto-covers auth.
- Tests: DEMO_DATE night = 14 / 22 / 21% (`test_overview.py:88`); room 104 (Neha) = Rs 2,678; MMT if_direct =
  `compute_saving`; no full name anywhere; no consent_id when unconsented; locked totals unchanged.

## 6. Pro page (section C)
- Today: `app/(owner)/(screens)/pro/page.tsx` has 3 static big cards and 7 text-only small cards. `GET /pro`
  (`routers/site.py:284-310`) returns audit_claim, line counts, consents and sample flags. `services/pro.py
  audit_lines` feeds both Audit and Recover (D-089). framer-motion is available; the bff "pro" rule covers `pro/*`.

| Card | Data today | Needs | Label |
|---|---|---|---|
| Audit + Recover | `/pro`, `/statements/disputes`, `/statements/rows/{id}/dispute` | nothing | Sample (D10) |
| Pulse | `web/lib/pulse.ts` sample events, `/ledger/monthly` | nothing | Sample (D-063) |
| Rate Watch | no data | static view | Sample |
| Tonight Card | `/rooms/nights` (22 - sold), `/ledger/channels` `rank_by_money_kept` | nothing once B1 lands | real |
| Who Paid the Discount | stored `discount` is hotel-funded only (`seed/generate.py:548`) | `GET /pro/discount-split` | Sample (OTA-funded part) |
| Floor by Channel | `/settings/contracts` | `GET /pro/floor?net=` (API computes the floor rates) | Illustration |
| Group Displacement | ledger net ADR, `/scenario/saturday` | `GET /pro/displacement?rooms&rate&nights` | Illustration |
| Agent Khata | 180 `ta` rows, no agent identity | `GET /pro/khata` (TA rows by month) | Sample agent names |
| Two-Property Rollup | one property only | static view | Sample |
| Seedha Proof | `/proof` | link only | real |

- **B5** owns `pro/page.tsx`, `pro.module.css`, `components/pro/ExpandCard.tsx` (layoutId, Escape, close, focus
  return), `components/pro/views/index.ts`, and the Audit, Pulse, RateWatch, Tonight and Proof views.
- **B6** owns the Discount, Floor, Displacement, Khata and Rollup views, `routers/pro_views.py` (prefix `/pro`, in
  main.py), `services/pro_views.py` and tests. The lead pre-creates B6's 5 view stubs and the registry first.

## 7. File ownership and specs to keep green
- **B1**: `routers/rooms.py`, `services/rooms.py`, `seed/closes.py`, one line in `seed/load.py` (B3 adds one too; lead merges), `main.py`,
  `tests/test_rooms.py`, count fixes in the two seed tests, `web/lib/bff.ts` + `bff.test.ts`.
- **B2**: `home/parts.tsx` (`LastNight` only, or new `components/owner/RoomBoard.tsx` and `RoomSheet.tsx`),
  `home/overview.module.css`, new `lib/types-rooms.ts`, and `app/(app)/desk/page.tsx` (`?room=`). No API files.
- Must stay green: `e2e/loop.spec.ts:87` (/home checklist hides after 8 steps); `e2e/a11y.spec.ts:11,21` (axe on
  /home and /pro, both themes and sizes); `owner.spec.ts` and `perf.spec.ts:8` (no /home); `test_overview.py:86-90`
  (14 / 22 / 21%). Leave `last_night_for` and `/overview` unchanged.
