/** GET /public/sample: the sample hotel's computed summary. Money in paise, shares in tenths of a percent. */

export type SampleChannel = {
  key: string;
  name: string;
  kind: string;
  room_nights: number;
  list_revenue: number;
  net_kept: number;
  paid_to_channels: number;
  list_adr: number | null;
  net_adr: number | null;
};

export type Sample = {
  is_sample: boolean;
  hotel: string;
  city: string;
  rooms_count: number;
  start: string;
  end: string;
  room_nights: number;
  list_revenue: number;
  net_kept: number;
  paid_to_channels: number;
  paid_to_channels_share_tenths: number | null;
  commission_free_share_tenths: number | null;
  direct_bookings_tenths: number | null;
  list_adr: number;
  net_adr: number;
  revpar_list: number;
  revpar_net: number;
  channels: SampleChannel[];
  rank_by_bookings: string[];
  rank_by_money_kept: string[];
  repeat_guests: number;
  paid_twice: number;
  saturday: {
    rooms: number;
    channel_name: string;
    channel_net_adr: number;
    direct_net_adr: number;
    extra_per_saturday: number;
  } | null;
  growth: {
    from_channel: string;
    from_net_adr: number;
    direct_net_adr: number;
    per_room_night: number;
  } | null;
  guest_cities: { city: string; stays: number }[];
};
