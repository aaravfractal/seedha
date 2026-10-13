"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import type { OwnerSiteWithDetails } from "@/lib/siteDetails";
import type { Lang } from "@/lib/types-site";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { GoogleKit } from "@/components/site/GoogleKit";
import { PackagesTab } from "@/components/site/PackagesTab";
import type { PackageChange } from "@/components/site/PackagesTab";
import { BuildFlow } from "@/components/site/BuildFlow";
import { Review, SitePreview } from "@/components/site/Review";
import { CardsPanel } from "@/components/site/cards/CardsPanel";
import { DetailsEditor } from "@/components/site/details/DetailsEditor";
import { RatingsPanel } from "@/components/site/ratings/RatingsPanel";
import o from "@/components/site/owner.module.css";

type Tab = "site" | "details" | "packages" | "cards" | "ratings" | "google";
const TABS: ReadonlyArray<[Tab, string]> = [
  ["site", "Site"],
  ["details", "Hotel details"],
  ["packages", "Packages"],
  ["cards", "Print cards"],
  ["ratings", "Ratings"],
  ["google", "Google kit"],
];
const WHAT_YOU_ADD = [
  "4 to 8 photos",
  "A few lines, typed or spoken",
  "Rooms and prices",
  "Check, then publish",
];

type Site = OwnerSiteWithDetails;

function patch(path: string, body: object): Promise<Site> {
  return api<Site>(path, {
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

function ExternalIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M14 4h6v6M20 4l-9 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The section tabs. At phone width they scroll sideways inside their bar
 * (never the page): a fade shows on the side with more tabs, and the chosen
 * tab is scrolled into view.
 */
function SectionTabs({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () =>
      setMore({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  // Keep the chosen tab in view (horizontally only, so the page does not jump).
  useEffect(() => {
    const el = list.current;
    const chosen = el?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!el || !chosen) return;
    const pad = 24;
    const start = chosen.offsetLeft - pad;
    const end = chosen.offsetLeft + chosen.offsetWidth + pad - el.clientWidth;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (el.scrollLeft > start) el.scrollTo({ left: start, behavior: reduce ? "auto" : "smooth" });
    else if (el.scrollLeft < end) el.scrollTo({ left: end, behavior: reduce ? "auto" : "smooth" });
  }, [tab]);

  return (
    <div className={o.tabs} data-more-left={more.left} data-more-right={more.right}>
      <div ref={list} className={`${o.seg} ${o.tabList}`} role="group" aria-label="Website sections">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => onTab(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Website (Seedha Site owner flow): build from photos and words, review, publish; packages; Google kit. */
export default function SitePage() {
  const site = useApi<Site>("site");
  // The sample hotel's preview language before a build (the guest page has its own switch).
  const [sampleLang, setSampleLang] = useState<Lang>("en");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("site");
  // Hotel details stays mounted once opened, so unsaved edits survive a tab switch.
  const [detailsOpened, setDetailsOpened] = useState(false);
  function openTab(next: Tab) {
    if (next === "details") setDetailsOpened(true);
    setTab(next);
  }
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

  async function run(work: () => Promise<Site>, note?: string): Promise<boolean> {
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

  // The public address opens for guests once published; the sample hotel's labelled page always does.
  const openable = site.data && (site.data.live || site.data.sample) ? site.data : null;
  const header = (
    <div className={o.top}>
      <div className={o.titleRow}>
        <div>
          <p className={o.eyebrow}>
            {site.data?.sample === false ? "Seedha Site" : "Seedha Site · sample data"}
          </p>
          <h1 className={o.h1}>Website</h1>
        </div>
        {openable ? (
          <a
            className={`btn ghost small ${o.openSite}`}
            href={openable.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open your site
            <ExternalIcon />
            <span className="sr-only-text"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
      <SectionTabs tab={tab} onTab={openTab} />
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
            () => postJson<Site>(`site/packages/${key}`),
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
  } else if (tab === "details") {
    body = null;
  } else if (tab === "cards") {
    body = <CardsPanel site={s} />;
  } else if (tab === "ratings") {
    body = <RatingsPanel />;
  } else if (tab === "google") {
    body = <GoogleKit site={s} onCopy={copy} />;
  } else if (s.stage === "empty") {
    body = (
      <>
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
        {s.sample ? (
          <section className={o.stack} aria-labelledby="sample-preview">
            <div className={o.reviewHead}>
              <div>
                <h2 id="sample-preview" className={o.h2}>
                  The sample hotel&apos;s page
                </h2>
                <p className={o.sub}>What guests see at {s.address}. Sample data, all fictional.</p>
              </div>
              <div className={o.seg} role="group" aria-label="Preview language">
                <button type="button" aria-pressed={sampleLang === "en"} onClick={() => setSampleLang("en")}>
                  English
                </button>
                <button
                  type="button"
                  lang="hi"
                  className={o.deva}
                  aria-pressed={sampleLang === "hi"}
                  onClick={() => setSampleLang("hi")}
                >
                  हिंदी
                </button>
              </div>
            </div>
            <SitePreview site={{ ...s, lang: sampleLang }} />
          </section>
        ) : null}
      </>
    );
  } else if (s.stage === "chat") {
    body = <BuildFlow busy={busy} claimFocus={claimFocus} onReview={() => void goStage("review")} />;
  } else {
    body = (
      <Review
        site={s}
        busy={busy}
        onLook={(look: { lang: Lang }) => run(() => patch("site", look))}
        onChange={() => void goStage("chat")}
        onSiteChanged={site.reload}
        onPackages={() => openTab("packages")}
        claimFocus={claimFocus}
      />
    );
  }

  return (
    <div className={o.stack}>
      {header}
      {body}
      {detailsOpened ? (
        <div hidden={tab !== "details"}>
          <DetailsEditor
            live={s.live}
            sampleHotel={s.sample}
            roomTypes={s.rooms.map((r) => r.room_type)}
            photos={s.photos}
            onSaved={site.reload}
          />
        </div>
      ) : null}
    </div>
  );
}
