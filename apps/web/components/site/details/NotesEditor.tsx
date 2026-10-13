"use client";

import { moveItem } from "@/lib/siteBuild";
import { DETAIL_LIMITS } from "@/lib/siteDetails";
import type { Note } from "@/lib/types-site-v2-owner";
import { Block, ItemTools, TextBox } from "./fields";
import d from "./details.module.css";

/** Check-in and check-out times and up to 8 house rules (the API's "good_to_know" lines). */
export function NotesEditor({
  notes,
  checkIn,
  checkOut,
  errors,
  onNotes,
  onTimes,
}: {
  notes: Note[];
  checkIn: string;
  checkOut: string;
  errors: Record<string, string>;
  onNotes: (next: Note[]) => void;
  onTimes: (patch: { check_in?: string; check_out?: string }) => void;
}) {
  const max = DETAIL_LIMITS.notes;
  function set(i: number, patch: Partial<Note>) {
    onNotes(notes.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  }
  return (
    <Block
      id="details-notes"
      title="House rules"
      count={`${notes.length} of ${max}`}
      hint="Times and the rules and small things guests should know before they come."
    >
      <div className={d.pair}>
        <TextBox
          label="Check-in time"
          type="time"
          value={checkIn}
          error={errors.check_in}
          onChange={(v) => onTimes({ check_in: v })}
        />
        <TextBox
          label="Check-out time"
          type="time"
          value={checkOut}
          error={errors.check_out}
          onChange={(v) => onTimes({ check_out: v })}
        />
      </div>
      <ol className={d.items}>
        {notes.map((n, i) => (
          <li key={i} className={d.item}>
            <div className={d.itemHead}>
              <h4 className={d.itemTitle}>Rule {i + 1}</h4>
              <ItemTools
                index={i}
                total={notes.length}
                noun="rule"
                onMove={(from, to) => onNotes(moveItem(notes, from, to))}
                onRemove={(at) => onNotes(notes.filter((_, j) => j !== at))}
              />
            </div>
            <div className={d.pair}>
              <TextBox
                label="In English"
                value={n.text_en}
                rows={2}
                error={errors[`good_to_know.${i}.text_en`]}
                onChange={(v) => set(i, { text_en: v })}
              />
              <TextBox
                label="In Hindi (optional)"
                value={n.text_hi}
                rows={2}
                lang="hi"
                error={errors[`good_to_know.${i}.text_hi`]}
                onChange={(v) => set(i, { text_hi: v })}
              />
            </div>
          </li>
        ))}
      </ol>
      <div>
        <button
          type="button"
          className="btn ghost small"
          disabled={notes.length >= max}
          onClick={() => onNotes([...notes, { text_en: "", text_hi: "" }])}
        >
          {notes.length >= max ? `${max} rules added` : "Add a rule"}
        </button>
      </div>
      {errors.good_to_know ? <p className={d.error}>{errors.good_to_know}</p> : null}
    </Block>
  );
}
