"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import styles from "./RatingPanel.module.css";

/** "https://host/rate/abc" -> "host/rate/abc": the link as a guest would type it. */
export function shortLink(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * After a Desk checkout: the guest's one-time rating link as a QR and a short
 * link, shown on the screen for the guest to scan. Never messaged.
 */
export function RatingPanel({ url, onClose }: { url: string; onClose: () => void }) {
  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toString(url, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    }).then((svg) => {
      if (alive) setQr({ url, svg });
    });
    return () => {
      alive = false;
    };
  }, [url]);
  const svg = qr && qr.url === url ? qr.svg : null;

  return (
    <section className={styles.panel} aria-labelledby="rate-stay-title" data-testid="rate-stay">
      <div
        className={styles.qr}
        role="img"
        aria-label="Rating QR code"
        data-url={url}
        // The SVG comes from the qrcode library, built from the API's URL.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <div className={styles.text}>
        <h2 id="rate-stay-title" className={styles.title}>
          Rate your stay
        </h2>
        <p className={styles.sub}>Scan with your phone. One rating per stay, nothing is sent to you.</p>
        <a className={styles.link} href={url} target="_blank" rel="noreferrer">
          {shortLink(url)}
        </a>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  );
}
