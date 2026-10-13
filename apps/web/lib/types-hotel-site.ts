/**
 * Hotel Site V2 payload types (docs/HOTEL_SITE_V2.md, implementation
 * contract): the owner's hotel facts the API adds to the public site as
 * `details` (SiteDetailsOut in apps/api/app/services/site_details.py).
 * Plain text only; nothing here is a price. The location shapes (Geo,
 * NearbyPlace) live in lib/types-site-v2.ts with the globe and map.
 */
import type { PublicSite } from "./types-site.ts";
import type { Geo, NearbyPlace } from "./types-site-v2.ts";

export type ReachItem = { mode: "road" | "rail" | "air"; text_en: string; text_hi: string };

export type GoodToKnow = { text_en: string; text_hi: string };

/** Empty strings mean "not set". */
export type HotelContact = {
  phone: string;
  whatsapp: string;
  email: string;
  address_en: string;
  address_hi: string;
};

export type AmenityLabel = { id: string; en: string; hi: string };

/**
 * The owner's facts about one room type, keyed by `name` (the room type as
 * `rooms[].room_type` names it). Every number is owner-entered; none is a
 * price. null or "" means "not set".
 */
export type RoomDetail = {
  name: string;
  size_sqft: number | null;
  beds_en: string;
  beds_hi: string;
  max_guests: number | null;
  /** At most 2 each. */
  features_en: string[];
  features_hi: string[];
  /** One of the site's photos (`photos[].id`), or null. */
  photo_id: number | null;
};

/** One shown comment from a verified guest (the owner can hide a comment, never edit the stars). */
export type RatingComment = { stars: number; comment: string; month: string };

/**
 * Verified-guest ratings as the API sums them. `average` is null until at
 * least 3 ratings exist; the page then shows no number at all.
 */
export type RatingSummary = { count: number; average: number | null; comments: RatingComment[] };

/** GET /public/rate/{token}. */
export type RatePage = { hotel: string; slug: string; state: "open" | "used" | "invalid" };

/** GET /public/site/{slug} `details`. `sample` marks the sample hotel's fixed facts. */
export type SiteDetailsData = {
  amenities: string[];
  amenity_labels: AmenityLabel[];
  nearby: NearbyPlace[];
  how_to_reach: ReachItem[];
  good_to_know: GoodToKnow[];
  check_in: string;
  check_out: string;
  contact: HotelContact;
  geo: Geo | null;
  sample: boolean;
  /**
   * The owner's own words for a guest who scanned a printed card (0 to 100
   * characters each; empty = no card perk). Optional: an older API does not
   * send them, and missing means empty.
   */
  card_perk_en?: string;
  card_perk_hi?: string;
  /** Room facts (optional: an older API does not send them; missing means none). */
  rooms?: RoomDetail[];
};

/** The public site as the V2 hotel page reads it. */
export type HotelSitePayload = PublicSite & {
  details: SiteDetailsData;
  /** The lowest room price, computed by the API (integer paise); missing or null means none shown. */
  from_price_paise?: number | null;
  /** Verified-guest ratings; missing means none yet. */
  ratings?: RatingSummary;
};

/** Which printed card's QR brought the guest (?src=card-wallet|card-room|card-desk). */
export type ScanCard = "wallet" | "room" | "desk";

/**
 * POST /public/site/{slug}/card/verify: a guest's booking reference from the
 * checkout slip (and the phone's last 4 digits when the API asks for them).
 * Only `verified` carries a stay token and the Book again prefill (room,
 * nights, next check-in, the guest's own perk code); never a price.
 */
export type CardVerifyState = "verified" | "needs_phone" | "not_found" | "not_ended" | "already_rated";
export type CardVerify = {
  state: CardVerifyState;
  stay_token?: string;
  room_type?: string;
  nights?: number;
  /** YYYY-MM-DD. */
  next_check_in?: string;
  perk_code?: string | null;
};
