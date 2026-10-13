/**
 * Hotel Site V2 location types. Shapes follow apps/api/app/services/site_details.py
 * (NearbyPlace, Geo) exactly.
 */

export type NearbyKind =
  "viewpoint" | "temple" | "market" | "waterfall" | "trek" | "lake" | "station" | "airport" | "other";

export type NearbyMode = "walk" | "drive";

/** A place near the hotel. `bearing` is 0 = north, clockwise, 0..359. */
export type NearbyPlace = {
  name_en: string;
  /** May be empty; the site then shows name_en. */
  name_hi: string;
  /** 1..600 */
  minutes: number;
  mode: NearbyMode;
  kind: NearbyKind;
  bearing: number;
};

/** The hotel's map position. */
export type Geo = { lat: number; lng: number };

/** Props shared by LocationGlobe and LocalMap. */
export type LocationProps = {
  geo: Geo | null;
  nearby: NearbyPlace[];
  hotel: string;
  lang: "en" | "hi";
};
