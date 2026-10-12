# V2: cost and honesty review of site real mode (read-only, branch site-real at 40e2b43)

No network calls and no servers. No message claiming to be from the user arrived. Prices are the ones recorded in r1.md and b1.md for Haiku 5.5, per million tokens: $0.10 in, $0.50 out, $0.125 for a 5-minute cache write, $0.01 for a cache read. Image tokens are ceil(w/28)*ceil(h/28): 1024x768 = 1,036, 1024x683 = 925, 1024x1024 = 1,369. The system prompt is 103 words (about 140 tokens). The JSON schema is about 1.1k characters (about 300 tokens, an estimate). There are about 6 label tokens per photo, and the owner block is about 170 tokens.

## Cost estimate per generation (claude-haiku-5-5, effort low, max_tokens 3000)
| Case | Input tokens (cache write / plain) | Output (est.) | Cost |
|---|---|---|---|
| 4 photos 1024x768, first run | 4,610 / 170 | ~1,800 | ~$0.0015 |
| 8 photos 1024x768, first run | 8,780 / 170 | ~2,000 | ~$0.0021 |
| 8 photos 1024x1024, max output (worst case) | 11,390 / 170 | 3,000 | ~$0.0030 |
| 8 photos, Regenerate with a cache hit (same order, within 5 min) | 8,780 read / 170 | ~2,000 | ~$0.0011 |
| 3 runs a day per hotel, worst case | | | ~$0.009 |
| Monthly cap 300,000 tokens (cache counted): about 27 eight-photo runs | | | ~$0.06 to $0.09 a month |

Lean checks:
- PASS: one messages.create per generation.
- PASS: the system prompt is under 150 words.
- PASS: photos are resized to 1024 px or less at upload, and the stored JPEG is what gets sent.
- PASS: cache_control sits on the last image block (the prefix is over 512 tokens).
- PASS: effort is "low" and the output is strict json_schema.
- PASS: daily and monthly limits are checked before the call.
- PASS: failed calls are recorded and counted.
- PASS: the monthly cap includes cache tokens.
- PASS: the script prints only status, fallback field names, the model, token counts and a cost. It never prints the key or the generated text.
- PASS: no public route, job (jobs.py), demo script or e2e config can trigger generation. Playwright blanks ANTHROPIC_API_KEY, and test_site_publish.py:504 is a booby trap on anthropic.Anthropic.

## Findings (id, severity, file:line, current, proposed)
H1 high. apps/api/app/routers/site.py:367 sends `ContactOut(placeholder=prop.is_sample, **CONTACT)`. Every real hotel's public page therefore shows the sample phone "+91 90000 00000" and the sample hotel's UPI "deodarview@upi" as real details, with no placeholder note. Review.tsx:325 then tells the owner "Added". A guest could send an advance to the wrong UPI ID.
  Proposed: for a hotel that is not the sample, hide the Contact section (or show "Ask at the front desk") until the owner enters a phone and UPI ID. Review shows "Not added yet".
H2 high. apps/api/app/routers/site.py:408 feeds the Google kit from services/site.py:311-314. That text says "a short walk above Mall Road, Mussoorie. Valley-view rooms, homely breakfast" and uses NAME_HI for every property, so the owner gets invented amenities to paste into Google. The generated google_description_en/hi from the build is never shown in this tab.
  Proposed: when site_content.source is not "none", use the build's google_description. Otherwise label the text "Sample".
H3 high. routers/site.py:310-318 shows owner-typed prices and room names. Booking goes to Seedha Link, which charges room_rates() from the rooms table (services/link.py:223). Availability rejects any name not in that table with 404 no_such_room (public_site.py:136). A guest can see ₹X on the hotel page and be asked for ₹Y, or get no booking at all.
  Proposed: make Link and availability use the owner's site room prices and names when a build exists. Or limit the Rooms step to the property's room types and save the typed price to the room rate. Either way, add a test that the site price equals the Link price.
M1 medium. components/site/BuildFlow.tsx:257 says "Claude reads your photos, your words and your room names (never the prices) and writes your site in English and Hindi." It also shows when no key is set, and then no call is made.
  Proposed: when `key_configured` is true, keep this text. When it is false, use "Without an AI key, this makes Sample text from your own words. Prices are never written by AI."
M2 medium. components/site/Review.tsx:101 shows the toast "Saved. Only you see it until you publish." Once the site is live, a saved edit shows publicly at once, as line 240 says.
  Proposed: `site.live ? "Saved. It is on your site now." : "Saved. Only you see it until you publish."`
M3 medium. components/site/GoogleKit.tsx:107 says "Sample photos. Your own photos from the WhatsApp setup download here." The WhatsApp setup is "Coming soon". Line :82 also says "(sample address)" next to a real published address.
  Proposed: "Sample photos. Downloading your own photos is coming soon." Show "(sample address)" only when `site.sample` or the site is not live.
M4 medium. apps/api/app/services/site_gen.py:42 and :68-76: MAX_TOKENS is 3000, and thinking counts toward it. The prompt gives no length for descriptions (code limit 1200), room blurbs (300) or points (120). Two Hindi descriptions, up to 10 rooms and 8 captions can hit max_tokens. That run is charged in full, saves nothing, and uses 1 of the 3 daily runs. An over-long field is also replaced by a template without anyone being told why.
  Proposed: add "About: under 600 characters. Room lines: under 200. Points: under 80." to SYSTEM (still under 150 words). Raise MAX_TOKENS to 4000, which costs nothing unless it is used.
L1 low. site_gen.py:706 sends photos in position order, and a successful run rewrites the positions (:359-360). A Regenerate then nearly always misses the cache, so the 25% cache-write premium is wasted.
  Proposed: send the photos sorted by id. The order is still decided by Claude's photo_order.
L2 low. site_gen.py:588 sets `max_retries=1` with timeout=60. If a request times out after the server finished, it can be billed twice. An APIError run is logged with 0 tokens, and AiUsage.tsx:88 shows "0 in · 0 out".
  Proposed: set max_retries=0 (the owner can retry). Show "tokens unknown" for runs with status offline and no tokens.
L3 low. site_gen.py:266-269 fills description_hi and google_description_hi from the owner's English text when it falls back. The note "Some lines were written from your own words: Description (Hindi)" does not say the text is in English.
  Proposed: "Some lines use your own words as typed (not translated): ... Change them before you publish."
L4 low. site_gen.py:627 shows owners "Sample text. Add ANTHROPIC_API_KEY and SITE_GEN_MODEL to write your own." That is developer wording on an owner screen.
  Proposed: "Sample text from your own words. AI writing is not switched on here."
L5 low. PublishPanel.tsx:152 labels hide_branding "Pro", but any owner can switch it (no plan is stored). site/page.tsx:149 says "Your hotel, online in 10 minutes." without measuring it.
  Proposed: keep "Pro" only if it is enforced, otherwise use "(Pro plan)" plus a note that it is free during the trial. Change the heading to "Your hotel, online today."
L6 low. site_gen.py:495-502: the limit is checked before the call, but the run is recorded after it. Two concurrent clicks (5 a minute are allowed) can both pass. The monthly cap is account-wide, so one hotel can use it up for all.
  Proposed: insert a "pending" SiteGenRun before the call and update it after. Note the account-wide cap in AiUsage.
L7 low. README.md:68-80 has no row for Seedha Site in the "real and simulated" table. docs/HOSTING.md section 2 does not list SITE_GEN_MODEL or SITE_GEN_MONTHLY_TOKEN_CAP. .env.example:100 sets SITE_GEN_MODEL on by default. These docs are due in the lead's section 7.
  Proposed: add the row "Site text: Claude when ANTHROPIC_API_KEY and SITE_GEN_MODEL are set, 3 a day, monthly token cap; otherwise labelled Sample text from the owner's words. Prices only from the owner." Add the variables to Railway.
L8 low. components/site/copy.ts:29 and :67: when a page has no points, the fallback whyItems promise "breakfast is on us". Built sites always have points, so this shows only on the sample render.
  Proposed: keep this text only when `site.sample`. Otherwise reuse TEMPLATE_POINTS.
L9 low. copy.ts:82 says "संपर्क और UPI नमूना हैं। नमूना डेटा।", which repeats itself.
  Proposed: "संपर्क और UPI नमूने के हैं (नमूना डेटा)।"

Copy rules pass on the added lines: no em dashes, no exclamation marks, no "genuinely" and no "not X but Y". The required strings are present: "Coming soon: build on WhatsApp", "Built with Seedha", "Book direct · Powered by Seedha" and "This uses AI credit". There are no invented reviews, ratings, customers or awards. The share text is "Book <hotel> directly on our own website: <url>" (wa.me only). Nothing claims WhatsApp sending is live. Owner-facing AI text is labelled "Written with Claude · check every line".
