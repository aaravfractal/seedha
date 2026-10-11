"use client";

import { useSearchParams } from "next/navigation";

const PLANS = new Set(["Base", "Pro", "Max"]);

/** When a visitor arrives from a plan card (/contact?plan=Pro), name the plan they picked. */
export function PlanNote() {
  const plan = useSearchParams().get("plan");
  const chosen = plan && PLANS.has(plan) ? plan : null;
  if (!chosen) return null;
  return (
    <div className="card" role="status" style={{ marginBottom: 16 }}>
      <h2 className="sub-title">You picked Seedha {chosen}</h2>
      <p className="sub" style={{ margin: "6px 0 0" }}>
        Once contact details are published, send your hotel&apos;s name, town and number of rooms and we will
        set up {chosen} with you. During the prototype nothing is charged.
      </p>
    </div>
  );
}
