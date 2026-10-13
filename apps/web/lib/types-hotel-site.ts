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
};

/** The public site as the V2 hotel page reads it. */
export type HotelSitePayload = PublicSite & { details: SiteDetailsData };

/** Which printed card's QR brought the guest (?src=card-wallet|card-room|card-desk). */
export type ScanCard = "wallet" | "room" | "desk";
