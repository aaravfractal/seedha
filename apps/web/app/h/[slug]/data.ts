import { cacheLife, cacheTag } from "next/cache";
import { HOTEL_SITES_TAG, hotelSiteTag, withDetails } from "@/lib/hotelSiteV2";
import type { HotelSitePayload } from "@/lib/types-hotel-site";
import { apiUrl, proxyProof } from "@/lib/webEnv";

/** The sample hotel's address: prerendered at build and listed in the sitemap. */
export const SAMPLE_SLUG = "deodar-view";

export type Loaded = { status: number; site: HotelSitePayload | null };

/** Thrown when the API did not answer, so a failure is never cached as the page. */
export class ApiUnreachable extends Error {}

/**
 * The public site payload, cached per slug and shared by every visitor (the
 * page, its metadata, its Open Graph image and the sitemap). Static per
 * hotel: tagged so any owner save (publish, edits, branding, prices) marks
 * it stale at once (app/api/[...path]/route.ts), and refreshed in the
 * background every 15 minutes so the hotel's date and room prices keep up.
 * Read with the proxy proof only: no visitor data goes into a shared cache.
 * A 404 is cached too (the proxy answers unknown slugs first, and a publish
 * clears it); an unreachable API throws and is not cached.
 */
export async function loadPublicSite(slug: string): Promise<Loaded> {
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

/** loadPublicSite, with an unreachable API as status 0 (the page then loads it in the browser). */
export async function tryLoadPublicSite(slug: string): Promise<Loaded> {
  try {
    return await loadPublicSite(slug);
  } catch {
    return { status: 0, site: null };
  }
}
