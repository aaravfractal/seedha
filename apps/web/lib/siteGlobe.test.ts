import { test } from "node:test";
import assert from "node:assert/strict";
import {
  END_ZOOM,
  angularDistance,
  cappedDpr,
  easeInOutCubic,
  endView,
  globeLabel,
  lngDelta,
  markerVisible,
  rotationFor,
  scaleFor,
  startView,
  viewAt,
} from "./siteGlobe.ts";

const HOTEL = { lat: 30.4598, lng: 78.0664 };

function close(a: number, b: number, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
}

test("ease is 0 at the start, 1 at the end and never goes backwards", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  close(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(-1), 0);
  assert.equal(easeInOutCubic(2), 1);
  let prev = 0;
  for (let i = 1; i <= 50; i++) {
    const v = easeInOutCubic(i / 50);
    assert.ok(v >= prev);
    prev = v;
  }
});

test("the ease ends exactly centred on the hotel and zoomed in", () => {
  const from = startView(HOTEL);
  const to = endView(HOTEL);
  const end = viewAt(1, from, to);
  close(end.lng, HOTEL.lng);
  close(end.lat, HOTEL.lat);
  close(end.k, END_ZOOM);
  const start = viewAt(0, from, to);
  close(start.lng, from.lng);
  close(start.k, 1);
  const [l, p, g] = rotationFor(end);
  close(l, -HOTEL.lng);
  close(p, -HOTEL.lat);
  assert.equal(g, 0);
});

test("rotation takes the short way across the date line", () => {
  close(lngDelta(170, -170), 20);
  close(lngDelta(-170, 170), -20);
  const from = { lng: 170, lat: 0, k: 1 };
  const to = { lng: -170, lat: 0, k: 1 };
  const mid = viewAt(0.5, from, to);
  close(Math.abs(mid.lng), 180);
  const geo = { lat: -40, lng: 175 };
  const s = startView(geo);
  assert.ok(s.lng >= -180 && s.lng < 180);
  close(viewAt(1, s, endView(geo)).lng, 175);
});

test("zoom grows steadily and the scale fits the box", () => {
  const from = startView(HOTEL);
  const to = endView(HOTEL);
  let prev = 0;
  for (let i = 0; i <= 20; i++) {
    const k = viewAt(i / 20, from, to).k;
    assert.ok(k >= prev);
    prev = k;
  }
  assert.ok(scaleFor({ lng: 0, lat: 0, k: 1 }, 400) < 200);
  close(scaleFor({ lng: 0, lat: 0, k: 2 }, 400), 2 * scaleFor({ lng: 0, lat: 0, k: 1 }, 400));
});

test("the marker shows only on the near side of the globe", () => {
  close(angularDistance(HOTEL, HOTEL), 0, 1e-6);
  assert.ok(markerVisible(endView(HOTEL), HOTEL));
  assert.ok(markerVisible(startView(HOTEL), HOTEL));
  assert.equal(markerVisible({ lng: HOTEL.lng - 180, lat: 0, k: 1 }, HOTEL), false);
});

test("device pixel ratio is capped at 2", () => {
  assert.equal(cappedDpr(3), 2);
  assert.equal(cappedDpr(1.5), 1.5);
  assert.equal(cappedDpr(undefined), 1);
});

test("accessible name uses only the hotel name, no em dashes or exclamation marks", () => {
  assert.equal(globeLabel("Hotel Deodar View", "en"), "Map: where Hotel Deodar View is on the globe");
  assert.match(globeLabel("Hotel Deodar View", "hi"), /Hotel Deodar View/);
  for (const l of ["en", "hi"] as const) assert.doesNotMatch(globeLabel("X", l), /—|!/);
});
