# V2 Honesty and copy review: live features (read-only, 12 Oct 2026)

Scope: diff cb8a501~1..HEAD for owner app, guest and kiosk pages, website pages, README-dev.md,
scripts/demo-*.sh, scripts/proof_wallet.py, and the API strings they show.

## Passes (no change needed)
- Chain: every on-screen mention says "Polygon Amoy testnet" (lib/proofChain.ts NETWORK), "Testnet tokens
  have no value." shows on the chain card and the Settings notice. No mainnet claims anywhere. Local mode is
  titled "Local only" and gives a reason. A bundle reads "Verified" only when apply_confirmation gets a
  receipt with status 0x1 (services/chain.py:245-255, services/proof.py:153-158). A missing or slow receipt
  stays "Sent ..., waiting for confirmation".
- Simulated parts: the morning preview has a "Simulated send" chip and button text, the API never calls
  WhatsApp (routers/events.py:323). With no key the extraction is labelled "Sample extraction" plus a no-key line.
  The kiosk paper toggle is labelled "Simulated: no paper". The README checklist keeps manual steps manual.
- No AI rupee figures: EVENT_SCHEMA has no money field. The guard rejects currency, price words, %, and 3+ digit
  numbers. Owner decisions are fixed code wording with no digits (services/calendar.py owner_decision_text).
  Owner cards show RATE_LINE and no rupee line.
- Copy scan of every new file found no em or en dashes, no exclamation marks, no "genuinely" and no "not just".
  The Hindi strings in the morning text, the decisions and the privacy note read naturally.
- Website Event Radar still shows "Pro" and "Planned", and its WhatsApp bubble is tagged "Sample". It describes
  automatic gathering, which is not built, so the section stays honest. The owner app never uses the name
  "Event Radar Lite" on screen (only in code comments), so no Beta label is needed.

## Findings

| id | sev | file:line | current text | proposed text |
|----|-----|-----------|--------------|---------------|
| H1 | medium | apps/web/lib/events.ts:84 (shown at calendar/page.tsx:126) | origin "sample_extraction" gets chips "From your sources" + "Sample extraction", and the card links the owner's URL as "Source:", though the fixed sample event (services/events.py:349) ignores the pasted text | Chips: "Sample extraction" only. Source line: "Sample event. Not read from {host}." |
| H2 | medium | apps/web/app/(owner)/(screens)/calendar/page.tsx:140 (lib/events.ts:102) | Saved card shows "Likely overnight demand: High" with no attribution (CLAUDE_NOTE appears only in the Add sheet). The screen subtitle at :275 says "Seedha Pulse does not predict demand." D-097 says the card must be labelled as Claude's reading | Owner_source card: "Likely overnight demand, as Claude read your source: High". Sample_extraction card: "Likely overnight demand (sample): High" |
| H3 | medium | apps/web/app/(owner)/(screens)/calendar/page.tsx:275 | "Each date becomes one channel decision. Seedha Pulse does not predict demand." | "Each date becomes one channel decision. Seedha does not forecast demand. On events from your sources, the demand line is Claude's reading of your notice." |
| H4 | medium | apps/web/app/(website)/privacy/page.tsx:176-180 | The AI service bullet lists every task it receives data for. Event notices are missing | Add the sentence "The text of event notices the owner pastes, to read event names, dates and towns." |
| H5 | low | apps/web/app/(website)/privacy/page.tsx:171-174 | Processors list has no chain node provider | Add the bullet "A Polygon Amoy testnet node provider, sent only the nightly Merkle root (one hash, no personal data) when the testnet option is on." |
| H6 | low | privacy/page.tsx:115, faq/page.tsx:49 | "when the hotel turns on the testnet option" | There is no hotel setting. It is server config (PROOF_* in .env). Use "when the testnet option is on" (as security/page.tsx:56 already does) |
| H7 | low | apps/web/app/(owner)/(screens)/approvals/page.tsx:171, components/inbox/Profile.tsx:66, components/owner/proofStatus.ts:6 | A consent chip reads "Verified" once it is sealed into a local root (services/proof.py:148), while a bundle beside it can read "Sent ..., waiting for confirmation" or "Stored on Seedha" | Keep the word, since the e2e and 8-step tests depend on it. Add a title or sub-line: "Sealed in a nightly root. The chain status is on Proof." |
| H8 | low | apps/web/components/desk/Kiosk.tsx:283 | "Printer needs paper. Slips show on this screen until paper is loaded." (the toggle is simulated) | "Printer needs paper (simulated). Slips show on this screen." |
| H9 | low | apps/web/components/desk/Kiosk.tsx:291 | "Load a 58 mm roll to print slips" (on a phone with no printer) | "Simulated paper out. Slips show on this screen." |
| H10 | low | apps/api/app/services/events.py:398-409 | The morning text treats sample-extraction events as "from your sources" and does not mark them | Add " (sample)" after the name when origin is sample_extraction |
| H11 | low | scripts/demo-live.sh:81-87 | Public link banner does not say what is simulated | Add `say "WhatsApp, payments and the morning preview are simulated. Sample hotel only."` |
| H12 | low | scripts/proof_wallet.py:67 | "Fund it with test POL: {FAUCET_URL}" | "Fund it with test POL (no value) from {FAUCET_URL}" |
| H13 | low | README-dev.md checklist step 2 | 'The bundle shows "Sent", then ...' | 'The bundle shows "Sent to Polygon Amoy testnet, waiting for confirmation", then ...' |
| H14 | low | apps/web/lib/events.ts:13 | "Read from your source by Claude, not a forecast." ("X, not Y" shape) | "Claude read this from your source. Seedha does not forecast demand." |
| H15 | low | lib/proofChain.ts:111, ProofChainCard.tsx:54 | "Only fingerprints go there: no name, phone or booking detail." (colon then list, an older pattern) | "Only fingerprints go there. No name, phone or booking detail does." |

## Not changed, noted
- The website Pulse lede (components/website/Sections.tsx:434, lib/pulse.ts:63) says "It does not predict demand."
  It describes Pulse's sample events, so it stays true once H2 and H3 attribute the owner-event demand to Claude.
- A Cloudflare quick tunnel carries all traffic in demo-live. README-dev documents this. It is a demo mode,
  so the privacy page does not list it.
