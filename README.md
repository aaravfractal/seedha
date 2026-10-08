# Seedha

**Live prototype:** https://seedha.vercel.app

**Live prototype:** https://seedha.vercel.app

**Live prototype:** https://seedha.vercel.app

**Know what you really keep.** Net revenue by channel for India's small hill hotels, and the tools to win guests back direct.

Track D6: Channel Mix and Distribution Cost Optimisation · AI-Tourism Hackathon, TBI GEU, Dehradun, 13 to 14 Oct 2026

## Run it

Open `index.html` in any browser. No install, no build step.

## What the prototype does

1. **Upload:** reads six sample OTA statements and flags rows that do not add up.
2. **The flip:** gross vs net per channel. MakeMyTrip drops from 1st by bookings to 5th by money kept.
3. **Repeat guests:** guests who paid OTA commission twice (internal report only).
4. **Saturday move:** one channel allocation recommendation.
5. **Seedha Desk:** QR consent at check-in, green ring, printed checkout slip.
6. **Approvals:** owner approves every WhatsApp win-back message.
7. **Seedha Proof:** each consent gets a SHA-256 fingerprint, written in a nightly bundle.
8. **Seedha Link:** direct booking with a perk code and UPI; savings counted only when a code is used.
9. **Seedha Site:** AI website setup, packages, publish.
10. **Ask:** six fixed Hindi WhatsApp questions with exact rupee answers.
11. **Plans:** Base, Pro, Max, yearly and monthly.

## What is real and what is simulated

| Part | Status |
|---|---|
| Frontend, full 8-step loop | Working |
| Data | Fictional sample hotel (Hotel Deodar View, Mussoorie, 22 rooms) |
| Statement parsing, WhatsApp sending, UPI payment | Simulated in the browser |
| SHA-256 fingerprints | Real (Web Crypto); blockchain write is simulated |
| Seedha Desk hardware (ESP32, TFT, 58 mm printer) | Designed; firmware in progress |

## Rules Seedha follows

- Never messages guests found through OTA data.
- Consent is unticked by default and every message has a Stop option.
- Perks for returning guests, never a lower public rate.
- Every rupee is arithmetic from the hotel's own statements.

## Team

Aarav Sharma (lead), Ishan Singh, Madhav Nauriyal, and our hospitality teammate.
