"use client";

import s from "./settings.module.css";

/** An on/off switch (role=switch) with a visible label and hint. */
export function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={s.switchRow}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={s.rowText}>
        <span className={s.rowLabel}>{label}</span>
        {hint ? <span className={s.rowHint}>{hint}</span> : null}
      </span>
      <span className={s.track} aria-hidden="true">
        <span className={s.knob} />
      </span>
    </button>
  );
}
