"use client";

import Link from "next/link";
import { PIPELINE_STEPS } from "@/lib/screens";

/** The 8-step loop: a progress bar, a sentence, and a tappable grid of steps. */
export function StepTracker({ done }: { done: ReadonlySet<string> }) {
  const n = PIPELINE_STEPS.filter((s) => done.has(s.key)).length;
  const total = PIPELINE_STEPS.length;
  return (
    <>
      <div
        className="progress"
        role="progressbar"
        aria-label="Steps done"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={n}
      >
        <i style={{ width: `${(n / total) * 100}%` }} />
      </div>
      <p className="calc">
        {n === total
          ? "All 8 steps done. The full loop works."
          : `${n} of ${total} steps done. Tap any step to run it.`}
      </p>
      <ol className="steps" style={{ listStyle: "none", padding: 0 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const isDone = done.has(step.key);
          return (
            <li key={step.key} style={{ display: "contents" }}>
              <Link href={step.href} className={`step${isDone ? " done" : ""}`}>
                <span className="dot" aria-hidden="true">
                  {isDone ? "✓" : i + 1}
                </span>
                <span>
                  <b>{step.title}</b>
                  <span className="d">{step.desc}</span>
                  <span className="sr-only-text">{isDone ? " (done)" : " (not done yet)"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
