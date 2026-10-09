# Needs from Aarav (priority order)

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
7. **Name of the hospitality teammate** for /about (placeholder until then).
8. **Contact, grievance officer and security emails** for the legal pages
   (visible placeholders until then).
