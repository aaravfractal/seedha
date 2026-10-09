import Link from "next/link";
import { inr } from "@/lib/format";
import type { SiteData } from "@/lib/types";

const MOODS: Record<SiteData["mood"], [string, string, string]> = {
  pine: ["#2C5E48", "#E8F0EC", "linear-gradient(160deg,#1f3d31,#2C5E48 45%,#9DBFAE)"],
  stone: ["#6B6259", "#F1EEEA", "linear-gradient(160deg,#3d3833,#6B6259 45%,#CFC6BC)"],
  sky: ["#3C6E91", "#E8F0F6", "linear-gradient(160deg,#21384a,#3C6E91 45%,#A9C6DB)"],
};

const T = {
  en: {
    book: "Book directly",
    room: "Book",
    why: "Why book direct",
    w: [
      "Breakfast on us when you come back",
      "Pay by UPI, straight to the hotel",
      "Talk to us directly on WhatsApp",
    ],
    rooms: "Rooms",
    pk: "Packages",
    near: "Nearby",
    night: "a night",
  },
  hi: {
    book: "Seedha book karein",
    room: "Book",
    why: "Seedha kyun book karein",
    w: [
      "Wapas aane par breakfast hamari taraf se",
      "UPI se seedha hotel ko payment",
      "WhatsApp par seedhe baat karein",
    ],
    rooms: "Kamre",
    pk: "Packages",
    near: "Paas mein",
    night: "ek raat",
  },
};

/** The hotel's own website, as guests would see it. Book buttons open Seedha Link. */
export function SitePreview({ site }: { site: SiteData }) {
  const [colour, soft, gradient] = MOODS[site.mood];
  const t = T[site.lang];
  const packages = site.packages.filter((p) => p.approved);
  return (
    <div className="hs" lang={site.lang === "hi" ? "hi-Latn" : "en"}>
      <div className="hero" style={{ background: gradient }}>
        <div>
          <h4>{site.hotel}</h4>
          <div style={{ fontSize: 14, opacity: 0.9 }}>{site.location}</div>
          <div style={{ fontSize: 14, opacity: 0.9, margin: "4px 0 10px" }}>{site.welcome[site.lang]}</div>
          <Link
            className="bk"
            href="/link"
            style={{ background: "#fff", color: colour, display: "inline-block" }}
          >
            {t.book}
          </Link>
        </div>
      </div>
      <div className="sec">
        <h5>{t.why}</h5>
        {t.w.map((line) => (
          <div key={line} style={{ fontSize: 14, padding: "3px 0" }}>
            ✓ {line}
          </div>
        ))}
      </div>
      <div className="sec">
        <h5>{t.rooms}</h5>
        {site.rooms.map((r, i) => (
          <div className="rm" key={r.room_type}>
            <div className="ph" style={{ background: gradient, opacity: 1 - i * 0.2 }} aria-hidden="true" />
            <div style={{ fontSize: 14 }}>
              <b>{r.room_type}</b>
              <br />
              <span style={{ color: "#555" }}>
                {inr(r.nightly_rate)} {t.night}
              </span>
            </div>
            <Link className="bk" href="/link" style={{ background: colour }}>
              {t.room}
            </Link>
          </div>
        ))}
      </div>
      {packages.length ? (
        <div className="sec">
          <h5>{t.pk}</h5>
          {packages.map((p) => (
            <div className="pk" key={p.key} style={{ background: soft }}>
              <b>{p.name}</b>
              <div style={{ fontSize: 13, color: "#555" }}>{p.includes}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{inr(p.price)}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="sec">
        <h5>{t.near}</h5>
        <div style={{ fontSize: 14, color: "#555" }}>{site.nearby}</div>
      </div>
      <div className="foot">Made with Seedha · sample hotel</div>
    </div>
  );
}
