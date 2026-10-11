/**
 * Personal-data guard (WEBSITE_UPGRADE section 7). Public-facing files and
 * docs must not carry the real names, handles or addresses of the people who
 * build Seedha. The blocked words are stored only as SHA-256 hashes, so this
 * file never repeats them. Fictional sample personas are not blocked.
 *
 * Each file is split into lower-cased word tokens and email-shaped tokens;
 * every token, and every pair of adjacent word tokens, is hashed and checked.
 * File paths are checked the same way, so a renamed file cannot keep a name.
 * Every file git tracks is scanned: text in full, PDFs by their metadata
 * fields, and Office files by their document properties. Other binaries
 * (images, fonts) are skipped.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

const REPO = resolve(import.meta.dirname, "..", "..", "..");

/** SHA-256 (hex) of each blocked token or token pair, lower-cased. */
const BLOCKED = new Set([
  "70c64570680ddcef112f9cd6bfe44f671b40fa653beacc67ab2832792b42934d", // pragma: allowlist secret
  "168f049aca6542622d68b00b7bb0f6bc53f55b795bfbf190e25e3a8256cb9363", // pragma: allowlist secret
  "f14fcebdb40705f5b8166ed9136a34a4936a2797c986ee95f4bd67e308dae4bc", // pragma: allowlist secret
  "e1515fb88f13542f175fd2ad131f79079487557fb88ebc8acf640c9ed754db1d", // pragma: allowlist secret
  "7290e492345306186996df9f3385a3c986b6e3914a6d2563dfc69ff060a77098", // pragma: allowlist secret
  "37bda420ed8181fa31b71e6466e33d7a3d9816a9183d77b11fc1187d9964f394", // pragma: allowlist secret
  "173628bacb5bef38b9e2f8381fa42cde95539ba1fe344b7a58a5efd5039901d0", // pragma: allowlist secret
  "e39b10ed75a9f909c2b06643a800137f04ccbad3c7545a04f91b201bcd5bfebd", // pragma: allowlist secret
]);

/** Office files whose document properties (author, last editor) are checked. */
const OFFICE = /\.(xlsx|docx|pptx)$/i;

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Every file git tracks, relative to the repo root. */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 })
    .split("\0")
    .filter(Boolean);
}

/** The Info dictionary strings and XMP packets of a PDF, where author names live. */
function pdfMetadata(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  const info = raw.match(/\/(Author|Creator|Producer|Title|Subject|Keywords)\s*\((?:\\.|[^\\)])*\)/g) ?? [];
  const xmp = raw.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g) ?? [];
  return [...info, ...xmp].join("\n");
}

/** The docProps/*.xml parts of a zipped Office file (core.xml holds the author). */
function officeMetadata(bytes: Buffer): string {
  const parts: string[] = [];
  // Walk the central directory: signature 0x02014b50, one record per entry.
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) return "";
  let at = bytes.readUInt32LE(end + 16);
  for (let n = bytes.readUInt16LE(end + 10); n > 0; n -= 1) {
    const method = bytes.readUInt16LE(at + 10);
    const size = bytes.readUInt32LE(at + 20);
    const nameLen = bytes.readUInt16LE(at + 28);
    const extraLen = bytes.readUInt16LE(at + 30);
    const commentLen = bytes.readUInt16LE(at + 32);
    const local = bytes.readUInt32LE(at + 42);
    const name = bytes.toString("utf8", at + 46, at + 46 + nameLen);
    if (name.startsWith("docProps/")) {
      const dataAt = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const data = bytes.subarray(dataAt, dataAt + size);
      parts.push((method === 8 ? inflateRawSync(data) : data).toString("utf8"));
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  return parts.join("\n");
}

/** The text of a tracked file that may carry a name, or null for other binaries. */
function scannableText(rel: string): string | null {
  const bytes = readFileSync(join(REPO, rel));
  if (/\.pdf$/i.test(rel)) return pdfMetadata(bytes);
  if (OFFICE.test(rel)) return officeMetadata(bytes);
  return bytes.subarray(0, 8192).includes(0) ? null : bytes.toString("utf8");
}

/** Hashes of the tokens in a text that are blocked, with the line they are on. */
function blockedHits(text: string): { line: number; hash: string }[] {
  const hits: { line: number; hash: string }[] = [];
  text
    .toLowerCase()
    .split("\n")
    .forEach((line, index) => {
      const words = line.match(/[\p{L}\p{N}]+/gu) ?? [];
      const emails = line.match(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+/gu) ?? [];
      const candidates = [...words, ...emails];
      for (let i = 0; i + 1 < words.length; i += 1) candidates.push(`${words[i]} ${words[i + 1]}`);
      for (const token of candidates) {
        const hash = sha(token);
        if (BLOCKED.has(hash)) hits.push({ line: index + 1, hash: hash.slice(0, 12) });
      }
    });
  return hits;
}

test("the hash list and scanner work on a harmless sample", () => {
  assert.equal(BLOCKED.size, 8);
  for (const hash of BLOCKED) assert.match(hash, /^[0-9a-f]{64}$/);
  // Fictional personas stay allowed.
  assert.deepEqual(blockedHits("Namaste Rahul ji. Rahul Sharma, Neha Gupta, Pooja and Rajesh ji."), []);
});

test("no tracked file, path or file metadata carries a blocked personal word", () => {
  const files = trackedFiles();
  assert.ok(files.length > 300, `scanned only ${files.length} files`);
  const problems: string[] = [];
  for (const rel of files) {
    for (const hit of blockedHits(rel.replaceAll("/", " "))) problems.push(`${rel} (path) #${hit.hash}`);
    const text = scannableText(rel);
    if (text === null) continue;
    for (const hit of blockedHits(text)) problems.push(`${rel}:${hit.line} #${hit.hash}`);
  }
  assert.deepEqual(problems, [], `personal data found:\n${problems.join("\n")}`);
});

test("PDF and Office metadata readers find an author field", () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Author (Sample Author) /Title (Deck) >> endobj", "latin1");
  assert.match(pdfMetadata(pdf), /Sample Author/);
  assert.equal(officeMetadata(Buffer.from("not a zip")), "");
});
