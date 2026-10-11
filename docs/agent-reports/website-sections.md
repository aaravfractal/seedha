# Website upgrade: sections builder report

## Files (all under apps/web/components/website/)
- SeedhaPass.tsx (new): `<section id="seedha-pass">`, h2, globe `initialLayer="pass"`.
- EventRadar.tsx (new): `<section id="event-radar">` nested inside `#pulse`, h3, globe `initialLayer="radar"`.
- useReveal.ts (new): rise-once reveal; hides only after hydration so no-JS readers see everything.
- upgrade.module.css (new): grid, status pills, points, consent line, WhatsApp bubble, reveal (var(--spring), 600 ms; instant under reduced motion).
- HomePage.tsx: `<SeedhaPass />` placed right after `<Features />`.
- Sections.tsx: PulseStrip renders `<EventRadar />` after its sample calendar and footnote. Calendar content, `id="pulse"` and the other sections are unchanged.
- No primary action (CTA) in either section.

## Final copy (verbatim)
Seedha Pass. Kicker "Seedha Pass". Pills "Planned", "Phase 3".
- H2: "Seedha Pass. One network of owner-run hill hotels." ("owner-run" sits in a nowrap span so it never breaks at the hyphen. Text content is unchanged.)
- "Perks everywhere": "Guests will get perks at every Seedha hotel, never lower prices."
- "Faster check-in": "Check-in will be faster from a profile the guest controls."
- "Referrals with no commission": "Hotels will refer guests to each other with no commission."
- Callout: "Shared between hotels only with the guest's separate consent."
- Footnote: "A planned feature shown with sample towns."
- Globe: `<WorldGlobe initialLayer="pass" label="Seedha Pass planned towns" />`

Event Radar. Kicker "Event Radar". Pills "Pro", "Planned".
- H3: "Know about every event near you, not just Diwali." (as written by the owner)
- Lede: "Seedha will gather upcoming local events from official sources. One WhatsApp line each morning will tell you what's coming. You decide rates, room holds and packages, and Seedha never sets a price."
- Bubble caption "Seedha on WhatsApp", tag "Sample". Text: "Winter Line Carnival in Mussoorie, 25 to 30 Dec. Keep rooms for direct guests and check your rates."
- Callout: "Official event sources only. No scraping."
- Globe: `<WorldGlobe initialLayer="radar" label="Event Radar sample events" />`
I scanned all the new copy for em or en dashes, exclamation marks, rupee signs and "genuinely" and found none.

## Checks
- typegen, tsc, eslint (--max-warnings=0), prettier --check and node --test lib/*.test.ts (68 pass, 0 fail) all pass.
- axe (wcag2a/2aa/21aa) on "/" after scrolling the whole page: no violations in dark at 1440, dark at 390, light at 1440 and light at 390.
- No horizontal overflow at 390, 760, 980 or 1440 in either theme.
- Reduced motion: the bubble and points show at full opacity straight away. With JavaScript off, #seedha-pass, #event-radar and #pulse all render.
- Screenshots compared: both sections at 390, 760, 980 and 1440 in light and dark, plus the whole #pulse section at 1440. The layout is a 5fr/6fr grid at 980 and up, with the copy on the left and the globe on the right. Below 980 it stacks with the globe under the copy. The globe was still the stub ("Map loading."), so the real globe's size and spacing need a look after the merge.
- The section titles use clamp(34px, 3.9vw, 56px), a step below the site's t-large h2. This keeps the Seedha Pass title to 3 lines at 1440, where t-large made it 4.

## For the lead
- Header: "/#pulse" still works. Event Radar sits inside #pulse, so it needs no new link. If you want one, add "/#seedha-pass" as "Pass" in WebsiteHeader.tsx (I did not edit it).
- e2e hooks: `#seedha-pass` (h2 `#seedha-pass-title`) and `#event-radar` (h3 `#event-radar-title`, inside `#pulse`). Each section holds exactly one WorldGlobe, so tests can scope to the section, for example `#event-radar [data-globe-layer]` while the stub is in place.
- The Features grid still has its "Pulse · Pro" card saying "Not a prediction". I left it unchanged as briefed.
- Dev visual checks must use http://localhost:3817. On 127.0.0.1, Next 16 blocks dev resources (allowedDevOrigins) and the page never hydrates.
