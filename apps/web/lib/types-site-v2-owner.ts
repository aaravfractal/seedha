/**
 * Hotel Site V2, owner side: the hotel's facts (GET and PUT /site/details),
 * card scan counts (GET /site/scans) and printed cards (GET /site/cards.pdf,
 * /site/cards/qr.svg, /site/cards/qr.png). Shapes follow
 * apps/api/app/services/site_details.py and docs/HOTEL_SITE_V2.md. Nothing
 * here is a price.
 */
import type { AmenityId } from "./amenities.ts";

export type NearbyKind =
  "viewpoint" | "temple" | "market" | "waterfall" | "trek" | "lake" | "station" | "airport" | "other";

export type TravelMode = "walk" | "drive";
export type ReachMode = "road" | "rail" | "air";

/** A place near the hotel. `bearing`: degrees from north, clockwise, for the site map. */
export type NearbyPlace = {
  name_en: string;
  name_hi: string;
  minutes: number;
  mode: TravelMode;
  kind: NearbyKind;
  bearing: number;
};

export type ReachItem = { mode: ReachMode; text_en: string; text_hi: string };

export type Note = { text_en: string; text_hi: string };

/** Empty strings mean "not set". */
export type Contact = {
  phone: string;
  whatsapp: string;
  email: string;
  address_en: string;
  address_hi: string;
};

export type Geo = { lat: number; lng: number };

/**
 * The owner's facts about one room type the hotel sells (keyed by `name`, the
 * room type). Owner-entered only; no price here (prices stay in the rooms and
 * rates data). Null or empty means "not set".
 */
export type RoomDetail = {
  name: string;
  /** 50 to 5000, or null. */
  size_sqft: number | null;
  /** Plain text, 0 to 40 letters ("1 king bed"). */
  beds_en: string;
  beds_hi: string;
  /** 1 to 12, or null. */
  max_guests: number | null;
  /** Up to 2 lines of 1 to 40 letters each. */
  features_en: string[];
  features_hi: string[];
  /** One of the hotel's site photos, or null. */
  photo_id: number | null;
};

/** PUT /site/details body. PUT replaces the whole object. */
export type SiteDetailsIn = {
  /** Up to 12, one per room type the hotel sells. */
  rooms: RoomDetail[];
  amenities: AmenityId[];
  nearby: NearbyPlace[];
  how_to_reach: ReachItem[];
  good_to_know: Note[];
  check_in: string;
  check_out: string;
  contact: Contact;
  geo: Geo | null;
  /** The owner's own returning-guest perk, plain text, 0 to 100 letters; empty = no card perk.
   * English prints on the cards; both show on the site when a guest scans a card. */
  card_perk_en: string;
  card_perk_hi: string;
};

/** GET and PUT /site/details response. `sample`: the fixed sample facts of the sample hotel. */
export type SiteDetailsOut = SiteDetailsIn & {
  amenity_labels: { id: string; en: string; hi: string }[];
  sample: boolean;
};

/** The API's 422 body: {error: {code: "invalid_input", message, details: [{field, problem}]}}. */
export type FieldProblem = { field: string; problem: string };

export type ScanCard = "wallet" | "room" | "desk";

export type ScanDay = { day: string; wallet: number; room: number; desk: number };

/** GET /site/scans: this month by the hotel's own calendar. Counts only. */
export type SiteScans = {
  month: string;
  total: number;
  by_card: Record<ScanCard, number>;
  by_day: ScanDay[];
};

/** A printed card. The tent card stands on the front desk, so its QR says card-desk. */
export type CardKind = "wallet" | "room" | "tent";
export type PdfKind = CardKind | "all";

/** Where a rating came from: a direct booking through Seedha Link, or a Desk checkout. */
export type RatingSource = string;

/** GET /site/ratings item. Stars cannot be edited; the owner can only hide the comment. */
export type SiteRating = {
  id: number;
  stars: number;
  /** Empty or null when the guest wrote none. */
  comment: string | null;
  hidden: boolean;
  created_at: string;
  source: RatingSource;
};

/** GET /site/feedback item: a private note a guest sent from the card page. Never public, never counted. */
export type SiteFeedback = {
  id: number;
  message: string;
  created_at: string;
  read: boolean;
};
