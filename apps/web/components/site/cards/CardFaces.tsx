"use client";

import QRCode from "qrcode";
import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CARD_SPECS, qrPathData } from "@/lib/siteDetails";
import type { CardKind } from "@/lib/types-site-v2-owner";
import c from "./cards.module.css";

/** What a card shows: hotel data only. No prices, no reviews, no ratings. */
export type CardData = {
  hotel: string;
  hotelHi: string;
  place: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  checkIn: string;
  checkOut: string;
  showBrand: boolean;
  sample: boolean;
};

/** A QR code drawn as SVG (level H, 4-module quiet zone) for `text`. */
export function QrSvg({ text, label, style }: { text: string; label: string; style?: CSSProperties }) {
  const drawn = useMemo(() => {
    try {
      const code = QRCode.create(text, { errorCorrectionLevel: "H" });
      const size = code.modules.size;
      return { size, d: qrPathData(size, (r, col) => code.modules.get(r, col) === 1) };
    } catch {
      return null;
    }
  }, [text]);
  if (!drawn) return null;
  const box = drawn.size + 8;
  return (
    <svg className={c.qr} viewBox={`0 0 ${box} ${box}`} role="img" aria-label={label} style={style}>
      <rect width={box} height={box} />
      <path d={drawn.d} shapeRendering="crispEdges" />
    </svg>
  );
}

/** One card face at its true aspect ratio, `width` CSS pixels wide at most. */
function Face({
  kind,
  width,
  caption,
  pine,
  sample,
  brand,
  children,
}: {
  kind: CardKind;
  width: number;
  caption: string;
  pine?: boolean;
  sample: boolean;
  brand?: boolean;
  children: ReactNode;
}) {
  const spec = CARD_SPECS[kind];
  return (
    <figure className={c.faceWrap} style={{ width: `min(100%, ${width}px)` }}>
      <div
        className={`${c.face} ${pine ? c.pine : ""}`}
        style={{
          aspectRatio: `${spec.w} / ${spec.h}`,
          // CR80 corners are 3.18 mm round; paper cards stay square.
          borderRadius:
            kind === "wallet" ? `${(318 / spec.w).toFixed(2)}% / ${(318 / spec.h).toFixed(2)}%` : undefined,
        }}
      >
        {sample ? <span className={c.sampleTag}>Sample</span> : null}
        {children}
        {brand ? <span className={c.brand}>Seedha</span> : null}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** "Call or WhatsApp" and the number, or each number on its own; nothing when neither is set. */
function contactParts(phone: string, whatsapp: string): [string, string][] {
  if (phone && whatsapp === phone) return [["Call or WhatsApp", phone]];
  const parts: [string, string][] = [];
  if (phone) parts.push(["Call", phone]);
  if (whatsapp) parts.push(["WhatsApp", whatsapp]);
  return parts;
}

function Contact({ data, size }: { data: CardData; size: string }) {
  const parts = contactParts(data.phone, data.whatsapp);
  if (parts.length === 0) return null;
  return (
    <p className={c.small} style={{ fontSize: size }}>
      {parts.map(([label, number], i) => (
        <span key={label} style={{ display: "block", marginTop: i ? "0.6cqw" : 0 }}>
          {label} <span className={c.nowrap}>{number}</span>
        </span>
      ))}
    </p>
  );
}

/** Front and back of the wallet card, the in-room card, or the desk tent card. */
export function CardFaces({ kind, data, qrText }: { kind: CardKind; data: CardData; qrText: string }) {
  const qrLabel = `QR code preview: ${qrText}`;
  if (kind === "wallet") {
    return (
      <div className={c.faces}>
        <Face kind="wallet" width={300} caption="Front" pine sample={data.sample}>
          <div className={`${c.inner} ${c.centre}`}>
            <p className={c.name} style={{ fontSize: "10cqw" }}>
              {data.hotel}
            </p>
            {data.hotelHi ? (
              <p className={`${c.small} ${c.hi}`} lang="hi" style={{ fontSize: "5cqw", marginTop: "1.5cqw" }}>
                {data.hotelHi}
              </p>
            ) : null}
            <span className={c.rule} />
            <p className={c.small} style={{ fontSize: "4.4cqw" }}>
              {data.place}
            </p>
          </div>
        </Face>
        <Face kind="wallet" width={300} caption="Back" sample={data.sample} brand={data.showBrand}>
          <div className={c.inner} style={{ flexDirection: "row", alignItems: "center", gap: "5cqw" }}>
            <QrSvg text={qrText} label={qrLabel} style={{ width: "30cqw", flex: "none" }} />
            <div style={{ display: "grid", gap: "2cqw", minWidth: 0 }}>
              <p className={c.name} style={{ fontSize: "7cqw" }}>
                Book direct next time
              </p>
              <p className={c.small} style={{ fontSize: "4cqw" }}>
                Scan to see our rooms and book with the hotel.
              </p>
              <Contact data={data} size="3.8cqw" />
            </div>
          </div>
        </Face>
      </div>
    );
  }
  if (kind === "room") {
    return (
      <div className={c.faces}>
        <Face kind="room" width={220} caption="Front" pine sample={data.sample}>
          <div className={`${c.inner} ${c.centre}`}>
            <p className={c.small} style={{ fontSize: "5cqw" }}>
              Welcome to
            </p>
            <p className={c.name} style={{ fontSize: "11cqw", marginTop: "2cqw" }}>
              {data.hotel}
            </p>
            {data.tagline ? (
              <p className={c.small} style={{ fontSize: "4.6cqw", marginTop: "3cqw" }}>
                {data.tagline}
              </p>
            ) : null}
            <span className={c.rule} />
            <p className={c.small} style={{ fontSize: "4.4cqw" }}>
              Check-in {data.checkIn} · Check-out {data.checkOut}
            </p>
          </div>
        </Face>
        <Face kind="room" width={220} caption="Back" sample={data.sample} brand={data.showBrand}>
          <div className={`${c.inner} ${c.centre}`} style={{ gap: "4cqw" }}>
            <p className={c.name} style={{ fontSize: "8.5cqw" }}>
              Come back and book direct
            </p>
            <QrSvg text={qrText} label={qrLabel} style={{ width: "34cqw" }} />
            <p className={c.small} style={{ fontSize: "4.4cqw" }}>
              Scan with your phone camera to book your next stay with us.
            </p>
            <Contact data={data} size="4.2cqw" />
          </div>
        </Face>
      </div>
    );
  }
  return (
    <div className={c.faces}>
      <Face
        kind="tent"
        width={260}
        caption="Front, stands on the desk"
        sample={data.sample}
        brand={data.showBrand}
      >
        <div className={`${c.inner} ${c.centre}`} style={{ gap: "3.5cqw" }}>
          <p className={c.name} style={{ fontSize: "9cqw" }}>
            {data.hotel}
          </p>
          <p className={c.small} style={{ fontSize: "4.6cqw" }}>
            Book your next stay direct with us
          </p>
          <QrSvg text={qrText} label={qrLabel} style={{ width: "42cqw" }} />
          <p className={c.small} style={{ fontSize: "4cqw" }}>
            Scan with your phone camera
          </p>
          <Contact data={data} size="3.8cqw" />
        </div>
      </Face>
    </div>
  );
}
