/** Shapes returned by the Seedha API. Money is always integer paise. */

export type PropertyInfo = {
  name: string;
  short_name: string;
  city: string;
  address: string;
  rooms_count: number;
  owner_name: string;
  is_sample: boolean;
};

export type PipelineStatus = {
  steps: { key: string; done: boolean }[];
  done_count: number;
};

export type StatementFile = {
  id: number;
  filename: string;
  file_type: string;
  parse_method: string;
  row_count: number;
  flagged_count: number;
  is_sample: boolean;
  uploaded_at: string;
};

export type FlaggedRow = {
  id: number;
  channel: string;
  external_ref: string;
  reason: string;
  detail: string;
  review_status: "pending" | "accepted" | "excluded" | "none";
};

export type StatementsSummary = {
  files: StatementFile[];
  rows: number;
  flagged: number;
  pending_review: number;
  flagged_rows: FlaggedRow[];
};

export type IngestOutcome = {
  filename: string;
  status: "imported" | "already_imported";
  file_id: number | null;
  layout: string | null;
  method: string | null;
  rows: number;
  flagged: number;
  duplicates: number;
  message: string;
  flagged_refs: string[];
};

export type SampleFile = { index: number; filename: string };

export type LedgerChannel = {
  key: string;
  name: string;
  kind: string;
  room_nights: number;
  stays: number;
  list_revenue: number;
  discount: number;
  commission: number;
  gst_on_commission: number;
  fees: number;
  net_kept: number;
  paid_to_channels: number;
  lost_vs_list_price: number;
  list_adr: number | null;
  net_adr: number | null;
  kept_share_tenths: number | null;
};

export type Ledger = {
  start: string;
  end: string;
  days: number;
  rooms_count: number;
  counted_rows: number;
  excluded_rows: number;
  channels: LedgerChannel[];
  totals: {
    room_nights: number;
    list_revenue: number;
    discount: number;
    commission: number;
    gst_on_commission: number;
    fees: number;
    net_kept: number;
    paid_to_channels: number;
    lost_vs_list_price: number;
  };
  paid_to_channels_share_tenths: number | null;
  direct_bookings_tenths: number | null;
  commission_free_share_tenths: number | null;
  revpar_list: number;
  revpar_net: number;
  rank_by_bookings: string[];
  rank_by_money_kept: string[];
  insight: { en: string; hi: string; channel: string; rank_by_money_kept: number; move_en: string } | null;
};
