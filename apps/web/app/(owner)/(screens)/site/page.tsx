"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import type { Lang, Mood, OwnerSite } from "@/lib/types-site";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { GoogleKit } from "@/components/site/GoogleKit";
import { PackagesTab } from "@/components/site/PackagesTab";
import type { PackageChange } from "@/components/site/PackagesTab";
import { BuildFlow } from "@/components/site/BuildFlow";
import { Review } from "@/components/site/Review";
import o from "@/components/site/owner.module.css";

type Tab = "site" | "packages" | "google";
const TABS: ReadonlyArray<[Tab, string]> = [
  ["site", "Site"],
  ["packages", "Packages"],
  ["google", "Google kit"],
];
const WHAT_YOU_ADD = [
  "4 to 8 photos",
  "A few lines, typed or spoken",
  "Rooms and prices",
  "Check, then publish",
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

/** Website (Seedha Site owner flow): build from photos and words, review, publish; packages; Google kit. */
export default function SitePage() {
  const site = useApi<OwnerSite>("site");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("site");
  // After a stage change by button, the new screen takes focus once (its heading).
  const focusNext = useRef(false);
  const claimFocus = useCallback(() => {
    const take = focusNext.current;
    focusNext.current = false;
    return take;
  }, []);
  async function goStage(stage: "chat" | "review") {
    focusNext.current = true;
    if (!(await run(() => patch("site", { stage })))) focusNext.current = false;
  }

  async function run(work: () => Promise<OwnerSite>, note?: string): Promise<boolean> {
    setBusy(true);
    try {
      site.setData(await work());
      if (note) toast(note);
      return true;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not work. Try again.");
      return false;
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
        <p className={o.eyebrow}>
          {site.data?.sample === false ? "Seedha Site" : "Seedha Site · sample data"}
        </p>
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
          No website? Add a few photos and a few lines, and we build one with direct booking.
        </p>
        <button type="button" className="btn" disabled={busy} onClick={() => void goStage("chat")}>
          Build my site
        </button>
        <p className={o.muted} style={{ margin: 0, fontSize: 15 }}>
          Coming soon: build on WhatsApp
        </p>
        <ul className={o.what} aria-label="What you add">
          {WHAT_YOU_ADD.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    );
  } else if (s.stage === "chat") {
    body = <BuildFlow busy={busy} claimFocus={claimFocus} onReview={() => void goStage("review")} />;
  } else {
    body = (
      <Review
        site={s}
        busy={busy}
        onLook={(look: { mood?: Mood; lang?: Lang }) => run(() => patch("site", look))}
        onChange={() => void goStage("chat")}
        onSiteChanged={site.reload}
        onPackages={() => setTab("packages")}
        claimFocus={claimFocus}
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
