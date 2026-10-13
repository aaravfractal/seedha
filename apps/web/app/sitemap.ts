import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/webEnv";

/**
 * Public pages for search engines: the Seedha website pages. No hotel is
 * listed: the API has no route that lists published hotels (and this file
 * adds none), and the sample hotel is fictional, so it is left out and its
 * page is noindex (rule 11, reviews R1-5 and R2-6). A real hotel's page is
 * indexable and found through its own links. Owner screens are private and
 * never listed.
 */
const WEBSITE = [
  "/",
  "/about",
  "/faq",
  "/contact",
  "/careers",
  "/security",
  "/privacy",
  "/terms",
  "/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return WEBSITE.map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.5,
  }));
}
