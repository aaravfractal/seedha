"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api";
import { withDetails } from "@/lib/hotelSiteV2";
import type { HotelSitePayload } from "@/lib/types-hotel-site";
import { HotelSiteV2 } from "@/components/site/v2/HotelSiteV2";
import { WorldBMessage } from "@/components/site/WorldBMessage";

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
  return <HotelSiteV2 site={site} />;
}
