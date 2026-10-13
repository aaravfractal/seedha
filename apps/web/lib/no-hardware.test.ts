import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// docs/NO_HARDWARE.md part 2: nothing users see mentions hardware. The
// firmware/ folder and the device API stay in the repo, outside the product.

const WEB = resolve(import.meta.dirname, "..");
const REPO = resolve(WEB, "..", "..");

const FORBIDDEN = /esp32|printer|led ring|firmware|hardware cost/i;

/** The one README sentence allowed to name the firmware folder. */
const README_ALLOWED =
  "The firmware/ folder and the device API remain in the repo but are not part of the product shown to users.";

const PUBLIC_ROOTS = ["app/(website)", "app/plans", "app/(app)/plans", "components/website", "lib/plans.ts"];

function sourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return /\.(tsx?|css|md)$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((name) => sourceFiles(join(path, name)));
}

function offendingLines(text: string): string[] {
  return text
    .split("\n")
    .map((line, i) => [i + 1, line] as const)
    .filter(([, line]) => FORBIDDEN.test(line))
    .map(([n, line]) => `${n}: ${line.trim()}`);
}

test("public page sources never mention hardware", () => {
  const files = PUBLIC_ROOTS.flatMap((root) => sourceFiles(join(WEB, root)));
  assert.ok(files.length > 10, "public page sources were found");
  const found = files.flatMap((file) =>
    offendingLines(readFileSync(file, "utf8")).map((hit) => `${relative(WEB, file)}:${hit}`),
  );
  assert.deepEqual(found, []);
});

test("README mentions hardware only in the one allowlisted developer sentence", () => {
  const readme = readFileSync(join(REPO, "README.md"), "utf8");
  assert.equal(readme.split(README_ALLOWED).length - 1, 1, "the developer sentence appears once");
  assert.deepEqual(offendingLines(readme.replace(README_ALLOWED, "")), []);
});

test("the guard catches each forbidden phrase in any case", () => {
  for (const phrase of ["ESP32 box", "slip Printer", "the LED Ring", "Firmware build", "Hardware cost"]) {
    assert.equal(offendingLines(phrase).length, 1, phrase);
  }
  assert.deepEqual(offendingLines("Front desk screen on any phone or tablet"), []);
});
