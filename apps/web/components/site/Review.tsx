"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useApi } from "@/lib/api";
import { LIMITS } from "@/lib/siteBuild";
import type { Lang, Mood, OwnerSite } from "@/lib/types-site";
import type { BuildPatch, BuildState, GenerateResult, SitePhoto } from "@/lib/types-site-build";
import { worldBFonts } from "@/lib/fonts-worldb";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { errorText, generateSite, patchBuild } from "./buildApi";
import { ConfirmGenerate, GenerateNote, SourceTag, allowanceText, atDailyLimit } from "./GenerateParts";
import { HotelSite } from "./HotelSite";
import PublishPanel from "./PublishPanel";
import { PhotosEditor, PointsEditor, RoomBlurbsEditor, TextPairEditor } from "./ReviewEditors";
import b from "./build.module.css";
import o from "./owner.module.css";

const MOODS: ReadonlyArray<[Mood, string, string]> = [
  ["pine", "Pine", "#1F4D3A"],
  ["stone", "Stone", "#4A4540"],
  ["sky", "Sky", "#2F6FA8"],
];

/**
 * Shows a page laid out at `width` CSS pixels, scaled to fit the frame. The
 * page itself is inert (a picture of the site); the frame scrolls.
 */
function PreviewFrame({
  width,
  height,
  label,
  children,
}: {
  width: number;
  height: number;
  label: string;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0, height: 0 });

  useEffect(() => {
    const frame = outer.current;
    const page = inner.current;
    if (!frame || !page) return;
    const measure = () => setSize({ scale: frame.clientWidth / width, height: page.offsetHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className={o.viewport} style={{ height }} tabIndex={0} role="region" aria-label={label}>
      <div style={{ height: size.height * size.scale, overflow: "hidden" }}>
        <div
          ref={inner}
          inert
          style={{
            width,
            transform: `scale(${size.scale})`,
            transformOrigin: "0 0",
            visibility: size.scale ? "visible" : "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Every generated line, editable, with the owner's own prices. Regenerate asks
 * first because it uses AI credit and replaces the text. `onSiteChanged`
 * reloads the preview after each save.
 */
function BuildEditor({ onSiteChanged, onChange }: { onSiteChanged: () => void; onChange: () => void }) {
  const toast = useToast();
  const loaded = useApi<BuildState>("site/build");
  const [build, setBuild] = useState<BuildState | null>(null);
  const [version, setVersion] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const current = build ?? loaded.data;

  if (loaded.error && !current) {
    return <ErrorState message={loaded.error.message} code={loaded.error.code} onRetry={loaded.reload} />;
  }
  if (!current) return <Loading rows={2} label="Loading your site text" />;

  async function save(patch: BuildPatch): Promise<boolean> {
    try {
      setBuild(await patchBuild(patch));
      onSiteChanged();
      toast("Saved. Only you see it until you publish.");
      return true;
    } catch (err) {
      toast(errorText(err));
      return false;
    }
  }

  async function regenerate() {
    setConfirm(false);
    setGenerating(true);
    setResult(null);
    try {
      const got = await generateSite();
      setBuild(got);
      setResult(got);
      // Fresh drafts from the new text.
      setVersion((v) => v + 1);
      onSiteChanged();
    } catch (err) {
      toast(errorText(err));
    } finally {
      setGenerating(false);
    }
  }

  const shown: BuildState = current;
  function setPhotos(photos: SitePhoto[]) {
    setBuild({ ...shown, photos });
    onSiteChanged();
  }

  if (current.source === "none") {
    return (
      <div className={b.section}>
        <h3 className={b.sectionTitle}>Your own photos and words are not added yet</h3>
        <p className={b.hint}>
          The preview shows sample text. Add your photos, a few lines and your rooms to build your own.
        </p>
        <div>
          <button type="button" className="btn" onClick={onChange}>
            Build my site
          </button>
        </div>
      </div>
    );
  }

  const limitHit = atDailyLimit(current);
  return (
    <div className={b.editor} key={version}>
      <div className={b.sectionHead}>
        <h2 className={o.cardTitle}>Your site text</h2>
        <SourceTag source={current.source} />
      </div>
      <div className={b.regen}>
        <button
          type="button"
          className="btn ghost"
          disabled={generating || limitHit}
          onClick={() => setConfirm(true)}
        >
          {generating ? "Writing…" : "Regenerate"}
        </button>
        <span className={b.hint}>{allowanceText(current)}</span>
      </div>
      <div aria-live="polite">
        {generating ? (
          <div className={b.field}>
            <p className={b.label}>Writing your site again. This can take up to a minute.</p>
            <span className={`${b.bar} ${b.indeterminate}`} aria-hidden="true">
              <i />
            </span>
          </div>
        ) : result ? (
          <GenerateNote result={result} />
        ) : null}
      </div>
      <TextPairEditor
        build={current}
        field="description"
        title="About the hotel"
        max={LIMITS.description}
        rows={6}
        onSave={save}
      />
      <PointsEditor build={current} onSave={save} />
      <RoomBlurbsEditor build={current} onSave={save} />
      <PhotosEditor build={current} onPhotos={setPhotos} onSave={save} onError={toast} />
      <TextPairEditor
        build={current}
        field="google_description"
        title="Google description"
        hint="For your Google Business Profile. Up to 750 letters."
        max={LIMITS.google}
        rows={5}
        onSave={save}
      />
      {confirm ? (
        <ConfirmGenerate
          build={current}
          onConfirm={() => void regenerate()}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </div>
  );
}

/** Review before publish. Nothing is public until Publish (rule 9 of the site brief). */
export function Review({
  site,
  busy,
  onLook,
  onChange,
  onSiteChanged,
  onPackages,
}: {
  site: OwnerSite;
  busy: boolean;
  onLook: (patch: { mood?: Mood; lang?: Lang }) => void;
  onChange: () => void;
  onSiteChanged: () => void;
  onPackages: () => void;
}) {
  const approved = site.packages.filter((p) => p.approved);
  const today = new Date().toISOString().slice(0, 10);
  const page = (
    <div className={worldBFonts}>
      <HotelSite site={site} packages={approved} lang={site.lang} mood={site.mood} today={today} preview />
    </div>
  );

  return (
    <div className={o.stack}>
      <div className={o.reviewHead}>
        <div>
          <h2 className={o.h2}>Your hotel, online.</h2>
          <p className={o.sub}>
            {site.live ? "Live now. Saved changes show on your site." : "Check every line, then publish."}
          </p>
        </div>
        <div className={o.switches}>
          <div className={o.seg} role="group" aria-label="Look">
            {MOODS.map(([key, label, colour]) => (
              <button
                key={key}
                type="button"
                aria-pressed={site.mood === key}
                disabled={busy}
                onClick={() => onLook({ mood: key })}
              >
                <span className={o.dot} style={{ background: colour }} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className={o.seg} role="group" aria-label="Language">
            <button
              type="button"
              aria-pressed={site.lang === "en"}
              disabled={busy}
              onClick={() => onLook({ lang: "en" })}
            >
              English
            </button>
            <button
              type="button"
              lang="hi"
              className={o.deva}
              aria-pressed={site.lang === "hi"}
              disabled={busy}
              onClick={() => onLook({ lang: "hi" })}
            >
              हिंदी
            </button>
          </div>
        </div>
      </div>

      {site.live ? null : (
        <p className={o.notice}>
          Not live yet. Only you can see this preview. Nothing goes online until you publish.
        </p>
      )}

      <div className={o.previews}>
        <div>
          <div className={o.phoneMock}>
            <PreviewFrame width={390} height={560} label="Phone preview of your site. Scroll to see more.">
              {page}
            </PreviewFrame>
          </div>
          <p className={o.previewLabel}>Phone</p>
        </div>
        <div>
          <div className={o.browser}>
            <div className={o.browserBar} aria-hidden="true">
              <i style={{ background: "#FF5F57" }} />
              <i style={{ background: "#FEBC2E" }} />
              <i style={{ background: "#28C840" }} />
              <span className={o.url}>{site.address}</span>
            </div>
            <PreviewFrame width={1280} height={560} label="Desktop preview of your site. Scroll to see more.">
              {page}
            </PreviewFrame>
          </div>
          <p className={o.previewLabel}>Computer</p>
        </div>
      </div>

      <BuildEditor onSiteChanged={onSiteChanged} onChange={onChange} />

      <div className={o.card}>
        <h3 className={o.cardTitle}>Also on your site</h3>
        <ul className={o.checklist}>
          <li data-optional={approved.length === 0}>
            <span>Packages</span>
            <button type="button" className="link" onClick={onPackages}>
              {approved.length} of {site.packages.length} approved
            </button>
          </li>
          <li>
            <span>Contact and UPI</span>
            <span className={o.muted}>{site.contact.placeholder ? "Placeholders" : "Added"}</span>
          </li>
        </ul>
        <div className={o.actions}>
          <button type="button" className="btn ghost" disabled={busy} onClick={onChange}>
            Change photos, words or rooms
          </button>
          {site.live ? (
            <>
              <Link className="btn ghost" href="/rate-card">
                Rate card
              </Link>
              <Link className="btn ghost" href="/agent-deck">
                Agent deck
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <PublishPanel hotelName={site.hotel} onPublished={onSiteChanged} />
    </div>
  );
}
