/**
 * Personal-data guard (WEBSITE_UPGRADE section 7). Public-facing files and
 * docs must not carry the real names, handles or addresses of the people who
 * build Seedha. The blocked words are stored only as SHA-256 hashes, so this
 * file never repeats them. Fictional sample personas are not blocked.
 *
 * Each file is split into lower-cased word tokens and email-shaped tokens;
 * every token, and every pair of adjacent word tokens, is hashed and checked.
 * File paths are checked the same way, so a renamed file cannot keep a name.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

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

/** Folders scanned recursively, relative to the repo root. */
const TREES = [
  "apps/web/app",
  "apps/web/components",
  "apps/web/lib",
  "apps/web/public",
  "firmware/seedha-desk/src",
  "firmware/seedha-desk/include",
  "firmware/seedha-desk/lib",
  "firmware/seedha-desk/test",
  "firmware/seedha-desk/tools",
  "docs",
];

/** Single files scanned, relative to the repo root. */
const FILES = [
  ".env.example",
  "CLAUDE.md",
  "README-dev.md",
  "apps/web/README.md",
  "apps/web/package.json",
  "apps/api/pyproject.toml",
  "firmware/seedha-desk/README.md",
  "firmware/seedha-desk/platformio.ini",
];

const TEXT = /\.(tsx?|mjs|js|css|md|txt|json|svg|html|ini|toml|cpp|c|h|hpp|py|example)$/i;
const SKIP_DIRS = new Set(["node_modules", ".next", ".pio", ".pio-core", ".venv", "__pycache__"]);

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT.test(name)) out.push(full);
  }
}

function scannedFiles(): string[] {
  const out: string[] = [];
  for (const tree of TREES) walk(join(REPO, tree), out);
  for (const file of FILES) if (existsSync(join(REPO, file))) out.push(join(REPO, file));
  for (const file of readdirSync(join(REPO, "design", "handoff-text"))) {
    if (file.endsWith(".md")) out.push(join(REPO, "design", "handoff-text", file));
  }
  return out;
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

test("no public-facing file or doc carries a blocked personal word", () => {
  const files = scannedFiles();
  assert.ok(files.length > 100, `scanned only ${files.length} files`);
  const problems: string[] = [];
  for (const file of files) {
    const rel = relative(REPO, file);
    for (const hit of blockedHits(rel.replaceAll("/", " "))) problems.push(`${rel} (path) #${hit.hash}`);
    for (const hit of blockedHits(readFileSync(file, "utf8"))) {
      problems.push(`${rel}:${hit.line} #${hit.hash}`);
    }
  }
  assert.deepEqual(problems, [], `personal data found:\n${problems.join("\n")}`);
});
