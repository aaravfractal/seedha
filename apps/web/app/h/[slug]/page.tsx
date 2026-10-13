import { Suspense } from "react";
import { preload } from "react-dom";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { hotelJsonLd, jsonLdText, metaDescription, photoSources } from "@/lib/hotelSiteV2";
import type { HotelSitePayload } from "@/lib/types-hotel-site";
import { SAMPLE_SLUG, tryLoadPublicSite } from "./data";
import { HotelPage } from "./HotelPage";
import s from "@/components/site/v2/hotel.module.css";

type Params = Promise<{ slug: string }>;

/**
 * The hotel's public site at /h/<slug> (and at <slug>.<SITE_ROOT_DOMAIN>,
 * which the proxy rewrites here). Static per hotel: the sample hotel is
 * prerendered at build; any other published hotel is rendered on its first
 * visit and then served from the cache until the hotel's own save or the
 * 15-minute refresh (app/h/[slug]/data.ts). The slug is lower-cased and
 * checked before the cache is touched (the proxy already 308s capitals and
 * 404s unknown slugs). Nothing here reads the request: the language, the
 * card-scan ribbon and the hotel-host booking links are applied in the
 * browser. Never calls AI.
 */
export function generateStaticParams() {
  return [{ slug: SAMPLE_SLUG }];
}

export const viewport: Viewport = { themeColor: "#F5F1E8", colorScheme: "light" };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { site } = await tryLoadPublicSite((await params).slug);
  if (!site) return { robots: { index: false } };
  const title = site.sample
    ? `${site.hotel} (sample) · ${site.location.en}`
    : `${site.hotel} · ${site.location.en}`;
  const description = metaDescription(site);
  return {
    title,
    description,
    alternates: { canonical: site.url },
    // The fictional sample hotel is never indexed (rule 11, reviews R1-5 and R2-6).
    ...(site.sample ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "website",
      siteName: site.hotel,
      locale: "en_IN",
      title,
      description,
      url: site.url,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** What shows for the moment before a hotel's first render streams in. */
function Fallback() {
  return <div className={s.fallback} aria-busy="true" />;
}

/** The hero photo, AVIF first, asked for before the page's own <picture> is parsed. */
function preloadHero(site: HotelSitePayload): void {
  const hero = site.photos[0];
  const sources = hero ? photoSources(hero.url, hero.width) : null;
  if (!hero || !sources) return;
  preload(hero.url, {
    as: "image",
    imageSrcSet: sources.avif,
    imageSizes: "100vw",
    type: "image/avif",
    fetchPriority: "high",
  });
}

async function Hotel({ params }: { params: Params }) {
  const { slug } = await params;
  const { status, site } = await tryLoadPublicSite(slug);
  // The API did not answer: render at request time (never cached) and let the
  // browser load the site with a retry.
  if (status === 0) await connection();
  if (site) preloadHero(site);
  return (
    <>
      {site ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdText(hotelJsonLd(site)) }}
        />
      ) : null}
      <HotelPage slug={site?.slug ?? slug.toLowerCase()} initial={site} missing={status === 404} />
    </>
  );
}

export default function Page({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Fallback />}>
      <Hotel params={params} />
    </Suspense>
  );
}
