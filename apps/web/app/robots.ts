import type { MetadataRoute } from "next";
import { ROBOTS_RULES } from "@/lib/hotelSiteV2";
import { siteOrigin } from "@/lib/webEnv";

/**
 * Crawlers may read public pages and the hotels' public photos (served under
 * /api/public/site/, which the hotel pages and their JSON-LD point at); the
 * rest of the API proxy is never indexed (review R3-4).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { ...ROBOTS_RULES, allow: [...ROBOTS_RULES.allow], disallow: [...ROBOTS_RULES.disallow] },
    sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
  };
}
