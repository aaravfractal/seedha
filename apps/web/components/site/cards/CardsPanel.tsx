"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import { useApi } from "@/lib/api";
import { CARD_TEXT, cardFacts } from "@/lib/cardLayout";
import { CARD_SOURCE, CARD_SPECS, cardUrl, cardsPdfHref, qrBaseUrl } from "@/lib/siteDetails";
import type { OwnerSite } from "@/lib/types-site";
import type { CardKind, PdfKind, SiteDetailsOut } from "@/lib/types-site-v2-owner";
import { useToast } from "@/components/Toast";
import { worldBFonts } from "@/lib/fonts-worldb";
import { CardFaces } from "./CardFaces";
import { QrPanel } from "./QrPanel";
import { ScansPanel } from "./ScansPanel";
import { downloadFile } from "./download";
import o from "../owner.module.css";
import c from "./cards.module.css";

const KINDS: readonly CardKind[] = ["wallet", "room", "tent"];

const noSubscribe = () => () => {};

/**
 * "Print cards": a browser preview of each card from the hotel's own data,
 * print-ready PDFs (GET /site/cards.pdf), "Card QR" (the QR alone as SVG and
 * PNG, GET /site/cards/qr.svg|png) and "Card scans this month".
 */
export function CardsPanel({ site }: { site: OwnerSite }) {
  const toast = useToast();
  const details = useApi<SiteDetailsOut>("site/details");
  const [busy, setBusy] = useState<string | null>(null);
  const saved = details.data;
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const slug = site.slug || "hotel";
  // The page every card QR opens (the API's card QR: PUBLIC_BASE_URL/h/<slug>).
  const qrBase = qrBaseUrl(site.url, slug, origin);
  // The same facts the PDF prints (apps/api/app/routers/site_details.py owner_card_data).
  const facts = useMemo(
    () =>
      cardFacts({
        hotel: site.hotel,
        url: qrBase,
        displayUrl: site.address,
        location: site.location.en,
        tagline: site.tagline.en,
        contact: saved?.contact ?? { phone: "", whatsapp: "", email: "", address_en: "" },
        checkIn: saved?.check_in ?? "",
        checkOut: saved?.check_out ?? "",
        nearby: saved?.nearby ?? [],
        notes: saved?.good_to_know.map((n) => n.text_en) ?? [],
        perk: saved?.card_perk_en ?? "",
        sample: site.sample,
        hideBranding: site.hide_branding,
      }),
    [site, saved, qrBase],
  );

  async function save(e: MouseEvent<HTMLAnchorElement>, key: string, name: string, type: string) {
    e.preventDefault();
    if (busy) return;
    setBusy(key);
    const problem = await downloadFile(e.currentTarget.href, name, type);
    setBusy(null);
    toast(problem ?? "Downloaded");
  }

  function pdfLink(kind: PdfKind, label: string, primary: boolean) {
    const key = `pdf-${kind}`;
    return (
      <a
        className={primary ? "btn small" : "btn ghost small"}
        href={cardsPdfHref(kind)}
        download={`${slug}-cards-${kind}.pdf`}
        aria-busy={busy === key || undefined}
        onClick={(e) => void save(e, key, `${slug}-cards-${kind}.pdf`, "application/pdf")}
      >
        {busy === key ? "Preparing…" : label}
      </a>
    );
  }

  return (
    <div className={c.stack}>
      <div className={o.reviewHead}>
        <div>
          <h2 className={o.h2}>Print cards</h2>
          <p className={o.sub}>
            Cards for the wallet, the room and the front desk. Each QR opens your site, and scans are counted
            below. Print-ready PDFs have bleed, crop marks and a colour table for the printer. Cards print in
            English only.
          </p>
        </div>
        <div className={c.actions}>{pdfLink("all", "Download all cards (PDF)", true)}</div>
      </div>

      {site.live ? null : (
        <p className={o.notice}>
          Your site is not live yet. The QR codes open your address once you publish. Print after publishing.
        </p>
      )}

      <ScansPanel />

      <QrPanel base={qrBase} slug={slug} />

      {saved ? (
        <p className={c.hint}>
          {facts.perk
            ? `Your card perk prints in gold: "${facts.perk}". Change it in Hotel details.`
            : `No card perk is set, so the cards say "${CARD_TEXT.noPerk}". You can add one in Hotel details.`}
        </p>
      ) : null}

      <div className={`${c.cards} ${worldBFonts}`}>
        {KINDS.map((kind) => {
          const spec = CARD_SPECS[kind];
          const card = CARD_SOURCE[kind];
          const target = cardUrl(qrBase, card);
          return (
            <section key={kind} className={c.section} aria-labelledby={`card-${kind}`}>
              <div className={c.sectionHead}>
                <h3 id={`card-${kind}`} className={c.title}>
                  {spec.title}
                </h3>
                <span className={c.hint}>{spec.size}</span>
              </div>
              <CardFaces kind={kind} facts={facts} />
              <p className={c.spec}>
                QR opens <span style={{ overflowWrap: "anywhere" }}>{target}</span>. Printed at least{" "}
                {spec.qrMm} mm wide.
              </p>
              <div className={c.links}>
                {pdfLink(kind, `Download ${spec.title.toLowerCase()} (PDF)`, false)}
              </div>
            </section>
          );
        })}
      </div>
      {details.error ? (
        <p className={c.hint} role="status">
          Your contact details did not load, so the previews show no phone number. The PDF uses your saved
          details.
        </p>
      ) : null}
    </div>
  );
}
