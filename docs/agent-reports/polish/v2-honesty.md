# V2 honesty and copy review (polish build, read-only)

Scope: commits 7fd901b..990f732. Room board and sheet, inbox seeds, templates and invoice, Settings
additions, Pro page and its ten views. No em dashes found in new copy (one "–" table placeholder,
pre-existing style). Ruling 3 holds: the night summary says "Direct bookings N%", and it counts
direct only (walk-in is its own kind). No real-customer claims found. AI draft prompt forbids
figures; the fixed templates carry no rupee amounts.

| id | sev | file:line | current text | proposed text |
|---|---|---|---|---|
| V2-1 | high | apps/web/components/shell/AppHeader.tsx:281 | Hotel chip shows only "Hotel Deodar View"; "(sample data)" is sr-only, so no visible "Sample hotel" badge exists anywhere in the shell | Visible quiet badge inside the chip when `is_sample`: "Sample hotel" (keep the sr-only text or drop it, since the badge reads aloud) |
| V2-2 | medium | apps/web/components/owner/RoomBoard.tsx:96 | "Sample close" note on the board card | Remove once V2-1 lands (LABELLING RULE: chip badge plus footer only; b2 kept it on purpose) |
| V2-3 | medium | apps/web/app/(owner)/(screens)/pro/page.tsx:55 | "From your screenshot today. No scraping." (Rate Watch is always sample) | "From a sample screenshot. No scraping." |
| V2-4 | medium | apps/web/components/pro/views/RateWatchView.tsx:17 | "From your screenshot. No scraping." | "From a sample screenshot. No scraping." |
| V2-5 | medium | apps/web/components/pro/ExpandCard.tsx:89 | "Show live view" / "Hide live view" on every card, including Sample cards (Pulse, Rate Watch, Rollup, Khata) | "Show view" / "Hide view" (also the region label "<name>, live view" -> "<name>, view") |
| V2-6 | medium | apps/web/lib/pulse.ts:115-116 | "Your busiest week. Sell direct first; ..." | "Carnival week in town. Sell direct first; open the lowest-net channel only for nights still empty." |
| V2-7 | medium | apps/web/lib/pulse.ts:93 | "Families book late. Open OTA rooms only for the quiet weekdays after." | "Hold OTA rooms for the festival nights. Open them for the weekdays after Diwali." |
| V2-8 | medium | apps/web/lib/pulse.ts:128 | "Packages sell better than discounts. Keep the public rate." | "Offer a package instead of a discount. Keep the public rate." |
| V2-9 | medium | apps/web/app/(owner)/(screens)/pro/page.tsx:47 | "25 to 30 Dec. Stop OTA discounts for these dates and keep 6 rooms for direct guests." (view says Agoda held, 10 rooms lit, "Sell direct first") | Match the view: "25 to 30 Dec. Sell direct first and hold Agoda until direct sells." |
| V2-10 | medium | apps/web/lib/proSample.ts:96 | "Offer the N rooms left to Direct guests first: they keep ₹X a night on average." ("they" = guests; colon reveal) | "Offer the N rooms left to Direct guests first. Direct keeps you ₹X a night on average." |
| V2-11 | medium | apps/web/app/(owner)/(screens)/pro/page.tsx:67 and TonightView.tsx:41-44 | "rooms left tonight" / "Rooms left" computed from last night's close | "Rooms unsold at the latest close" or compute from tonight's in-house register |
| V2-12 | medium | apps/api/app/services/invoice.py:64 and InvoicePanel.tsx:98 | "Prices include GST." (Room charges minus Discount does not visibly equal Taxable value) | "Prices include GST. Taxable value, CGST and SGST are worked back from the total paid at 5%." (rate from gst_bps) |
| V2-13 | medium | apps/api/app/services/invoice.py:365-366 (with :391) | CGST/SGST lines print even when the owner has no GSTIN set | When `gstin` is None, add a line "GSTIN not set. Add it in Settings before you send this to a guest." or omit the tax split |
| V2-14 | medium | apps/web/components/settings/SimulateMessage.tsx:51 | "A sample guest writes to you on WhatsApp, so the inbox is never empty in a demo." | "A sample guest message lands in your inbox as if sent on WhatsApp. Nothing is sent." |
| V2-15 | medium | apps/api/app/services/inbox.py:576 | "sorry about the Wi-Fi trouble. We are checking the router near your room now and will tell you as soon as it works." (claims an action; wrong for a guest who has checked out) | "sorry about the Wi-Fi trouble. We will check the router near your room and tell you once it is fixed." |
| V2-16 | low | apps/api/app/services/inbox.py:564 | "yes, we will keep parking ready for your cars." (promises capacity unchecked) | "we will check parking for your cars. Please share your arrival time so we can keep space." |
| V2-17 | low | apps/api/app/services/inbox.py:582-583 | "...is checking the refund ... and will update you today." | "...is checking the refund for the cancelled night and will update you soon." |
| V2-18 | low | apps/api/seed/inbox_threads.py:68, :82 | "Namaste! Hum..." / "Hi! Diwali pe..." (D16: no exclamation marks anywhere) | "Namaste ji, hum..." / "Hi, Diwali pe..." |
| V2-19 | low | apps/web/components/owner/RoomSheet.tsx:103-106 | "+₹X more kept" / "Commission ... stay with you" (hypothetical in present tense) | "₹X more kept if direct" / "Commission ... would have stayed with you, minus the UPI fee of ₹Y." |
| V2-20 | low | apps/web/components/owner/RoomSheet.tsx:65 | "Slip sent to the Desk" (no full stop; sibling toasts end with one) | "Slip sent to the Desk." |
| V2-21 | low | apps/web/lib/rooms.ts:80 | "No rooms sold of 22" | "No rooms sold. 22 rooms free." |
| V2-22 | low | apps/web/lib/proSample.ts:50 and pro/page.tsx:56 | "Guests who compare book direct." / "Guests who compare book the lower price." (behaviour claim) | "Guests who compare see the lower price." |
| V2-23 | low | apps/api/app/services/pro_views.py:74-77, :428 | Sample agent names "Himalayan Trails", "Kumaon Holidays", "Doon Valley Tours", "Mall Road Travels"; "Pine Ridge Cottages" (likely real businesses; shown with commission) | Plainly fictional names, e.g. "Sample Agent A" to "D", "Sample Cottages, Nainital" |
| V2-24 | low | apps/web/components/pro/views/FloorView.tsx:61 | "Floors at a minimum of ₹X kept." | "Each floor keeps you at least ₹X a night." |
| V2-25 | low | apps/web/lib/pulse.ts:74 | "Long weekend for Delhi families." (Dussehra is Tue 20 Oct; demand framing) | "Tuesday holiday with a Monday bridge. Hold Saturday rooms for direct and repeat guests first." |
| V2-26 | low | apps/web/components/settings/InvoiceGstSetting.tsx:12-15 | "rooms up to Rs 7,500 a night" (app copy uses ₹ elsewhere) | "rooms up to ₹7,500 a night" (keep "Rs" only in the PDF, Helvetica has no ₹) |

Checked and fine: Illustration chip on the room sheet's if-direct block (once); no per-item
Sample/Demo pills in inbox threads or room tiles; InvoicePanel Sample chip and PDF "SAMPLE" plus
footer note (the guest document needs its own mark); "UPI (sample)" and "UPI (simulated)" payment
labels; accountant footer; Pro cards carry exactly one Sample or Illustration tag; Discount Split,
Khata, Rollup and Floor state which part is sample in plain words; Displacement states its
assumptions (pushed-out rooms valued at the 7-night average net per room night); Rate Watch
recommends a perk, never a lower public rate (rule 6); no "genuinely", no closing questions.
