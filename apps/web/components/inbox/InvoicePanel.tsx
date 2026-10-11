"use client";

import { useApi } from "@/lib/api";
import { amountRows, invoiceDate, invoicePdfPath } from "@/lib/invoice";
import type { StayInvoice } from "@/lib/types-invoice";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { SampleChip } from "@/components/owner/ui";
import styles from "./InvoicePanel.module.css";

export type InvoicePanelProps = {
  /** The inbox thread (an active Desk consent of this hotel). */
  consentId: number;
  /** Called with the invoice number when the owner taps "Attach to reply". Omit to hide the button. */
  onAttach?: (invoiceNumber: string) => void;
  /** True once this invoice is attached to the draft (the button then reads "Attached"). */
  attached?: boolean;
};

/**
 * Stay invoice preview for the guest's latest finished stay. Every amount is
 * computed by the API from the booking row; this panel only formats paise.
 * The PDF downloads from the same origin; attaching is done by code, never
 * by the AI text.
 */
export function InvoicePanel({ consentId, onAttach, attached = false }: InvoicePanelProps) {
  const invoice = useApi<StayInvoice>(`inbox/threads/${consentId}/invoice`);

  if (invoice.error && !invoice.data) {
    if (invoice.error.status === 404) {
      return (
        <EmptyState title="No invoice yet">
          {invoice.error.code === "no_completed_stay"
            ? "This guest has no finished stay to invoice."
            : "This guest is not in your inbox."}
        </EmptyState>
      );
    }
    return <ErrorState message={invoice.error.message} code={invoice.error.code} onRetry={invoice.reload} />;
  }
  const inv = invoice.data;
  if (!inv) return <Loading rows={3} label="Preparing the stay invoice" />;

  const rows = amountRows(inv);
  return (
    <section className={styles.panel} aria-label={`Stay invoice ${inv.number}`}>
      <div className={styles.head}>
        <div className={styles.hotel}>
          <h3 className={styles.hotelName}>{inv.hotel_name}</h3>
          <p className={styles.muted}>{inv.hotel_address}</p>
          {inv.gstin ? <p className={styles.muted}>GSTIN {inv.gstin}</p> : null}
        </div>
        <div className={styles.meta}>
          {inv.sample ? (
            <span>
              <SampleChip />
            </span>
          ) : null}
          <span>Stay invoice</span>
          <span className={styles.number}>{inv.number}</span>
          <span>{invoiceDate(inv.issued_on)}</span>
        </div>
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Guest</dt>
          <dd>{inv.guest_name}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Stay</dt>
          <dd>
            {invoiceDate(inv.check_in)} to {invoiceDate(inv.check_out)}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Room</dt>
          <dd>{inv.room}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Payment</dt>
          <dd>{inv.payment_method}</dd>
        </div>
      </dl>

      <table className={styles.amounts}>
        <caption className="sr-only-text">Amounts on this invoice</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.strong ? styles.total : undefined}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.notes}>
        <p className={styles.footer}>{inv.gst_note}</p>
        <p className={styles.thanks}>{inv.thank_you}</p>
        <p className={styles.footer}>{inv.footer}</p>
      </div>

      <div className={styles.actions}>
        <a className="btn ghost" href={invoicePdfPath(consentId)} download={inv.filename}>
          Download PDF
        </a>
        {onAttach ? (
          <button
            type="button"
            className="btn"
            disabled={attached}
            aria-pressed={attached}
            onClick={() => onAttach(inv.number)}
          >
            {attached ? "Attached" : "Attach to reply"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
