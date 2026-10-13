/**
 * The printed cards' layout, mirrored from the PDF (apps/api/app/services/
 * site_cards.py) so the owner's browser preview is the card that prints:
 * the same faces, positions, sizes, fonts (Times bold headings, Helvetica
 * body), colours and words. English only, as the PDF prints no Hindi.
 *
 * Pure (no "@/" imports) so node --test runs it. Coordinates are PDF points
 * on the trim (no bleed); shapes come out in SVG coordinates (y down). Text
 * widths come from a `Measure` (canvas in the browser, an estimate in tests).
 * Nothing here is money: cards carry no prices.
 */
import type { CardKind } from "./types-site-v2-owner.ts";

/** Points per millimetre, as the PDF uses. */
export const MM = 72 / 25.4;
const QUIET_MODULES = 4;
const HEADING_LINES = 2;
const SMALLEST_HEADING = 4;

/** The PDF's words (site_cards.py), kept in one place for the preview. */
export const CARD_TEXT = {
  noPerk: "Book directly with the hotel",
  scan: "Scan to see rooms and book direct",
  scanShort: "Scan to book direct",
  roomHeadline: "Your next stay, booked direct",
  sample: "Sample card: fictional hotel",
  brand: "Seedha",
  checkIn: (time: string) => `Check-in from ${time}`,
  checkOut: (time: string) => `Check-out by ${time}`,
} as const;

/** The Pine mood as the cards print it. Gold is for the owner's perk line only. */
export const CARD_COLOURS = {
  pine: "#1F4D3A",
  cream: "#F5F1E8",
  stone: "#E6E0D4",
  ink: "#1D1D1F",
  grey: "#6E6E73",
  gold: "#E8A33D",
} as const;
export type Tone = keyof typeof CARD_COLOURS;

export type CardFont = "head" | "body" | "bodyBold";
/** The width in points of `text` set in `font` at `size` points. */
export type Measure = (text: string, font: CardFont, size: number) => number;

export type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; tone: Tone }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      font: CardFont;
      size: number;
      tone: Tone;
      anchor: "start" | "middle" | "end";
    }
  | { kind: "qr"; x: number; y: number; side: number; text: string }
  | { kind: "turned"; shapes: Shape[] }
  | { kind: "fold"; y: number };

export type CardFace = {
  /** "front", "back" or "printed sheet". */
  name: string;
  /** The caption under the preview. */
  caption: string;
  w: number;
  h: number;
  shapes: Shape[];
  /** Every printed line in reading order, and the QR target, for the text alternative. */
  words: string[];
};

/** What the cards print, from the hotel's own data (the PDF's CardData). */
export type CardFacts = {
  hotel: string;
  /** The site address the QR opens (before ?src=). */
  url: string;
  /** The address as printed. */
  displayUrl: string;
  location: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  checkIn: string;
  checkOut: string;
  /** "Name, N min walk|drive". */
  nearby: string[];
  notes: string[];
  /** The owner's card perk in English; empty prints the neutral line. */
  perk: string;
  sample: boolean;
  hideBranding: boolean;
};

const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** The text if the PDF's built-in fonts can draw all of it (cp1252), else "" (as the PDF does). */
export function printable(text: string): string {
  const one = text.split(/\s+/).filter(Boolean).join(" ");
  for (const ch of one) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(ch)) continue;
    return "";
  }
  return one;
}

/** The facts as the PDF keeps them: only printable text; nearby places as "Name, N min walk". */
export function cardFacts(input: {
  hotel: string;
  url: string;
  displayUrl: string;
  location: string;
  tagline: string;
  contact: { phone: string; whatsapp: string; email: string; address_en: string };
  checkIn: string;
  checkOut: string;
  nearby: ReadonlyArray<{ name_en: string; minutes: number; mode: "walk" | "drive" }>;
  notes: readonly string[];
  perk: string;
  sample: boolean;
  hideBranding: boolean;
}): CardFacts {
  return {
    hotel: printable(input.hotel) || printable(input.displayUrl),
    url: input.url,
    displayUrl: printable(input.displayUrl),
    location: printable(input.location),
    tagline: printable(input.tagline),
    phone: printable(input.contact.phone),
    whatsapp: printable(input.contact.whatsapp),
    email: printable(input.contact.email),
    address: printable(input.contact.address_en),
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nearby: input.nearby
      .filter((p) => printable(p.name_en))
      .map((p) => printable(`${p.name_en}, ${p.minutes} min ${p.mode === "walk" ? "walk" : "drive"}`)),
    notes: input.notes.map(printable).filter(Boolean),
    perk: printable(input.perk),
    sample: input.sample,
    hideBranding: input.hideBranding,
  };
}

/** The QR target, built as the API's `card_url` builds it. */
export function qrTarget(url: string, card: "wallet" | "room" | "desk"): string {
  return `${url}${url.includes("?") ? "&" : "?"}src=card-${card}`;
}

/** Greedy word wrap, as reportlab's simpleSplit. A word wider than the line keeps a line of its own. */
export function wrap(text: string, font: CardFont, size: number, width: number, measure: Measure): string[] {
  const rows: string[] = [];
  let row = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const next = row ? `${row} ${word}` : word;
    if (row && measure(next, font, size) > width) {
      rows.push(row);
      row = word;
    } else {
      row = next;
    }
  }
  if (row) rows.push(row);
  return rows;
}

/** The largest size up to `size` at which `text` fits `width` (the PDF's `fitted`). */
export function fitted(
  text: string,
  font: CardFont,
  size: number,
  width: number,
  measure: Measure,
  smallest = 6,
): number {
  let s = size;
  while (s > smallest && measure(text, font, s) > width) s -= 0.5;
  return s;
}

/** One card page being drawn in PDF coordinates (origin lower left); shapes come out y-down. */
class Sheet {
  readonly shapes: Shape[] = [];
  readonly words: string[] = [];
  readonly w: number;
  readonly h: number;
  readonly measure: Measure;
  constructor(w: number, h: number, measure: Measure) {
    this.w = w;
    this.h = h;
    this.measure = measure;
  }

  fill(tone: Tone, x: number, y: number, w: number, h: number): void {
    this.shapes.push({ kind: "rect", x, y: this.h - y - h, w, h, tone });
  }

  background(tone: Tone): void {
    this.fill(tone, 0, 0, this.w, this.h);
  }

  text(
    x: number,
    y: number,
    text: string,
    opts: { font?: CardFont; size?: number; tone?: Tone; align?: "left" | "centre" | "right" } = {},
  ): void {
    if (!text) return;
    const anchor = opts.align === "centre" ? "middle" : opts.align === "right" ? "end" : "start";
    this.shapes.push({
      kind: "text",
      x,
      y: this.h - y,
      text,
      font: opts.font ?? "body",
      size: opts.size ?? 8,
      tone: opts.tone ?? "ink",
      anchor,
    });
    this.words.push(text);
  }

  /** The hotel's name on baseline y: shrunk to fit one line, else two lines growing upwards. */
  heading(
    x: number,
    y: number,
    text: string,
    width: number,
    size: number,
    smallest: number,
    tone: Tone,
  ): void {
    let s = fitted(text, "head", size, width, this.measure, smallest);
    let rows = [text];
    if (this.measure(text, "head", s) > width) {
      for (;;) {
        rows = wrap(text, "head", s, width, this.measure);
        const fits = rows.every((r) => this.measure(r, "head", s) <= width);
        if (s <= SMALLEST_HEADING || (rows.length <= HEADING_LINES && fits)) break;
        s -= 0.5;
      }
    }
    // The last line sits on baseline y, earlier lines above it.
    rows.forEach((row, k) =>
      this.text(x, y + (rows.length - 1 - k) * s * 1.1, row, { font: "head", size: s, tone }),
    );
  }

  /** Wrapped text from baseline y down; returns the next free baseline. */
  lines(
    x: number,
    y: number,
    text: string,
    width: number,
    opts: { font?: CardFont; size?: number; tone?: Tone; most?: number } = {},
  ): number {
    if (!text) return y;
    const size = opts.size ?? 8;
    let at = y;
    for (const line of wrap(text, opts.font ?? "body", size, width, this.measure).slice(0, opts.most ?? 3)) {
      this.text(x, at, line, { font: opts.font, size, tone: opts.tone });
      at -= size * 1.3;
    }
    return at;
  }

  /** The QR panel (symbol plus quiet zone) with its lower left at (x, y). */
  qr(text: string, x: number, y: number, side: number): void {
    this.shapes.push({ kind: "qr", x, y: this.h - y - side, side, text });
    this.words.push(`QR code to ${text}`);
  }
}

/** The QR panel's side in points: the symbol `qrMm` wide plus the 4-module quiet zone. */
export function qrPanelSide(modules: number, qrMm: number): number {
  return (qrMm * MM * (modules + 2 * QUIET_MODULES)) / modules;
}

/** The QR sizes the PDF draws (mm, without the quiet zone). */
const QR_MM = { wallet: 20, room: 30, tent: 42 } as const;
/** Trim sizes (mm). */
export const TRIM_MM = {
  wallet: [85.6, 54],
  room: [105, 148],
  tent: [210, 148],
} as const;

/** The owner's perk in gold, or the neutral line in the face's text colour. */
function perkLine(f: CardFacts, plain: Tone): { text: string; tone: Tone } {
  return f.perk ? { text: f.perk, tone: "gold" } : { text: CARD_TEXT.noPerk, tone: plain };
}

function sampleMark(p: Sheet, f: CardFacts, tone: Tone): void {
  if (f.sample) p.text(p.w - 3 * MM, p.h - 4 * MM, CARD_TEXT.sample, { size: 5, tone, align: "right" });
}

function brandMark(p: Sheet, f: CardFacts): void {
  if (!f.hideBranding)
    p.text(p.w - 3 * MM, 2.5 * MM, CARD_TEXT.brand, { size: 5, tone: "grey", align: "right" });
}

function walletFront(p: Sheet, f: CardFacts): void {
  p.background("pine");
  const left = 6 * MM;
  const width = p.w - 12 * MM;
  p.heading(left, p.h - 17 * MM, f.hotel, width, 16, 9, "cream");
  p.text(left, p.h - 23 * MM, f.location, { size: 7, tone: "stone" });
  p.lines(left, p.h - 30 * MM, f.tagline, width, { size: 6.5, tone: "cream", most: 2 });
  const perk = perkLine(f, "cream");
  p.text(left, 6 * MM, perk.text, { font: "bodyBold", size: 6, tone: perk.tone });
  sampleMark(p, f, "stone");
}

function walletBack(p: Sheet, f: CardFacts, modules: (text: string) => number): void {
  p.background("cream");
  const target = qrTarget(f.url, "wallet");
  const side = qrPanelSide(modules(target), QR_MM.wallet);
  p.qr(target, 3 * MM, (p.h - side) / 2, side);
  const left = 3 * MM + side + 3 * MM;
  const width = p.w - left - 4 * MM;
  let y = p.h - 12 * MM;
  p.heading(left, y, f.hotel, width, 10, 6, "pine");
  y = p.lines(left, y - 5 * MM, CARD_TEXT.scanShort, width, { font: "bodyBold", size: 6.5 });
  y = p.lines(left, y, f.displayUrl, width, { size: 6, tone: "grey", most: 2 });
  for (const [label, value] of [
    ["Phone", f.phone],
    ["WhatsApp", f.whatsapp],
  ] as const) {
    if (value) y = p.lines(left, y - 1, `${label} ${value}`, width, { size: 6, most: 1 });
  }
  sampleMark(p, f, "grey");
  brandMark(p, f);
}

function roomFront(p: Sheet, f: CardFacts, modules: (text: string) => number): void {
  p.background("cream");
  const band = 60 * MM;
  p.fill("pine", 0, p.h - band, p.w, band);
  const left = 9 * MM;
  const width = p.w - 18 * MM;
  p.heading(left, p.h - 24 * MM, f.hotel, width, 22, 12, "cream");
  p.text(left, p.h - 31 * MM, f.location, { size: 9, tone: "stone" });
  p.lines(left, p.h - 39 * MM, f.tagline, width, { size: 8.5, tone: "cream", most: 3 });
  const centre = p.w / 2;
  p.text(centre, 76 * MM, CARD_TEXT.roomHeadline, { font: "head", size: 13, tone: "pine", align: "centre" });
  const perk = perkLine(f, "pine");
  p.text(centre, 69 * MM, perk.text, { font: "bodyBold", size: 7.5, tone: perk.tone, align: "centre" });
  const target = qrTarget(f.url, "room");
  const side = qrPanelSide(modules(target), QR_MM.room);
  p.qr(target, centre - side / 2, 17 * MM, side);
  p.text(centre, 12 * MM, CARD_TEXT.scan, { size: 7.5, align: "centre" });
  p.text(centre, 7.5 * MM, f.displayUrl, { size: 7, tone: "grey", align: "centre" });
  sampleMark(p, f, "stone");
}

function roomBack(p: Sheet, f: CardFacts): void {
  p.background("cream");
  const left = 9 * MM;
  const width = p.w - 18 * MM;
  let y = p.h - 16 * MM;
  p.heading(left, y, f.hotel, width, 15, 9, "pine");
  const sections: [string, string[]][] = [
    [
      "Your stay",
      f.checkIn && f.checkOut ? [CARD_TEXT.checkIn(f.checkIn), CARD_TEXT.checkOut(f.checkOut)] : [],
    ],
    ["Nearby", f.nearby.slice(0, 4)],
    ["Good to know", f.notes.slice(0, 3)],
    [
      "Contact",
      [
        f.phone ? `Phone ${f.phone}` : "",
        f.whatsapp ? `WhatsApp ${f.whatsapp}` : "",
        f.email,
        f.address,
        f.displayUrl,
      ],
    ],
  ];
  y -= 9 * MM;
  for (const [title, entries] of sections) {
    const items = entries.filter(Boolean);
    if (!items.length || y < 24 * MM) continue;
    p.text(left, y, title.toUpperCase(), { font: "bodyBold", size: 7, tone: "pine" });
    y -= 4.5 * MM;
    for (const item of items) {
      if (y < 14 * MM) break;
      y = p.lines(left, y, item, width, { size: 8, most: 2 }) - 1;
    }
    y -= 3.5 * MM;
  }
  sampleMark(p, f, "grey");
  brandMark(p, f);
}

/** One 210 x 74 mm face of the tent card, drawn in the lower half. */
function tentFace(p: Sheet, f: CardFacts, modules: (text: string) => number, back: boolean): void {
  const faceH = p.h / 2;
  const target = qrTarget(f.url, "desk");
  const side = qrPanelSide(modules(target), QR_MM.tent);
  const qrX = p.w - 10 * MM - side;
  p.qr(target, qrX, (faceH - side) / 2, side);
  const left = 12 * MM;
  const width = qrX - 20 * MM;
  p.heading(left, faceH - 20 * MM, f.hotel, width, 26, 14, "cream");
  p.text(left, faceH - 28 * MM, f.location, { size: 10, tone: "stone" });
  const perk = perkLine(f, "cream");
  let y = p.lines(left, faceH - 40 * MM, perk.text, width, { font: "bodyBold", size: 10, tone: perk.tone });
  y = p.lines(left, y - 2 * MM, CARD_TEXT.scan, width, { size: 9, tone: "cream", most: 2 });
  p.lines(left, y, f.displayUrl, width, { size: 8.5, tone: "stone", most: 2 });
  if (f.sample)
    p.text(p.w - 4 * MM, faceH - 5 * MM, CARD_TEXT.sample, { size: 6, tone: "stone", align: "right" });
  if (back && !f.hideBranding)
    p.text(p.w - 4 * MM, 3 * MM, CARD_TEXT.brand, { size: 6, tone: "stone", align: "right" });
}

function sheet(kind: CardKind, measure: Measure): Sheet {
  const [w, h] = TRIM_MM[kind];
  return new Sheet(w * MM, h * MM, measure);
}

function face(name: string, caption: string, p: Sheet): CardFace {
  return { name, caption, w: p.w, h: p.h, shapes: p.shapes, words: p.words };
}

/**
 * The faces of one card as the PDF prints them: wallet front and back, in-room
 * front (with the QR) and back, and the tent card's one landscape sheet that
 * folds into two identical faces, the upper one turned 180 degrees.
 * `modules(text)` is the QR symbol's size in modules (level H).
 */
export function cardFaces(
  kind: CardKind,
  f: CardFacts,
  measure: Measure,
  modules: (text: string) => number,
): CardFace[] {
  if (kind === "wallet") {
    const front = sheet("wallet", measure);
    walletFront(front, f);
    const back = sheet("wallet", measure);
    walletBack(back, f, modules);
    return [face("front", "Front", front), face("back", "Back", back)];
  }
  if (kind === "room") {
    const front = sheet("room", measure);
    roomFront(front, f, modules);
    const back = sheet("room", measure);
    roomBack(back, f);
    return [face("front", "Front", front), face("back", "Back", back)];
  }
  const p = sheet("tent", measure);
  p.background("pine");
  tentFace(p, f, modules, false);
  const lower = p.shapes.splice(1);
  const lowerWords = p.words.splice(0);
  tentFace(p, f, modules, true);
  const upper = p.shapes.splice(1);
  p.shapes.push({ kind: "turned", shapes: upper }, ...lower, { kind: "fold", y: p.h / 2 });
  // Both faces print the same words; say them once.
  p.words.splice(0, p.words.length, ...lowerWords);
  return [
    face(
      "printed sheet",
      "One A5 sheet. Fold it along the dashed line (not printed): the upper face is upside down so both sides read upright on the desk.",
      p,
    ),
  ];
}

/** A width estimate for tests and before fonts can be measured (Helvetica averages about half an em). */
export const estimateWidth: Measure = (text, font, size) =>
  [...text].length * size * (font === "bodyBold" ? 0.55 : 0.5);
