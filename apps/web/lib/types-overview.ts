/** Shape of GET /overview. Money is integer paise; shares are tenths of a percent. */

export type OverviewItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  icon: string;
  at: string | null;
  /** A gain in paise shown after the title, or null. */
  amount: number | null;
};

export type OverviewKpis = {
  list_revenue: number;
  net_kept: number;
  net_kept_share_tenths: number;
  net_adr: number;
  list_adr: number;
  revpar_net: number;
  revpar_list: number;
  paid_to_channels: number;
  paid_to_channels_share_tenths: number | null;
  commission_free_share_tenths: number | null;
  direct_bookings_tenths: number | null;
  room_nights: number;
  occupancy_tenths: number;
};

export type OverviewRoom = { number: number; channel_key: string | null; code: string | null };

export type Overview = {
  business_date: string;
  owner: { name: string; short_name: string; initials: string };
  hotel: { name: string; short_name: string; rooms_count: number; is_sample: boolean };
  period: { start: string; end: string; days: number; available_room_nights: number };
  has_statements: boolean;
  kpis: OverviewKpis | null;
  insight: { en: string; hi: string } | null;
  waterfall: { key: string; label: string; amount: number }[];
  channel_mix: { key: string; name: string; room_nights: number; share_tenths: number }[];
  last_night: {
    date: string;
    rooms_count: number;
    sold: number;
    net_kept: number;
    direct_share_pct: number | null;
    is_sample: boolean;
    rooms: OverviewRoom[];
  };
  savings: { total_net_saving: number; count: number };
  needs_you: OverviewItem[];
  pending_approvals: number;
  checklist: { steps: { key: string; done: boolean }[]; done_count: number; total: number };
  notifications: OverviewItem[];
};
