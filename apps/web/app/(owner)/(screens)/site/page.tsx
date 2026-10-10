"use client";

import { useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import type { Lang, Mood, OwnerSite } from "@/lib/types-site";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { GoogleKit } from "@/components/site/GoogleKit";
import { PackagesTab } from "@/components/site/PackagesTab";
import type { PackageChange } from "@/components/site/PackagesTab";
import { Review } from "@/components/site/Review";
import { SetupFlow } from "@/components/site/SetupFlow";
import o from "@/components/site/owner.module.css";

type Tab = "site" | "packages" | "google";
const TABS: ReadonlyArray<[Tab, string]> = [
  ["site", "Site"],
  ["packages", "Packages"],
  ["google", "Google kit"],
];
const WHAT_YOU_SEND = [
  "8 to 10 photos",
  "One Hindi voice note",
  "Rooms and prices",
  "Nearby places",
  "Contact and UPI",
];

function patch(path: string, body: object): Promise<OwnerSite> {
  return api<OwnerSite>(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function HouseIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinejoin="round" />
      <path d="M10 20v-5h4v5" strokeLinejoin="round" />
    </svg>
  );
}

/** Website (Seedha Site owner flow): set up on WhatsApp, review, publish; packages; Google kit. */
export default function SitePage() {
  const site = useApi<OwnerSite>("site");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("site");

  async function run(work: () => Promise<OwnerSite>, note?: string) {
    setBusy(true);
    try {
      site.setData(await work());
      if (note) toast(note);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, note: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(note);
    } catch {
      toast("Copy did not work here. Select the text and copy it.");
    }
  }

  const header = (
    <div className={o.top}>
      <div>
        <p className={o.eyebrow}>Seedha Site · sample data</p>
        <h1 className={o.h1}>Website</h1>
      </div>
      <div className={o.seg} role="group" aria-label="Website sections">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  if (site.error)
    return (
      <div className={o.stack}>
        {header}
        <ErrorState message={site.error.message} code={site.error.code} onRetry={site.reload} />
      </div>
    );
  if (!site.data)
    return (
      <div className={o.stack}>
        {header}
        <Loading rows={3} label="Loading your website" />
      </div>
    );
  const s = site.data;

  let body;
  if (tab === "packages") {
    body = (
      <PackagesTab
        packages={s.packages}
        busy={busy}
        onApprove={(key) =>
          run(
            () => postJson<OwnerSite>(`site/packages/${key}`),
            s.live ? "Approved. It is on your site now." : "Approved. It shows once you publish.",
          )
        }
        onChange={(key, change: PackageChange) =>
          run(
            () => patch(`site/packages/${key}`, change),
            change.nights
              ? "Price worked out again. Approve it when ready."
              : change.state === "skipped"
                ? "Skipped"
                : "Updated",
          )
        }
      />
    );
  } else if (tab === "google") {
    body = <GoogleKit site={s} onCopy={copy} />;
  } else if (s.stage === "empty") {
    body = (
      <section className={`${o.card} ${o.empty}`} aria-labelledby="site-empty">
        <span className={o.iconTile}>
          <HouseIcon />
        </span>
        <h2 id="site-empty" className={o.emptyTitle}>
          Your hotel, online in 10 minutes.
        </h2>
        <p className={o.sub} style={{ margin: 0 }}>
          No website? Send a few photos and we build one with direct booking.
        </p>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => run(() => patch("site", { stage: "chat" }))}
        >
          Start on WhatsApp
        </button>
        <ul className={o.what} aria-label="What you send">
          {WHAT_YOU_SEND.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    );
  } else if (s.stage === "chat") {
    body = <SetupFlow site={s} busy={busy} onReview={() => run(() => patch("site", { stage: "review" }))} />;
  } else {
    body = (
      <Review
        site={s}
        busy={busy}
        onLook={(look: { mood?: Mood; lang?: Lang }) => run(() => patch("site", look))}
        onPublish={() => run(() => postJson<OwnerSite>("site/publish"), "Your site is live")}
        onChange={() => run(() => patch("site", { stage: "chat" }))}
        onCopy={(url) => copy(url, "Link copied")}
        onPackages={() => setTab("packages")}
      />
    );
  }

  return (
    <div className={o.stack}>
      {header}
      {body}
    </div>
  );
}
