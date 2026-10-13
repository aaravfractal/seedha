# Hotel Site V2: V2-PAGE report

Helper V2-PAGE, worktree `.worktrees/v2page`, branch `hsv2-page`. Not committed (the lead commits).

## What was built

The public hotel page at `/h/<slug>` (and `<slug>.<SITE_ROOT_DOMAIN>` / `<slug>.localhost` through the existing proxy), Pine mood:

- Sticky header (the booking pill): hotel name, EN/HI toggle (`aria-pressed`, labelled "English" / "हिन्दी"), Book pill to the booking form.
- Hero: owner photo (or the labelled sample gradient), place, name, tagline, "Book directly" (Seedha Link from `booking_url`, prefilled for the first bookable room), WhatsApp (a `wa.me` link from `details.contact.whatsapp`, hidden when empty).
- Perk ribbon: gold, wording only, no amounts. Shown only when the address has `?src=card-wallet|card-room|card-desk`. It is placed absolutely inside the fixed-height hero, so it adds no layout shift.
- Scan ping: one `POST /api/public/site/<slug>/scan {card}` per visit (`credentials: "omit"`, `keepalive`, guarded against React double effects). After the ping, `src` is removed from the address bar, so a reload or a shared link does not count again. The page stores nothing.
- Booking form ("Book your stay"), unchanged from V1: availability check, "Book direct · Powered by Seedha".
- About; Why book direct (the existing text); rooms and packages, with prices exactly as the API sends them (`inr()` formatting only; no price is computed in the web).
- Amenities from `details.amenity_labels`, with 40 inline SVG icons. The page shows 12 first, then a "Show all N amenities" / "Show fewer" button (`aria-expanded`, `aria-controls`).
- Gallery (owner photos, or the labelled sample gradients).
- Honest empty reviews: "No reviews yet." plus "Have a question before you book? Ask the hotel directly." No reviews, ratings or awards appear anywhere.
- Location: V2-GLOBE's `LocationGlobe` (`next/dynamic`, `ssr: false`, a `GLOBE_BOX` placeholder) and `LocalMap` (`next/dynamic`). Both load only when the section comes within one screen of view (IntersectionObserver). `LocalMap` renders the "Open in Maps" link. The page adds its own link only when there are no nearby places but there is a map position, so the link is never shown twice.
- How to reach (road, rail and air icons), Good to know (check-in and check-out times plus the owner's notes), Contact (tel, WhatsApp, mailto, address, UPI, and the sample placeholder note).
- Footer: "Sample hotel. All details are fictional." on the sample hotel, and "Built with Seedha" unless `hide_branding` is set.
- Sticky mobile bar under 720 px (Call / WhatsApp / Book). The page reserves bottom padding for it.
- Hindi: Devanagari with Mukta (headings in Mukta 700). Inter with Mukta as the fallback for body text.
- Offline: `public/h-sw.js`.
- SEO: per-hotel title and description, canonical (`site.url`), Open Graph and Twitter cards, `app/h/[slug]/opengraph-image.tsx`, schema.org Hotel JSON-LD, `app/sitemap.ts`, `app/robots.ts`.
- Strict headers for hotel pages on both addresses.

## Files

New:
- `apps/web/app/h/[slug]/data.ts`: cached loader (`'use cache'`, `cacheTag`, `cacheLife`)
- `apps/web/app/h/[slug]/opengraph-image.tsx`
- `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`
- `apps/web/components/site/v2/HotelSiteV2.tsx`, `hotel.module.css`, `copy.ts`, `AmenityIcon.tsx`
- `apps/web/lib/hotelSiteV2.ts` and `hotelSiteV2.test.ts`: scan source, links, cache tags, JSON-LD, headers, `withDetails`, `AMENITIES_SHOWN`
- `apps/web/lib/amenityIcons.ts` and `amenityIcons.test.ts`: the 40 icon shapes as data; the test checks that every id in `lib/amenities.ts` has an icon
- `apps/web/lib/types-hotel-site.ts`: the `details` payload types (`HotelSitePayload`, `SiteDetailsData`, `ScanCard`)
- `apps/web/lib/fonts-hotel.ts`, `apps/web/lib/fonts/inter-latin-variable.woff2`, `apps/web/lib/fonts/OFL-Inter.txt`
- `apps/web/public/h-sw.js`
- `apps/web/e2e/hotel-site-v2.spec.ts`

Changed:
- `apps/web/app/h/[slug]/page.tsx`: static per hotel, Suspense, JSON-LD, metadata
- `apps/web/app/h/[slug]/HotelPage.tsx`: renders V2
- `apps/web/app/api/[...path]/route.ts`: 2 imports and 5 lines, revalidation only
- `apps/web/lib/siteHost.ts` and `siteHost.test.ts`
- `apps/web/proxy.ts`: hotel-host headers
- `apps/web/next.config.ts`: `/h/:slug` headers

Copied as instructed (read-only, owned by others):
- From V2-GLOBE: `components/site/v2/LocationGlobe.tsx`, `components/site/v2/LocalMap.tsx`, `lib/siteGlobe.ts` and its test, `lib/localMap.ts` and its test, `lib/types-site-v2.ts`
- From V2-OWNER: `lib/amenities.ts` (my own `amenities.ts` and `amenities.test.ts` were deleted; V2-OWNER's `siteDetails.test.ts` checks the mirror)

**Stubs: none remain.** I briefly wrote placeholder `LocationGlobe` and `LocalMap` files, then replaced them with V2-GLOBE's real files on the lead's instruction.

## Decisions

**Inter font.** The file is the Latin subset of the Inter variable font (one file covers weights 400 to 600; 48,432 bytes; sha256 `c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4`). Source: `https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2`, the Latin file the Google Fonts CSS API gives for `family=Inter:wght@400;600`. The licence text is SIL OFL 1.1, from `https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt` ("Copyright (c) 2016 The Inter Project Authors"), saved as `lib/fonts/OFL-Inter.txt`. It is loaded with `next/font/local` in `lib/fonts-hotel.ts`, together with a second `localFont` for Cormorant 600 (same bundled file as World B). Mukta Devanagari comes from the root layout.

**Static per hotel, revalidated on publish.**
- `loadPublicSite(slug)` is a `'use cache'` function tagged `hotel-sites` and `hotel-site:<slug>`, with `cacheLife({stale: 300, revalidate: 900, expire: 86400})`.
- It fetches with the proxy proof only, never the visitor's address, because the result is shared.
- An unreachable API throws, so a failure is never cached. The page then calls `connection()` and renders the existing client fallback with retry. A 404 is cached; the proxy answers not-live slugs first, and a publish clears the cache.
- The page awaits `params` inside `<Suspense>` and reads no request data.
- `generateStaticParams` returns the sample slug, so the build output shows `○ /h/deodar-view` (fully static) and `◐ /h/[slug]`. Other published hotels are rendered on their first visit and then served from the ISR cache.
- Revalidation: every successful owner write through the BFF (`access === "owner"`, method not GET or HEAD, 2xx) calls `revalidateTag("hotel-sites", { expire: 0 })`. That covers publish, site edits, branding, room prices, V2-OWNER's PUT details and the demo reset.
- I chose this over a publish-only hook because owner edits after publishing already appear live today, and e2e/site-build expects branding changes at once. It marks all hotel pages stale, which is cheap at this scale. The 15-minute background refresh keeps the hotel's date and room prices current.
- `Cache-Control: public, max-age=0, must-revalidate` is set on hotel pages. Next's ISR header carries `stale-while-revalidate`, and without this override Chrome showed a stale page after a branding change; site-build caught it.

**Service worker.**
- `public/h-sw.js` is registered only by the hotel page, as `/h-sw.js?slug=<slug>`. Its scope is `/h/<slug>` on the app host and `/` on the hotel host.
- It keeps one thing: that hotel's public site JSON, fetched at install with `credentials: "omit"` and refreshed once a day after a page load that worked.
- It intercepts only navigations to exactly that hotel's page, network first. When offline it returns a small 503 page built from the saved JSON: the hotel's name, place, phone, WhatsApp, email, address and the sample label, with its own `default-src 'none'` CSP.
- Nothing else is intercepted or cached, and no visitor data is stored.
- `hotelPathAllowed` allows `GET /h-sw.js` on hotel hosts.

**siteHost / proxy.**
- `hotelPathAllowed` now allows exactly one write: `POST /api/public/site/<own slug>/scan`. Other POSTs, PUT, PATCH, DELETE, other slugs and `/scan/x` are all refused (tests added).
- The BFF's existing Origin check still applies; e2e confirms the POST works on both addresses.
- The proxy sets the strict hotel headers on the hotel-host rewrite.

**Headers (`hotelPageHeaders` in `lib/hotelSiteV2.ts`).** The app's CSP plus `worker-src 'self'`, `manifest-src 'self'` and `frame-src 'none'`. `frame-ancestors 'self'` is kept so an owner preview frame would still work. Permissions-Policy adds `microphone=()` and `usb=()`. Also COOP `same-origin` and the Cache-Control above. These apply to `/h/:slug` in `next.config.ts` (a later entry overrides the global one) and on the hotel host in `proxy.ts`. e2e checks both addresses.

**Sitemap.** The API has no route that lists published hotels, and I added none. The sitemap lists the Seedha website pages plus the sample hotel at `<origin>/h/deodar-view`. Robots allows `/` and disallows `/api/`.

**JSON-LD.** Hotel with name, url, address (street from the owner's address, locality, country IN), geo, telephone, email, amenityFeature, image, checkinTime, checkoutTime and numberOfRooms. It never includes review, rating, priceRange or offers. The sample hotel's placeholder phone and email are left out. `<` is escaped.

**Images.** I used `next/image` with `unoptimized` (no lint suppressions). Images have explicit width and height and `sizes`. The hero uses `loading="eager"` and `fetchPriority="high"`; the rest are lazy. The `img src` stays `/api/public/site/<slug>/photos/<id>?v=…`, which e2e/site-build checks.

**Mood.** The V2 page is Pine only, per the brief; `?mood=` is ignored there.

**Contrast.** Grey #6E6E73 is 4.49:1 on cream, which axe fails. My secondary text uses #4F4F54. V2-GLOBE's `LocalMap` draws grey text on the page background, so I put it inside a white card, where it is 5.1:1. V2-GLOBE may want to know.

## Check results (real output, apps/web)

`npx next typegen > /dev/null && npx tsc --noEmit && npx eslint . --max-warnings=0 && npx prettier --check . --log-level warn && node --test lib/*.test.ts && node scripts/audit-check.mjs && npx next build`: exit 0.

```
ℹ tests 243
ℹ pass 243
ℹ fail 0
npm audit gate passed: production 0 high/critical; dev 5 high (allowlisted, reviewed).
✓ Compiled successfully
✓ Generating static pages using 9 workers (59/59)
├   /h/[slug]
│ ├ ◐ /h/[slug]
│ └ ○ /h/deodar-view
├   /h/[slug]/opengraph-image
│ └ ● /h/deodar-view/opengraph-image
├ ○ /robots.txt
├ ○ /sitemap.xml
```

e2e: a scratch copy of `playwright.config.ts` on web 3011 and API 8011, removed afterwards. The real config was not edited.

```
✓ hotel-site-v2: 390 px, English: every section, amenities expand, no sideways scroll
✓ hotel-site-v2: 1440 px, Hindi: the toggle and ?lang=hi, Devanagari, no sideways scroll
✓ hotel-site-v2: SEO: title, canonical, Open Graph image and Hotel JSON-LD without reviews
✓ hotel-site-v2: strict headers on the hotel page, on both addresses
✓ hotel-site-v2: a card scan shows the perk and counts once, with no cookies
✓ hotel-site-v2: offline: the service worker shows the hotel's name and contact
✓ hotel-site-v2: slow 4G at 390 px: LCP under 2.5 s and CLS under 0.1   (LCP 1136 ms, CLS 0.0000)
✓ site-address: publish under a chosen address, then open, share and protect it
✓ site-build: build, generate, edit, regenerate and publish the site
✓ site-build: Settings shows the site AI usage card
```

The axe WCAG 2.1 AA sweep is clean at 390 (EN, and with the perk) and at 1440 (HI). Lighthouse was not run (it is not installed). The LCP and CLS figures come from Chrome under CDP throttling: 150 ms RTT, 1.6 Mbps down, 4x CPU.

The API was not touched, so no API checks were needed.

## Known gaps

- **No AVIF/WebP.** The API's photo route stores and serves one JPEG (≤1024 px, about 200 KB). Serving AVIF or WebP needs API-side variants or the Next optimizer, and the optimizer would change the photo URLs that e2e/site-build checks.
- **LCP was measured on the sample hotel only.** It has no photos, so its LCP element is text. An owner site's LCP is its hero JPEG, which is eager with high fetch priority, but it was not measured.
- **`?lang=hi`, the perk and hotel-host booking links apply after hydration**, so the page itself can stay static. A shared Hindi link shows English for a moment. The perk causes no shift.
- **The owner's preview still uses V1.** The Website screen's Review preview renders the old `components/site/HotelSite.tsx`, so it differs from the public V2 page. That is V2-OWNER's or the lead's call.
- **No robots or sitemap on hotel hosts.** Hotel hosts serve only `/`, so `robots.txt` and `sitemap.xml` 404 there.
- **The proxy still calls the API on every page request.** This is existing behaviour (`/resolve`, no-store), so each view still makes one small API call even though the page is static.
- **The build prerenders the sample page from whatever API is reachable at build time (`API_URL`).** In this worktree that was a dev API on the default port, which did not yet send `details`. `withDetails()` now fills in missing details, so an older API cannot break the page or the build. If no API is reachable at build time, the page renders on its first request.
- **Merge note: `app/api/[...path]/route.ts`.** V2-OWNER added PUT there. My change is 2 imports plus 5 lines in `forward()`, and `forward()` is what PUT calls, so its writes revalidate too.
