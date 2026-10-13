import { expect, test, type Locator, type Page } from "@playwright/test";

// Website upgrade checks (docs/WEBSITE_UPGRADE.md section 7): the Seedha Pass
// and Event Radar sections, the shared globe and its static fallback, and the
// legal pages.

async function markerIds(list: Locator): Promise<string[]> {
  const ids = await list
    .locator("[data-marker]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-marker") ?? ""));
  return ids.sort();
}

/** Scroll a section into view so its globe lazy-loads, and return the section. */
async function openSection(page: Page, id: string): Promise<Locator> {
  const section = page.locator(`#${id}`);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible();
  return section;
}

test("both new sections render with their planned labels", async ({ page }) => {
  await page.goto("/");
  const pass = await openSection(page, "seedha-pass");
  await expect(pass.getByRole("heading", { level: 2 })).toContainText("Seedha Pass.");
  await expect(pass).toContainText("Shared between hotels only with the guest's separate consent.");
  await expect(pass.getByText("Planned", { exact: true }).first()).toBeVisible();
  await expect(pass.getByText("Phase 3", { exact: true })).toBeVisible();

  const radar = await openSection(page, "event-radar");
  await expect(radar).toContainText("Know about every event near you, not just Diwali.");
  await expect(radar).toContainText("Official event sources only. No scraping.");
  await expect(radar.getByText("Pro", { exact: true }).first()).toBeVisible();
  // No rupee figures in the new sections.
  for (const section of [pass, radar]) {
    expect(await section.innerText()).not.toMatch(/₹|\bRs\.?\s?\d/);
  }
});

test("the front desk section describes a phone or tablet screen, not a device", async ({ page }) => {
  await page.goto("/");
  const desk = await openSection(page, "desk");
  await expect(desk).toContainText("Front desk screen");
  await expect(desk).toContainText("on any phone or tablet at reception");
  await expect(desk).toContainText("says yes on their own phone");
  await expect(desk).toContainText("shown on screen or sent by WhatsApp");
  expect(await desk.innerText()).not.toMatch(/ESP32|printer|LED ring|firmware/i);
});

test("the layer toggle switches markers and the text list", async ({ page }) => {
  await page.goto("/");
  const pass = await openSection(page, "seedha-pass");
  const toggle = pass.getByTestId("globe-toggle");
  const passBtn = toggle.getByRole("button", { name: "Seedha Pass" });
  const radarBtn = toggle.getByRole("button", { name: "Event Radar" });
  await expect(passBtn).toHaveAttribute("aria-pressed", "true");
  await expect(radarBtn).toHaveAttribute("aria-pressed", "false");

  const list = pass.getByTestId("globe-list");
  await expect(list).toHaveAttribute("data-layer", "pass");
  await expect(list).toContainText("Planned town");
  const passIds = await markerIds(list);
  expect(passIds).toHaveLength(6);

  await radarBtn.click();
  await expect(radarBtn).toHaveAttribute("aria-pressed", "true");
  await expect(passBtn).toHaveAttribute("aria-pressed", "false");
  await expect(list).toHaveAttribute("data-layer", "radar");
  await expect(list).toContainText("Winter Line Carnival");
  await expect(list).toContainText("Sample");
  const radarIds = await markerIds(list);
  expect(radarIds.length).toBeGreaterThanOrEqual(1);
  expect(radarIds.length).toBeLessThanOrEqual(5);
  expect(radarIds).not.toEqual(passIds);

  // Keyboard: focus the pressed button and switch back with Enter on the other.
  await passBtn.focus();
  await page.keyboard.press("Enter");
  await expect(passBtn).toHaveAttribute("aria-pressed", "true");
});

test("the globe canvas, when drawn, carries the same markers as the list", async ({ page }) => {
  await page.goto("/");
  const pass = await openSection(page, "seedha-pass");
  const list = pass.getByTestId("globe-list");
  const canvas = pass.getByTestId("globe-canvas");
  const fallback = pass.getByTestId("globe-fallback");
  await expect(canvas.or(fallback)).toBeVisible();
  const listIds = await markerIds(list);
  if (await canvas.isVisible()) {
    await expect(canvas).toHaveAttribute("aria-hidden", /.*/);
    const attr = (await canvas.getAttribute("data-markers")) ?? "";
    expect(attr.split(" ").filter(Boolean).sort()).toEqual(listIds);
    // WCAG 2.2.2: the sway and pulse can be stopped.
    const pause = pass.getByTestId("globe-pause");
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
  } else {
    expect(await markerIds(fallback)).toEqual(listIds);
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the static land-only map with markers matching the list", async ({ page }) => {
    await page.goto("/");
    for (const id of ["seedha-pass", "event-radar"]) {
      const section = await openSection(page, id);
      const fallback = section.getByTestId("globe-fallback");
      await expect(fallback).toBeVisible();
      await expect(section.getByTestId("globe-canvas")).toHaveCount(0);
      expect(await markerIds(fallback)).toEqual(await markerIds(section.getByTestId("globe-list")));

      // Land is one filled shape. The only other paths are the arcs between
      // planned towns; nothing traces a country or state border.
      await expect(fallback.locator("path[data-land]")).toHaveCount(1);
      const strayPaths = await fallback
        .locator("path")
        .evaluateAll(
          (els) =>
            els.filter((el) => !el.hasAttribute("data-land") && !el.closest("g[class*='mapArcs']")).length,
        );
      expect(strayPaths).toBe(0);
    }
  });
});

test("the home page makes no request to another origin", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost:3001").origin;
  const foreign: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) foreign.push(req.url());
  });
  await page.goto("/");
  await openSection(page, "seedha-pass");
  await openSection(page, "event-radar");
  await page.waitForLoadState("networkidle");
  expect(foreign).toEqual([]);
});

const LEGAL = ["/privacy", "/terms", "/cookies", "/security", "/data-deletion"];
const PUBLIC = [...LEGAL, "/contact", "/about", "/careers"];

for (const path of PUBLIC) {
  test(`${path} has no bracket placeholders`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\[[^\]]*\]/);
    expect(text).not.toMatch(/example\.com|placeholder/i);
    if (LEGAL.includes(path)) {
      await expect(page.locator("main")).toContainText(
        "Draft for the hackathon prototype. Not legal advice. To be reviewed by a lawyer before launch.",
      );
      await expect(page.locator("main")).toContainText(/Last updated/i);
    }
  });
}
