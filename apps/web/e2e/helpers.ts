import { mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

/** Sign in to the sample hotel with Direct beta login (D4); lands on Overview. */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.click("#beta-login");
  await expect(page).toHaveURL(/\/home$/);
}

/**
 * Reset the sample hotel (POST /api/demo/reset). The API allows two resets a
 * minute; if a run ever lands on the limit, wait the window out once and try
 * again rather than fail the spec that is only cleaning up.
 */
export async function resetSampleHotel(page: Page): Promise<void> {
  const first = await page.request.post("/api/demo/reset");
  if (first.status() === 429) {
    await page.waitForTimeout(61_000);
    const again = await page.request.post("/api/demo/reset");
    expect(again.ok(), `demo reset after waiting: ${again.status()}`).toBe(true);
    return;
  }
  expect(first.ok(), `demo reset: ${first.status()}`).toBe(true);
}

/** KEY=value from the repo .env (or .env.example), the file playwright.config.ts reads. */
function envFileValue(key: string): string | undefined {
  const root = resolve(dirname(test.info().config.configFile ?? `${process.cwd()}/x`), "../..");
  let text = "";
  try {
    text = readFileSync(resolve(root, ".env"), "utf8");
  } catch {
    try {
      text = readFileSync(resolve(root, ".env.example"), "utf8");
    } catch {
      return undefined;
    }
  }
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1] === key) return match[2] ?? "";
  }
  return undefined;
}

/**
 * The origin every QR and guest link should use: PUBLIC_BASE_URL when set,
 * else the web origin the e2e servers run on. playwright.config.ts passes the
 * .env file's values over the shell's, so a key present there wins.
 */
export function expectedPublicOrigin(baseURL: string | undefined): string {
  const fromFile = envFileValue("PUBLIC_BASE_URL");
  const configured = fromFile !== undefined ? fromFile : process.env.PUBLIC_BASE_URL;
  const origin = configured?.trim() || baseURL;
  expect(origin, "PUBLIC_BASE_URL or the e2e baseURL").toBeTruthy();
  return new URL(origin ?? "").origin;
}

/** True when the page scrolls sideways. */
export async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/** WCAG 2.1 A/AA violations axe finds on the page as it is now. */
export async function axeViolations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return result.violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}

const signedInStates = new Map<string, string>();

/**
 * Sign in with Direct beta login once per spec file and keep the session as
 * a Playwright storageState file under test-results/.auth/. Later calls in
 * the same file (same worker) return the same path without signing in
 * again, so a spec stays far below the login rate limit. Use it in
 * beforeAll: `const state = await signInOnce(browser);` then
 * `browser.newContext({ storageState: state })` for owner calls.
 */
export async function signInOnce(browser: Browser): Promise<string> {
  const info = test.info();
  const key = info.file;
  const known = signedInStates.get(key);
  if (known) return known;
  const path = resolve(info.project.outputDir, ".auth", `${basename(key).replace(/\W+/g, "-")}.json`);
  mkdirSync(dirname(path), { recursive: true });
  const context = await browser.newContext({ baseURL: info.project.use.baseURL });
  const page = await context.newPage();
  await signIn(page);
  await context.storageState({ path });
  await context.close();
  signedInStates.set(key, path);
  return path;
}
