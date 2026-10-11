/** Shapes of the Seedha Pro mini view APIs (GET /pro/...). Money is integer paise. */

export type ProLines = {
  list_amount: number;
  discount: number;
  commission: number;
  gst_on_commission: number;
  fees: number;
  net_kept: number;
};

export type DiscountRow = {
  channel_key: string;
  channel_name: string;
  promotion: string;
  list_amount: number;
  /** Stored discount the hotel funded (real ledger data). */
  hotel_funded: number;
  /** OTA-funded part: not in statements, a sample figure. */
  ota_funded: number;
  hotel_share_tenths: number | null;
  ota_funded_sample: true;
};

export type DiscountSplit = {
  rows: DiscountRow[];
  total_hotel_funded: number;
  total_ota_funded: number;
  sample: true;
  label: "Sample";
};

export type FloorRow = {
  channel_key: string;
  channel_name: string;
  commission_bps: number;
  gst_applies: boolean;
  floor_rate: number;
  at_rate: ProLines;
  worth_taking: boolean;
};

export type Floor = {
  target: number;
  target_is_sample: boolean;
  rate: number;
  rows: FloorRow[];
  label: "Illustration";
};

export type Displacement = {
  group_rooms: number;
  group_rate: number;
  nights: number;
  rooms_count: number;
  nights_sampled: number;
  average_rooms_sold: number;
  average_net_per_room_night: number;
  free_rooms: number;
  rooms_pushed_out: number;
  group_net: number;
  displaced_net: number;
  difference: number;
  label: "Illustration";
};

export type AgentRow = {
  agent: string;
  bookings: number;
  room_nights: number;
  lines: ProLines;
};

export type Khata = { rows: AgentRow[]; totals: AgentRow; sample: true; label: "Sample" };

export type RollupKey = "a" | "b" | "all";

export type RollupProperty = {
  key: RollupKey;
  name: string;
  city: string;
  rooms_count: number;
  sample: boolean;
  room_nights: number;
  lines: ProLines;
  paid_to_channels: number;
  net_adr: number | null;
  direct_bookings_tenths: number | null;
};

export type Rollup = {
  selected: RollupKey;
  view: RollupProperty;
  properties: RollupProperty[];
  combined: RollupProperty;
  sample: true;
  label: "Sample";
};
