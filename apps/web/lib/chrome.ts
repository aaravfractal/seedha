/**
 * Which pages bring their own chrome instead of the app header and footer.
 *
 * - Public website (P7): the marketing page and its legal pages have their
 *   own dark-first header and footer.
 * - World B (P5): the hotel's own site, rate card and agent deck carry the
 *   hotel's brand, with Seedha only as a tiny "Made with Seedha" line.
 *
 * Those route groups render their own <main id="main"> for the skip link.
 */
export const OWN_CHROME_EXACT: ReadonlyArray<string> = ["/"];

export const OWN_CHROME_PREFIXES: ReadonlyArray<string> = [
  "/privacy",
  "/terms",
  "/cookies",
  "/security",
  "/about",
  "/contact",
  "/faq",
  "/careers",
  "/data-deletion",
  "/hotel",
  "/rate-card",
  "/agent-deck",
];

export function hasOwnChrome(pathname: string): boolean {
  if (OWN_CHROME_EXACT.includes(pathname)) return true;
  return OWN_CHROME_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
