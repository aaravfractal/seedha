"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError, api, postJson } from "@/lib/api";
import { siteAddress, slugProblem, toSlug } from "@/lib/siteHost";
import type { PublishResult, SiteAddressInfo, SlugCheck } from "@/lib/types-site";
import { useToast } from "@/components/Toast";
import SiteAddress from "./SiteAddress";
import p from "./publish.module.css";

const LOCAL_MESSAGES = {
  slug_invalid:
    "Use 3 to 40 small letters, numbers and single hyphens, starting and ending with a letter or number.",
  slug_reserved: "This address is reserved. Please pick another.",
} as const;
const CHECK_DELAY_MS = 350;

type Check =
  { state: "idle" | "checking" } | { state: "done"; result: SlugCheck } | { state: "error"; message: string };

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * The end of Review: pick the address (checked as you type), see it live,
 * publish, then share it. Nothing is public until Publish. Renaming a live
 * site keeps the old address redirecting for 30 days.
 */
export function PublishPanel({
  hotelName,
  onPublished,
}: {
  hotelName: string;
  /** Optional: lets the screen reload its own copy of the site after a publish. */
  onPublished?: () => void;
}) {
  const inputId = useId();
  const noteId = useId();
  const brandId = useId();
  const toast = useToast();
  const [info, setInfo] = useState<SiteAddressInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [appHost, setAppHost] = useState("");
  const asked = useRef(0);

  async function load() {
    setLoadError(null);
    try {
      const value = await api<SiteAddressInfo>("site/address");
      setInfo(value);
      setSlug((current) => current || value.slug || value.suggested_slug);
    } catch (err) {
      setLoadError(errorText(err, "Could not load your address."));
    }
  }

  // First load: the address in use and the suggestion; the app host for the preview.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of the host after hydration
    setAppHost(window.location.host);
    void load();
  }, []);

  // Check with the API as the owner types (after a short pause).
  const local = slug ? slugProblem(slug) : "slug_invalid";
  useEffect(() => {
    if (!info || !slug || local) return;
    const ticket = ++asked.current;
    const timer = setTimeout(() => {
      setCheck({ state: "checking" });
      api<SlugCheck>(`site/slug/check?${new URLSearchParams({ slug })}`)
        .then((result) => {
          if (ticket === asked.current) setCheck({ state: "done", result });
        })
        .catch((err: unknown) => {
          if (ticket === asked.current)
            setCheck({ state: "error", message: errorText(err, "Could not check the address") });
        });
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [slug, local, info]);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const done = await postJson<PublishResult>("site/publish", { slug });
      setInfo((old) =>
        old ? { ...old, slug: done.slug, url: done.url, address: done.address, published: true } : old,
      );
      setEditing(false);
      toast("Your site is live");
      onPublished?.();
    } catch (err) {
      setError(errorText(err, "Could not publish. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function setBranding(hide: boolean) {
    try {
      const value = await api<{ hide_branding: boolean }>("site/branding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hide_branding: hide }),
      });
      setInfo((old) => (old ? { ...old, hide_branding: value.hide_branding } : old));
      toast(value.hide_branding ? "Seedha branding hidden" : "Seedha branding shown");
    } catch (err) {
      toast(errorText(err, "Could not save. Try again."));
    }
  }

  if (loadError) {
    return (
      <section className={p.panel} aria-label="Publish">
        <p className={p.bad} role="alert">
          {loadError}
        </p>
        <button type="button" className="btn ghost small" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );
  }
  if (!info) {
    return (
      <section className={p.panel} aria-label="Publish" aria-busy="true">
        <p className={p.sub}>Loading your address</p>
      </section>
    );
  }

  const live = info.published;
  const branding = (
    <label className={p.check} htmlFor={brandId}>
      <input
        id={brandId}
        type="checkbox"
        checked={info.hide_branding}
        onChange={(e) => void setBranding(e.target.checked)}
      />
      <span>
        Hide &ldquo;Built with Seedha&rdquo; and &ldquo;Powered by Seedha&rdquo;{" "}
        <span className={p.pro}>Pro</span>
      </span>
    </label>
  );

  if (live && info.url && info.slug && !editing) {
    return (
      <section className={p.panel} aria-labelledby={`${inputId}-title`}>
        <h2 id={`${inputId}-title`} className={p.title}>
          Your site is live
        </h2>
        <SiteAddress url={info.url} slug={info.slug} hotelName={hotelName} />
        {branding}
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            setSlug(info.slug ?? slug);
            setEditing(true);
          }}
        >
          Change address
        </button>
      </section>
    );
  }

  const result = check.state === "done" && check.result.slug === slug ? check.result : null;
  const ok = !local && result?.ok === true;
  const message = slug && local ? LOCAL_MESSAGES[local] : (result?.message ?? null);
  const unchanged = live && info.slug === slug;
  const preview = result?.ok
    ? result.url.replace(/^https?:\/\//, "")
    : siteAddress(slug, info.root_domain, appHost);
  let note = "";
  if (check.state === "checking") note = "Checking";
  else if (check.state === "error") note = check.message;
  else if (unchanged) note = "This is your address now.";
  else if (result?.ok) note = "Available";

  return (
    <section className={p.panel} aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className={p.title}>
        {live ? "Change your address" : "Pick your address"}
      </h2>
      <p className={p.sub}>
        {live
          ? "The old address keeps working for 30 days and then stops."
          : "Guests will type this or tap it on WhatsApp. Nothing is public until you publish."}
      </p>
      <label className={p.label} htmlFor={inputId}>
        Address
      </label>
      <div className={p.field}>
        <input
          id={inputId}
          className={p.input}
          value={slug}
          inputMode="url"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          aria-describedby={noteId}
          aria-invalid={Boolean(message) || undefined}
          onChange={(e) => setSlug(toSlug(e.target.value))}
        />
      </div>
      <p id={noteId} className={message ? p.bad : p.note} role="status" aria-live="polite">
        {message ?? note}
      </p>
      <div className={p.preview} aria-label="How the address will look">
        <div className={p.bar}>
          <span className={p.lock} aria-hidden="true" />
          <span className={p.barText}>{slug ? preview : "your-hotel"}</span>
        </div>
        <div className={p.previewBody}>
          <strong>{hotelName}</strong>
          <span className={p.previewBtn}>Book direct{info.hide_branding ? "" : " · Powered by Seedha"}</span>
        </div>
      </div>
      <div className={p.actions}>
        <button
          type="button"
          className="btn"
          disabled={busy || !ok || unchanged}
          onClick={() => void publish()}
        >
          {busy ? "Publishing" : live ? "Save new address" : "Publish site"}
        </button>
        {live ? (
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        ) : null}
      </div>
      {branding}
      {error ? (
        <p className={p.bad} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export default PublishPanel;
