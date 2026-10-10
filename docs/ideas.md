# Ideas for a stronger judge demo (ideas agent, 11 Oct 2026)

Proposals only; nothing here is built. Ranked by value per hour. Every rupee in
each idea is computed by code from stored rows (rule 1). Sample figures below
are from the locked seed data; the build must read them from the API.

## 1. D6 scorecard (own idea) · 1.5 h · build it
**Judge sees:** on Money kept (/flip), under the summary strip, one card titled
"Problem D6 metrics" with the organiser's six names, word for word: Commission
% of room revenue 14.1% (sub-line "with GST and fees 16.5%"), Direct bookings
10.7% (sub "Commission-free share 16.7%"), Net ADR by channel (link to the
rows above), Net RevPAR ₹1,176 vs list ₹1,566, Repeat bookings by channel
(MakeMyTrip n, Booking.com n, Agoda n), Value of guests converted to direct
(₹ from Savings). Each with "Calculated from your statements".
Click path: beta login, Upload, "Use sample statements", "See my real money".
**Why D6:** the judges hold this list as their rubric. Today four of six exist
but under our own labels on two screens; repeat-by-channel is not shown anywhere.
**Builds on:** GET /ledger/channels (totals.commission, list_revenue,
direct_bookings_tenths, commission_free_share_tenths, revpar_*;
services/ledger.py), GET /repeat (matches[].returned.channel;
services/repeats.py), savings totals used by GET /overview. Add to LedgerOut:
commission_share_tenths and repeat_by_channel (count + paid_twice per channel,
confirmed and pending shown separately). Web: flip/page.tsx card.
**Rules:** rule 1 (API computes; tenths like the existing shares), rulings 2
and 3 (never bare "direct share" or "lost"), D1 labels, D16 copy, ruling 7
(the repeat count is internal, owner-only; no guest names on the card).
**Risk:** low. Commission % must be defined once (commission only over list
revenue) and say so in a caption, or a judge asks "with GST?". A test locks
14.1% and the repeat-by-channel counts summing to 12.
**Minimal:** same card without repeat-by-channel, plus a link to /repeat (45 min).

## 2. Seedha Recover (approved) · 1.5 to 2 h · build it
**Judge sees:** on Upload each flagged row gets "Draft a dispute". A sheet
opens with a ready message to the OTA: booking ref, stay date, the lines as
printed, what they should be, and the amount to claim, plus "Copy text".
Seed rows: AG77102 Agoda, commission ₹680 + GST ₹122 on a cancelled stay, claim
₹802; MM48213 MakeMyTrip, payout ₹3,120 vs ₹3,240 computed, claim ₹120 short;
BK55320 Booking.com, GST line missing, ask for the tax invoice line (the
payout gap of ₹128 is shown by code). Pro's Audit card links to the same list.
**Why D6:** distribution cost includes money the OTA should not have taken;
recovering it is pure computation, and Rajesh sees Seedha pay for itself.
**Builds on:** GET /statements flagged_rows (reason, detail), Booking fields
(external_ref, check_in, commission, gst_on_commission, tds, payout_reported),
services/checks.py (expected_payout, reason constants), services/pro.py audit().
New: services/recover.py claim_for(booking) -> (kind, amount_paise, lines);
GET /statements/rows/{id}/dispute returns a code-filled template in EN/HI.
**Rules:** rule 1 and D6: the letter is a fixed template filled by code; no
LLM (if Claude ever rephrases, run the D6 guard and keep amounts as code
slots). Rule 2: TDS shown as a credit, never claimed. Rule 3: the row stays
excluded until reviewed; drafting a dispute is not a review. Rule 8: nothing
is sent or scraped; owner copies it into the extranet. Rule 9: no guest name
in the letter, booking ref is enough. D16: no exclamation marks.
**Risk:** the Recover total must reconcile with Pro Audit (Audit counts only
cancelled and over-rate lines, so ₹802 here, plus ₹120 shortfall labelled
separately). A judge may ask "do OTAs accept this?": answer, it is the owner's
claim, Seedha only does the arithmetic.
**Minimal:** "Copy dispute" button with the template built in the API for the
cancelled and mismatch reasons only (1 h).

## 3. Split the Commission (approved) · 1.5 h minimal, 3 h full
**Judge sees:** on Savings, Rahul's coded booking expands to a three-way split:
"MakeMyTrip would have taken ₹2,233. Guest got breakfast for two, 2 nights,
costing you ₹800. You kept ₹1,399 more." Full version: on Approvals a
"Share of saving" control (0, 25, 50%) that suggests perks that fit the
budget (breakfast ₹400 a night, late checkout, bonfire) before the owner approves.
**Why D6:** "value of guests converted to direct" net of what it cost to
convert them; shows the direct channel is cheaper even after a generous perk.
**Builds on:** services/savings.py compute_saving (ruling 5 lines unchanged),
Saving row (commission_rate_used, net_saving), DirectBooking nights,
PerkCode.perk, the "Breakfast for two ₹400 per night" Extra in services/site.py.
Add perk_cost_per_night to the property (or reuse the Site extra) and return
perk_cost and kept_after_perk next to net_saving.
**Rules:** rule 6 (the guest pays the same public ₹4,300; the split is only a
perk, never shown as a discount or lower rate), ruling 5 (net_saving and the
₹2,233 / ₹2,199 locked numbers do not change; the perk is a separate line),
rule 7 (budget changes the draft only, owner still approves), gold only for
the hotel's saving.
**Risk:** a judge reads "split" as a rebate. Copy must say "perk worth",
never "₹ off". Perk cost is owner-entered, so label it "your cost".
**Minimal:** the three-way split line on Savings only, fixed breakfast cost.

## 4. Commission lever (own idea) · 1.5 h
**Judge sees:** on each channel row of the flip, "What 1 point of commission
costs you": MakeMyTrip about ₹27,000 per point over the six months (1% of
post-discount ₹22,91,520 plus 18% GST, per row in code). A stepper 22% to 18%
shows net ADR moving from ₹2,737 and whether MakeMyTrip still ranks 5th.
**Why D6:** recommendation step: contract negotiation and "is a preferred
programme at +3 points worth it" are real hotel decisions, and it is
computation on past rows, not a forecast.
**Builds on:** Booking rows by channel, services/money.py bps_of and
gst_on_commission, services/ledger.py channel summaries, ChannelContract.
New GET /scenario/commission?channel=mmt&bps=1800.
**Rules:** rule 1, rule 2 (GST recomputed at 18%, TDS untouched), label
"What if, on your past six months", D10 not needed (real data).
**Risk:** low; keep rank animation off here so it does not compete with the flip.
**Minimal:** static "1 point = ₹X" line per OTA row (45 min).

## 5. Direct Booking Score (approved, with changes) · 2 to 2.5 h
**Judge sees:** on Overview a ring "Direct readiness 46 / 100" with five rows,
each 0 to 20 and its formula visible: direct bookings vs the owner's goal,
consented guests over checked-out guests, repeat matches reviewed, win-backs
sent, Site published. Tapping a row opens that screen.
**Why D6:** turns diagnosis into a next action. Weaker for faculty judges: a
composite score with chosen weights can look invented or predictive.
**Builds on:** routers/pipeline.py compute_steps, GET /overview, ledger
direct_bookings_tenths, Consent, repeat statuses, Message status, site publish.
**Rules:** no rupees in it, so rule 1 is easy; each part must show its
inputs; the goal is owner-set in Settings, not ours. Must not duplicate the
8-step checklist (D3), which hides when done; the score is ongoing.
**Risk:** judge asks "why 20 each?". If built, call it "readiness" and show
the parts first, the total second.
**Minimal:** three parts from data already in /overview (1.5 h).

## Not proposed
Auto-flip on login (flip already reachable in under a minute with the sample
button); any lower-rate or OTA-guest messaging idea (rules 4 and 6).
