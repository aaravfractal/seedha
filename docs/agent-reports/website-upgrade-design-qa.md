# Website upgrade: design QA report

Reviewer: design QA (read-only). Date: 11 Oct 2026. Target: `make demo-prod` on http://localhost:3000.
Method: Playwright chromium (SwiftShader WebGL) at 390, 760, 980 and 1440 px, light and dark (site
`seedha_theme` cookie), and with reduced motion. The cookie banner was dismissed for the section shots.
Scripts and screenshots are in the session scratchpad under `review-design/`, not in the repo.

## What passed
- No horizontal scroll on `/`, `/privacy`, `/terms`, `/cookies`, `/security`, `/data-deletion`,
  `/contact`, `/about` or `/careers` at any width or theme. The only wide elements are the clipped
  hero glow and marquee. No console errors.
- Every page has a proper title ("Privacy policy · Seedha" and so on).
- The globe loads lazily and the intro eases from a whole-Earth view to North India. Land only: no
  country or internal border lines on the globe or the static map. Pine Pass markers, gold Radar markers.
- Radar list cards show name, town, dates and "Sample". Only Winter Line Carnival (Mussoorie,
  25 to 30 Dec) has dates. The other four show "Dates to confirm".
- Pills are correct: "Planned" and "Phase 3" on Pass, "Pro" and "Planned" on Radar. The bubble
  is labelled "Sample". The new sections have no rupee figures, em dashes, exclamation marks,
  "genuinely" or closing questions. "Not just Diwali" is the brief's own wording.
- Reduced motion switches both sections to the static map (`data-globe-mode="static"`).
- The careers section labels every role "Planned", and the lede says applications open before launch.

## Findings

| ID | Sev | Page / width / theme | File:line | What is wrong | Suggested fix |
|----|-----|----------------------|-----------|---------------|---------------|
| D1 | high | `/` #seedha-pass and #event-radar, reduced motion, all widths, both themes | `apps/web/lib/globe.ts:245` (`NORTH_INDIA_BOUNDS = [72, 25, 85, 35.5]`), `globe/StaticMap.tsx:76` (`slice`) | The static fallback is a plain grey rectangle with dots and labels. The frame holds land only, so no coastline or shape tells the viewer it is a map of North India. It looks unfinished. Reduced-motion users and low-end phones, which are likely among hill-hotel owners, see this view. | Widen the frame so some coastline shows, for example lon 62 to 94 and lat 18 to 38: the Arabian Sea, Gujarat and the head of the Bay of Bengal. Add a soft pine glow behind the hill belt so the markers still read. Another option is a small inset or subtle relief. Keep the map land-only. |
| D2 | medium | `/` both globe sections, all widths, light and dark | `globe/scene.ts:56-61` (`CAM_END 2.0`, `FOCUS_ELEV`), `scene.ts:254` (point sizes) | After the intro, the camera sits so close that the globe reads as a flat grey slab with a horizon. All six Pass towns fit in a cluster about 30 px wide that overlaps, and the 0.0016-radius arc tubes (`scene.ts:283`) cannot be seen. The arcs labelled "Planned town" (brief section 2) exist only in the text list. | Pull the camera back (CAM_END about 2.6 to 2.8) so the curve of the Earth and the coastline show. Make the arcs thicker or use a glow line (radius about 0.004). Add an HTML or sprite label "Planned town" on hover or focus, or one caption chip near the cluster. |
| D3 | medium | `/` globe toggle, all widths, dark | `globe/globe.module.css:52-56` | In dark mode the pressed segment (`--card`) is almost the same colour as the track (`--fill`), so the selected layer can only be told apart by slightly brighter text. Light mode is fine. | In dark mode, give the pressed state a lighter surface, for example `color-mix(in srgb, var(--ink) 14%, var(--fill))`, or a 1px `--line` border. Pine text on the active segment is another option. |
| D4 | medium | `/` both globe sections, all widths, light | `lib/globe.ts:274-277` (light palette: land `#7c7c81`, ocean `#eceef1`) | Light mode reads as inverted. Mid-grey land fills almost the whole frame and the pale seas look like cut-out shapes. Gold Radar dots on `#7c7c81` land have low contrast and are about 8 px wide. | Lighten the land (about `#b9bcc2`) and darken the ocean slightly, or tint the ocean with pine. Check that gold markers reach at least 3:1 against the land, or give them a dark ring in light mode. |
| D5 | medium | `/privacy`, `/security`, `/data-deletion`, `/terms`, all widths | `app/(website)/privacy/page.tsx:162`, `security/page.tsx:20`, `data-deletion/page.tsx:60`, `terms/page.tsx:118` | When no address is set, the fallback renders as "Email: Contact details will be published before launch." The label and sentence clash, and the terms version is a colon-then-reveal line ("Questions about these terms: Contact details..."). | Let `ContactEmail` render the whole sentence, for example "Email address: to be published before launch." Or drop the "Email:" prefix when the value is unset. |
| D6 | medium | `/` #event-radar, 980 and 1440, both themes | `EventRadar.tsx:23`, `upgrade.module.css:25-33` | The Event Radar `h3` uses the same `.title` style (clamp to 56px) as the Seedha Pass `h2`, so it is almost the size of the Pulse `h2` ("Every festival, one channel decision.") above it. The subsection competes with its parent section. | Give the Radar title a smaller step (about `--t-title`, 32 to 40px), or make it visually a sub-head under Pulse. |
| D7 | low | `/` both sections, 980 and 1440 | `upgrade.module.css:7` (`align-items: center`) | The copy column is centred against a much taller globe column. The kicker starts about 150 px below the layer toggle, and the space above the copy looks empty. | Use `align-items: start` and make the copy `position: sticky; top: 96px`, or top-align the kicker with the toggle. |
| D8 | low | `/` 390, both themes | `globe/globe.module.css:216-226` | On mobile, the Pass section runs to about 2 screens of stacked 64px list cards, and Radar is similar. | Below 480px, show the list as a 2-column grid or compact chips, keeping the accessible `ul`. |
| D9 | low | `/` 760 light | `globe/land.ts:8` (land-110m) | At 760 to 1440 the coastlines look visibly stepped in light mode, where the contrast is high. | Soften with a 1px blur on the land canvas texture, or accept the look. land-50m costs extra kilobytes. |
| D10 | low | `/` #pulse and #event-radar | `Sections.tsx` (PULSE data), `lib/globe.ts:76` | The Pulse strip lists "Dussehra · Tue 20 Oct" with a date, and directly below the Radar card says "Kullu Dussehra · Dates to confirm". Side by side these can read as contradictory. | Add a footnote line, or rename the card to "Kullu Dussehra fair". |
| D11 | low | `/` #guest-map | `Sections.tsx:345-346` | The Guest map footnote says "3D view coming soon", but a 3D globe already appears on the page. It is also soft "coming soon" wording. | Use "Planned: a 3D view of guest origins." |
| D12 | low | `/` careers section, both themes | `Pricing.tsx:126` (`styles.planned`) | The careers "Planned" pill is outlined and small, while the new sections use filled pine `tagPlanned` pills. The same status has two styles. | Reuse one pill component and style for Planned everywhere. |
| D13 | low | `/terms` | `app/(website)/terms/page.tsx` ("for perks for returning guests, not to sell rooms below...") | The X, not Y construction is close to the banned "not X but Y" pattern. | "Use Seedha to give returning guests perks. Keep your public rates as published." |
| D14 | low | `/` globe, desktop | `globe/scene.ts:63-64` | Auto motion is a ±9° sway over 48 s, not a slow rotation. It is calm, but on screen it reads as almost static. | Optional: allow a slow continuous drift that recentres on North India, or keep it as is and note it in decisions.md. |

## Not checked here
- Contrast ratios: checked only by eye. The accessibility reviewer owns the measured 4.5:1 checks.
- 60 fps and bundle size: owned by the performance review.
