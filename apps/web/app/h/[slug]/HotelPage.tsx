"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api";
import type { Lang, Mood, PublicSite } from "@/lib/types-site";
import { HotelSite } from "@/components/site/HotelSite";
import { WorldBMessage } from "@/components/site/WorldBMessage";

/**
 * The client side of /h/<slug>: the page arrives rendered from the server
 * (`initial`). Only when the server could not reach the API does it load the
 * site here, with a retry. Read only: no owner data and no AI calls.
 */
export function HotelPage({
  slug,
  initial,
  missing,
  lang: firstLang,
  mood,
}: {
  slug: string;
  initial: PublicSite | null;
  missing: boolean;
  lang: Lang | null;
  mood: Mood | null;
}) {
  const router = useRouter();
  const fetched = useApi<PublicSite>(initial || missing ? null : `public/site/${encodeURIComponent(slug)}`);
  const site = initial ?? fetched.data;
  const [lang, setLang] = useState<Lang | null>(firstLang);

  // A renamed address (the proxy usually redirects first): go to the new one.
  const moved = site?.redirect_to ?? null;
  useEffect(() => {
    if (moved && window.location.pathname.startsWith("/h/")) {
      router.replace(`/h/${encodeURIComponent(moved)}${window.location.search}`);
    }
  }, [moved, router]);

  useEffect(() => {
    if (site) document.title = `${lang === "hi" ? site.hotel_hi : site.hotel} · ${site.location.en}`;
  }, [site, lang]);

  if (missing || fetched.error?.status === 404) {
    return <WorldBMessage title="This hotel site isn't live yet" body="Check the link the hotel sent you." />;
  }
  if (fetched.error) {
    return (
      <WorldBMessage
        title="This page did not load."
        body="Please try again in a moment."
        onRetry={fetched.reload}
      />
    );
  }
  if (!site) return <WorldBMessage title="Loading the hotel" loading />;
  return (
    <HotelSite
      site={site}
      packages={site.packages}
      lang={lang ?? site.lang}
      mood={mood ?? site.mood}
      today={site.today}
      onLang={setLang}
    />
  );
}
