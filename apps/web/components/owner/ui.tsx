"use client";

import type { ReactNode } from "react";
import s from "./owner.module.css";

export { s as ui };

/** One owner screen: enter fade and 12px rise, a large title and a sub line. */
export function Screen({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.screen}>
      <header className={s.head}>
        <h1 className={s.title}>{title}</h1>
        {sub ? <p className={s.sub}>{sub}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** The line every rupee total carries. */
export function CalcNote({ children }: { children?: ReactNode }) {
  return (
    <p className={s.calc}>
      <span className={s.calcLead}>Calculated from your statements.</span>
      {children ? <> {children}</> : null}
    </p>
  );
}

type ChipTone = "plain" | "ok" | "bad" | "sample";

/** A pill that never wraps. */
export function Chip({
  tone = "plain",
  dot = false,
  className,
  children,
}: {
  tone?: ChipTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const toneClass = tone === "plain" ? "" : s[tone];
  return (
    <span className={[s.chip, toneClass, className].filter(Boolean).join(" ")}>
      {dot ? <i className={s.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Visible label on every sample figure (D10, rule 11). */
export function SampleChip() {
  return <Chip tone="sample">Sample</Chip>;
}

export type SegOption<T extends string> = { value: T; label: string };

/**
 * Segmented control: a white pill slides under the chosen option (300ms).
 * `markerClass` keeps older selectors (".toggle") working for tests.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  markerClass,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  markerClass?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div className={s.segWrap}>
      <div className={[s.seg, markerClass].filter(Boolean).join(" ")} role="group" aria-label={label}>
        <span
          className={s.pill}
          aria-hidden="true"
          style={{
            width: `calc((100% - 6px) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={s.segBtn}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
