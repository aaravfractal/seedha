"use client";

/**
 * Shared Earth for the public website (docs/WEBSITE_UPGRADE.md section 2).
 *
 * INTERFACE STUB: the globe builder replaces this file. Contract used by the
 * Seedha Pass and Event Radar sections:
 * - `initialLayer`: which layer shows first ("pass" | "radar").
 * - The component renders its own segmented layer toggle (aria-pressed), the
 *   canvas (aria-hidden) or the static land-only fallback map, and an
 *   accessible text list of every marker beside it.
 * - `label`: an accessible name for the whole globe region.
 */
export type GlobeLayer = "pass" | "radar";

export type WorldGlobeProps = {
  initialLayer: GlobeLayer;
  label: string;
};

export function WorldGlobe({ initialLayer, label }: WorldGlobeProps) {
  return (
    <div role="region" aria-label={label} data-globe-layer={initialLayer}>
      <p>Map loading.</p>
    </div>
  );
}
