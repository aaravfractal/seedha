"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { SUGGESTED_GOALS, parseGoal, readiness } from "@/lib/readiness";
import type { ReadinessGoals, ReadinessInputs } from "@/lib/readiness";
import { Chip } from "./ui";
import r from "./readiness.module.css";

const STORE = "seedha.readinessGoals";
const HREF = { direct: "/flip", free: "/flip", coded: "/savings" } as const;

/** Goals live in this browser only: a per-viewer convenience, never shared state. */
function loadGoals(): ReadinessGoals | null {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return null;
    const g = JSON.parse(raw) as Partial<ReadinessGoals>;
    const ok = [g.directTenths, g.freeTenths, g.codedBookings].every((n) => typeof n === "number" && n > 0);
    return ok ? (g as ReadinessGoals) : null;
  } catch {
    return null;
  }
}

function saveGoals(goals: ReadinessGoals | null) {
  try {
    if (goals) window.localStorage.setItem(STORE, JSON.stringify(goals));
    else window.localStorage.removeItem(STORE);
  } catch {
    /* storage blocked: the goals last for this visit only */
  }
}

/** "Direct readiness": three parts with their formulas first, the total second. No rupees. */
export function ReadinessCard({ inputs }: { inputs: ReadinessInputs }) {
  const [own, setOwn] = useState<ReadinessGoals | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const ids = useId();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after hydration
    setOwn(loadGoals());
  }, []);
  const goals = own ?? SUGGESTED_GOALS;
  const result = readiness(inputs, goals);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const direct = parseGoal(String(form.get("direct") ?? ""), "percent");
    const free = parseGoal(String(form.get("free") ?? ""), "percent");
    const coded = parseGoal(String(form.get("coded") ?? ""), "count");
    if (direct === null || free === null || coded === null) {
      setError("Use a percent from 0.1 to 100 and a whole number of bookings.");
      return;
    }
    const next = { directTenths: direct, freeTenths: free, codedBookings: coded };
    setOwn(next);
    saveGoals(next);
    setError("");
    setEditing(false);
  }

  function useSuggested() {
    setOwn(null);
    saveGoals(null);
    setError("");
    setEditing(false);
  }

  return (
    <section className={r.card} aria-labelledby={`${ids}-title`}>
      <div className={r.top}>
        <div>
          <h2 id={`${ids}-title`} className={r.title}>
            Direct readiness
          </h2>
          <p className={r.sub}>Each part is your figure against a goal you set. Past data, no forecast.</p>
        </div>
        {own ? <Chip>Your goals</Chip> : <Chip tone="sample">Suggested goals</Chip>}
      </div>
      <ol className={r.parts}>
        {result.parts.map((p) => (
          <li key={p.key} className={r.part}>
            <div className={r.partHead}>
              <Link href={HREF[p.key]} className={r.partLabel}>
                {p.label}
              </Link>
              <span className={r.partScore}>{p.score} of 100</span>
            </div>
            <span className={r.track} aria-hidden="true">
              <i className={r.fill} style={{ width: `${p.score}%` }} />
            </span>
            <p className={r.formula}>{p.formula}</p>
          </li>
        ))}
      </ol>
      <p className={r.total}>
        Readiness <b>{result.total}</b> of 100, the mean of the three parts.
      </p>
      {editing ? (
        <form className={r.form} onSubmit={submit} noValidate>
          <label className={r.field}>
            Direct bookings goal, %
            <input type="text" inputMode="decimal" name="direct" defaultValue={goals.directTenths / 10} />
          </label>
          <label className={r.field}>
            Commission-free share goal, %
            <input type="text" inputMode="decimal" name="free" defaultValue={goals.freeTenths / 10} />
          </label>
          <label className={r.field}>
            Coded direct bookings goal
            <input type="text" inputMode="numeric" name="coded" defaultValue={goals.codedBookings} />
          </label>
          {error ? (
            <p className={r.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={r.actions}>
            <button type="submit" className="btn small">
              Save goals
            </button>
            <button type="button" className="btn small ghost" onClick={useSuggested}>
              Use suggested goals
            </button>
          </div>
        </form>
      ) : (
        <div className={r.actions}>
          <button type="button" className="btn small ghost" onClick={() => setEditing(true)}>
            Set your goals
          </button>
        </div>
      )}
    </section>
  );
}
