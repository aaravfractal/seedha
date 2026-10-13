import type { MetadataRoute } from "next";
import { SAMPLE_SLUG } from "./h/[slug]/data";
import { siteOrigin } from "@/lib/webEnv";

/**
 * Public pages for search engines. The API has no route that lists published
 * hotels (and this file adds none), so the only hotel listed is the sample
 * hotel, which is labelled as sample data on its page. The Seedha website
 * pages are listed too; owner screens are private and never listed.
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
  return [
    ...WEBSITE.map((path) => ({
      url: new URL(path, origin).toString(),
      changeFrequency: "monthly" as const,
      priority: path === "/" ? 1 : 0.5,
    })),
    { url: new URL(`/h/${SAMPLE_SLUG}`, origin).toString(), changeFrequency: "weekly", priority: 0.6 },
  ];
}
