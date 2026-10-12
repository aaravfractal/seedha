"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { shareMessage, whatsappShareHref } from "@/lib/siteHost";
import p from "./publish.module.css";

/** The old copy route (a selected, off-screen text box). False when the browser refuses. */
function legacyCopy(text: string): boolean {
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  let ok = false;
  try {
    ok = document.execCommand("copy"); // the only copy route without the Clipboard API
  } catch {
    ok = false;
  }
  box.remove();
  return ok;
}

/**
 * A live hotel address with the three ways to pass it on: Copy, Share on
 * WhatsApp (a plain wa.me link with a prefilled message; no WhatsApp API) and
 * a QR code image to download for the checkout slip.
 */
export function SiteAddress({ url, slug, hotelName }: { url: string; slug: string; hotelName: string }) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  // Shown only when the browser blocks clipboard access: the address, selected, to copy by hand.
  const [manual, setManual] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const shown = url.replace(/^https?:\/\//, "");

  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then((data) => {
        if (alive) setQr(data);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    if (manual) field.current?.select();
  }, [manual]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Address copied");
      return;
    } catch {
      // Older browsers and http pages without clipboard access: fall through.
    }
    if (legacyCopy(url)) {
      toast("Address copied");
      return;
    }
    setManual(true);
    toast("Could not copy. The address is selected: copy it from the box.");
  }

  return (
    <div className={p.address}>
      <div className={p.addressText}>
        <span className={p.label}>Your site is live at</span>
        <a className={p.url} href={url} target="_blank" rel="noopener noreferrer">
          {shown}
        </a>
      </div>
      <div className={p.actions}>
        <button type="button" className="btn" onClick={() => void copy()}>
          Copy
        </button>
        <a
          className="btn ghost"
          href={whatsappShareHref(shareMessage(hotelName, url))}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on WhatsApp
        </a>
      </div>
      {manual ? (
        <input
          ref={field}
          className={p.copyField}
          readOnly
          value={url}
          aria-label="Your site address"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
      <div className={p.qr}>
        {qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL */}
            <img src={qr} alt={`QR code for ${shown}`} width={160} height={160} className={p.qrImg} />
            <div>
              <p className={p.qrNote}>Print it on the checkout slip so guests book direct next time.</p>
              <a className="btn ghost small" href={qr} download={`${slug}-qr.png`}>
                Download QR code
              </a>
            </div>
          </>
        ) : (
          <p className={p.qrNote} role="status">
            Making the QR code
          </p>
        )}
      </div>
    </div>
  );
}

export default SiteAddress;
