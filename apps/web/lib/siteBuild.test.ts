import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captionError,
  fallbackLabels,
  moveItem,
  paiseToRupeeText,
  photoFileError,
  pointError,
  roomRowError,
  roomsError,
  rupeesToPaise,
  wordCount,
} from "./siteBuild.ts";

test("rupees typed by the owner become integer paise", () => {
  assert.equal(rupeesToPaise("4500"), 450_000);
  assert.equal(rupeesToPaise("4,500"), 450_000);
  assert.equal(rupeesToPaise(" ₹ 3,200 "), 320_000);
  assert.equal(rupeesToPaise("4500.5"), 450_050);
  assert.equal(rupeesToPaise("4500.05"), 450_005);
  assert.equal(rupeesToPaise("100000"), 10_000_000);
  assert.equal(rupeesToPaise("1,00,000"), 10_000_000);
});

test("non-prices are refused", () => {
  for (const bad of [
    "",
    "0",
    "0.00",
    "abc",
    "-500",
    "4500.555",
    "1e3",
    "100001",
    "100000.01",
    "10000001",
    "45 00",
  ]) {
    assert.equal(rupeesToPaise(bad), null, bad);
  }
});

test("paise back to input text", () => {
  assert.equal(paiseToRupeeText(450_000), "4500");
  assert.equal(paiseToRupeeText(450_005), "4500.05");
  assert.equal(paiseToRupeeText(0), "");
  assert.equal(paiseToRupeeText(12.5), "");
});

test("room rows need a name and a price", () => {
  assert.equal(roomRowError("Deluxe", "4500"), null);
  assert.match(roomRowError(" ", "4500") ?? "", /room name/);
  assert.match(roomRowError("Deluxe", "") ?? "", /price/);
  assert.match(roomRowError("x".repeat(61), "4500") ?? "", /60/);
  assert.match(roomRowError("D", "4500") ?? "", /at least 2/);
});

test("the room list: 1 to 10 rows, no name twice", () => {
  assert.equal(roomsError([{ name: "Deluxe", price: "4500" }]), null);
  assert.match(roomsError([]) ?? "", /at least one/);
  const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `Room ${i}`, price: "1000" }));
  assert.match(roomsError(eleven) ?? "", /10/);
  assert.match(
    roomsError([
      { name: "Deluxe", price: "4500" },
      { name: " deluxe ", price: "5000" },
    ]) ?? "",
    /Room 2: .*own name/,
  );
  assert.match(roomsError([{ name: "Deluxe", price: "abc" }]) ?? "", /Room 1: .*price/);
});

test("captions and points follow the API limits", () => {
  assert.equal(captionError("Morning view of the valley"), null);
  assert.equal(captionError("one two three four five six seven eight"), null);
  assert.match(captionError("one two three four five six seven eight nine") ?? "", /8 words/);
  assert.match(captionError("x".repeat(121)) ?? "", /120/);
  assert.equal(pointError("Breakfast on the terrace"), null);
  assert.match(pointError("  ") ?? "", /few words/);
  assert.match(pointError("x".repeat(121)) ?? "", /120/);
});

test("word counts", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("   "), 0);
  assert.equal(wordCount("Quiet rooms with a view"), 5);
  assert.equal(wordCount("शांत कमरे और पहाड़"), 4);
});

test("photo file checks before upload", () => {
  const mb = 1024 * 1024;
  assert.equal(photoFileError({ name: "a.jpg", type: "image/jpeg", size: 2 * mb }), null);
  assert.equal(photoFileError({ name: "a.webp", type: "image/webp", size: 10 * mb }), null);
  assert.match(photoFileError({ name: "a.jpg", type: "image/jpeg", size: 10 * mb + 1 }) ?? "", /10 MB/);
  assert.equal(photoFileError({ name: "a.heic", type: "", size: mb }), null);
  assert.equal(photoFileError({ name: "a.HEIC", type: "image/heic", size: mb }), null);
  assert.equal(photoFileError({ name: "a.png", type: "image/png", size: mb }), null);
  assert.match(
    photoFileError({ name: "a.gif", type: "image/gif", size: mb }) ?? "",
    /JPEG, PNG, WebP or HEIC/,
  );
  assert.match(photoFileError({ name: "a.pdf", type: "application/pdf", size: mb }) ?? "", /JPEG/);
  assert.match(photoFileError({ name: "a.png", type: "image/png", size: 0 }) ?? "", /empty/);
});

test("moving an item", () => {
  assert.deepEqual(moveItem([1, 2, 3], 0, 2), [2, 3, 1]);
  assert.deepEqual(moveItem([1, 2, 3], 2, 1), [1, 3, 2]);
  assert.deepEqual(moveItem([1, 2, 3], 0, -1), [1, 2, 3]);
  assert.deepEqual(moveItem([1, 2, 3], 3, 0), [1, 2, 3]);
});

test("fallback fields in plain words, each once", () => {
  assert.deepEqual(
    fallbackLabels([
      "description_hi",
      "why_book_direct_en",
      "google_description_en",
      "rooms.0.blurb_en",
      "rooms.1.blurb_hi",
      "photos.12.caption_hi",
      "photos.13.caption_en",
      "photo_order",
      "something_new",
    ]),
    [
      "Description (Hindi)",
      "Why book direct (English)",
      "Google description (English)",
      "Room descriptions",
      "Photo captions",
      "Photo order",
    ],
  );
  assert.deepEqual(fallbackLabels([]), []);
});
