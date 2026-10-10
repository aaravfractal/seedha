"use client";

import { type FormEvent, useState } from "react";
import { type CostInputs, parseRupees } from "@/lib/myplace";
import type { CostSource, PlaceInputs } from "@/lib/types-myplace";
import { SampleChip } from "@/components/owner/ui";
import s from "./myplace.module.css";

const COST_LABEL = "Cost per occupied night";
const FIXED_LABEL = "Fixed monthly costs";

function SourceTag({ source }: { source: CostSource }) {
  if (source === "sample") return <SampleChip />;
  if (source === "onboarding") return <span className={s.help}>From your onboarding answer</span>;
  return null;
}

/** Owner-entered costs. Whole rupees; empty uses the onboarding answer or the sample cost. */
export function CostForm({
  inputs,
  busy,
  onApply,
}: {
  inputs: PlaceInputs;
  busy: boolean;
  onApply: (next: CostInputs) => void;
}) {
  const [cost, setCost] = useState(String(Math.round(inputs.cost_per_night / 100)));
  const [fixed, setFixed] = useState(String(Math.round(inputs.fixed_monthly / 100)));
  const [errors, setErrors] = useState<{ cost?: string; fixed?: string }>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const c = parseRupees(cost, inputs.max_cost_per_night, COST_LABEL);
    const f = parseRupees(fixed, inputs.max_fixed_monthly, FIXED_LABEL);
    const next = { cost: c.error ?? undefined, fixed: f.error ?? undefined };
    setErrors(next);
    if (next.cost || next.fixed) return;
    onApply({ costPerNight: c.value, fixedMonthly: f.value });
  }

  function resetCosts() {
    setErrors({});
    setCost("");
    setFixed("");
    onApply({ costPerNight: null, fixedMonthly: null });
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <div className={s.field}>
        <label className={s.label} htmlFor="mp-cost">
          {COST_LABEL} (₹) <SourceTag source={inputs.cost_per_night_source} />
        </label>
        <input
          id="mp-cost"
          className={s.input}
          inputMode="numeric"
          autoComplete="off"
          value={cost}
          placeholder="900"
          onChange={(e) => setCost(e.target.value)}
          aria-invalid={errors.cost ? true : undefined}
          aria-describedby={errors.cost ? "mp-cost-help mp-cost-e" : "mp-cost-help"}
        />
        <p className={s.help} id="mp-cost-help">
          Housekeeping, laundry, power and breakfast for one sold room night.
        </p>
        {errors.cost ? (
          <p className={s.error} id="mp-cost-e" role="alert">
            {errors.cost}
          </p>
        ) : null}
      </div>
      <div className={s.field}>
        <label className={s.label} htmlFor="mp-fixed">
          {FIXED_LABEL} (₹) <SourceTag source={inputs.fixed_monthly_source} />
        </label>
        <input
          id="mp-fixed"
          className={s.input}
          inputMode="numeric"
          autoComplete="off"
          value={fixed}
          placeholder="450000"
          onChange={(e) => setFixed(e.target.value)}
          aria-invalid={errors.fixed ? true : undefined}
          aria-describedby={errors.fixed ? "mp-fixed-help mp-fixed-e" : "mp-fixed-help"}
        />
        <p className={s.help} id="mp-fixed-help">
          Salaries, rent or loan EMI, maintenance. Split evenly across the rooms.
        </p>
        {errors.fixed ? (
          <p className={s.error} id="mp-fixed-e" role="alert">
            {errors.fixed}
          </p>
        ) : null}
      </div>
      <div className={s.formActions}>
        <button type="submit" className="btn small" disabled={busy}>
          Update the map
        </button>
        <button type="button" className="btn small ghost" disabled={busy} onClick={resetCosts}>
          Reset costs
        </button>
      </div>
      <p className={s.help}>Only used for this view. Nothing is saved.</p>
    </form>
  );
}
