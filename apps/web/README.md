# Seedha web app

Next.js 16 (App Router) app for Seedha: the public website and legal pages,
the owner screens, the guest pages (consent and Seedha Link) and the Desk
simulator. All hotel and guest data it shows is fictional sample data.

Run it from the repository root with `make dev` (development) or `make demo`
(production build); see `README-dev.md` for the full guide, the demo script
and the quality gates.

## Notes

- The browser only calls `/api/*` on this app. The server side adds the owner
  token or device key and forwards allowlisted routes to the API
  (`lib/bff.ts`).
- Public contact addresses come from `PUBLIC_CONTACT_EMAIL`,
  `PUBLIC_PRIVACY_EMAIL` and `PUBLIC_SECURITY_EMAIL` (`lib/contact.ts`). The
  pages that show them are prerendered, so set them before `next build`.
  When unset the pages say "Contact details will be published before launch."
- Unit tests: `node --test lib/*.test.ts`. `lib/personal-data.test.ts` fails if
  a public-facing file or doc carries a blocked personal word; it stores only
  SHA-256 hashes of those words.
- This Next.js version differs from older releases: read `AGENTS.md` and the
  guides in `node_modules/next/dist/docs/` before changing framework code.
