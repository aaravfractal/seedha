/** Shapes of GET /rooms/nights and GET /rooms/{night}/{room}. Money is integer paise. */

export type RoomTile = { room: number; channel_key: string | null; sold: boolean };

export type RoomChannelCount = { channel_key: string; channel_name: string; rooms: number };

export type RoomNight = {
  /** "YYYY-MM-DD" */
  night: string;
  rooms_sold: number;
  rooms_total: number;
  net_kept: number;
  /** Direct bookings as a whole percent of rooms sold, or null when none were sold. */
  direct_bookings_pct: number | null;
  by_channel: RoomChannelCount[];
  tiles: RoomTile[];
};

export type RoomNights = { nights: RoomNight[]; is_sample: boolean };

export type ConsentStatus = "consented_at_desk" | "not_consented";

export type IfDirect = {
  extra_kept: number;
  commission_avoided: number;
  gst_avoided: number;
  upi_fee: number;
  label: string;
};

export type RoomDetail = {
  room: number;
  night: string;
  channel_key: string;
  channel_name: string;
  nights: number;
  list_amount: number;
  discount: number;
  commission: number;
  gst_on_commission: number;
  fees: number;
  net_kept: number;
  guest_initials: string;
  consent_status: ConsentStatus | string;
  consent_id: number | null;
  booking_id: number;
  if_direct: IfDirect | null;
};
