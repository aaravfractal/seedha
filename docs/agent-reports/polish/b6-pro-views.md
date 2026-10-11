# B6: Pro mini views (discount split, floor, displacement, khata, rollup)

Status: done, uncommitted in worktree polish/pro-b6. make check-api steps and the web check pass.

## Files
- API: app/services/pro_views.py, app/routers/pro_views.py (prefix /pro, OwnerDep), main.py (import + include_router), tests/test_pro_views.py (60 tests, 100% coverage of both new files).
- Web: components/pro/views/{DiscountSplit,Floor,Displacement,Khata,Rollup}View.tsx, components/pro/views/proCalc.module.css, lib/types-pro.ts, lib/proViews.ts (+ proViews.test.ts), lib/useDebounced.ts.

## API (all money integer paise, owner-only: 401 without token, 403 for a demo session on a real hotel, 422 invalid_input)
- GET /pro/discount-split -> {rows[{channel_key, channel_name, promotion, list_amount, hotel_funded, ota_funded, hotel_share_tenths, ota_funded_sample}], total_hotel_funded, total_ota_funded, sample, label "Sample"}.
  hotel_funded = ledger discount per OTA (counted rows, Apr to Sep). ota_funded = sample bps of list (mmt 4%, bcom 3%, agoda 5%). Promotion names are sample.
- GET /pro/floor?rate=<paise, default 400000>&target=<paise, default sample 250000>&channel=<key optional, 404 unknown> -> {target, target_is_sample, rate, rows[{channel_key, channel_name, commission_bps, gst_applies, floor_rate, at_rate{list_amount..net_kept}, worth_taking}], label "Illustration"}.
  kept(R) = line_items_for_booking(R, discount 0, contract bps, GST 18%, UPI fee if the contract has it).net_kept.
  floor = lowest whole-rupee R with kept(R) >= target, scanned up from a bound that provably sits below it; with a whole-rupee target kept(floor) == target exactly (round-trip test). rate and target must be whole rupees, at most Rs 1,00,000.
  Seed: MMT floor Rs 3,377 at Rs 2,500 target; TA Rs 2,778; Direct Rs 2,510 (UPI fee); Walk-in Rs 2,500.
- GET /pro/displacement?group_rooms&group_rate&nights -> {inputs, rooms_count, nights_sampled, average_rooms_sold, average_net_per_room_night, free_rooms, rooms_pushed_out, group_net, displaced_net, difference, label "Illustration"}.
  From the room board's last 7 desk nights: average rooms sold (half-up), average net per room night = stored net of each in-house booking (once) / its nights (per_unit_rounded). free = rooms - avg sold; pushed = max(group - free, 0); group_net = rooms x nights x rate (group booked direct, no commission or fee); displaced = pushed x nights x avg net; difference = group_net - displaced. Seed: 15 sold avg, Rs 3,252 per room night.
- GET /pro/khata -> {rows[{agent, bookings, room_nights, lines}], totals, sample, label "Sample"}. Real travel-agent rows (ledger filter), grouped under 4 fictional agent names by reference digits mod 4. Totals equal the ledger's ta channel: 165 stays, 180 RN, net Rs 6,15,600.
- GET /pro/rollup?property=a|b|all (default all) -> {selected, view, properties[a,b], combined, sample, label "Sample"}. a = this hotel's ledger totals (net Rs 47,33,012, paid to channels Rs 10,39,108); b = fictional "Pine Ridge Cottages", Nainital, 14 rooms, fixed sample line items (GST via gst_on_commission); combined = sums, net ADR recomputed.

## Web
- Views fetch through useApi("pro/..."); no money is computed in the browser (rupee input x100 for requests and bar widths only). Money via lib/format inr.
- Per the lead: no Sample/Illustration chip inside views (ExpandCard shows it); inline notes only where one figure is sample (OTA-funded part, sample minimum, sample agent names, sample second property).
- Floor: native range slider (Rs 1,000 to 12,000, step 100, keyboard arrows, aria-valuetext), 250 ms debounce, table dims while stale.
- Displacement: three labelled 44px inputs with inline errors (max rooms from /property), debounced.
- Rollup: 3-button group with aria-pressed, 44px targets.
- Checked at 390 light and 1440 dark with a temporary preview page (removed): no horizontal page scroll, no console errors; wide tables scroll inside their wrapper on phones.

## Not done / notes for lead
- Views are not yet reachable until B5's page renders PRO_VIEWS. No e2e added (T2 owns Playwright).
