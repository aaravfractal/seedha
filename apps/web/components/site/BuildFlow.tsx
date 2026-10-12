"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useApi } from "@/lib/api";
import { MAX_DESCRIPTION_CHARS, MIN_PHOTOS, roomsError, rupeesToPaise } from "@/lib/siteBuild";
import type { BuildState, GenerateResult, SitePhoto } from "@/lib/types-site-build";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { errorText, generateSite, patchBuild } from "./buildApi";
import { ConfirmGenerate, GenerateNote, allowanceText, atDailyLimit } from "./GenerateParts";
import { MicButton } from "./MicButton";
import { PhotoPicker } from "./PhotoPicker";
import { RoomsEditor, roomRows } from "./RoomsEditor";
import type { RoomRow } from "./RoomsEditor";
import b from "./build.module.css";

type Step = "photos" | "describe" | "rooms" | "generate";
const STEPS: ReadonlyArray<[Step, string]> = [
  ["photos", "Photos"],
  ["describe", "Describe"],
  ["rooms", "Rooms and prices"],
  ["generate", "Generate"],
];

function firstStep(build: BuildState): Step {
  if (build.photos.length < MIN_PHOTOS) return "photos";
  if (!build.owner_description.trim()) return "describe";
  if (build.rooms.length === 0) return "rooms";
  return "generate";
}

/**
 * Seedha Site setup: photos, the owner's words (typed or spoken), rooms and
 * prices, then one generation. Nothing is public here; Review and Publish
 * come next (docs/SITE_REAL.md section 4).
 */
export function BuildFlow({
  onReview,
  busy,
  claimFocus,
}: {
  onReview: () => void;
  busy: boolean;
  /** True once when the steps were just opened from Review or the empty screen: focus the step heading. */
  claimFocus?: () => boolean;
}) {
  const build = useApi<BuildState>("site/build");
  if (build.error && !build.data) {
    return <ErrorState message={build.error.message} code={build.error.code} onRetry={build.reload} />;
  }
  if (!build.data) return <Loading rows={3} label="Loading your site setup" />;
  return <Steps initial={build.data} onReview={onReview} busy={busy} claimFocus={claimFocus} />;
}

function Steps({
  initial,
  onReview,
  busy,
  claimFocus,
}: {
  initial: BuildState;
  onReview: () => void;
  busy: boolean;
  claimFocus?: () => boolean;
}) {
  const toast = useToast();
  const descId = useId();
  const [build, setBuild] = useState(initial);
  const [step, setStep] = useState<Step>(() => firstStep(initial));
  const [desc, setDesc] = useState(initial.owner_description);
  const [rows, setRows] = useState<RoomRow[]>(() => roomRows(initial.rooms));
  const [roomErrors, setRoomErrors] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const note = useRef<HTMLDivElement>(null);
  const writeButton = useRef<HTMLButtonElement>(null);
  const focusNote = useRef(false);

  useEffect(() => {
    // Move focus to the new step's heading (not on first load).
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  useEffect(() => {
    // Opened with a button (Build my site, Change photos): start at the heading.
    if (claimFocus?.()) heading.current?.focus();
  }, [claimFocus]);

  // While writing and after it, focus the status note (the button that started
  // it is disabled meanwhile); after an error, the button again.
  useEffect(() => {
    if (!focusNote.current) return;
    if (generating || result) note.current?.focus();
    else writeButton.current?.focus();
    if (!generating) focusNote.current = false;
  }, [generating, result]);

  const index = STEPS.findIndex(([key]) => key === step);
  const descDirty = desc.trim() !== build.owner_description;
  const savedRooms = JSON.stringify(build.rooms.map((r) => [r.name, r.price_paise]));
  const typedRooms = JSON.stringify(
    rows.map((r) => [r.name.trim().replace(/\s+/g, " "), rupeesToPaise(r.price)]),
  );
  const roomsDirty = savedRooms !== typedRooms;
  const ready = {
    photos: build.photos.length >= MIN_PHOTOS,
    describe: build.owner_description.trim().length > 0,
    rooms: build.rooms.length > 0,
  };

  function setPhotos(update: (photos: SitePhoto[]) => SitePhoto[]) {
    setBuild((current) => ({ ...current, photos: update(current.photos) }));
  }

  /** Save the step being left; false (with a message) when it cannot move on. */
  async function saveStep(forward: boolean): Promise<boolean> {
    setError("");
    if (step === "photos" && forward && !ready.photos) {
      setError(`Add at least ${MIN_PHOTOS} photos to continue.`);
      return false;
    }
    if (step === "describe" && (descDirty || forward)) {
      if (forward && !desc.trim()) {
        setError("Write or speak a few lines about your hotel to continue.");
        return false;
      }
      if (!descDirty) return true;
      return save(() => patchBuild({ owner_description: desc.trim() }));
    }
    if (step === "rooms" && (roomsDirty || forward)) {
      const err = roomsError(rows);
      if (err) {
        setRoomErrors(true);
        if (!forward) return true; // going back keeps the typed rows in memory
        setError(err);
        return false;
      }
      if (!roomsDirty) return true;
      const ok = await save(() =>
        patchBuild({
          rooms: rows.map((r) => ({ name: r.name.trim(), price_paise: rupeesToPaise(r.price) ?? 0 })),
        }),
      );
      if (ok) setRoomErrors(false);
      return ok;
    }
    return true;
  }

  async function save(work: () => Promise<BuildState>): Promise<boolean> {
    setSaving(true);
    try {
      const next = await work();
      setBuild(next);
      setDesc(next.owner_description);
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goTo(target: Step) {
    const to = STEPS.findIndex(([key]) => key === target);
    if (to === index) return;
    if (await saveStep(to > index)) setStep(target);
  }

  async function generate() {
    focusNote.current = true;
    setConfirm(false);
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const got = await generateSite();
      setBuild(got);
      setResult(got);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setGenerating(false);
    }
  }

  const canReview = build.source !== "none";
  const limitHit = atDailyLimit(build);
  const working = saving || generating || busy;

  return (
    <div className={b.flow}>
      <nav aria-label="Site setup steps">
        <ol className={b.steps}>
          {STEPS.map(([key, label], i) => (
            <li key={key}>
              <button
                type="button"
                className={b.stepBtn}
                aria-current={key === step ? "step" : undefined}
                disabled={working || (i > index + 1 && !Object.values(ready).slice(0, i).every(Boolean))}
                onClick={() => void goTo(key)}
              >
                <span className={b.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={b.stepBtn}
              disabled={working || !canReview}
              onClick={() => void saveStep(false).then((ok) => ok && onReview())}
            >
              <span className={b.stepNum} aria-hidden="true">
                5
              </span>
              Review
            </button>
          </li>
        </ol>
      </nav>

      <section className={b.panel} aria-labelledby={`${descId}-title`}>
        <h2 id={`${descId}-title`} ref={heading} tabIndex={-1} className={b.title}>
          {step === "photos"
            ? "Add 4 to 8 photos"
            : step === "describe"
              ? "Tell guests about your hotel"
              : step === "rooms"
                ? "Rooms and prices"
                : "Write my site"}
        </h2>

        {step === "photos" ? (
          <>
            <p className={b.lede}>
              Rooms, the view, food and the building. The first photo leads your site; use the arrows to
              change the order.
            </p>
            <PhotoPicker photos={build.photos} onPhotos={setPhotos} onError={toast} />
          </>
        ) : step === "describe" ? (
          <>
            <p className={b.lede}>
              What makes a stay special: the view, the food, walks nearby, how far from town. Hindi or English
              is fine. Leave prices out; they come from the next step.
            </p>
            <div className={b.field}>
              <label className={b.label} htmlFor={descId}>
                About your hotel
              </label>
              <textarea
                id={descId}
                className={b.input}
                rows={7}
                maxLength={MAX_DESCRIPTION_CHARS}
                value={desc}
                aria-describedby={`${descId}-count`}
                onChange={(e) => setDesc(e.target.value)}
              />
              <span id={`${descId}-count`} className={b.counter}>
                {desc.length} of {MAX_DESCRIPTION_CHARS} letters
              </span>
            </div>
            <MicButton
              disabled={working}
              onText={(text) =>
                setDesc((d) => `${d.trimEnd()}${d.trim() ? " " : ""}${text}`.slice(0, MAX_DESCRIPTION_CHARS))
              }
            />
          </>
        ) : step === "rooms" ? (
          <>
            <p className={b.lede}>
              Each room type with its price for one night. Your site shows exactly these prices; AI never
              writes a price.
            </p>
            <RoomsEditor rows={rows} onRows={setRows} showErrors={roomErrors} />
          </>
        ) : (
          <>
            <p className={b.lede}>
              {build.key_configured
                ? "Claude reads your photos, your words and your room names (never the prices) and writes your site in English and Hindi. You check and edit every line next."
                : "Without an AI key, this makes Sample text from your own words. Prices are never written by AI. You check and edit every line next."}
            </p>
            <ul className={b.summary} aria-label="What goes in">
              <li>
                <span>Photos</span>
                <b>{build.photos.length}</b>
              </li>
              <li>
                <span>Your words</span>
                <b>{build.owner_description.length} letters</b>
              </li>
              <li>
                <span>Room types</span>
                <b>{build.rooms.length}</b>
              </li>
            </ul>
            <p className={b.hint}>{allowanceText(build)}</p>
            <div aria-live="polite" ref={note} tabIndex={-1} className={b.liveNote}>
              {generating ? (
                <div className={b.field}>
                  <p className={b.label}>Writing your site. This can take up to a minute.</p>
                  <span className={`${b.bar} ${b.indeterminate}`} aria-hidden="true">
                    <i />
                  </span>
                </div>
              ) : result ? (
                <GenerateNote result={result} />
              ) : null}
            </div>
            <div className={b.regen}>
              <button
                ref={writeButton}
                type="button"
                className={canReview ? "btn ghost" : "btn"}
                disabled={working || limitHit || !ready.photos || !ready.describe || !ready.rooms}
                onClick={() => (canReview ? setConfirm(true) : void generate())}
              >
                {generating ? "Writing…" : canReview ? "Write it again" : "Write my site"}
              </button>
              {canReview ? (
                <button type="button" className="btn" disabled={working} onClick={onReview}>
                  Review my site
                </button>
              ) : null}
            </div>
            {limitHit ? (
              <p className={b.hint}>
                All {build.daily_limit} AI runs for today are used. Try again tomorrow.
              </p>
            ) : null}
          </>
        )}

        {error ? (
          <p className={b.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={b.nav}>
          {index > 0 ? (
            <button
              type="button"
              className="btn ghost"
              disabled={working}
              onClick={() => void goTo(STEPS[index - 1]![0])}
            >
              Back
            </button>
          ) : null}
          {step !== "generate" ? (
            <div className={b.navEnd}>
              <button
                type="button"
                className="btn"
                disabled={working}
                onClick={() => void goTo(STEPS[index + 1]![0])}
              >
                {saving ? "Saving…" : "Next"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {confirm ? (
        <ConfirmGenerate build={build} onConfirm={() => void generate()} onClose={() => setConfirm(false)} />
      ) : null}
    </div>
  );
}
