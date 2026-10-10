/**
 * World B display fonts, one per mood (HANDOFF README "World B"):
 * Pine Cormorant Garamond 600, Stone DM Serif Display, Sky Outfit 600.
 * Text and Devanagari use Mukta from lib/fonts.ts. Imported only by the
 * hotel's own pages (hotel site, its preview, rate card, agent deck), so the
 * rest of the app never loads them.
 *
 * Bundled in lib/fonts (SIL Open Font License, licences beside the files) and
 * loaded with next/font/local, so no page needs Google Fonts at runtime (D-087).
 */
import localFont from "next/font/local";

const cormorant = localFont({
  src: "./fonts/cormorant-garamond-600.woff2",
  weight: "600",
  variable: "--font-wb-pine",
  display: "swap",
});

const dmSerif = localFont({
  src: "./fonts/dm-serif-display-400.woff2",
  weight: "400",
  variable: "--font-wb-stone",
  display: "swap",
});

const outfit = localFont({
  src: "./fonts/outfit-600.woff2",
  weight: "600",
  variable: "--font-wb-sky",
  display: "swap",
});

/** Class names that define the three --font-wb-* variables. */
export const worldBFonts = `${cormorant.variable} ${dmSerif.variable} ${outfit.variable}`;
