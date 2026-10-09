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

export type RepeatStay = { channel: string; check_in: string; guest_name: string; city: string | null };

export type RepeatMatch = {
  id: number;
  guest_name: string;
  city: string | null;
  first: RepeatStay;
  returned: RepeatStay;
  confidence: number;
  status: "suggested" | "confirmed";
  llm_opinion: string | null;
  paid_twice: number;
  not_new_demand: boolean;
};

export type Repeats = { count: number; confirmed: number; paid_twice_total: number; matches: RepeatMatch[] };

export type SaturdayMove = {
  available: boolean;
  reason: string | null;
  rooms: number;
  max_rooms: number;
  channel_key: string | null;
  channel_name: string | null;
  channel_net_adr: number | null;
  direct_net_adr: number | null;
  extra_per_room: number | null;
  extra_per_saturday: number | null;
  decision: "accepted" | "later" | null;
  decided_at: string | null;
};

export type DeskGuest = {
  booking_id: number;
  name: string;
  short_name: string;
  room: number | null;
  channel: string;
  consent: boolean;
  checked_out: boolean;
  perk_code: string | null;
};

export type DeskState = {
  business_date: string;
  device: { registered: boolean; name: string | null; online: boolean; last_seen: string | null };
  guests: DeskGuest[];
};

export type SlipLine = { label: string; amount: number | null; bold: boolean };
export type Slip = { title: string; subtitle: string; lines: SlipLine[]; footer: string[]; text: string };

export type DeskCommand = { id: number; kind: string; payload: Record<string, unknown> };

export type ConsentPage = {
  hotel: string;
  city: string;
  guest_short_name: string;
  perk: string;
  wording: string;
  wording_version: string;
  expires_at: string;
};

export type WinbackMessage = {
  id: number;
  consent_id: number;
  guest_name: string;
  short_name: string;
  perk_code: string;
  body: string;
  status: "draft" | "approved" | "sent" | "rejected" | "failed" | "blocked";
  transport: string | null;
  consent_given_at: string;
  consent_fingerprint: string;
  proof_status: string;
  consent_active: boolean;
  created_at: string;
  sent_at: string | null;
};

export type Messages = { pending: number; simulated: boolean; messages: WinbackMessage[] };

export type LinkPage = {
  hotel: string;
  address: string;
  code: string | null;
  code_status: "valid" | "used" | "unknown" | "none";
  guest_short_name: string | null;
  perk: string;
  rooms: { room_type: string; nightly_rate: number }[];
  dates: { check_in: string; nights: number; label: string }[];
};

export type BookResult = {
  reference: string;
  amount: number;
  check_in: string;
  nights: number;
  room_type: string;
  perk_applied: boolean;
  payment: string;
};

export type SavingItem = {
  guest_name: string;
  code: string;
  amount: number;
  check_in: string;
  original_channel: string;
  commission_rate_used: number;
  commission_avoided: number;
  gst_avoided: number;
  upi_fee: number;
  net_saving: number;
  booked_at: string;
};

export type Savings = { total_net_saving: number; total_avoided: number; count: number; items: SavingItem[] };

export type ProofBundle = {
  id: number;
  created_at: string;
  item_count: number;
  merkle_root: string;
  chain_status: string;
  chain_tx: string | null;
  explorer_url: string | null;
};

export type ProofOverview = {
  consents_this_month: number;
  proven: number;
  pending: number;
  chain_live: boolean;
  bundles: ProofBundle[];
};

export type ConsentProof = {
  consent_id: number;
  guest_name: string;
  given_at: string;
  fingerprint: string;
  status: string;
  bundle: ProofBundle | null;
  path: { side: string; hash: string }[];
  matches: boolean | null;
};

export type AskQuestion = { key: string; hi: string; en: string };
export type AskAnswer = {
  key: string;
  question: string;
  answer: string;
  answer_en: string;
  figures: string[];
  source: string;
};
