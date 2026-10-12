/**
 * Fonts. World A uses the system stack; Mukta covers Devanagari.
 *
 * Mukta (SIL Open Font License, lib/fonts/OFL-Mukta.txt) is bundled in the
 * repo and loaded with next/font/local, so the app never needs Google Fonts
 * at runtime: with next/font/google a server without internet answered 500 on
 * every page (accessibility review A1, D-087). Only the Devanagari subset is
 * bundled; Latin text keeps the system font. World B fonts load in the
 * hotel-site components.
 */
import localFont from "next/font/local";

export const mukta = localFont({
  src: [
    { path: "./fonts/mukta-devanagari-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/mukta-devanagari-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/mukta-devanagari-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mukta",
  display: "swap",
  // Not preloaded: the three Devanagari files (about 200 KB) would compete with
  // every page's first paint, and the browser fetches them as soon as Hindi
  // text is on screen anyway (design review V3-M7).
  preload: false,
});
