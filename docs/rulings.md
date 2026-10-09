# Owner rulings (Aarav), binding alongside CLAUDE.md

1. **Line-item rounding.** Compute in paise, round each line item (discount,
   commission, GST on commission, fees) half-up to the rupee; net = list minus
   the sum of the rounded items. MakeMyTrip net Rs 16,96,642; total net
   Rs 47,33,012; paid to channels Rs 10,39,108; MMT net ADR Rs 2,737; net
   RevPAR Rs 1,176. A test locks this rule.
2. **Two named "lost" figures, never the bare word "lost".**
   "Paid to channels" = commission + GST on commission + fees = Rs 10,39,108.
   "Lost vs list price" = discount + commission + GST + fees = Rs 15,71,988.
   The per-row flip figure uses "Lost vs list price".
3. **Direct share, two names.** "Direct bookings" = direct only = 10.7%
   (160 / 1,500), the D6 metric. "Commission-free share" = direct + walk-in =
   16.7% (250 / 1,500). Flip stat: "Direct bookings 10.7%" with
   "Commission-free share 16.7%" as sub-line. Never the bare "direct share".
4. **Slips from the guest's own booking.** Walk-in slips show no commission or
   GST lines, only "Booked directly. Hotel kept Rs X." Neha Gupta's stay is
   Booking.com, Rs 4,000 list, 15% hotel-funded promo, 18% commission:
   Rs 4,000 - 600 - 612 - 110 = Rs 2,678 kept.
5. **Commission avoided** uses the original channel's channel_contract rate,
   plus 18% GST on it, minus UPI fee (0.4% above Rs 2,000, cap Rs 300). Never
   a flat rate. Rahul (MMT 22%) Rs 8,600 coded rebooking: Rs 2,233 avoided,
   Rs 2,199 net. Rate used stored on each saving row.
6. **Monthly figures.** Real April to September breakdown with a July and
   August monsoon dip, summing exactly to every 6-month total. Ask returns the
   true September figure. Do not force Rs 99,146.
7. **Matching vs messaging.** A repeat-guest match is confirmed only when the
   owner taps Confirm, at any confidence. Messaging eligibility comes only
   from a consent record that exists and is not withdrawn. OTA matching never
   makes a guest messageable. A test proves a matched-but-unconsented guest
   cannot get a draft or a send.

## Answers A to D (final)

A. Dependencies approved (see docs/AUTONOMOUS.md section 0).
B. A row is a statement line (booking, cancellation or adjustment). 410 + 412
   + 214 + 96 + 180 + 188 = 1,500 rows; 3 flagged excluded; locked totals
   come from the 1,497 passing rows.
C. Commission paid twice = commission + GST on commission on each guest's
   return OTA booking. First stays seeded as 2025 history. 12 guests,
   Rs 41,800.
D. Desk guests' current stays are October 2026 bookings outside the ledger
   window. Ledger takes an explicit date range defaulting to 1 Apr to
   30 Sep 2026; a test proves Desk activity never changes locked totals.
