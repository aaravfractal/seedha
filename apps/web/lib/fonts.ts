/**
 * Fonts loaded with next/font (self-hosted at build time, no runtime requests
 * to Google, so the CSP font-src 'self' holds).
 *
 * World A uses the system stack; Mukta covers Devanagari. The World B mood
 * fonts (Cormorant Garamond, DM Serif Display, Outfit) are loaded only by the
 * hotel-site components that use them.
 */
import { Mukta } from "next/font/google";

export const mukta = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-mukta",
  display: "swap",
});
