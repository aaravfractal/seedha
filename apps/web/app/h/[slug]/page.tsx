import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { hotelJsonLd, jsonLdText } from "@/lib/hotelSiteV2";
import { SAMPLE_SLUG, tryLoadPublicSite } from "./data";
import { HotelPage } from "./HotelPage";
import s from "@/components/site/v2/hotel.module.css";

type Params = Promise<{ slug: string }>;

/**
 * The hotel's public site at /h/<slug> (and at <slug>.<SITE_ROOT_DOMAIN>,
 * which the proxy rewrites here). Static per hotel: the sample hotel is
 * prerendered at build; any other published hotel is rendered on its first
 * visit and then served from the cache until an owner save or the 15-minute
 * refresh (app/h/[slug]/data.ts). Nothing here reads the request: the
 * language, the card-scan perk and the hotel-host booking links are applied
 * in the browser. Never calls AI.
 */
export function generateStaticParams() {
  return [{ slug: SAMPLE_SLUG }];
}

export const viewport: Viewport = { themeColor: "#F5F1E8", colorScheme: "light" };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { site } = await tryLoadPublicSite((await params).slug);
  if (!site) return { robots: { index: false } };
  const title = `${site.hotel} · ${site.location.en}`;
  const description =
    site.text?.description.en.slice(0, 160) ||
    site.tagline.en ||
    `${site.hotel} in ${site.location.en}. Book directly with the hotel.`;
  return {
    title,
    description,
    alternates: { canonical: site.url },
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

async function Hotel({ params }: { params: Params }) {
  const { slug } = await params;
  const { status, site } = await tryLoadPublicSite(slug);
  // The API did not answer: render at request time (never cached) and let the
  // browser load the site with a retry.
  if (status === 0) await connection();
  return (
    <>
      {site ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdText(hotelJsonLd(site)) }}
        />
      ) : null}
      <HotelPage slug={slug} initial={site} missing={status === 404} />
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
