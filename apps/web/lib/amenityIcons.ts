/**
 * Line icons for the 40 fixed amenities (lib/amenities.ts) and the three ways
 * to reach a hotel, as plain shape data on a 24 px grid. Drawn for the Hotel
 * Site V2 page; components/site/v2/AmenityIcon.tsx renders them as inline
 * SVG in one colour. lib/amenityIcons.test.ts checks every amenity has one.
 */
import type { AmenityId } from "./amenities.ts";
import { AMENITY_IDS } from "./amenities.ts";

/** A path, a circle (`fill` = solid dot) or a rounded rectangle. */
export type IconShape =
  | { d: string }
  | { cx: number; cy: number; r: number; fill?: boolean }
  | { x: number; y: number; w: number; h: number; rx: number };

const dot = (cx: number, cy: number, r = 1.2): IconShape => ({ cx, cy, r, fill: true });

const TAXI: IconShape[] = [
  { d: "M4 17v-5l2.5-5h11l2.5 5v5zM4 12h16M10 4.5h4V7h-4z" },
  { cx: 7.5, cy: 17, r: 1.6 },
  { cx: 16.5, cy: 17, r: 1.6 },
];
const PLANE: IconShape[] = [
  {
    d: "M12 2c1 0 1.5 1 1.5 2v5l7 4v2l-7-2v4l2 1.5V20L12 19l-3.5 1v-1.5l2-1.5v-4l-7 2v-2l7-4V4c0-1 .5-2 1.5-2z",
  },
];

export const AMENITY_ICONS: Readonly<Record<AmenityId, readonly IconShape[]>> = {
  wifi: [
    { d: "M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0" },
    dot(12, 19.2, 1.3),
  ],
  parking: [{ x: 3, y: 3, w: 18, h: 18, rx: 4 }, { d: "M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5" }],
  breakfast: [
    { cx: 12, cy: 12, r: 8.5 },
    { cx: 12, cy: 12, r: 3 },
  ],
  restaurant: [{ d: "M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2 1-3 4-3 8h3" }],
  room_service: [{ d: "M3 18h18M5 18a7 7 0 0 1 14 0M12 11V8.5M10.5 8.5h3" }],
  hot_water: [{ d: "M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11zM9.5 14.5A2.5 2.5 0 0 0 12 17" }],
  heater: [{ x: 3, y: 6, w: 18, h: 12, rx: 2 }, { d: "M7.5 6v12M12 6v12M16.5 6v12M5 18v2.5M19 18v2.5" }],
  power_backup: [{ d: "M13 2 5 13.5h6L10 22l8-11.5h-6z" }],
  valley_view: [{ d: "M2 6c4 0 6 11 10 11s6-11 10-11M2 20.5h20" }],
  mountain_view: [{ d: "M2 20 9 7l4 7 2-3 7 9zM7.3 10.3 9 11.6l1.6-1.3" }],
  balcony: [{ d: "M8 12V4h8v8M3 12h18M3 20h18M5 12v8M9 12v8M13 12v8M17 12v8" }],
  garden: [{ d: "M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15.5c0-3-2.5-5-6-5 0 3 2.5 5 6 5zM6 21h12" }],
  terrace: [{ d: "M3.5 10a8.5 5 0 0 1 17 0zM12 10v10M8 20h8" }],
  bonfire: [
    {
      d: "M12 2.5c3 3 5 5.2 5 8.3a5 5 0 0 1-10 0c0-2 .9-3.2 2-4.2 0 2 1 3 2 3 0-2.8-.8-4.8 1-7.1zM4 21l16-3M4 18l16 3",
    },
  ],
  family_rooms: [
    { cx: 8, cy: 7, r: 2.5 },
    { cx: 16, cy: 7, r: 2.5 },
    { cx: 12, cy: 13.2, r: 1.8 },
    { d: "M3 20v-1.5a5 5 0 0 1 5-5M21 20v-1.5a5 5 0 0 0-5-5M9.5 20a2.5 2.5 0 0 1 5 0" },
  ],
  kids_play: [{ d: "M3 4h18M6 4 4 21M18 4l2 17M10 4v10M14 4v10M9 14h6" }],
  pet_friendly: [
    { d: "M8.5 17.5c0-2.5 1.6-4.5 3.5-4.5s3.5 2 3.5 4.5c0 1.6-1.5 2.5-3.5 2.5s-3.5-.9-3.5-2.5z" },
    { cx: 6, cy: 10.5, r: 1.6 },
    { cx: 9.5, cy: 6.5, r: 1.6 },
    { cx: 14.5, cy: 6.5, r: 1.6 },
    { cx: 18, cy: 10.5, r: 1.6 },
  ],
  travel_desk: [{ d: "m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" }],
  taxi: TAXI,
  airport_pickup: PLANE,
  laundry: [{ x: 4, y: 3, w: 16, h: 18, rx: 2 }, { cx: 12, cy: 13, r: 4.5 }, { d: "M7 6.5h2" }],
  housekeeping: [{ d: "M12 3v9M7 21l2-9h6l2 9zM9.5 16.5h5" }],
  tv: [{ x: 3, y: 5, w: 18, h: 12, rx: 2 }, { d: "M8 21h8M12 17v4" }],
  tea_coffee: [
    {
      d: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3c-1 1.4 1 2.4 0 4M12.5 3c-1 1.4 1 2.4 0 4",
    },
  ],
  geyser: [
    { x: 7, y: 3, w: 10, h: 15, rx: 3 },
    { d: "M10 18v3M14 18v3M10 7.5h4" },
    { cx: 12, cy: 12.5, r: 1.6 },
  ],
  lift: [{ x: 5, y: 3, w: 14, h: 18, rx: 2 }, { d: "M9.5 10 12 7.5l2.5 2.5M9.5 14l2.5 2.5 2.5-2.5" }],
  wheelchair: [{ cx: 11, cy: 4.5, r: 1.6 }, { d: "M11 7.5V13h6l2 5M8.5 10.5a5 5 0 1 0 6.8 6.5" }],
  doctor_on_call: [{ d: "M6 3v5a4 4 0 0 0 8 0V3M10 12v3a5 5 0 0 0 10 0v-2" }, { cx: 20, cy: 11, r: 2 }],
  first_aid: [{ x: 3, y: 7, w: 18, h: 13, rx: 2 }, { d: "M9 7V5h6v2M12 10.5v6M9 13.5h6" }],
  cctv: [{ d: "m4 9 12-4 2.2 5.5-12 4zM8 14l1.5 4H4M18.2 10.5 21 9.5" }],
  upi: [{ x: 7, y: 2, w: 10, h: 20, rx: 2 }, { d: "m10 11.5 1.5 1.5 3-3M11 18.5h2" }],
  cards: [{ x: 2.5, y: 5, w: 19, h: 14, rx: 2 }, { d: "M2.5 9.5h19M6 15h4" }],
  veg_food: [{ x: 4, y: 4, w: 16, h: 16, rx: 1.5 }, dot(12, 12, 3.6)],
  local_food: [
    { cx: 12, cy: 12, r: 8.5 },
    { cx: 9, cy: 9.8, r: 1.8 },
    { cx: 15, cy: 9.8, r: 1.8 },
    { cx: 12, cy: 15, r: 2 },
  ],
  yoga: [{ cx: 12, cy: 5, r: 2 }, { d: "M12 7.5v5M6 11l6 1.5 6-1.5M5 19c2.5-2 4.5-3 7-3s4.5 1 7 3" }],
  trek_guide: [{ d: "m3 20 6-10 4 6 2-3 6 7zM9 10V3l5 2-5 2" }],
  library: [{ d: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7" }],
  indoor_games: [{ x: 4, y: 4, w: 16, h: 16, rx: 3 }, dot(9, 9), dot(12, 12), dot(15, 15)],
  workspace: [{ x: 5, y: 5, w: 14, h: 10, rx: 1.5 }, { d: "M2.5 19h19L19 15H5z" }],
  luggage: [{ x: 6, y: 7, w: 12, h: 13, rx: 2 }, { d: "M9.5 7V4h5v3M10 11v5M14 11v5M9 20v1.5M15 20v1.5" }],
};

export const REACH_ICONS: Readonly<Record<"road" | "rail" | "air", readonly IconShape[]>> = {
  road: TAXI,
  rail: [
    { x: 6, y: 3, w: 12, h: 14, rx: 3 },
    { d: "M6 11h12M8 21l2-4M16 21l-2-4" },
    dot(9, 14, 1),
    dot(15, 14, 1),
  ],
  air: PLANE,
};

/** True for one of the 40 fixed ids (anything else from the API is not drawn). */
export function isAmenityId(value: string): value is AmenityId {
  return (AMENITY_IDS as readonly string[]).includes(value);
}
