"use client";

/**
 * Local map for the hotel site (docs/HOTEL_SITE_V2.md, V2-GLOBE).
 *
 * Default export; load it with next/dynamic from a client component:
 *   const LocalMap = dynamic(() => import("@/components/site/v2/LocalMap"));
 * It has no browser-only code, so it can also render on the server.
 *
 * A plain SVG drawing, no tiles and no API key: the hotel at the centre, each
 * nearby place in its compass direction at a radius scaled from its minutes
 * (walk minutes count for less ground than drive minutes; see lib/localMap.ts).
 * Dashed line = walk, solid line = drive. The list under the map carries the
 * same places as text and is the accessible version. "Open in Maps" is a
 * plain link, shown only when the hotel has a map position.
 * No nearby places renders nothing.
 */
import { useMemo } from "react";
import {
  CX,
  CY,
  KIND_ICON,
  MAP_COPY,
  MAP_H,
  MAP_W,
  NAME_SIZE,
  NORTH_X,
  RINGS,
  TIME_SIZE,
  hotelBox,
  layoutMap,
  mapsUrl,
  minutesText,
  placeName,
} from "@/lib/localMap";
import type { LocationProps, NearbyKind } from "@/lib/types-site-v2";

const PINE = "#1F4D3A";
const CREAM = "#F5F1E8";
const STONE = "#E6E0D4";
const INK = "#1D1D1F";
const GREY = "#6E6E73";

function KindGlyph({ kind, x, y, scale = 1 }: { kind: NearbyKind; x: number; y: number; scale?: number }) {
  const icon = KIND_ICON[kind];
  return (
    <path
      d={icon.d}
      transform={`translate(${x - 6 * scale} ${y - 6 * scale}) scale(${scale})`}
      fill={icon.fill ? CREAM : "none"}
      stroke={CREAM}
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export default function LocalMap({ geo, nearby, hotel, lang }: LocationProps) {
  const copy = MAP_COPY[lang];
  const layout = useMemo(() => layoutMap(nearby, hotel, lang), [nearby, hotel, lang]);
  const hb = useMemo(() => hotelBox(hotel), [hotel]);
  if (nearby.length === 0) return null;

  return (
    <figure data-testid="local-map" style={{ margin: 0, width: "100%" }}>
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label={copy.mapLabel(hotel, nearby.length)}
        style={{
          display: "block",
          width: "100%",
          maxWidth: 560,
          height: "auto",
          aspectRatio: `${MAP_W} / ${MAP_H}`,
          marginInline: "auto",
          background: CREAM,
          borderRadius: 16,
          fontFamily: "inherit",
        }}
      >
        {RINGS.map((r) => (
          <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={STONE} strokeWidth={1.5} />
        ))}
        <g aria-hidden="true">
          <text x={NORTH_X} y={31} textAnchor="middle" fontSize={11} fontWeight={600} fill={GREY}>
            {copy.north}
          </text>
          <path d={`M${NORTH_X} 8 l-4 9 h8 z`} fill={GREY} />
        </g>
        {layout.map((m, i) => (
          <line
            key={`l${i}`}
            x1={CX}
            y1={CY}
            x2={m.x}
            y2={m.y}
            stroke={PINE}
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeDasharray={m.place.mode === "walk" ? "3 4" : undefined}
            strokeLinecap="round"
          />
        ))}
        {layout.map((m, i) => {
          const lb = m.label;
          // Leader line from the dot to the nearest point of a label that had to move.
          const nx = Math.min(Math.max(m.x, lb.x), lb.x + lb.w);
          const ny = Math.min(Math.max(m.y, lb.y), lb.y + lb.h);
          return (
            <g key={`p${i}`} data-place={i}>
              {lb.moved ? (
                <line x1={m.x} y1={m.y} x2={nx} y2={ny} stroke={GREY} strokeWidth={0.8} strokeOpacity={0.7} />
              ) : null}
              <circle cx={m.x} cy={m.y} r={9} fill={PINE} stroke={CREAM} strokeWidth={1.5} />
              <KindGlyph kind={m.place.kind} x={m.x} y={m.y} scale={0.95} />
              <text
                x={lb.x}
                y={lb.y + NAME_SIZE}
                fontSize={NAME_SIZE}
                fontWeight={600}
                fill={INK}
                stroke={CREAM}
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {m.shortName}
              </text>
              <text
                x={lb.x}
                y={lb.y + NAME_SIZE + TIME_SIZE + 3}
                fontSize={TIME_SIZE}
                fill={GREY}
                stroke={CREAM}
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {m.time}
              </text>
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={7} fill={INK} stroke={CREAM} strokeWidth={2.5} />
        <text
          x={CX}
          y={hb.y + NAME_SIZE}
          textAnchor="middle"
          fontSize={NAME_SIZE}
          fontWeight={700}
          fill={INK}
          stroke={CREAM}
          strokeWidth={3}
          paintOrder="stroke"
        >
          {hb.text}
        </text>
      </svg>
      <figcaption style={{ marginTop: 8, fontSize: 13, color: GREY, textAlign: "center" }}>
        {copy.note}
      </figcaption>
      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 10 }}>
        {nearby.map((p, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 32 }}>
            <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden="true" style={{ flex: "none" }}>
              <circle cx={14} cy={14} r={14} fill={PINE} />
              <KindGlyph kind={p.kind} x={14} y={14} scale={1.3} />
            </svg>
            <span style={{ display: "flex", flexWrap: "wrap", columnGap: 8, overflowWrap: "anywhere" }}>
              <span style={{ color: INK, fontWeight: 600 }}>{placeName(p, lang)}</span>
              <span style={{ color: GREY }}>{minutesText(p.minutes, p.mode, lang)}</span>
            </span>
          </li>
        ))}
      </ul>
      {geo ? (
        <p style={{ margin: "16px 0 0" }}>
          <a
            href={mapsUrl(geo)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 18px",
              borderRadius: 999,
              border: `1.5px solid ${PINE}`,
              color: PINE,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {copy.open}
          </a>
        </p>
      ) : null}
    </figure>
  );
}
