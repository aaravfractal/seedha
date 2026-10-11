/** Stay invoice (POLISH_BUILD B4). Money is integer paise computed by the API. */

/** One printed line as on the PDF ("Rs" text). The HTML preview formats paise itself. */
export type InvoiceLine = { label: string; value: string };

/** GET /inbox/threads/{consent_id}/invoice */
export type StayInvoice = {
  number: string;
  filename: string;
  issued_on: string;
  sample: boolean;
  hotel_name: string;
  hotel_address: string;
  gstin: string | null;
  guest_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  room: string;
  rate_per_night: number;
  rate_is_average: boolean;
  room_charges: number;
  discount: number;
  taxable: number;
  gst_bps: number;
  cgst: number;
  sgst: number;
  total_paid: number;
  payment_method: string;
  lines: InvoiceLine[];
  gst_note: string;
  thank_you: string;
  footer: string;
};

/** GET and PATCH /settings/invoice */
export type InvoiceSettings = {
  room_gst_bps: number;
  is_default: boolean;
  default_bps: number;
  max_bps: number;
};
