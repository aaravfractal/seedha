"use client";

import { useApi } from "@/lib/api";
import type { Sample } from "@/lib/types-website";
import { Hero } from "./Hero";
import { Metrics } from "./Metrics";
import { Careers, Faq, FinalCta, Pricing } from "./Pricing";
import {
  DeskSection,
  Features,
  FlipExplainer,
  GrowthCalculator,
  GuestMap,
  NoWebsiteBand,
  PulseStrip,
  Trust,
} from "./Sections";

/** The public marketing page. Every figure comes from GET /public/sample. */
export function HomePage() {
  const sample = useApi<Sample>("public/sample");
  const data = sample.data;
  return (
    <>
      <Hero sample={sample} />
      {data ? (
        <>
          <Metrics data={data} />
          <FlipExplainer data={data} />
        </>
      ) : null}
      <Features />
      {data ? <GrowthCalculator data={data} /> : null}
      {data && data.guest_cities.length > 0 ? <GuestMap data={data} /> : null}
      <PulseStrip />
      <DeskSection />
      <NoWebsiteBand />
      <Trust />
      <Pricing />
      <Careers />
      <Faq />
      <FinalCta />
    </>
  );
}
