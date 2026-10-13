import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARD_TEXT, cardFaces, cardFacts, estimateWidth, printable, qrTarget } from "./cardLayout.ts";
import type { CardFace, CardFacts, Shape } from "./cardLayout.ts";

const FACTS: CardFacts = cardFacts({
  hotel: "Deodar View",
  url: "http://localhost:3000/h/deodar-view",
  displayUrl: "localhost:3000/h/deodar-view",
  location: "Mussoorie",
  tagline: "A quiet hotel above the valley",
  contact: { phone: "+91 90000 00000", whatsapp: "", email: "", address_en: "Mall Road" },
  checkIn: "12:00",
  checkOut: "11:00",
  nearby: [
    { name_en: "Gun Hill", minutes: 10, mode: "walk" },
    { name_en: "गन हिल", minutes: 5, mode: "drive" },
  ],
  notes: ["Nights are cold."],
  perk: "",
  sample: true,
  hideBranding: false,
});
const modules = () => 33;

function texts(shapes: Shape[]): string[] {
  return shapes.flatMap((s) => (s.kind === "text" ? [s.text] : s.kind === "turned" ? texts(s.shapes) : []));
}
function qrs(face: CardFace): string[] {
  const all = (shapes: Shape[]): string[] =>
    shapes.flatMap((s) => (s.kind === "qr" ? [s.text] : s.kind === "turned" ? all(s.shapes) : []));
  return all(face.shapes);
}

test("the in-room card has its QR on the front, and stay times on two lines on the back", () => {
  const [front, back] = cardFaces("room", FACTS, estimateWidth, modules);
  assert.deepEqual(qrs(front!), [qrTarget(FACTS.url, "room")]);
  assert.deepEqual(qrs(back!), []);
  assert.ok(texts(front!.shapes).includes(CARD_TEXT.roomHeadline));
  const lines = texts(back!.shapes);
  assert.ok(lines.includes("Check-in from 12:00"));
  assert.ok(lines.includes("Check-out by 11:00"));
});

test("the tent card is one landscape sheet with two identical faces, the upper one turned", () => {
  const faces = cardFaces("tent", FACTS, estimateWidth, modules);
  assert.equal(faces.length, 1);
  const sheet = faces[0]!;
  assert.ok(sheet.w > sheet.h);
  const turned = sheet.shapes.find((s) => s.kind === "turned");
  assert.ok(turned && turned.kind === "turned");
  const lower = sheet.shapes.filter((s) => s.kind === "text").map((s) => (s.kind === "text" ? s.text : ""));
  const upper = texts(turned.shapes).filter((t) => t !== CARD_TEXT.brand);
  assert.deepEqual(upper, lower);
  assert.equal(qrs(sheet).length, 2);
  assert.ok(qrs(sheet).every((q) => q.endsWith("?src=card-desk")));
});

test("no Hindi prints; the perk line is the owner's perk in gold, else the neutral line", () => {
  const all = (f: CardFacts) =>
    (["wallet", "room", "tent"] as const).flatMap((k) =>
      cardFaces(k, f, estimateWidth, modules).flatMap((face) => texts(face.shapes)),
    );
  assert.ok(all(FACTS).every((t) => !/[ऀ-ॿ]/.test(t)));
  assert.deepEqual(FACTS.nearby, ["Gun Hill, 10 min walk"]);
  assert.ok(all(FACTS).includes(CARD_TEXT.noPerk));
  const withPerk = { ...FACTS, perk: "Free evening tea" };
  const [front] = cardFaces("wallet", withPerk, estimateWidth, modules);
  const perk = front!.shapes.find((s) => s.kind === "text" && s.text === "Free evening tea");
  assert.ok(perk && perk.kind === "text" && perk.tone === "gold");
  assert.ok(!all(withPerk).includes(CARD_TEXT.noPerk));
  assert.equal(printable("देवदार"), "");
  assert.equal(printable(" Café  ‘Deodar’ "), "Café ‘Deodar’");
});

test("the preview's words are the PDF's words (site_cards.py)", () => {
  const py = readFileSync(new URL("../../api/app/services/site_cards.py", import.meta.url), "utf8");
  for (const words of [CARD_TEXT.scan, CARD_TEXT.scanShort, CARD_TEXT.roomHeadline, CARD_TEXT.sample])
    assert.ok(py.includes(`"${words}"`), words);
});
