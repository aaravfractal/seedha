/** GET /my-place: what each room keeps in a month (an illustration). Money is integer paise. */

export type CostSource = "owner" | "onboarding" | "sample";

export type PlaceMonth = { key: string; label: string; start: string; end: string; days: number };

export type PlaceInputs = {
  cost_per_night: number;
  cost_per_night_source: CostSource;
  fixed_monthly: number;
  fixed_monthly_source: CostSource;
  max_cost_per_night: number;
  max_fixed_monthly: number;
};

export type PlaceKpis = {
  net_kept: number;
  profit: number;
  rooms_in_profit: number;
  rooms_count: number;
  break_even_rooms: number | null;
};

export type PlaceSummary = {
  occupancy_tenths: number;
  nights_basis: number;
  nights_per_room: number;
  room_nights: number;
  net_kept: number;
  variable_costs: number;
  fixed_costs: number;
  profit: number;
};

export type PlaceChannel = {
  key: string;
  name: string;
  rooms: number;
  net_adr: number;
  nights_share_tenths: number;
};

export type PlaceRoom = {
  number: number;
  floor: number;
  room_type: string;
  channel_key: string;
  channel_name: string;
  nights: number;
  net: number;
  variable_cost: number;
  fixed_share: number;
  profit: number;
};

export type PlaceFloor = { floor: number; rooms: number; rooms_in_profit: number; profit: number };

export type MyPlace = {
  available: boolean;
  reason: string | null;
  label: string;
  is_sample: boolean;
  sample_note: string | null;
  month: PlaceMonth;
  months: PlaceMonth[];
  inputs: PlaceInputs;
  kpis: PlaceKpis | null;
  summary: PlaceSummary | null;
  channels: PlaceChannel[];
  rooms: PlaceRoom[];
  floors: PlaceFloor[];
};
