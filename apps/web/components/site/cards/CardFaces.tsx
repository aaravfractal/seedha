"use client";

import QRCode from "qrcode";
import { useMemo, useSyncExternalStore } from "react";
import { CARD_COLOURS, cardFaces, estimateWidth } from "@/lib/cardLayout";
import type { CardFace, CardFacts, CardFont, Measure, Shape } from "@/lib/cardLayout";
import { CARD_SPECS, qrPathData } from "@/lib/siteDetails";
import type { CardKind } from "@/lib/types-site-v2-owner";
import c from "./cards.module.css";

/** The PDF's built-in fonts, and their metric twins on screens. */
const FONT_FAMILY: Record<CardFont, string> = {
  head: '"Times New Roman", Times, serif',
  body: "Helvetica, Arial, sans-serif",
  bodyBold: "Helvetica, Arial, sans-serif",
};

type Qr = { size: number; d: string };

const QR_CACHE = new Map<string, Qr | null>();

/** The QR symbol (level H) for `text`, as one SVG path offset by the 4-module quiet zone. */
function qrSymbol(text: string): Qr | null {
  const known = QR_CACHE.get(text);
  if (known !== undefined) return known;
  let drawn: Qr | null = null;
  try {
    const code = QRCode.create(text, { errorCorrectionLevel: "H" });
    const size = code.modules.size;
    drawn = { size, d: qrPathData(size, (r, col) => code.modules.get(r, col) === 1) };
  } catch {
    drawn = null;
  }
  QR_CACHE.set(text, drawn);
  return drawn;
}

/** The symbol's size in modules (a version 2 size if it cannot be drawn). */
function qrModules(text: string): number {
  return qrSymbol(text)?.size ?? 25;
}

let canvasMeasure: Measure | null = null;
/** Text widths from the browser's own fonts (Arial and Times New Roman share Helvetica's and Times' widths). */
function browserMeasure(): Measure {
  if (canvasMeasure) return canvasMeasure;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return estimateWidth;
  const measure: Measure = (text, font, size) => {
    ctx.font = `${font === "body" ? 400 : 700} ${size}px ${FONT_FAMILY[font]}`;
    return ctx.measureText(text).width;
  };
  canvasMeasure = measure;
  return measure;
}
const noSubscribe = () => () => {};

function Shapes({ shapes }: { shapes: Shape[] }) {
  return shapes.map((shape, i) => {
    if (shape.kind === "rect") {
      return (
        <rect
          key={i}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          fill={CARD_COLOURS[shape.tone]}
        />
      );
    }
    if (shape.kind === "text") {
      return (
        <text
          key={i}
          x={shape.x}
          y={shape.y}
          fontFamily={FONT_FAMILY[shape.font]}
          fontWeight={shape.font === "body" ? 400 : 700}
          fontSize={shape.size}
          fill={CARD_COLOURS[shape.tone]}
          textAnchor={shape.anchor}
        >
          {shape.text}
        </text>
      );
    }
    if (shape.kind === "qr") {
      const qr = qrSymbol(shape.text);
      const box = qr ? qr.size + 8 : 1;
      return (
        <g key={i}>
          <rect x={shape.x} y={shape.y} width={shape.side} height={shape.side} fill={CARD_COLOURS.cream} />
          {qr ? (
            <svg x={shape.x} y={shape.y} width={shape.side} height={shape.side} viewBox={`0 0 ${box} ${box}`}>
              <path d={qr.d} fill={CARD_COLOURS.ink} shapeRendering="crispEdges" />
            </svg>
          ) : null}
        </g>
      );
    }
    // "turned" and "fold" are drawn by Face.
    return null;
  });
}

/** One printed face at its true size ratio, as an image with its words as the text alternative. */
function Face({
  face,
  title,
  width,
  rounded,
}: {
  face: CardFace;
  title: string;
  width: number;
  /** CR80 wallet cards have 3.18 mm round corners. */
  rounded: boolean;
}) {
  const turned = face.shapes.find((s): s is Extract<Shape, { kind: "turned" }> => s.kind === "turned");
  const fold = face.shapes.find((s): s is Extract<Shape, { kind: "fold" }> => s.kind === "fold");
  const label = `${title}, ${face.name}: ${face.words.join(". ")}`;
  return (
    <figure className={c.faceWrap} style={{ width: `min(100%, ${width}px)` }}>
      <svg
        className={c.face}
        viewBox={`0 0 ${face.w} ${face.h}`}
        role="img"
        aria-label={label}
        style={
          rounded ? { borderRadius: `${(318 / 85.6).toFixed(2)}% / ${(318 / 54).toFixed(2)}%` } : undefined
        }
        data-card-face={face.name}
      >
        <Shapes shapes={face.shapes} />
        {turned ? (
          <g transform={`rotate(180 ${face.w / 2} ${face.h / 2})`} data-turned="true">
            <Shapes shapes={turned.shapes} />
          </g>
        ) : null}
        {fold ? (
          <line
            x1={0}
            x2={face.w}
            y1={fold.y}
            y2={fold.y}
            stroke={CARD_COLOURS.stone}
            strokeOpacity={0.6}
            strokeWidth={0.6}
            strokeDasharray="4 3"
          />
        ) : null}
      </svg>
      <figcaption>{face.caption}</figcaption>
    </figure>
  );
}

const WIDTH: Record<CardKind, number> = { wallet: 300, room: 230, tent: 480 };

/** The faces of one card, laid out as its PDF prints them (lib/cardLayout.ts). */
export function CardFaces({ kind, facts }: { kind: CardKind; facts: CardFacts }) {
  // Canvas widths in the browser; the estimate on the server (the panel is client-only in practice).
  const measure = useSyncExternalStore(noSubscribe, browserMeasure, () => estimateWidth);
  const faces = useMemo(() => cardFaces(kind, facts, measure, qrModules), [kind, facts, measure]);
  const title = CARD_SPECS[kind].title;
  return (
    <div className={c.faces}>
      {faces.map((face) => (
        <Face key={face.caption} face={face} title={title} width={WIDTH[kind]} rounded={kind === "wallet"} />
      ))}
    </div>
  );
}
