import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hotel site · Made with Seedha",
  description: "The hotel's own website with direct booking.",
};

/**
 * World B frame: the hotel's own page, no Seedha app chrome. The page
 * renders its own <main id="main"> (components/site/v2/HotelSiteV2.tsx and
 * the messages in app/h/[slug]/HotelPage.tsx) and loads only its own fonts
 * (lib/fonts-hotel.ts): the older World B fonts are not preloaded here any
 * more (performance review R3-2).
 */
export default function HotelLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
