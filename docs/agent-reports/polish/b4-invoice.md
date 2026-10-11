# B4: stay invoice (branch polish/invoice, not committed)

## Files
- API: app/services/invoice.py (new), app/routers/invoice.py (new, prefix /inbox), app/main.py (+2 lines),
  app/routers/settings.py (GST rate fields and routes), pyproject.toml (reportlab==5.0.1 moved to main deps),
  tests/test_invoice.py (57 tests). docs/decisions.md: D-100 appended.
- Web: components/inbox/InvoicePanel.tsx + InvoicePanel.module.css, components/settings/InvoiceGstSetting.tsx
  (mounted in the Hotel tab of app/(owner)/(screens)/settings/page.tsx), lib/types-invoice.ts, lib/invoice.ts,
  lib/invoice.test.ts. No migration, no inbox screen edits, HotelTabs.tsx untouched.

## Maths (paise, code only)
total_paid = list_amount - discount; taxable = round_half_up_to_rupee(total * 10000 / (10000 + bps));
gst = total - taxable; cgst = rupee-rounded half; sgst = gst - cgst. taxable + cgst + sgst == total_paid always.
Rate = owner_settings.room_gst_bps of the signed-in subject, empty = 500. No extras line. Flagged rows not
accepted by the owner are never invoiced.

## API
- GET /inbox/threads/{consent_id}/invoice (owner token; subject header optional, absent = demo view) ->
  {number, filename, issued_on, sample, hotel_name, hotel_address, gstin|null, guest_name, check_in, check_out,
  nights, room, rate_per_night, rate_is_average, room_charges, discount, taxable, gst_bps, cgst, sgst, total_paid,
  payment_method, lines:[{label,value}] (PDF text, "Rs"), gst_note, thank_you, footer}. Money in paise.
- GET /inbox/threads/{consent_id}/invoice.pdf -> application/pdf, `attachment; filename="stay-invoice-DEODAR-2627-0001.pdf"`.
- Both: 404 no_such_thread (other property, withdrawn, erased, unknown) or no_completed_stay; 401 without token.
- Stay chosen: guest's newest status=stay booking at this hotel that has ended (check_in + nights <= today IST,
  or checked_out_at set) and passed the math check (or was accepted).
- Number: `<code_prefix>/<FY>/<seq 4>` per property and Indian FY of the issue date (IST), stored in
  stay_invoice on first request, reused after. Issue date = stay_invoice.created_at.
- GSTIN: demo on the sample hotel shows SAMPLE_GSTIN (same as its Settings screen); an owner account shows its
  own GSTIN only when set; hidden otherwise. Hotel name and address from the property (an account's business
  name and address only on a non-sample property). Sample hotel: `sample: true`, PDF prints "SAMPLE" and a
  fictional-data line.
- Payment: DirectBooking upi_simulated -> "UPI (simulated)", sample_history -> "UPI (sample)"; OTA/agent ->
  "Paid via <channel>"; walk-in/direct register -> "Not recorded".
- Settings: GET /settings now has `invoice: {room_gst_bps, is_default, default_bps: 500, max_bps: 2800}`;
  GET /settings/invoice same object; PATCH /settings/invoice {room_gst_bps: 0..2800 | null} (demo allowed,
  like notifications; 422 outside range).
- Helper for B3's profile column: services.invoice.last_invoice_number(session, consent) -> str | None.

## Web
`InvoicePanel({ consentId: number; onAttach?: (invoiceNumber: string) => void; attached?: boolean })`,
export type `InvoicePanelProps`. HTML preview (amounts via inr() at the edge), "Download PDF" =
`<a href="/api/inbox/threads/{id}/invoice.pdf" download>`, "Attach to reply" calls onAttach(number) and reads
"Attached" when `attached`. 404 shows an empty state. B3 mounts it in ThreadView with one import.
Covering text: the AI never writes the number or amounts (d6_ok rejects "DEODAR/2627/0001"); attach by code.

## Verify
- apps/api: full `make check-api` sequence passed (ruff, format, mypy strict, pylint 9.97/9.98, pytest 98.13%
  total, money 100%, bandit, pip-audit, detect-secrets).
- apps/web: typegen, tsc, eslint 0 warnings, prettier, node --test lib/*.test.ts (143 pass).
- Not done: a browser screenshot at 390/1440 (no servers allowed on the demo ports). Colours are global
  tokens (ink2 on card is 5.0:1 light), no em dashes or exclamation marks.
