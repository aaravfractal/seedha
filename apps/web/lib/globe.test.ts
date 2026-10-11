import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATES_TO_CONFIRM,
  PASS_ARCS,
  PASS_TOWNS,
  PLANNED_TOWN,
  RADAR_EVENTS,
  angleDelta,
  arcPoints,
  arcsFor,
  cappedDpr,
  cubicBezier,
  fallbackReason,
  focusAngles,
  latLonToVec3,
  markerText,
  markersFor,
  rotateYX,
  siteEase,
  TOWNS,
} from "./globe.ts";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("Seedha Pass shows the six planned towns, each labelled Planned town", () => {
  const m = markersFor("pass");
  assert.deepEqual(
    m.map((x) => x.name),
    ["Manali", "Shimla", "Mussoorie", "Rishikesh", "Auli", "Nainital"],
  );
  assert.ok(m.every((x) => x.detail === PLANNED_TOWN && x.layer === "pass" && !x.sample));
  assert.equal(new Set(m.map((x) => x.id)).size, m.length);
});

test("arcs join planned towns only", () => {
  assert.ok(PASS_ARCS.length >= 5);
  for (const [a, b] of PASS_ARCS) {
    assert.ok(PASS_TOWNS.includes(a) && PASS_TOWNS.includes(b) && a !== b);
  }
  assert.equal(arcsFor("pass").length, PASS_ARCS.length);
  assert.equal(arcsFor("radar").length, 0);
});

test("Event Radar: Winter Line Carnival keeps its repo dates, the rest say Dates to confirm", () => {
  const m = markersFor("radar");
  assert.ok(m.length >= 2 && m.length <= 5);
  const wlc = m.find((x) => x.name === "Winter Line Carnival");
  assert.ok(wlc);
  assert.equal(wlc.town, "Mussoorie");
  assert.equal(wlc.detail, "25 to 30 Dec");
  for (const x of m.filter((e) => e !== wlc)) assert.equal(x.detail, DATES_TO_CONFIRM);
  assert.ok(m.every((x) => x.sample && x.layer === "radar"));
  assert.equal(RADAR_EVENTS.filter((e) => e.dates !== null).length, 1);
});

test("marker text carries name, town, dates and Sample", () => {
  const [first] = markersFor("radar");
  assert.ok(first);
  assert.equal(markerText(first), "Winter Line Carnival, Mussoorie, 25 to 30 Dec, Sample");
  const [town] = markersFor("pass");
  assert.ok(town);
  assert.equal(markerText(town), "Manali, Planned town");
});

test("copy has no rupee figures, em dashes or exclamation marks", () => {
  const all = [...markersFor("pass"), ...markersFor("radar")].map(markerText).join(" ");
  assert.doesNotMatch(all, /₹|Rs\.?\s?\d|—|!/);
});

test("latLonToVec3 gives unit vectors and matches the texture seam", () => {
  const [x, y, z] = latLonToVec3(30, 78);
  close(Math.hypot(x, y, z), 1);
  const seam = latLonToVec3(0, -180);
  close(seam[0], -1);
  close(seam[2], 0);
  close(latLonToVec3(90, 0)[1], 1);
});

test("focusAngles brings any town to face the camera on +Z", () => {
  for (const t of Object.values(TOWNS)) {
    const a = focusAngles(t.lat, t.lon);
    const p = rotateYX(latLonToVec3(t.lat, t.lon), a.y, a.x);
    close(p[0], 0);
    close(p[1], 0);
    close(p[2], 1);
  }
});

test("arc points start and end on the towns and lift in the middle", () => {
  const pts = arcPoints(TOWNS.manali, TOWNS.nainital, 20, 0.05);
  assert.equal(pts.length, 21);
  const [a, b] = [
    latLonToVec3(TOWNS.manali.lat, TOWNS.manali.lon),
    latLonToVec3(TOWNS.nainital.lat, TOWNS.nainital.lon),
  ];
  pts[0]!.forEach((v, i) => close(v, a[i]!));
  pts[20]!.forEach((v, i) => close(v, b[i]!));
  close(Math.hypot(...pts[10]!), 1.05);
});

test("angleDelta takes the short way round", () => {
  close(angleDelta(0, 0.5), 0.5);
  close(angleDelta(0.1, 2 * Math.PI - 0.1), -0.2);
  close(angleDelta(3, -3), 2 * Math.PI - 6);
});

test("cubic bezier matches its end points and the site curve front-loads motion", () => {
  const linear = cubicBezier(0, 0, 1, 1);
  close(linear(0.3), 0.3, 1e-4);
  assert.equal(siteEase(0), 0);
  assert.equal(siteEase(1), 1);
  assert.ok(siteEase(0.3) > 0.7);
  let prev = 0;
  for (let i = 1; i <= 20; i++) {
    const v = siteEase(i / 20);
    assert.ok(v >= prev);
    prev = v;
  }
});

test("fallback: reduced motion, no WebGL and low-end phones get the static map", () => {
  const base = { reducedMotion: false, webgl: true, cores: 8, memoryGb: 8, screenMin: 900 };
  assert.equal(fallbackReason(base), null);
  assert.equal(fallbackReason({ ...base, reducedMotion: true }), "reduced-motion");
  assert.equal(fallbackReason({ ...base, webgl: false }), "no-webgl");
  assert.equal(fallbackReason({ ...base, memoryGb: 2 }), "low-end");
  assert.equal(fallbackReason({ ...base, cores: 4, screenMin: 390 }), "low-end");
  assert.equal(fallbackReason({ ...base, cores: 4 }), null);
  assert.equal(fallbackReason({ ...base, cores: undefined, memoryGb: undefined, screenMin: 390 }), null);
});

test("device pixel ratio is capped at 2", () => {
  assert.equal(cappedDpr(3), 2);
  assert.equal(cappedDpr(1.5), 1.5);
  assert.equal(cappedDpr(undefined), 1);
  assert.equal(cappedDpr(0), 1);
});
