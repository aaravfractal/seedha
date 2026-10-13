import { test } from "node:test";
import assert from "node:assert/strict";
import { AMENITY_IDS } from "./amenities.ts";
import { AMENITY_ICONS, REACH_ICONS, isAmenityId } from "./amenityIcons.ts";

test("every one of the 40 amenities has an icon, and nothing else does", () => {
  assert.equal(AMENITY_IDS.length, 40);
  for (const id of AMENITY_IDS) {
    const shapes = AMENITY_ICONS[id];
    assert.ok(shapes && shapes.length > 0, `icon for ${id}`);
  }
  assert.deepEqual(Object.keys(AMENITY_ICONS).sort(), [...AMENITY_IDS].sort());
});

test("icon shapes stay on the 24 px grid", () => {
  for (const [id, shapes] of [...Object.entries(AMENITY_ICONS), ...Object.entries(REACH_ICONS)]) {
    for (const shape of shapes) {
      if ("d" in shape) {
        assert.match(shape.d, /^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/, id);
      } else if ("cx" in shape) {
        assert.ok(shape.cx - shape.r >= 0 && shape.cx + shape.r <= 24, id);
        assert.ok(shape.cy - shape.r >= 0 && shape.cy + shape.r <= 24, id);
      } else {
        assert.ok(shape.x >= 0 && shape.x + shape.w <= 24 && shape.y >= 0 && shape.y + shape.h <= 24, id);
      }
    }
  }
  assert.deepEqual(Object.keys(REACH_ICONS).sort(), ["air", "rail", "road"]);
});

test("only the fixed ids are drawn", () => {
  assert.ok(isAmenityId("wifi"));
  assert.ok(isAmenityId("luggage"));
  assert.equal(isAmenityId("pool"), false);
  assert.equal(isAmenityId("constructor"), false);
  assert.equal(isAmenityId(""), false);
});
