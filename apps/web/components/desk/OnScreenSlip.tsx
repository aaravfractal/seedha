import { inr } from "@/lib/format";
import type { Slip } from "@/lib/types";
import styles from "./Desk.module.css";

/** The slip the API sent: as data when this page asked for it, else its plain text. */
export type SlipJob = { slip: Slip | null; text: string };

/**
 * The slip on screen, black on white. Lines and amounts come from the API;
 * the structured slip is shown when the page knows it (same text the front
 * desk screen got), otherwise the slip's plain text exactly as sent.
 */
export function OnScreenSlip({ job }: { job: SlipJob }) {
  const { slip } = job;
  if (!slip) {
    return <pre className={styles.slipText}>{job.text}</pre>;
  }
  return (
    <div className={styles.slipBody}>
      <p className={styles.slipTitle}>{slip.title}</p>
      <p className={styles.slipSub}>{slip.subtitle}</p>
      <hr className={styles.slipRule} />
      <ul className={styles.slipLines}>
        {slip.lines.map((line, i) =>
          line.amount === null ? (
            <li key={i} className={styles.slipNote}>
              {line.label}
            </li>
          ) : (
            <li key={i} className={`${styles.slipLine} ${line.bold ? styles.slipBold : ""}`}>
              <span>{line.label}</span>
              <span className="num">{inr(line.amount)}</span>
            </li>
          ),
        )}
      </ul>
      {slip.footer.length ? (
        <>
          <hr className={styles.slipRule} />
          {slip.footer.map((line, i) => (
            <p key={i} className={styles.slipFoot}>
              {line}
            </p>
          ))}
        </>
      ) : null}
    </div>
  );
}
