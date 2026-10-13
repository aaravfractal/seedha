"use client";

import { useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import d from "./details.module.css";

type Lang = "en" | "hi";

/** A labelled one-line or multi-line text box with an inline error. */
export function TextBox({
  label,
  value,
  onChange,
  error,
  lang = "en",
  rows,
  type = "text",
  inputMode,
  placeholder,
  autoComplete = "off",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  lang?: Lang;
  rows?: number;
  type?: "text" | "tel" | "email" | "time";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const id = useId();
  const described = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ");
  const common = {
    id,
    className: `${d.input} ${lang === "hi" ? d.deva : ""}`,
    lang,
    value,
    placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": described || undefined,
  } as const;
  return (
    <div className={d.field}>
      <label className={d.label} htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className={d.hint}>
          {hint}
        </p>
      ) : null}
      {rows ? (
        // Every field is one line of plain text (the API refuses line breaks): the box
        // wraps long text, Enter adds nothing and pasted line breaks become spaces.
        <textarea
          {...common}
          rows={rows}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
        />
      ) : (
        <input
          {...common}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error ? (
        <p id={`${id}-err`} className={d.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled select from fixed choices. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className={d.field}>
      <label className={d.label} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={d.input}
        value={value}
        onChange={(e) => {
          const picked = options.find(([key]) => key === e.target.value);
          if (picked) onChange(picked[0]);
        }}
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One editor block with a heading, a count and a hint. */
export function Block({
  id,
  title,
  count,
  hint,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className={d.section} aria-labelledby={id}>
      <div className={d.sectionHead}>
        <h3 id={id} className={d.sectionTitle}>
          {title}
        </h3>
        {count ? <span className={d.count}>{count}</span> : null}
      </div>
      {hint ? <p className={d.hint}>{hint}</p> : null}
      {children}
    </section>
  );
}

/** Move up, move down and remove for one item of a list. */
export function ItemTools({
  index,
  total,
  noun,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  noun: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const n = index + 1;
  return (
    <div className={d.tools}>
      <button
        type="button"
        className={d.tool}
        disabled={index === 0}
        aria-label={`Move ${noun} ${n} up`}
        onClick={() => onMove(index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={d.tool}
        disabled={index === total - 1}
        aria-label={`Move ${noun} ${n} down`}
        onClick={() => onMove(index, index + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className={`${d.tool} ${d.remove}`}
        aria-label={`Remove ${noun} ${n}`}
        onClick={() => onRemove(index)}
      >
        Remove
      </button>
    </div>
  );
}
