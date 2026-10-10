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
  action: "no_discount" | "hold";
  rooms: number;
  decision: string;
  in_plan: boolean;
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
