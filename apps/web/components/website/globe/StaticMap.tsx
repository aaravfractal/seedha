"use client";

/**
 * Static land-only map of North India: the fallback for reduced motion, no
 * WebGL and low-end phones. Same land topology as the globe, same markers and
 * arcs. No country or internal border lines are drawn.
 */
import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import {
  LABEL_POS,
  NORTH_INDIA_BOUNDS,
  arcsFor,
  markersFor,
  townKeyOf,
  type GlobeLayerKey,
} from "@/lib/globe";
import { landGeoJson } from "./land";
import styles from "./globe.module.css";

const W = 640;
const H = 520;

function frame() {
  const [w, s, e, n] = NORTH_INDIA_BOUNDS;
  const box: GeoJSON.Feature<GeoJSON.MultiPoint> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPoint",
      coordinates: [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
      ],
    },
  };
  return geoMercator()
    .fitExtent(
      [
        [0, 0],
        [W, H],
      ],
      box,
    )
    .clipExtent([
      [-4, -4],
      [W + 4, H + 4],
    ]);
}

export default function StaticMap({ layer, active }: { layer: GlobeLayerKey; active: string | null }) {
  const { projection, land } = useMemo(() => {
    const proj = frame();
    return { projection: proj, land: geoPath(proj)(landGeoJson()) ?? "" };
  }, []);
  const markers = markersFor(layer);
  const arcs = arcsFor(layer).map(([a, b]) => {
    const p0 = projection([a.lon, a.lat]);
    const p1 = projection([b.lon, b.lat]);
    if (!p0 || !p1) return "";
    // A soft quadratic bow between the two towns.
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const bow = 0.22;
    return `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} Q${(mx - dy * bow).toFixed(1)},${(my + dx * bow).toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
  });

  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      data-testid="globe-fallback"
      data-layer={layer}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="globe-map-glow" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="var(--globeRim)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--globeRim)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} className={styles.mapSea} />
      <path d={land} className={styles.mapLand} data-land="true" />
      <rect width={W} height={H} fill="url(#globe-map-glow)" />
      <g className={styles.mapArcs}>{arcs.map((d, i) => (d ? <path key={i} d={d} /> : null))}</g>
      {markers.map((m) => {
        const p = projection([m.lon, m.lat]);
        if (!p) return null;
        const { side, dy } = LABEL_POS[townKeyOf(m)];
        const isActive = m.id === active;
        const tx = side === "left" ? p[0] - 13 : p[0] + 13;
        const ty = p[1] + 6 + dy;
        return (
          <g
            key={m.id}
            data-marker={m.id}
            className={`${styles.mapMarker} ${m.layer === "pass" ? styles.mapPass : styles.mapRadar}`}
          >
            <circle cx={p[0]} cy={p[1]} r={isActive ? 15 : 11} className={styles.mapHalo} />
            <circle cx={p[0]} cy={p[1]} r={isActive ? 7 : 5.5} className={styles.mapDot} />
            <text x={tx} y={ty} textAnchor={side === "left" ? "end" : "start"} className={styles.mapLabel}>
              {m.town}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
