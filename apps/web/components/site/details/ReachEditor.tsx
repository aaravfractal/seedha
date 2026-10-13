"use client";

import { moveItem } from "@/lib/siteBuild";
import { DETAIL_LIMITS, REACH_MODES } from "@/lib/siteDetails";
import type { ReachItem } from "@/lib/types-site-v2-owner";
import { Block, Choice, ItemTools, TextBox } from "./fields";
import d from "./details.module.css";

/** Up to 6 ways to reach the hotel by road, rail or air, in English and Hindi. */
export function ReachEditor({
  value,
  errors,
  onChange,
}: {
  value: ReachItem[];
  errors: Record<string, string>;
  onChange: (next: ReachItem[]) => void;
}) {
  const max = DETAIL_LIMITS.reach;
  function set(i: number, patch: Partial<ReachItem>) {
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  return (
    <Block
      id="details-reach"
      title="How to reach"
      count={`${value.length} of ${max}`}
      hint="Nearest road, station and airport, in a line each."
    >
      {value.length === 0 ? <p className={d.hint}>Nothing added yet.</p> : null}
      <ol className={d.items}>
        {value.map((r, i) => (
          <li key={i} className={d.item}>
            <div className={d.itemHead}>
              <h4 className={d.itemTitle}>Way {i + 1}</h4>
              <ItemTools
                index={i}
                total={value.length}
                noun="way to reach"
                onMove={(from, to) => onChange(moveItem(value, from, to))}
                onRemove={(at) => onChange(value.filter((_, j) => j !== at))}
              />
            </div>
            <Choice label="By" value={r.mode} options={REACH_MODES} onChange={(v) => set(i, { mode: v })} />
            <div className={d.pair}>
              <TextBox
                label="In English"
                value={r.text_en}
                rows={2}
                error={errors[`how_to_reach.${i}.text_en`]}
                onChange={(v) => set(i, { text_en: v })}
              />
              <TextBox
                label="In Hindi (optional)"
                value={r.text_hi}
                rows={2}
                lang="hi"
                error={errors[`how_to_reach.${i}.text_hi`]}
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
          disabled={value.length >= max}
          onClick={() => onChange([...value, { mode: "road", text_en: "", text_hi: "" }])}
        >
          {value.length >= max ? `${max} ways added` : "Add a way to reach"}
        </button>
      </div>
      {errors.how_to_reach ? <p className={d.error}>{errors.how_to_reach}</p> : null}
    </Block>
  );
}
