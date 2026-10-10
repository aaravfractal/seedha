import type { ReactNode } from "react";
import { KeyPoints } from "./KeyPoints";
import styles from "./website/site.module.css";

export const LAST_UPDATED = "9 October 2026";

/** Shared frame for legal and static pages on the website: notice, date, key points, body. */
export function LegalPage({
  title,
  lede,
  legal = true,
  points,
  children,
}: {
  title: string;
  lede?: string;
  legal?: boolean;
  points?: { en: string[]; hi: string[] };
  children: ReactNode;
}) {
  return (
    <article className={`legal ${styles.legal}`}>
      {legal ? (
        <p className={styles.legalNotice} role="note">
          Draft for the hackathon prototype. Not legal advice. To be reviewed by a lawyer before launch.
        </p>
      ) : null}
      <h1>{title}</h1>
      {lede ? <p className={styles.legalLede}>{lede}</p> : null}
      <p className={styles.legalDate}>Last updated {LAST_UPDATED}</p>
      {points ? <KeyPoints points={points} /> : null}
      {children}
    </article>
  );
}
