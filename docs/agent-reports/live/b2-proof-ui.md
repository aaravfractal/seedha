# B2 Proof UI (branch live/proof-ui, not committed)

## Files changed (apps/web)
- lib/types.ts: ProofBundle gains optional chain_block, network_label; new ProofChain; ProofOverview.chain optional.
- lib/proofChain.ts (new): pure helpers. chainStatus ("written" reads as "sent"), bundleStatus labels,
  readChain (missing chain = local), localReason, shortAddress, formatPol, linkHost (https only),
  needsTopUp, dialogChainText. FAUCET_URL, NETWORK, NO_VALUE.
- lib/proofChain.test.ts (new): 9 node tests.
- app/(owner)/(screens)/proof/page.tsx + proof.module.css: "Write tonight's proof" row (busy state,
  aria-busy, disabled when nothing is pending), chain card, per-bundle status line (aria-live polite),
  Refresh on sent bundles (re-GETs /proof, toasts the new status), "View on Amoy explorer (host)" link.
  Bundles now show even if entries are empty. Old public-chain note removed (moved into the card).
- components/owner/ProofChainCard.tsx + proofChain.module.css (new): amoy = "Polygon Amoy testnet", short
  wallet address (full address for screen readers), Copy address, wallet explorer link, balance in POL,
  low-balance faucet link, "Testnet tokens have no value."; local = "Local only" + reason + root kept on
  Seedha's server.
- components/ProofDialog.tsx: chain copy from dialogChainText (true in both modes), Root status row,
  link renamed "View on Amoy explorer (host)".
- components/settings/ProofWalletNotice.tsx + proofWalletNotice.module.css (new): role="status" note when
  amoy+low_balance or local+reason low_balance; faucet link; renders nothing on error (staff 403).
- app/(owner)/(screens)/settings/page.tsx: one line mounting ProofWalletNotice above the tabs.
- e2e/proof-live.spec.ts (new): local mode write -> "Stored on Seedha", "Local only" card, button then
  disabled; mocked GET /api/proof amoy/verified -> label with block, explorer href/target/rel, card,
  and the Settings faucet notice. Creates its own consent via /api/desk/checkin (skips rooms 104, 207).

## How to verify
cd apps/web && npx next typegen >/dev/null && npx tsc --noEmit && npx eslint . --max-warnings=0 &&
npx prettier --check . && node --test lib/*.test.ts
Ran proof-live.spec.ts on 3850/8850 with a temporary config: 2/2 pass. Also ran axe (wcag2a/aa) and
no-horizontal-scroll checks at 390 and 1440, light and dark, local and mocked amoy (all four
bundle states) on /proof and /settings: all pass. Temp config, spec and db removed afterwards.

## Open issues
- node --test: 94 pass, 1 fail that predates this work: personal-data test flags
  docs/LIVE_FEATURES.md:107 (committed in cb8a501). Lead to fix the doc line.
- Turbopack refuses to build with the symlinked node_modules in a worktree. To run e2e I briefly
  swapped in an APFS clone (cp -c) and restored the symlink afterwards.
- Toast text after a write uses the newest bundle's label; it relies on B1 returning bundles newest first.
- Website pages (privacy, security, faq) still say the root "is not yet on a public chain"; not owned by B2.
