"use client";

import { useApi } from "@/lib/api";
import type { Sample } from "@/lib/types-website";
import { EventRadar } from "./EventRadar";
import { Hero } from "./Hero";
import { Metrics } from "./Metrics";
import { PulseSection } from "./pulse/PulseSection";
import { SeedhaPass } from "./SeedhaPass";
import site from "./site.module.css";
import { Careers, Faq, FinalCta, Pricing } from "./Pricing";
import {
  DeskSection,
  Features,
  FlipExplainer,
  GrowthCalculator,
  GuestMap,
  NoWebsiteBand,
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
      <SeedhaPass />
      {data ? <GrowthCalculator data={data} /> : null}
      {data && data.guest_cities.length > 0 ? <GuestMap data={data} /> : null}
      <PulseSection />
      <div className={site.container}>
        <EventRadar />
      </div>
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
