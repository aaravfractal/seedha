import { cacheLife, cacheTag } from "next/cache";
import { HOTEL_SITES_TAG, hotelSiteTag, withDetails } from "@/lib/hotelSiteV2";
import { publicSlug } from "@/lib/siteHost";
import type { HotelSitePayload } from "@/lib/types-hotel-site";
import { apiUrl, proxyProof } from "@/lib/webEnv";

/** The sample hotel's address: prerendered at build (never listed in the sitemap: it is fictional). */
export const SAMPLE_SLUG = "deodar-view";

export type Loaded = { status: number; site: HotelSitePayload | null };

/** Thrown when the API did not answer, so a failure is never cached as the page. */
export class ApiUnreachable extends Error {}

/**
 * The public site payload, cached per slug and shared by every visitor (the
 * page, its metadata and its Open Graph image). Static per hotel: tagged
 * hotel-site:<slug>, so the hotel's own site saves (publish, edits, photos,
 * branding) mark only that hotel stale at once, and the demo reset marks all
 * (app/api/[...path]/route.ts, lib/hotelSiteV2.ts hotelRevalidation); refreshed in the
 * background every 15 minutes so the hotel's date and room prices keep up.
 * Read with the proxy proof only: no visitor data goes into a shared cache.
 * A 404 is cached too (the proxy answers unknown slugs first, and a publish
 * clears it); an unreachable API throws and is not cached. Only called with
 * a slug that publicSlug() accepted, so the cache holds one entry per real
 * address shape and never one per case variant (security review R1-1).
 */
async function cachedPublicSite(slug: string): Promise<Loaded> {
  "use cache";
  cacheTag(HOTEL_SITES_TAG, hotelSiteTag(slug));
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
  let res: Response;
  try {
    res = await fetch(apiUrl(`public/site/${encodeURIComponent(slug)}`), {
      headers: { accept: "application/json", "x-seedha-proxy": await proxyProof() },
    });
  } catch {
    throw new ApiUnreachable(`API unreachable for ${slug}`);
  }
  if (res.status === 404) return { status: 404, site: null };
  if (!res.ok) throw new ApiUnreachable(`API answered ${res.status} for ${slug}`);
  return { status: res.status, site: withDetails((await res.json()) as HotelSitePayload) };
}

/**
 * The public site for an address as asked for: lower-cased and checked
 * first, so an impossible slug is a 404 at once, with no cache entry and no
 * API call.
 */
export async function loadPublicSite(raw: string): Promise<Loaded> {
  const slug = publicSlug(raw);
  if (slug === null) return { status: 404, site: null };
  return cachedPublicSite(slug);
}

/** loadPublicSite, with an unreachable API as status 0 (the page then loads it in the browser). */
export async function tryLoadPublicSite(slug: string): Promise<Loaded> {
  try {
    return await loadPublicSite(slug);
  } catch {
    return { status: 0, site: null };
  }
}
