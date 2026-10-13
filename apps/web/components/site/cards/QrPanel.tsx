"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { SCAN_LABELS, cardUrl, qrHref } from "@/lib/siteDetails";
import type { ScanCard } from "@/lib/types-site-v2-owner";
import { useToast } from "@/components/Toast";
import { QrImage } from "./CardFaces";
import { downloadFile } from "./download";
import c from "./cards.module.css";

const CARDS: readonly ScanCard[] = ["wallet", "room", "desk"];

/**
 * "Card QR": for each card, the QR (error correction H, 4-module quiet zone),
 * the exact address it opens and downloads from the API as SVG and as a
 * print-resolution PNG (GET /site/cards/qr.svg|png?card=...).
 */
export function QrPanel({ base, slug }: { base: string; slug: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function save(e: MouseEvent<HTMLAnchorElement>, key: string, name: string, type: string) {
    e.preventDefault();
    if (busy) return;
    setBusy(key);
    const problem = await downloadFile(e.currentTarget.href, name, type);
    setBusy(null);
    toast(problem ?? "Downloaded");
  }

  return (
    <section className={c.section} aria-labelledby="qr-title">
      <div className={c.sectionHead}>
        <h3 id="qr-title" className={c.title}>
          Card QR
        </h3>
      </div>
      <p className={c.hint}>
        Use these if you print your own cards. Each QR opens your site and tells it which card was scanned.
        High error correction, so a small mark or fold still scans. The PNG is print resolution.
      </p>
      <ul className={c.qrs}>
        {CARDS.map((card) => {
          const target = cardUrl(base, card);
          const name = SCAN_LABELS[card];
          return (
            <li key={card} className={c.qr}>
              <h4 className={c.qrTitle}>{name}</h4>
              <div className={c.qrBox}>
                <QrImage text={target} label={`QR code of the ${name.toLowerCase()} to ${target}`} />
              </div>
              <p className={c.spec}>
                Opens <span className={c.url}>{target}</span>
              </p>
              <div className={c.links}>
                {(["svg", "png"] as const).map((format) => {
                  const key = `${format}-${card}`;
                  const file = `${slug}-qr-${card}.${format}`;
                  return (
                    <a
                      key={format}
                      className="btn ghost small"
                      href={qrHref(card, format)}
                      download={file}
                      aria-busy={busy === key || undefined}
                      aria-label={`Download QR of the ${name.toLowerCase()} as ${format.toUpperCase()}`}
                      onClick={(e) =>
                        void save(e, key, file, format === "svg" ? "image/svg+xml" : "image/png")
                      }
                    >
                      {busy === key ? "Preparing…" : `Download ${format.toUpperCase()}`}
                    </a>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
