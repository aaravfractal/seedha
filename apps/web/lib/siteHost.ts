/**
 * Hotel addresses (docs/SITE_REAL.md section 5), pure and unit-tested.
 *
 * A hotel host is exactly `<slug>.<root>` with one label, where the root is
 * SITE_ROOT_DOMAIN (when set) or `localhost` (so <slug>.localhost:3000 works
 * in development). Every other host is the app host: the apex, www, app.,
 * *.vercel.app, IP addresses and anything unknown. Hotel hosts serve only the
 * hotel's public page and its public, read-only API calls; never an owner route.
 *
 * The slug rules mirror apps/api/app/services/slug.py (the API decides; this
 * copy only gives instant feedback while typing and routes hosts).
 */

import { hostName } from "./requestOrigin.ts";

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Hosts, infrastructure names and the web app's own top-level routes. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www", "app", "api", "admin", "mail", "docs", "status",
  "hotel", "h", "login", "static", "signup", "otp", "onboard", "demo",
  "home", "upload", "flip", "repeat", "scenario", "approvals", "savings",
  "ask", "site", "proof", "pro", "settings", "desk", "rate-card",
  "agent-deck", "my-place", "inbox", "assistant", "calendar", "billing",
  "consent", "link", "plans", "about", "careers", "contact", "cookies",
  "data-deletion", "faq", "privacy", "security", "terms", "auth",
  "session", "public", "health", "webhooks", "not-live", "seedha",
  "help", "support", "blog", "cdn", "assets", "img", "images", "ftp",
  "smtp", "imap", "pop", "dev", "staging", "test", "localhost",
]); // prettier-ignore

export type SlugProblem = "slug_invalid" | "slug_reserved";

/** Why a slug can never be used (null when its shape is fine; the API checks who holds it). */
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX || !SLUG_PATTERN.test(slug)) return "slug_invalid";
  return RESERVED_SLUGS.has(slug) ? "slug_reserved" : null;
}

/** What the owner types, made into slug form as they type ("Deodar View!" -> "deodar-view"). */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX);
}

/** SITE_ROOT_DOMAIN in plain form: "https://Seedha.in/" -> "seedha.in" ("" = not set). */
export function rootDomain(raw: string | undefined): string {
  const host = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  return (host.split("/")[0] ?? "").split(":")[0]!.replace(/^\.+|\.+$/g, "");
}

export type HotelHost = { slug: string; root: string };

/** The hotel a Host header names, or null for the app host. */
export function hotelHost(host: string, root: string): HotelHost | null {
  const name = hostName(host);
  for (const candidate of [root, "localhost"]) {
    if (!candidate || !name.endsWith(`.${candidate}`)) continue;
    const label = name.slice(0, -(candidate.length + 1));
    if (!label.includes(".") && slugProblem(label) === null) return { slug: label, root: candidate };
  }
  return null;
}

/** The hotel page's offline service worker (public/h-sw.js). */
export const HOTEL_SW_PATH = "/h-sw.js";

/**
 * What a hotel host may serve: its page at "/", Next's own assets, its
 * offline service worker, GET requests to its own public site API (the page,
 * availability and photos) and exactly one write: POST to its own
 * `/scan` (a printed card's QR count; the BFF still checks the Origin).
 */
export function hotelPathAllowed(pathname: string, method: string, slug: string): boolean {
  if (pathname === "/" || pathname.startsWith("/_next/") || pathname.startsWith("/__nextjs")) return true;
  const api = `/api/public/site/${slug}`;
  if (method === "POST") return pathname === `${api}/scan`;
  if (method !== "GET" && method !== "HEAD") return false;
  if (pathname === HOTEL_SW_PATH) return true;
  return pathname === api || pathname.startsWith(`${api}/`);
}

/** The slug in "/h/<slug>" (lower case), or null for any other path. */
export function hotelPathSlug(pathname: string): string | null {
  const match = /^\/h\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!).toLowerCase();
  } catch {
    return null;
  }
}

/** "/hotel/deodar-view" (the old address) -> "/h/deodar-view"; null for other paths. */
export function legacyHotelPath(pathname: string): string | null {
  const match = /^\/hotel\/([^/]+)\/?$/.exec(pathname);
  return match ? `/h/${match[1]}` : null;
}

/** The address a renamed hotel host moves to, keeping the scheme and port. */
export function movedHostUrl(current: URL, host: string, slug: string, root: string): string {
  const port = /:(\d+)$/.exec(host)?.[1];
  return `${current.protocol}//${slug}.${root}${port ? `:${port}` : ""}/${current.search}`;
}

/** The prefilled WhatsApp message for sharing the hotel's address. */
export function shareMessage(hotel: string, url: string): string {
  return `Book ${hotel} directly on our own website: ${url}`;
}

/** A standard wa.me share link (no WhatsApp API): the guest picks who to send it to. */
export function whatsappShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

type Here = { protocol: string; hostname: string; port: string };

/**
 * Where a booking button goes. Seedha Link lives on the app host and a hotel
 * host serves only its own page, so: an absolute `bookingUrl` (the API sets
 * one when SITE_ROOT_DOMAIN is on) keeps the query of `linkPath`; on a
 * development hotel host (<slug>.localhost) the app host is plain localhost;
 * anywhere else the same-origin path is right.
 */
export function bookingLink(bookingUrl: string, linkPath: string, here?: Here): string {
  const query = linkPath.includes("?") ? linkPath.slice(linkPath.indexOf("?")) : "";
  if (/^https?:\/\//.test(bookingUrl)) return `${bookingUrl}${query}`;
  if (here && here.hostname.endsWith(".localhost")) {
    return `${here.protocol}//localhost${here.port ? `:${here.port}` : ""}${linkPath}`;
  }
  return linkPath;
}

/** The address as people read it, for the live preview while the owner types. */
export function siteAddress(slug: string, root: string, appHost: string): string {
  return root ? `${slug}.${root}` : `${appHost}/h/${slug}`;
}
