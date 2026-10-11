"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import type { StatementsSummary } from "@/lib/types";
import type { Dispute, RecoverData } from "@/lib/types-owner";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Chip } from "@/components/owner/ui";
import { RecoverTotals } from "@/components/owner/Recover";
import o from "@/app/(owner)/(screens)/pro/pro.module.css";

type Line = { key: string; ref: string; detail: string; chip: string; tone: "bad" | "ok" | "plain" };

/** Flagged statement rows plus over-rate lines, as the Upload screen lists them. */
function lines(summary: StatementsSummary, disputes: Dispute[]): Line[] {
  const flagged = new Set(summary.flagged_rows.map((r) => r.id));
  const rows: Line[] = summary.flagged_rows.map((r) => ({
    key: `row-${r.id}`,
    ref: `${r.channel} #${r.external_ref}`,
    detail: r.detail,
    chip: r.review_status === "pending" ? "Check" : r.review_status === "accepted" ? "Counted" : "Kept out",
    tone: r.review_status === "pending" ? "bad" : r.review_status === "accepted" ? "ok" : "plain",
  }));
  const over: Line[] = disputes
    .filter((d) => !flagged.has(d.booking_id))
    .map((d) => ({
      key: `over-${d.booking_id}`,
      ref: `${d.channel} #${d.external_ref}`,
      detail: "Commission above your contract rate",
      chip: "Over rate",
      tone: "plain",
    }));
  return [...rows, ...over];
}

/** Pro card "audit": flagged rows and the Seedha Recover draft. Every amount comes from the API. */
export function AuditView() {
  const summary = useApi<StatementsSummary>("statements");
  const recover = useApi<RecoverData>("statements/disputes");
  const toast = useToast();

  const failed = summary.error ?? recover.error;
  if (failed) {
    return (
      <ErrorState
        message={failed.message}
        code={failed.code}
        onRetry={() => {
          summary.reload();
          recover.reload();
        }}
      />
    );
  }
  if (!summary.data || !recover.data) return <Loading rows={2} label="Loading the audit" />;

  if (summary.data.rows === 0) {
    return (
      <div className={o.view}>
        <p className={o.vText}>No statements yet. Upload them and Seedha checks every line.</p>
        <Link className={o.vLink} href="/upload">
          Upload statements
        </Link>
      </div>
    );
  }

  const list = lines(summary.data, recover.data.disputes);
  const draft = recover.data.disputes.find((d) => d.audit_claim > 0) ?? recover.data.disputes[0];

  async function copy(d: Dispute) {
    try {
      await navigator.clipboard.writeText(`${d.subject}\n\n${d.text}`);
      toast("Dispute copied. Paste it to the channel yourself.");
    } catch {
      toast("Copy did not work here. Select the text and copy it.");
    }
  }

  return (
    <div className={o.view}>
      <div className={o.split}>
        <div className={o.view}>
          <h3 className={o.vTitle}>Lines that need a look</h3>
          {list.length ? (
            <ul className={o.rows}>
              {list.map((l) => (
                <li className={o.row} key={l.key}>
                  <span>
                    <span className={o.rowRef}>{l.ref}</span>
                    <br />
                    <span className={o.rowDetail}>{l.detail}</span>
                  </span>
                  <Chip tone={l.tone}>{l.chip}</Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className={o.vText}>Every line adds up. Nothing to dispute.</p>
          )}
          <RecoverTotals data={recover.data} />
        </div>
        {draft ? (
          <div className={o.view}>
            <h3 className={o.vTitle}>Seedha Recover draft</h3>
            <p className={o.vNote}>{draft.subject}</p>
            <pre className={o.letter} tabIndex={0} aria-label={`Dispute for booking ${draft.external_ref}`}>
              {draft.text}
            </pre>
            <div className={o.vActions}>
              <button type="button" className="btn small" onClick={() => void copy(draft)}>
                Copy dispute
              </button>
            </div>
            <p className={o.vNote}>
              Filled by code from the stored line. Seedha does not send it; paste it to {draft.channel}{" "}
              yourself.
            </p>
          </div>
        ) : null}
      </div>
      <Link className={o.vLink} href="/upload#disputes">
        Open the disputes
      </Link>
    </div>
  );
}
