/** Display helpers for the stay invoice preview. Every amount comes from the API in paise. */
import { inr } from "./format.ts";
import type { StayInvoice } from "./types-invoice.ts";

export type InvoiceRow = { key: string; label: string; value: string; strong?: boolean };

/** Basis points as a percent label: 500 -> "5%", 250 -> "2.5%". */
export function bpsLabel(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const rest = Math.abs(bps % 100);
  if (rest === 0) return `${whole}%`;
  return `${whole}.${String(rest).padStart(2, "0").replace(/0+$/, "")}%`;
}

/** CGST and SGST each carry half of the GST rate. */
export function halfRateLabel(gstBps: number): string {
  return bpsLabel(gstBps / 2);
}

/** "2026-09-20" -> "20 Sep 2026" (calendar dates, no time zone shift). */
export function invoiceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d ?? ""} ${months[(m ?? 1) - 1] ?? ""} ${y ?? ""}`;
}

/**
 * The money rows of the preview, in the PDF's order, formatted at the edge.
 * Without a GSTIN the tax split is not printed, only the total paid.
 */
export function amountRows(inv: StayInvoice): InvoiceRow[] {
  const half = halfRateLabel(inv.gst_bps);
  const tax: InvoiceRow[] = inv.gstin
    ? [
        { key: "taxable", label: "Taxable value", value: inr(inv.taxable) },
        { key: "cgst", label: `CGST at ${half}`, value: inr(inv.cgst) },
        { key: "sgst", label: `SGST at ${half}`, value: inr(inv.sgst) },
      ]
    : [];
  return [
    {
      key: "rate",
      label: inv.rate_is_average ? "Average rate per night" : "Rate per night",
      value: inr(inv.rate_per_night),
    },
    {
      key: "charges",
      label: `Room charges, ${inv.nights} ${inv.nights === 1 ? "night" : "nights"}`,
      value: inr(inv.room_charges),
    },
    { key: "discount", label: "Discount", value: inv.discount ? inr(-inv.discount) : inr(0) },
    ...tax,
    { key: "total", label: "Total paid", value: inr(inv.total_paid), strong: true },
  ];
}

/** Same-origin PDF download path through the web BFF. */
export function invoicePdfPath(consentId: number): string {
  return `/api/inbox/threads/${encodeURIComponent(String(consentId))}/invoice.pdf`;
}
