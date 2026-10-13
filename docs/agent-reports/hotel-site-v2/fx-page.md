# FX-PAGE report: Hotel Site V2, public page fixes

Fixer FX-PAGE, worktree `.worktrees/fxpage`, branch `hsv2-fx-page` (base `hotel-site-v2` eafd3b4). Nothing is committed; the lead commits.

## Done

| id | change | tests |
|---|---|---|
| R2-1 / R1-9 | The card ribbon (`?src=card-*`) shows the owner's own `card_perk_en` / `card_perk_hi` (picked by language, Hindi falls back to English) in gold only when it is set. Otherwise it shows a neutral pine line that promises nothing: "Welcome. Booking here goes straight to the hotel." / "स्वागत है। यहां की बुकिंग सीधे होटल को जाती है।". The old "returning-guest perk" copy is gone. The perk fields are optional on `SiteDetailsData`, and `withDetails` fills in "" when they are missing. | unit `cardPerk`; e2e: the ribbon shows either "Sample perk:..." or exactly the welcome line, and never "returning-guest perk" or ₹ |
| R2-5 | The ribbon now sits inside the hero's text flow, above the place line, instead of absolutely at the top. It cannot cover the "Sample photo" chip. It adds no layout shift: the hero height is fixed and its text is aligned to the bottom. | e2e: the bounding boxes of the ribbon and the "Sample photo" chip do not overlap |
| R1-1 | `lib/siteHost.ts`: new `hotelRoute()` matches `/h/<slug>` and `/h/<slug>/opengraph-image*`; new `publicSlug()` lower-cases and rejects invalid shapes. Proxy: a slug with capitals now 308s to the lower-case path, and the live/none check also covers the OG image path (an empty 404 for the image, the not-live page for the page). `data.ts`: `loadPublicSite` checks `publicSlug` before the private `"use cache"` function runs, so case variants share one entry and an invalid slug never creates one. `opengraph-image.tsx` returns 404 for an invalid or unknown slug before drawing. | unit `hotelRoute`, `publicSlug`; e2e: `/h/Deodar-View` gives 308 to `/h/deodar-view`; both `/h/no-hotel-here-x/opengraph-image` and `/h/x_y/opengraph-image` give 404 |
| R1-3 | `hotelRevalidation()` in `lib/hotelSiteV2.ts` returns one of three values. `own`: an owner 2xx write to `site` or `site/*`. `all`: `demo/reset`, because the reset reloads every table. `none`: everything else. It also returns `none` for any write by the Direct beta subject `demo` when `isHosted()`. The BFF (`route.ts`) handles `own` with one GET `/site`, using the same owner headers, to get the slug, then `revalidateTag("hotel-site:<slug>")`. If that read fails it falls back to all. Rooms are not included: no owner route edits rack rates, and room writes are slips only. | unit (13 cases); e2e site-build passes (photos, text, publish and branding edits still show on the public page) |
| R1-5 / R2-6 | Choice: **the sample keeps labelled JSON-LD**: name "Deodar View (sample)", description "Sample hotel for the Seedha demo. All details are fictional.", and no address, geo, telephone, email or priceRange. It also gets `robots: noindex, nofollow` and the title "Deodar View (sample) · Mussoorie". It is removed from `sitemap.xml`, which now lists only the Seedha website pages, because the API cannot list hotels. Real hotels keep full SEO. | unit; e2e: JSON-LD, the robots meta, and the sample's absence from the sitemap |
| R1-6 | `public/h-sw.js`: the cache is versioned `v2`, and older versions are deleted on activate. A 404 or 410 for the hotel page or its public JSON deletes this hotel's caches and unregisters the worker. Every fetch that succeeds replaces the saved copy. The refresh window drops from 1 day to 15 minutes. | e2e offline test passes |
| R2-7 | The focus ring on dark surfaces (hero, mobile bar) is cream with an ink outer ring, so it is readable on any photo. Pine stays elsewhere. No gold. | e2e axe clean |
| R2-8 | Hero "Book directly", the header Book pill and the mobile bar Book all go to `#…book`. They scroll smoothly (instantly with reduced motion) and focus the check-in date. | e2e: clicking Book directly focuses Check-in |
| R2-9 | The submit button is in the page's language: "Book direct · Powered by Seedha" / "सीधे बुक करें · Seedha द्वारा". When the branding is hidden it shows only the "Book direct" part. The footer reads "Built with Seedha" / "Seedha के साथ बना" and no longer forces `lang="en"`. | e2e site-build still finds the English label |
| R2-10 | `copy.ts` `openInMaps` now comes from `MAP_COPY` in `lib/localMap.ts`, which is a single string ("मैप्स में खोलें"). | n/a |
| R3-2 | `app/h/layout.tsx` no longer applies `worldBFonts`, so Mukta Latin and the World B fonts are not preloaded on hotel pages. The layout's own `<main>` is removed: V2 renders its own `<main id="main">`, so there is no longer a duplicate. The loading, missing and error states in `HotelPage.tsx` now use the hotel page's own CSS module instead of `WorldBMessage`/`worldb.module.css`. | e2e |
| R3-3 | The "हि" button label uses a system Devanagari stack, so an English page never needs Mukta. Mukta stays `preload: false` and loads only when Hindi text is on screen. | build |
| R3-4 | `robots.txt` now has `Allow: /`, `Allow: /api/public/site/` and `Disallow: /api/`. The rules live in `ROBOTS_RULES` (`lib/hotelSiteV2.ts`). | unit + e2e |
| R3-8 | Real hotels: `priceRange` ("₹4,300 to ₹6,200") comes from the API's room prices (formatting only) and `image` from the photos. Each is added only when the data exists. | unit |
| R3-9 | `metaDescription()`: the owner's description clipped to 155 characters at a word boundary, otherwise "tagline. Hotel in Place. Book directly with the hotel.". Sample pages start with "Sample hotel with fictional details." | unit |
| R3-10 | The language buttons show "EN" / "हि" followed by visually hidden " English" / " हिन्दी", so the accessible name contains the visible text. | e2e (names still match) |
| R3-1 (page part) | Hero and gallery photos use `<picture>`: AVIF and WebP `srcset` plus a JPEG `<img>` fallback with `srcset`, built against the contract `?w=480\|768\|1024&fmt=avif\|webp\|jpeg` (`photoSources()`, never wider than the stored photo). `next/image` is no longer imported. The hero is eager with `fetchpriority="high"`, and `page.tsx` preloads it with `imagesrcset` (AVIF, `sizes=100vw`) through `react-dom` `preload`. URLs outside the public route (the owner preview) are shown as they are. The JPEG fallback `src` is `...&w=1024&fmt=jpeg`, so until FX-API lands the API ignores the extra parameters and serves the JPEG. | unit; e2e site-build: the photos load and the first `src` is `image/jpeg` |
| 8 (preview) | `HotelSiteV2` takes a `preview` prop (see the API below). | tsc |
| 9 (sign-in) | `e2e/helpers.ts` `signInOnce(browser)`. `hotel-site-v2.spec.ts` now signs in once per file, in `beforeAll`. Owner calls go through a separate context made from that storageState. The guest page stays signed out. | e2e |

## Not done (left as is, nothing half-done)

- **R3-5 (owner CSS on /h):** not fixed. The hotel page still links a 113 KB CSS chunk (`391jlhljhf0c_.css`, owner-app modules). I split the toast CSS out of `Shell.module.css`, which the root layout pulls in. The chunk was still linked afterwards: Turbopack merges CSS across the app. Because that did not cure it, I reverted it. A real fix probably needs a separate root layout for `/h` (route groups with their own `<html>`), which touches every top-level route.
- **R3-6:** no browserslist change. Next 16.4's default is already `chrome 111, edge 111, firefox 111, safari 16.4` (`node_modules/next/dist/docs/03-architecture/supported-browsers.md`). The flagged polyfills are in Next's prebuilt runtime, which a browserslist does not change. Dropping `next/image` removes its client code from the page.
- **R1-12 (CSP `unsafe-inline`):** left as is. A nonce makes every hotel page dynamic, which conflicts with static per hotel. Accepted risk; the JSON-LD escapes `<` and all owner text is React text.
- **R2-11, R2-12 (map label on its own line, globe first frame):** not touched (out of time). `LocationGlobe.tsx`, `LocalMap.tsx`, `lib/localMap.ts` and `lib/siteGlobe.ts` are unchanged.
- **Lighthouse:** not run, at the lead's instruction. **Conflict to note:** the noindex on the sample page (R1-5/R2-6) makes Lighthouse SEO fail its "is-crawlable" audit on `/h/deodar-view`, so SEO will score below 90 there. All other SEO audits are unaffected. A real (non-sample) hotel page is indexable.
- The not-live and error states now use system fonts (no World B fonts).

## Preview prop (for the fixer rendering V2 in Review)

```ts
import { HotelSiteV2 } from "@/components/site/v2/HotelSiteV2";
type HotelSiteV2Props = {
  site: HotelSitePayload;               // owner GET /site (has details) through withDetails()
  preview?: boolean;                    // owner preview
  lang?: Lang;                          // controlled language (Review's EN/HI)
  onLangChange?: (lang: Lang) => void;  // the page's own EN/HI switch calls this when given
  previewCard?: ScanCard | null;        // preview only: show the card ribbon for this card
};
```

With `preview`:
- No scan POST, no service worker, no `history.replaceState`, no `document.title` change, no availability API calls.
- Links do nothing (only the in-page `#book` jumps still work), and the booking form does not submit.
- The header and the mobile bar are `position: static`.
- The page's cream `html`/`body` background is not applied.
- It renders a `<div>` instead of `<main id="main">`.
- `?lang` and `?src` in the owner's URL are ignored.

## Sign-in helper

```ts
import { signInOnce } from "./helpers";
let state = "";
test.beforeAll(async ({ browser }) => { state = await signInOnce(browser); });
// then: const ctx = await browser.newContext({ storageState: state, baseURL }); const owner = await ctx.newPage();
```

`signInOnce(browser: Browser): Promise<string>` signs in with Direct beta login once per spec file (it is memoised per file in the worker). It saves the storageState to `test-results/.auth/<spec>.json` and returns that path.

## Check results (real output, apps/web)

`npx next typegen && npx tsc --noEmit && npx eslint . --max-warnings=0 && npx prettier --check . --log-level warn && node --test lib/*.test.ts && node scripts/audit-check.mjs && npx next build`: exit 0.

```
ℹ tests 266
ℹ pass 266
ℹ fail 0
npm audit gate passed: production 0 high/critical; dev 5 high (allowlisted, reviewed).
```

The build HTML for `/h/deodar-view` has `name="robots" content="noindex, nofollow"` and JSON-LD `"name":"Deodar View (sample)"`.

e2e ran with a scratch copy of playwright.config.ts on web 3051 / API 8051, removed afterwards. The real config was not edited.

```
✓ hotel-site-v2: 390 px, English: every section, amenities expand, no sideways scroll
✓ hotel-site-v2: 1440 px, Hindi: the toggle and ?lang=hi, Devanagari, no sideways scroll
✓ hotel-site-v2: SEO: title, canonical, Open Graph image and Hotel JSON-LD without reviews
✓ hotel-site-v2: strict headers on the hotel page, on both addresses
✓ hotel-site-v2: a card scan shows the owner's perk or a plain welcome and counts once, with no cookies
✓ hotel-site-v2: offline: the service worker shows the hotel's name and contact
✓ hotel-site-v2: slow 4G at 390 px: LCP under 2.5 s and CLS under 0.1 (production build)
✓ site-address: publish under a chosen address, then open, share and protect it
✓ site-build: build, generate, edit, regenerate and publish the site
✓ site-build: Settings shows the site AI usage card
10 passed (2.9m)
```

After the service-worker change, hotel-site-v2.spec.ts was rerun: 7 passed.
