"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api";
import { withDetails } from "@/lib/hotelSiteV2";
import type { HotelSitePayload } from "@/lib/types-hotel-site";
import { HotelSiteV2 } from "@/components/site/v2/HotelSiteV2";
import s from "@/components/site/v2/hotel.module.css";

/**
 * Loading, missing and error states, in the hotel page's own styles (no
 * other stylesheet or font is pulled onto the hotel page for them).
 */
function HotelMessage({
  title,
  body,
  loading = false,
  onRetry,
}: {
  title: string;
  body?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className={`${s.root} ${s.messagePage}`} lang="en">
      <main id="main" className={s.message}>
        <div role={loading ? "status" : "alert"} aria-live="polite" aria-busy={loading || undefined}>
          <h1 className={`${s.display} ${s.h2}`}>{title}</h1>
          {body ? <p className={s.muted}>{body}</p> : null}
          {onRetry ? (
            <button type="button" className={s.pill} onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/**
 * The client side of /h/<slug>: the page arrives rendered from the server
 * (`initial`, from the shared cache). Only when the server could not reach
 * the API does it load the site here, with a retry. Read only: no owner data
 * and no AI calls.
 */
export function HotelPage({
  slug,
  initial,
  missing,
}: {
  slug: string;
  initial: HotelSitePayload | null;
  missing: boolean;
}) {
  const router = useRouter();
  const fetched = useApi<HotelSitePayload>(
    initial || missing ? null : `public/site/${encodeURIComponent(slug)}`,
  );
  const loaded = fetched.data;
  const site = useMemo(() => initial ?? (loaded ? withDetails(loaded) : null), [initial, loaded]);

  // A renamed address (the proxy usually redirects first): go to the new one.
  const moved = site?.redirect_to ?? null;
  useEffect(() => {
    if (moved && window.location.pathname.startsWith("/h/")) {
      router.replace(`/h/${encodeURIComponent(moved)}${window.location.search}`);
    }
  }, [moved, router]);

  if (missing || fetched.error?.status === 404) {
    return <HotelMessage title="This hotel site isn't live yet" body="Check the link the hotel sent you." />;
  }
  if (fetched.error) {
    return (
      <HotelMessage
        title="This page did not load."
        body="Please try again in a moment."
        onRetry={fetched.reload}
      />
    );
  }
  if (!site) return <HotelMessage title="Loading the hotel" loading />;
  return <HotelSiteV2 site={site} />;
}
