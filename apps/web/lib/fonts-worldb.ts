/**
 * World B display fonts, one per mood (HANDOFF README "World B"):
 * Pine Cormorant Garamond 600, Stone DM Serif Display, Sky Outfit 600.
 * Text and Devanagari use Mukta from lib/fonts.ts. Imported only by the
 * hotel's own pages (hotel site, its preview, rate card, agent deck), so the
 * rest of the app never downloads them. next/font self-hosts the files.
 */
import { Cormorant_Garamond, DM_Serif_Display, Outfit } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-wb-pine",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wb-stone",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-wb-sky",
  display: "swap",
});

/** Class names that define the three --font-wb-* variables. */
export const worldBFonts = `${cormorant.variable} ${dmSerif.variable} ${outfit.variable}`;
