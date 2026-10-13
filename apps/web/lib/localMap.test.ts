import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KIND_ICON,
  MAP_COPY,
  MAP_H,
  MAP_W,
  NORTH_BOX,
  R_MAX,
  R_MIN,
  CX,
  CY,
  DOT_R,
  hotelBox,
  inBounds,
  layoutMap,
  mapsUrl,
  minutesText,
  overlaps,
  placeLabels,
  placeName,
  polar,
  radii,
  roughKm,
  shortName,
  textWidth,
} from "./localMap.ts";
import type { NearbyKind, NearbyPlace } from "./types-site-v2.ts";

/** The sample hotel's four places (apps/api/app/services/site_details.py). */
const SAMPLE: NearbyPlace[] = [
  { name_en: "Mall Road", name_hi: "मॉल रोड", minutes: 5, mode: "walk", kind: "market", bearing: 200 },
  { name_en: "Gun Hill", name_hi: "गन हिल", minutes: 10, mode: "drive", kind: "viewpoint", bearing: 330 },
  { name_en: "Lal Tibba", name_hi: "लाल टिब्बा", minutes: 15, mode: "drive", kind: "viewpoint", bearing: 70 },
  {
    name_en: "Kempty Falls",
    name_hi: "केम्प्टी फ़ॉल्स",
    minutes: 30,
    mode: "drive",
    kind: "waterfall",
    bearing: 290,
  },
];

function close(a: number, b: number, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
}

function assertClean(layout: ReturnType<typeof layoutMap>, hotel: string) {
  const hb = hotelBox(hotel);
  for (const [i, m] of layout.entries()) {
    assert.ok(inBounds(m.label), `label ${i} (${m.shortName}) leaves the map: ${JSON.stringify(m.label)}`);
    assert.equal(overlaps(m.label, hb, 0), false, `label ${i} covers the hotel name`);
    assert.equal(overlaps(m.label, NORTH_BOX, 0), false, `label ${i} covers the north arrow`);
    for (const [j, n] of layout.entries()) {
      if (j <= i) continue;
      assert.equal(overlaps(m.label, n.label, 0), false, `labels ${i} and ${j} overlap`);
    }
  }
}

test("minutes text in English and Hindi", () => {
  assert.equal(minutesText(5, "walk", "en"), "5 min walk");
  assert.equal(minutesText(10, "drive", "en"), "10 min drive");
  assert.equal(minutesText(5, "walk", "hi"), "5 मिनट पैदल");
  assert.equal(minutesText(10, "drive", "hi"), "10 मिनट ड्राइव");
});

test("Hindi names fall back to English when empty", () => {
  assert.equal(placeName({ name_en: "Gun Hill", name_hi: "गन हिल" }, "hi"), "गन हिल");
  assert.equal(placeName({ name_en: "Gun Hill", name_hi: "  " }, "hi"), "Gun Hill");
  assert.equal(placeName({ name_en: "Gun Hill", name_hi: "गन हिल" }, "en"), "Gun Hill");
});

test("a walk covers less ground than a drive of the same minutes", () => {
  assert.ok(roughKm(10, "walk") < roughKm(10, "drive"));
  close(roughKm(10, "walk"), 0.8);
  close(roughKm(10, "drive"), 4);
  const [walk, drive] = radii([
    { minutes: 10, mode: "walk" },
    { minutes: 10, mode: "drive" },
  ]);
  assert.ok(walk! < drive!);
});

test("radii stay between the inner and outer rings and grow with distance", () => {
  const rs = radii(SAMPLE);
  for (const r of rs) assert.ok(r >= R_MIN && r <= R_MAX);
  close(Math.max(...rs), R_MAX);
  assert.ok(rs[1]! < rs[2]! && rs[2]! < rs[3]!);
  // One short walk alone is not pushed to the outer ring.
  assert.ok(radii([{ minutes: 5, mode: "walk" }])[0]! < R_MAX);
});

test("bearing 0 is north (up), 90 is east (right)", () => {
  const n = polar(0, 100);
  close(n.x, CX);
  close(n.y, CY - 100);
  const e = polar(90, 100);
  close(e.x, CX + 100);
  close(e.y, CY, 1e-9);
  const s = polar(180, 100);
  close(s.y, CY + 100);
  const w = polar(270, 100);
  close(w.x, CX - 100);
});

test("long names are cut with one ellipsis character", () => {
  assert.equal(shortName("Gun Hill"), "Gun Hill");
  const cut = shortName("A".repeat(60));
  assert.equal(Array.from(cut).length, 20);
  assert.ok(cut.endsWith("…"));
});

test("Devanagari vowel signs add no width", () => {
  assert.ok(textWidth("कि", 10) < textWidth("कक", 10));
  assert.ok(textWidth("Mall Road", 12) > 0);
});

test("labels never cover a place dot on the sample map", () => {
  for (const lang of ["en", "hi"] as const) {
    const layout = layoutMap(SAMPLE, "Hotel Deodar View", lang);
    for (const m of layout)
      for (const n of layout) {
        const dot = { x: n.x - DOT_R, y: n.y - DOT_R, w: 2 * DOT_R, h: 2 * DOT_R };
        assert.equal(overlaps(m.label, dot, 0), false, `${m.shortName} covers ${n.shortName}`);
      }
    // With room to spare, every label sits right beside its own point.
    assert.ok(layout.every((m) => !m.label.moved));
  }
});

test("sample places lay out with no overlaps and inside the map, EN and HI", () => {
  for (const lang of ["en", "hi"] as const)
    assertClean(layoutMap(SAMPLE, "Hotel Deodar View", lang), "Hotel Deodar View");
});

test("crowded maps (8 places, same direction, long names) still do not overlap or overflow", () => {
  const kinds: NearbyKind[] = [
    "viewpoint",
    "temple",
    "market",
    "waterfall",
    "trek",
    "lake",
    "station",
    "airport",
  ];
  const sameWay: NearbyPlace[] = kinds.map((kind, i) => ({
    name_en: `A rather long place name number ${i + 1}`,
    name_hi: `काफ़ी लंबे नाम वाली जगह संख्या ${i + 1}`,
    minutes: 5 + i * 7,
    mode: i % 2 ? "drive" : "walk",
    kind,
    bearing: 85 + i,
  }));
  const around: NearbyPlace[] = kinds.map((kind, i) => ({
    name_en: `Place ${i + 1} with a long name`,
    name_hi: "",
    minutes: 600 - i,
    mode: "drive",
    kind,
    bearing: i * 45,
  }));
  const north: NearbyPlace[] = kinds.map((kind, i) => ({
    name_en: `North ${i}`,
    name_hi: "",
    minutes: 10 + i,
    mode: "drive",
    kind,
    bearing: 359 - i,
  }));
  const hotel = "A very long hotel name that goes on and on";
  for (const set of [sameWay, around, north]) {
    for (const lang of ["en", "hi"] as const) assertClean(layoutMap(set, hotel, lang), hotel);
  }
});

test("labels that leave their point are marked for a leader line", () => {
  const items = [0, 1, 2].map(() => ({ x: CX + 60, y: CY, w: 80, h: 30 }));
  const placed = placeLabels(items);
  assert.ok(placed.some((p) => p.moved));
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) assert.equal(overlaps(placed[i]!, placed[j]!, 0), false);
});

test("labels at the right edge flip to the left side", () => {
  const [p] = placeLabels([{ x: MAP_W - 20, y: CY, w: 80, h: 30 }]);
  assert.ok(p!.x + p!.w < MAP_W - 20);
  assert.ok(inBounds(p!));
  const [q] = placeLabels([{ x: 20, y: MAP_H - 10, w: 80, h: 30 }]);
  assert.ok(inBounds(q!));
});

test("every kind has an icon", () => {
  const kinds: NearbyKind[] = [
    "viewpoint",
    "temple",
    "market",
    "waterfall",
    "trek",
    "lake",
    "station",
    "airport",
    "other",
  ];
  for (const k of kinds) assert.ok(KIND_ICON[k].d.length > 0);
});

test("Open in Maps is a plain search URL with no key", () => {
  assert.equal(
    mapsUrl({ lat: 30.4598, lng: 78.0664 }),
    "https://www.google.com/maps/search/?api=1&query=30.45980,78.06640",
  );
  assert.doesNotMatch(mapsUrl({ lat: 1, lng: 2 }), /key=/);
});

test("copy has no em dashes or exclamation marks", () => {
  for (const c of Object.values(MAP_COPY)) {
    const all = [c.mapLabel("Hotel", 4), c.mapLabel("Hotel", 1), c.note, c.open, c.north].join(" ");
    assert.doesNotMatch(all, /—|!/);
  }
});
