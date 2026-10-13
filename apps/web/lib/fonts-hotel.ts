/**
 * Hotel Site V2 fonts (docs/HOTEL_SITE_V2.md, Pine mood): headings Cormorant
 * Garamond 600, body Inter, Hindi Mukta (Devanagari from lib/fonts.ts, on
 * every page through the root layout). Imported only by the public hotel
 * page, so the rest of the app never loads them.
 *
 * Bundled in lib/fonts under the SIL Open Font License (licences beside the
 * files) and loaded with next/font/local, so the page never calls Google
 * Fonts at runtime. Inter is the Latin subset of the variable font (one file
 * covers 400 and 600), from Google Fonts' gstatic copy of rsms/inter v4.
 */
import localFont from "next/font/local";

const cormorant = localFont({
  src: "./fonts/cormorant-garamond-600.woff2",
  weight: "600",
  variable: "--font-hotel-display",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  weight: "400 600",
  variable: "--font-hotel-text",
  display: "swap",
});

/** Class names that define --font-hotel-display and --font-hotel-text. */
export const hotelFonts = `${cormorant.variable} ${inter.variable}`;
