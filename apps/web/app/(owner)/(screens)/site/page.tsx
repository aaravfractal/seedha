"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { SiteData } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import { SitePreview } from "@/components/SitePreview";
import { useToast } from "@/components/Toast";

function patch(body: Partial<Pick<SiteData, "stage" | "mood" | "lang">>): Promise<SiteData> {
  return api<SiteData>("site", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Replays the owner's WhatsApp setup answers, then moves to review. */
function SetupChat({ site, onDone }: { site: SiteData; onDone: (s: SiteData) => void }) {
  const [shown, setShown] = useState(0);
  const finished = useRef(false);
  const steps = site.setup_chat.length;
  useEffect(() => {
    if (shown < steps * 2) {
      const t = setTimeout(() => setShown(shown + 1), shown % 2 === 0 ? 450 : 550);
      return () => clearTimeout(t);
    }
    if (finished.current) return;
    finished.current = true;
    const t = setTimeout(() => {
      void patch({ stage: "review" }).then(onDone);
    }, 1300);
    return () => clearTimeout(t);
  }, [shown, steps, onDone]);
  const answered = Math.floor(shown / 2);
  return (
    <>
      <h2 className="title">Five quick questions.</h2>
      <p className="sub">
        This is how the owner sets it up on WhatsApp. These are the sample hotel&apos;s answers.
      </p>
      <div className="wa" aria-live="polite">
        {site.setup_chat.slice(0, Math.ceil(shown / 2)).map(([q, a], i) => (
          <div key={q} style={{ display: "contents" }}>
            <div className="bub bot">
              {q}
              <span className="foot">
                Seedha · {i + 1} of {steps}
              </span>
            </div>
            {shown > i * 2 + 1 ? <div className="bub me">{a}</div> : null}
          </div>
        ))}
        {shown >= steps * 2 ? (
          <div className="bub bot">
            Theek hai. Building your site now.<span className="foot">Seedha</span>
          </div>
        ) : null}
      </div>
      <div className="progress" aria-hidden="true">
        <i style={{ width: `${(answered / steps) * 100}%` }} />
      </div>
      <p className="calc">
        {answered < steps ? `Question ${answered + 1} of ${steps}` : "Building your site"}
      </p>
    </>
  );
}

export default function SitePage() {
  const site = useApi<SiteData>("site");
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<SiteData>, note?: string) {
    setBusy(true);
    try {
      site.setData(await work());
      if (note) toast(note);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  }

  if (site.error)
    return <ErrorState message={site.error.message} code={site.error.code} onRetry={site.reload} />;
  if (!site.data) return <Loading rows={3} label="Loading your website" />;
  const s = site.data;

  if (s.stage === "empty") {
    return (
      <>
        <h2 className="title">Your hotel, online in 10 minutes.</h2>
        <p className="sub">
          No website? Send a few photos and a voice note on WhatsApp. Seedha builds a site with direct
          booking, packages and a rate card.
        </p>
        <div className="card">
          <h3 className="sub-title">What you send</h3>
          <p className="sub" style={{ margin: "6px 0 16px" }}>
            8 photos, a voice note in Hindi, room prices, nearby places, contact and UPI ID. About 5 minutes.
          </p>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => run(() => patch({ stage: "chat" }))}
          >
            Start on WhatsApp
          </button>
        </div>
      </>
    );
  }
  if (s.stage === "chat") return <SetupChat site={s} onDone={site.setData} />;

  const share = `https://wa.me/?text=${encodeURIComponent(`Book ${s.hotel} directly: https://${s.address}`)}`;
  return (
    <>
      <h2 className="title">{s.live ? "Your site is live." : "Your hotel, online."}</h2>
      <p className="sub">
        {s.live
          ? `${s.address} (sample address) · Guests who book here pay you directly.`
          : "Check it, approve packages, then publish. Nothing goes live before you tap Publish."}
      </p>
      <div className="two">
        <div>
          <div className="toggle" role="group" aria-label="Look">
            {(["pine", "stone", "sky"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={s.mood === m}
                onClick={() => run(() => patch({ mood: m }))}
              >
                {m[0]?.toUpperCase()}
                {m.slice(1)}
              </button>
            ))}
          </div>{" "}
          <div className="toggle" role="group" aria-label="Language">
            {(
              [
                ["en", "English"],
                ["hi", "Hindi"],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                type="button"
                aria-pressed={s.lang === code}
                onClick={() => run(() => patch({ lang: code }))}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="card" style={{ padding: "8px 20px" }}>
            <h3 className="sub-title" style={{ margin: "12px 0 0" }}>
              Packages for your guests
            </h3>
            <p className="calc" style={{ margin: "2px 0 4px" }}>
              Packages add value. Your public room price stays the same.
            </p>
            {s.packages.map((p) => (
              <div className="pkg" key={p.key}>
                <div>
                  <b>{p.name}</b>
                  <div className="meta">
                    {p.includes} · {inr(p.price)}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--ink3)" }}>Why: {p.why}</div>
                </div>
                <div>
                  {p.approved ? (
                    <span className="tag ok">Approved</span>
                  ) : (
                    <button
                      type="button"
                      className="btn small"
                      disabled={busy}
                      onClick={() =>
                        run(() => postJson<SiteData>(`site/packages/${p.key}`), "Package approved")
                      }
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h3 className="sub-title">{s.live ? "Share it" : "Ready to publish"}</h3>
            {["Photos", "Rooms and prices", "Nearby places", "Contact and UPI"].map((x) => (
              <div key={x} style={{ padding: "4px 0", fontSize: 15 }}>
                ✓ {x}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {s.live ? (
                <>
                  <a className="btn" href={share} target="_blank" rel="noopener noreferrer">
                    Share on WhatsApp
                  </a>
                  <Link className="btn ghost" href="/rate-card" target="_blank">
                    Rate card
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => run(() => postJson<SiteData>("site/publish"), "Your site is live")}
                  >
                    Publish site
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => run(() => patch({ stage: "chat" }))}
                  >
                    Change something
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="phone" style={{ minHeight: 0, borderWidth: 8 }}>
            <div className="notch" />
            <div className="frame" style={{ border: 0, borderRadius: 0 }}>
              <SitePreview site={s} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
