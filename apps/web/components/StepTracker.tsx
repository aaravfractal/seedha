"use client";

import Link from "next/link";
import { PIPELINE_STEPS } from "@/lib/screens";
import { Icon } from "./shell/Icons";
import styles from "./StepTracker.module.css";

/**
 * "Set up the direct loop": progress, "N of 8 done" and a two-column
 * checklist of the 8 steps, each linking to its screen. `done` comes from
 * real state (GET /overview, which reads the pipeline).
 */
export function StepTracker({ done }: { done: ReadonlySet<string> }) {
  const n = PIPELINE_STEPS.filter((s) => done.has(s.key)).length;
  const total = PIPELINE_STEPS.length;
  return (
    <section className={styles.card} aria-labelledby="loop-title">
      <div className={styles.head}>
        <h2 id="loop-title">Set up the direct loop</h2>
        <span className={styles.count}>
          {n} of {total} done
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Direct loop steps done"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={n}
      >
        <i style={{ width: `${(n / total) * 100}%` }} />
      </div>
      <ol className={styles.grid}>
        {PIPELINE_STEPS.map((step, i) => {
          const isDone = done.has(step.key);
          return (
            <li key={step.key}>
              <Link href={step.href} className={styles.row}>
                <span className={isDone ? styles.done : styles.todo} aria-hidden="true">
                  {isDone ? <Icon name="check" size={16} /> : i + 1}
                </span>
                <span className={styles.title}>
                  {step.title}
                  <span className="sr-only-text">{isDone ? ", done" : ", not done yet"}</span>
                </span>
                <span className={styles.chev} aria-hidden="true">
                  <Icon name="chevron" />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
