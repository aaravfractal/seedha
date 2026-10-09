import type { ReactNode } from "react";
import { KeyPoints } from "./KeyPoints";

export const LAST_UPDATED = "9 October 2026";

/** Shared frame for legal and static pages: notice, date, key points, body. */
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
    <article className="view legal">
      {legal ? (
        <p className="notice" role="note">
          Draft for the hackathon prototype. Not legal advice. To be reviewed by a lawyer before launch.
        </p>
      ) : null}
      <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
        {title}
      </h1>
      {lede ? <p className="lede">{lede}</p> : null}
      <p className="calc">Last updated {LAST_UPDATED}</p>
      {points ? <KeyPoints points={points} /> : null}
      {children}
    </article>
  );
}
