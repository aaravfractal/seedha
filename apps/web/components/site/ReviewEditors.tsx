"use client";

import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { inr } from "@/lib/format";
import { LIMITS, captionError, pointError } from "@/lib/siteBuild";
import type { BuildContent, BuildPatch, BuildState, SitePhoto } from "@/lib/types-site-build";
import { PhotoGrid } from "./PhotoPicker";
import b from "./build.module.css";

type Save = (patch: BuildPatch) => Promise<boolean>;
type Lang = "en" | "hi";
const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hindi" };

/** A labelled text box with a live letter count and an inline error. */
function TextField({
  label,
  value,
  onChange,
  max,
  lang,
  rows,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  lang: Lang;
  rows?: number;
  error?: string | null;
}) {
  const id = useId();
  const over = value.length > max;
  const describedBy = `${id}-count${error ? ` ${id}-err` : ""}`;
  const common = {
    id,
    className: `${b.input} ${lang === "hi" ? b.deva : ""}`,
    lang,
    value,
    "aria-invalid": over || error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
  return (
    <div className={b.field}>
      <label className={b.label} htmlFor={id}>
        {label}
      </label>
      {rows ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type="text" onChange={(e) => onChange(e.target.value)} />
      )}
      <span id={`${id}-count`} className={b.counter} data-over={over}>
        {value.length} of {max} letters
      </span>
      {error ? (
        <p id={`${id}-err`} className={b.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One editable block of the review page with its own Save. */
function Section({
  title,
  hint,
  dirty,
  invalid,
  onSave,
  children,
}: {
  title: string;
  hint?: string;
  dirty: boolean;
  invalid: boolean;
  onSave: () => Promise<boolean>;
  children: ReactNode;
}) {
  const id = useId();
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave();
    setSaving(false);
  }
  return (
    <form className={b.section} aria-labelledby={id} onSubmit={(e) => void submit(e)} noValidate>
      <div className={b.sectionHead}>
        <h3 id={id} className={b.sectionTitle}>
          {title}
        </h3>
        {dirty ? <span className="tag">Not saved</span> : null}
      </div>
      {hint ? <p className={b.hint}>{hint}</p> : null}
      {children}
      <div>
        <button
          type="submit"
          className="btn small"
          disabled={!dirty || invalid || saving}
          aria-label={saving ? undefined : `Save ${title}`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

type TextKey = "description" | "google_description";

/** Description or Google description, English and Hindi side by side. */
export function TextPairEditor({
  build,
  field,
  title,
  hint,
  max,
  rows,
  onSave,
}: {
  build: BuildState;
  field: TextKey;
  title: string;
  hint?: string;
  max: number;
  rows: number;
  onSave: Save;
}) {
  const en = `${field}_en` as const;
  const hi = `${field}_hi` as const;
  const [draft, setDraft] = useState({ en: build.content[en], hi: build.content[hi] });
  const dirty = draft.en !== build.content[en] || draft.hi !== build.content[hi];
  const invalid = draft.en.length > max || draft.hi.length > max;
  return (
    <Section
      title={title}
      hint={hint}
      dirty={dirty}
      invalid={invalid}
      onSave={() => onSave({ content: { [en]: draft.en, [hi]: draft.hi } as Partial<BuildContent> })}
    >
      <div className={b.pair}>
        {(["en", "hi"] as const).map((lang) => (
          <TextField
            key={lang}
            label={LANG_NAME[lang]}
            lang={lang}
            rows={rows}
            max={max}
            value={draft[lang]}
            onChange={(value) => setDraft({ ...draft, [lang]: value })}
          />
        ))}
      </div>
    </Section>
  );
}

/** The three "why book direct" points in each language. */
export function PointsEditor({ build, onSave }: { build: BuildState; onSave: Save }) {
  const [draft, setDraft] = useState({
    en: build.content.why_book_direct_en,
    hi: build.content.why_book_direct_hi,
  });
  const same = (a: string[], c: string[]) => a.length === c.length && a.every((x, i) => x === c[i]);
  const dirty =
    !same(draft.en, build.content.why_book_direct_en) || !same(draft.hi, build.content.why_book_direct_hi);
  const invalid = [...draft.en, ...draft.hi].some((p) => pointError(p) !== null);
  const set = (lang: Lang, i: number, value: string) =>
    setDraft({ ...draft, [lang]: draft[lang].map((p, j) => (j === i ? value : p)) });
  return (
    <Section
      title="Why book direct"
      hint="Three short points in each language. Perks, never a lower price."
      dirty={dirty}
      invalid={invalid}
      onSave={() => {
        const clean = { en: draft.en.map((p) => p.trim()), hi: draft.hi.map((p) => p.trim()) };
        setDraft(clean);
        return onSave({ content: { why_book_direct_en: clean.en, why_book_direct_hi: clean.hi } });
      }}
    >
      <div className={b.pair}>
        {(["en", "hi"] as const).map((lang) => (
          <ol key={lang} className={b.points} aria-label={`Points in ${LANG_NAME[lang]}`}>
            {draft[lang].map((point, i) => (
              <li key={i}>
                <TextField
                  label={`${LANG_NAME[lang]} point ${i + 1}`}
                  lang={lang}
                  max={LIMITS.point}
                  value={point}
                  error={dirty ? pointError(point) : null}
                  onChange={(value) => set(lang, i, value)}
                />
              </li>
            ))}
          </ol>
        ))}
      </div>
    </Section>
  );
}

/** A short line for each room. Name and price are the owner's own and shown read-only here. */
export function RoomBlurbsEditor({ build, onSave }: { build: BuildState; onSave: Save }) {
  const [draft, setDraft] = useState(() => build.rooms.map((r) => ({ en: r.blurb_en, hi: r.blurb_hi })));
  const dirty = build.rooms.some((r, i) => draft[i]?.en !== r.blurb_en || draft[i]?.hi !== r.blurb_hi);
  const invalid = draft.some((d) => d.en.length > LIMITS.blurb || d.hi.length > LIMITS.blurb);
  if (build.rooms.length === 0) return null;
  return (
    <Section
      title="Rooms"
      hint="Prices are exactly what you typed. To change a name or price, go back to setup."
      dirty={dirty}
      invalid={invalid}
      onSave={() =>
        onSave({
          rooms: build.rooms.map((r, i) => ({
            name: r.name,
            price_paise: r.price_paise,
            blurb_en: draft[i]?.en ?? r.blurb_en,
            blurb_hi: draft[i]?.hi ?? r.blurb_hi,
          })),
        })
      }
    >
      {build.rooms.map((room, i) => (
        <div key={room.name} className={b.field}>
          <p className={b.label}>
            {room.name} · {inr(room.price_paise)} a night
          </p>
          <div className={b.pair}>
            {(["en", "hi"] as const).map((lang) => (
              <TextField
                key={lang}
                label={`${room.name}, ${LANG_NAME[lang]}`}
                lang={lang}
                rows={3}
                max={LIMITS.blurb}
                value={draft[i]?.[lang] ?? ""}
                onChange={(value) => setDraft(draft.map((d, j) => (j === i ? { ...d, [lang]: value } : d)))}
              />
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

/** Photo order (saved at once) and captions of 8 words at most (saved with Save). */
export function PhotosEditor({
  build,
  onPhotos,
  onSave,
  onError,
}: {
  build: BuildState;
  onPhotos: (photos: SitePhoto[]) => void;
  onSave: Save;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Record<number, { en: string; hi: string }>>(() =>
    Object.fromEntries(build.photos.map((p) => [p.id, { en: p.caption_en, hi: p.caption_hi }])),
  );
  const text = (p: SitePhoto) => draft[p.id] ?? { en: p.caption_en, hi: p.caption_hi };
  const changed = build.photos.filter((p) => text(p).en !== p.caption_en || text(p).hi !== p.caption_hi);
  const invalid = build.photos.some((p) => captionError(text(p).en) || captionError(text(p).hi));
  if (build.photos.length === 0) return null;
  return (
    <Section
      title="Photos and captions"
      hint="The arrows change the order at once. Captions are 8 words at most."
      dirty={changed.length > 0}
      invalid={invalid}
      onSave={() => {
        // The API collapses spaces in captions; do the same so the saved text matches the boxes.
        const tidy = (t: string) => t.trim().replace(/\s+/g, " ");
        const clean = changed.map((p) => ({
          photo_id: p.id,
          caption_en: tidy(text(p).en),
          caption_hi: tidy(text(p).hi),
        }));
        setDraft({
          ...draft,
          ...Object.fromEntries(clean.map((c) => [c.photo_id, { en: c.caption_en, hi: c.caption_hi }])),
        });
        return onSave({ captions: clean });
      }}
    >
      <PhotoGrid
        photos={build.photos}
        onPhotos={onPhotos}
        onError={onError}
        allowRemove={false}
        wide
        extra={(photo, i) =>
          (["en", "hi"] as const).map((lang) => (
            <TextField
              key={lang}
              label={`Photo ${i + 1} caption, ${LANG_NAME[lang]}`}
              lang={lang}
              max={LIMITS.captionChars}
              value={text(photo)[lang]}
              error={captionError(text(photo)[lang])}
              onChange={(value) => setDraft({ ...draft, [photo.id]: { ...text(photo), [lang]: value } })}
            />
          ))
        }
      />
    </Section>
  );
}
