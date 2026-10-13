"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useApi } from "@/lib/api";
import { apiProblems, draftChanged, errorLines, fromDraft, toDraft, validateDraft } from "@/lib/siteDetails";
import type { DetailsDraft } from "@/lib/siteDetails";
import type { SiteDetailsOut } from "@/lib/types-site-v2-owner";
import type { SitePhoto } from "@/lib/types-site";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { errorText } from "../buildApi";
import { AmenitiesEditor } from "./AmenitiesEditor";
import { ContactEditor } from "./ContactEditor";
import { NearbyEditor } from "./NearbyEditor";
import { NotesEditor } from "./NotesEditor";
import { PerkEditor } from "./PerkEditor";
import { ReachEditor } from "./ReachEditor";
import { RoomsEditor } from "./RoomsEditor";
import { saveDetails } from "./detailsApi";
import o from "../owner.module.css";
import d from "./details.module.css";

/** The toast after a save. The sample hotel's hosted public page always shows its fixed sample facts. */
export function savedNote(live: boolean, sampleHotel: boolean): string {
  if (sampleHotel) return "Saved. The hosted public sample page keeps its fixed sample facts.";
  return live ? "Saved. It is on your site now." : "Saved. Only you see it until you publish.";
}

/**
 * "Hotel details" on the Website screen: rooms, amenities, nearby places, how
 * to reach, house rules, contact, map position and the card perk. One Save
 * sends the whole object (PUT /site/details). Checks here mirror the API; the
 * API's own 422 problems show in plain words next to each box.
 */
export function DetailsEditor({
  live,
  sampleHotel,
  roomTypes,
  photos,
  onSaved,
}: {
  live: boolean;
  /** The shared sample hotel: its hosted public page is locked to the sample facts. */
  sampleHotel: boolean;
  /** The room types the hotel sells, in order (the site's rooms). */
  roomTypes: readonly string[];
  /** The hotel's site photos, for the room photo picker. */
  photos: readonly SitePhoto[];
  onSaved?: () => void;
}) {
  const toast = useToast();
  const loaded = useApi<SiteDetailsOut>("site/details");
  const [saved, setSaved] = useState<SiteDetailsOut | null>(null);
  const [draft, setDraft] = useState<DetailsDraft | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [focusSummary, setFocusSummary] = useState(0);

  const base = saved ?? loaded.data;
  const baseDraft = base ? toDraft(base, roomTypes) : null;
  const photoIds = photos.map((p) => p.id);
  const shown = draft ?? baseDraft;
  const dirty = Boolean(draft && baseDraft && draftChanged(draft, baseDraft));

  useEffect(() => {
    if (focusSummary) summary.current?.focus();
  }, [focusSummary]);

  // Leaving the page with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loaded.error && !base) {
    return <ErrorState message={loaded.error.message} code={loaded.error.code} onRetry={loaded.reload} />;
  }
  if (!base || !shown) return <Loading rows={3} label="Loading your hotel details" />;

  const current: DetailsDraft = shown;
  const clientErrors = attempted ? validateDraft(current, { photoIds }) : {};
  const errors = { ...serverErrors, ...clientErrors };
  const lines = errorLines(errors);

  function edit(patch: Partial<DetailsDraft>) {
    setDraft({ ...current, ...patch });
    setServerErrors({});
    setFailure(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFailure(null);
    if (Object.keys(validateDraft(current, { photoIds })).length > 0) {
      setFocusSummary((n) => n + 1);
      return;
    }
    setSaving(true);
    try {
      const result = await saveDetails(fromDraft(current));
      if (result.ok) {
        setSaved(result.details);
        setDraft(null);
        setAttempted(false);
        setServerErrors({});
        toast(savedNote(live, sampleHotel));
        onSaved?.();
      } else {
        setServerErrors(apiProblems(result.problems));
        setFocusSummary((n) => n + 1);
      }
    } catch (err) {
      const text = errorText(err);
      setFailure(text);
      toast(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={d.form} onSubmit={(e) => void submit(e)} noValidate aria-labelledby="details-title">
      <div className={d.head}>
        <div>
          <h2 id="details-title" className={o.h2}>
            Hotel details
          </h2>
          <p className={o.sub}>
            The facts guests look for on your site: your rooms, what you have, what is nearby, how to get
            there and how to reach you.
          </p>
        </div>
        {base.sample && !dirty ? <span className="tag">Sample facts</span> : null}
      </div>

      {lines.length > 0 ? (
        <div ref={summary} tabIndex={-1} className={d.summary} role="alert">
          <p>Fix {lines.length === 1 ? "this" : `these ${lines.length}`} to save:</p>
          <ul>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <RoomsEditor
        rooms={current.rooms}
        photos={photos}
        errors={errors}
        onChange={(rooms) => edit({ rooms })}
      />
      <AmenitiesEditor
        value={current.amenities}
        error={errors.amenities}
        onChange={(amenities) => edit({ amenities })}
      />
      <NearbyEditor value={current.nearby} errors={errors} onChange={(nearby) => edit({ nearby })} />
      <ReachEditor
        value={current.how_to_reach}
        errors={errors}
        onChange={(how_to_reach) => edit({ how_to_reach })}
      />
      <NotesEditor
        notes={current.good_to_know}
        checkIn={current.check_in}
        checkOut={current.check_out}
        errors={errors}
        onNotes={(good_to_know) => edit({ good_to_know })}
        onTimes={(times) => edit(times)}
      />
      <ContactEditor
        contact={current.contact}
        lat={current.lat}
        lng={current.lng}
        errors={errors}
        onContact={(patch) => edit({ contact: { ...current.contact, ...patch } })}
        onGeo={(patch) => edit(patch)}
      />
      <PerkEditor
        en={current.card_perk_en}
        hi={current.card_perk_hi}
        errors={errors}
        onChange={(patch) => edit(patch)}
      />

      <div className={d.saveBar}>
        <span className={d.saveState} role="status">
          {saving ? "Saving" : failure ? "Not saved. " + failure : dirty ? "Not saved" : "All changes saved"}
        </span>
        <div className={d.saveActions}>
          {dirty ? (
            <button
              type="button"
              className="btn ghost small"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setAttempted(false);
                setServerErrors({});
                setFailure(null);
              }}
            >
              Undo changes
            </button>
          ) : null}
          <button type="submit" className="btn small" disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save hotel details"}
          </button>
        </div>
      </div>
    </form>
  );
}
