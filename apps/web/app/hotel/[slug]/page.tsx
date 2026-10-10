"use client";

import { use, useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import type { Lang, Mood, PublicSite } from "@/lib/types-site";
import { HotelSite } from "@/components/site/HotelSite";
import { WorldBMessage } from "@/components/site/WorldBMessage";

const MOODS: ReadonlyArray<Mood> = ["pine", "stone", "sky"];

/** The hotel's public site. Serves a published site or the sample hotel only (API decides). */
export default function HotelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const site = useApi<PublicSite>(`public/site/${encodeURIComponent(slug)}`);
  const [lang, setLang] = useState<Lang | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);

  // ?lang=hi and ?mood=stone let the owner share a version; read once on load.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const l = q.get("lang");
    const m = q.get("mood");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of the URL after hydration
    if (l === "en" || l === "hi") setLang(l);
    if (m && (MOODS as string[]).includes(m)) setMood(m as Mood);
  }, []);

  useEffect(() => {
    if (site.data)
      document.title = `${lang === "hi" ? site.data.hotel_hi : site.data.hotel} · ${site.data.location.en}`;
  }, [site.data, lang]);

  if (site.error) {
    return site.error.status === 404 ? (
      <WorldBMessage
        title="There is no hotel site at this address."
        body="Check the link the hotel sent you."
      />
    ) : (
      <WorldBMessage
        title="This page did not load."
        body="Please try again in a moment."
        onRetry={site.reload}
      />
    );
  }
  if (!site.data) return <WorldBMessage title="Loading the hotel" loading />;
  const s = site.data;
  return (
    <HotelSite
      site={s}
      packages={s.packages}
      lang={lang ?? s.lang}
      mood={mood ?? s.mood}
      today={s.today}
      onLang={setLang}
    />
  );
}
