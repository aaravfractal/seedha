# Needs from the owner (priority order)

Everything below has a working simulated fallback today. Nothing is blocked.

1. **Confirm decision D-001** (docs/decisions.md): travel agents' commission is
   treated as having no GST (unregistered agents), which is the only way the
   locked Rs 10,39,108 reconciles. If agents should carry 18% GST, paid to
   channels becomes Rs 10,51,420 and the locked numbers change.
2. **Anthropic API key** (`ANTHROPIC_API_KEY`, `CLAUDE_MODEL`). Without it:
   PDF/unknown statement layouts use the deterministic parser only, match
   tie-breaks use the score alone, and wording uses fixed templates. Money is
   never affected either way (rule 1).
3. **WhatsApp Cloud API test number** (`WHATSAPP_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
   and the current `WHATSAPP_API_VERSION`). Also an approved **message
   template** for the win-back text: WhatsApp only allows free text inside a
   24-hour window after the guest writes first. Without keys: sends are
   simulated and labelled.
4. **Razorpay test keys** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). Only
   simulated UPI is built (D-049); with keys I can add Razorpay test-mode
   checkout and signature verification.
5. **Polygon Amoy testnet** (`PROOF_RPC_URL`, `PROOF_PRIVATE_KEY` for a funded
   test wallet). Without them: the nightly Merkle root is stored locally and
   labelled "stored, not yet on a public chain".
6. **Desk hardware** for M8 on-device testing (ESP32, ILI9488 TFT, NeoPixel
   ring, ESC/POS printer, button, buzzer). Firmware is compiled and tested
   against a mock server only.
7. **Done (11 Oct 2026).** ~~Team names for /about~~. The About page now describes the team by roles (Founder, Product, Hardware) with no names.
8. **Contact, privacy and security emails** for the website: set
   `PUBLIC_CONTACT_EMAIL`, `PUBLIC_PRIVACY_EMAIL` and `PUBLIC_SECURITY_EMAIL`
   in `.env` before `next build`. Until then the pages say "Contact details
   will be published before launch."
9. **Done (10 Oct 2026, D-076).** ~~Perk code guessability~~ (decisions D-075). Codes like DEODAR-RS26 can
   be guessed (about 676 per hotel per year), which would show a guest's short
   name and could spend their one-time perk. Options: (a) add a random part
   to new codes, e.g. DEODAR-RS26-K7Q (demo code unchanged); (b) ask for the
   last 4 digits of the consented WhatsApp number before the perk applies;
   (c) stop showing the name on the link page. I recommend (a) plus (c).
10. **Done (11 Oct 2026).** ~~Files outside the repo~~ (blockers B-003). Both `~/.platformio`
    (about 20 MB) and `~/.cache/pre-commit` are still on the machine.
    Correction: I wrongly reported ~/.platformio as gone on 10 Oct (I
    misread a truncated listing). Nothing in the repo needs them, and the
    git hook now keeps pre-commit's cache in the repo. Please run
    `rm -rf ~/.platformio ~/.cache/pre-commit`.
11. **Done (10 Oct 2026).** ~~Frontend build inputs~~ (blockers B-004). Add `docs/FRONTEND_MASTER.md`
    and the `design/` folder (Design_Handoff.pdf, handoff-pages/,
    video-screens/, VIDEO_SPEC.md, claude-design-files/ if you have it).
    The frontend build has not started without them.
