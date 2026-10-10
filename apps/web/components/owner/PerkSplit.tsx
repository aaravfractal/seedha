"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { inr } from "@/lib/format";
import type { OwnerSavingItem } from "@/lib/types-owner";
import { Chip, SampleChip } from "./ui";
import p from "./perkSplit.module.css";

/** Owner-entered perk cost per night, in rupees. Empty resets to the sample cost. */
export function PerkCostForm({
  perNight,
  isSample,
  onChange,
}: {
  perNight: number;
  isSample: boolean;
  onChange: (rupees: number | null) => void;
}) {
  const field = useId();
  const [value, setValue] = useState(String(Math.round(perNight / 100)));
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (text === "") {
      setError("");
      onChange(null);
      return;
    }
    const rupees = Number(text);
    if (!/^\d{1,4}$/.test(text) || rupees > 5000) {
      setError("Enter whole rupees from 0 to 5,000.");
      return;
    }
    setError("");
    onChange(rupees);
  }
  return (
    <form className={p.form} onSubmit={submit} noValidate>
      <label className={p.label} htmlFor={field}>
        Your perk cost per night, in rupees {isSample ? <SampleChip /> : <Chip>Your cost</Chip>}
      </label>
      <div className={p.inputRow}>
        <input
          id={field}
          type="text"
          inputMode="numeric"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${field}-hint`}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn small ghost">
          Update split
        </button>
      </div>
      <p className={error ? p.error : p.hint} id={`${field}-hint`} role={error ? "alert" : undefined}>
        {error || "Leave it empty to use the sample cost of breakfast for two."}
      </p>
    </form>
  );
}

/** Where the commission a coded booking avoided went: perk, UPI fee, and what the hotel keeps. */
export function PerkSplit({ item, isSample }: { item: OwnerSavingItem; isSample: boolean }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const avoided = item.commission_avoided + item.gst_avoided;
  const kept = item.kept_after_perk;
  const nights = `${item.nights} night${item.nights === 1 ? "" : "s"}`;
  return (
    <div className={p.wrap}>
      <button
        type="button"
        className={p.toggle}
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide the split" : "See the split"}
      </button>
      {open ? (
        <div className={p.panel} id={panel}>
          <p className={p.lead}>
            {item.original_channel} would have taken <b className={p.num}>{inr(avoided)}</b>.
          </p>
          <dl className={p.rows}>
            <div className={p.row}>
              <dt>
                Perk given: {item.perk} ({nights}){" "}
                {isSample ? <Chip tone="sample">Sample cost</Chip> : <Chip>Your cost</Chip>}
              </dt>
              <dd className={p.num}>−{inr(item.perk_cost)}</dd>
            </div>
            <div className={p.row}>
              <dt>UPI fee</dt>
              <dd className={p.num}>{item.upi_fee ? `−${inr(item.upi_fee)}` : inr(0)}</dd>
            </div>
            <div className={`${p.row} ${p.keep}`}>
              <dt>You keep beyond the perk</dt>
              <dd className={`${p.num} ${kept < 0 ? p.loss : p.gold}`}>
                {kept < 0 ? `−${inr(-kept)}` : `+${inr(kept)}`}
              </dd>
            </div>
          </dl>
          <p className={p.note}>
            The guest paid the same public rate, {inr(item.amount)}. The perk is a thank-you on top.
          </p>
        </div>
      ) : null}
    </div>
  );
}
