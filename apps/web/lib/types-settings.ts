/** Settings, Calendar (Pulse) and Billing. Money is integer paise from the API. */

export type Personal = {
  sample: boolean;
  name: string;
  mobile: string | null;
  email: string | null;
  business_name: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  pin: string | null;
};

export type HotelInfo = { name: string; town: string; address: string; rooms: number; is_sample: boolean };

export type Notifications = { morning_line: boolean; close_slip: boolean; approvals: boolean };

export type SecurityInfo = {
  sign_in: "demo" | "whatsapp_code";
  mobile: string | null;
  account_created_at: string | null;
  first_verified_at: string | null;
  idle_minutes: number;
  two_step: "planned";
};

export type SettingsData = {
  kind: "demo" | "owner";
  read_only: boolean;
  note: string;
  personal: Personal;
  hotel: HotelInfo;
  notifications: Notifications;
  security: SecurityInfo;
};

export type ContractRow = {
  key: string;
  name: string;
  kind: string;
  contracted_bps: number | null;
  effective_bps: number | null;
  stays: number;
};

export type ContractsData = { start: string; end: string; sample: boolean; channels: ContractRow[] };

export type StaffRole = "front_desk" | "manager" | "accounts";

export type StaffMember = {
  id: number | null;
  name: string;
  role: StaffRole;
  mobile: string;
  status: "invited" | "sample";
  invited_at: string | null;
};

export type StaffData = { read_only: boolean; note: string; staff: StaffMember[] };

export type PulseEvent = {
  key: string;
  title: string;
  tag: string;
  start: string;
  end: string;
  /** Owner events with low demand use "keep" (keep the usual mix). */
  action: "no_discount" | "hold" | "keep";
  rooms: number;
  decision: string;
  in_plan: boolean;
  /** Missing on older API builds: read as "sample". */
  origin?: EventOrigin;
  source_url?: string | null;
  /** Owner events carry the town and the demand read from their source. */
  town?: string | null;
  demand?: EventDemand | null;
};

export type PulseFacts = {
  channel_key: string;
  channel_name: string;
  channel_net_adr: number;
  direct_net_adr: number;
  extra_per_room_night: number;
};

export type CalendarData = {
  first_month: string;
  last_month: string;
  sample: boolean;
  events: PulseEvent[];
  facts: PulseFacts | null;
};

/** Where a calendar event came from. Older API builds omit it: treat as "sample". */
export type EventOrigin = "sample" | "owner_source" | "sample_extraction";

export type EventCategory =
  "festival" | "fair" | "religious" | "sports" | "music" | "conference" | "holiday" | "other";

/** Likely overnight demand as read from the owner's own source text (D-097), never a forecast. */
export type EventDemand = "low" | "medium" | "high";

/** One event read from a pasted notice. Saved only when the owner taps Save. */
export type EventDraft = {
  name: string;
  start_date: string;
  end_date: string;
  town: string;
  category: EventCategory;
  demand: EventDemand;
  source_url: string;
};

export type RejectReason =
  | "money_mentioned"
  | "web_address"
  | "bad_dates"
  | "bad_length"
  | "bad_category"
  | "bad_demand"
  | "duplicate"
  | "too_many"
  | "already_saved";

/** The API hides a name that mentions money or a link: name is then null. */
export type RejectedEvent = { index: number; name: string | null; reason: string };

export type ExtractResult = {
  mode: "claude" | "sample";
  events: EventDraft[];
  rejected: RejectedEvent[];
  note?: string;
};

export type OwnerEvent = EventDraft & {
  id: number;
  origin: "owner_source" | "sample_extraction";
  created_at: string;
  in_plan: boolean;
  plan_key: string;
};

export type SaveEventsResult = { saved: OwnerEvent[]; rejected: RejectedEvent[] };

/** The morning WhatsApp line. Sending is always simulated. */
export type MorningPreviewData = { en: string; hi: string; simulated: true; count: number };

export type MorningSendResult = { status: "simulated"; sent_at: string; note: string; count?: number };
