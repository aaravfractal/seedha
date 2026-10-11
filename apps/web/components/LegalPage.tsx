import type { ReactNode } from "react";
import { KeyPoints } from "./KeyPoints";
import { CONTACT_PENDING, publicEmail, type ContactKind } from "@/lib/contact";
import styles from "./website/site.module.css";

export const LAST_UPDATED = "11 October 2026";

/**
 * A public role address from server config (lib/contact.ts), or the pending
 * line when it is not set. Server component: the value never reaches client code.
 */
export function ContactEmail({ kind, lead }: { kind: ContactKind; lead?: string }) {
  const email = publicEmail(kind);
  // Unset: the pending sentence stands alone, never after "Email:" or a lead-in.
  if (!email) return <span>{CONTACT_PENDING}</span>;
  const link = (
    <a className="link" href={`mailto:${email}`}>
      {email}
    </a>
  );
  if (!lead) return link;
  return (
    <span>
      {lead} {link}.
    </span>
  );
}

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
