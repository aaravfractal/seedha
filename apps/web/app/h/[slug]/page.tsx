import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { clientAddress } from "@/lib/ratelimit";
import type { Lang, Mood, PublicSite } from "@/lib/types-site";
import { apiUrl, proxyProof } from "@/lib/webEnv";
import { HotelPage } from "./HotelPage";

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;
type Loaded = { status: number; site: PublicSite | null };

const MOODS: ReadonlyArray<string> = ["pine", "stone", "sky"];

/**
 * The public site payload, read on the server so the page (and its hero
 * image) is in the first HTML, not fetched after hydration. Same headers as
 * the /api proxy's public routes: the guest's address for rate limits and
 * the proxy proof. status 0 means the API did not answer.
 */
const loadSite = cache(async (slug: string): Promise<Loaded> => {
  const incoming = await headers();
  try {
    const res = await fetch(apiUrl(`public/site/${encodeURIComponent(slug)}`), {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "x-forwarded-for": clientAddress(new Headers(incoming)),
        "x-seedha-proxy": await proxyProof(),
      },
    });
    if (!res.ok) return { status: res.status, site: null };
    return { status: res.status, site: (await res.json()) as PublicSite };
  } catch {
    return { status: 0, site: null };
  }
});

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { site } = await loadSite((await params).slug);
  if (!site) return {};
  return { title: `${site.hotel} · ${site.location.en}`, description: site.tagline.en || undefined };
}

/**
 * The hotel's public site at /h/<slug> (and at <slug>.<SITE_ROOT_DOMAIN>,
 * which the proxy rewrites here). Rendered on the server; the client part
 * only switches language and handles a renamed address.
 */
export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const query = await searchParams;
  const { status, site } = await loadSite(slug);
  // ?lang=hi and ?mood=stone let the owner share a version.
  const lang = one(query.lang);
  const mood = one(query.mood);
  return (
    <HotelPage
      slug={slug}
      initial={site}
      missing={status === 404}
      lang={lang === "en" || lang === "hi" ? (lang as Lang) : null}
      mood={mood && MOODS.includes(mood) ? (mood as Mood) : null}
    />
  );
}
