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

/** PUT /site/details body. PUT replaces the whole object. */
export type SiteDetailsIn = {
  amenities: AmenityId[];
  nearby: NearbyPlace[];
  how_to_reach: ReachItem[];
  good_to_know: Note[];
  check_in: string;
  check_out: string;
  contact: Contact;
  geo: Geo | null;
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
