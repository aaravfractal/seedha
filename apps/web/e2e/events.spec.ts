import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Event Radar Lite on the Calendar (B6). The e2e servers run without an
 * ANTHROPIC_API_KEY, so extraction is the labelled sample. Everything this
 * spec saves is deleted again so other specs see the calendar unchanged.
 */

const SOURCE = "https://e2e-events.example.org/notices/winter-line";
const NOTICE =
  "Winter Line Carnival, Mussoorie. Cultural evenings on the Mall Road from 25 to 30 December. " +
  "Organised by the town committee.";

type OwnerEventRow = { id: number; source_url: string };

/** Delete every event this spec may have saved, through the same proxy the page uses. */
async function cleanUp(page: Page): Promise<void> {
  const res = await page.request.get("/api/events");
  if (!res.ok()) return;
  const rows = (await res.json()) as OwnerEventRow[];
  for (const row of rows.filter((r) => r.source_url === SOURCE)) {
    const del = await page.request.delete(`/api/events/${row.id}`);
    expect(del.ok()).toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await cleanUp(page);
});

test.afterEach(async ({ page }) => {
  await cleanUp(page);
});

test("an http:// source link is refused before anything is sent", async ({ page }) => {
  let extractCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/events/extract")) extractCalls += 1;
  });
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add events" }).click();
  const sheet = page.getByRole("dialog", { name: "Add events from your source." });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Seedha does not fetch or scrape websites.");
  await sheet.getByLabel("Paste the event notice").fill(NOTICE);
  await sheet.getByLabel("Official source link").fill("http://e2e-events.example.org/notice");
  await sheet.getByRole("button", { name: "Read events" }).click();
  await expect(sheet.getByText("Use the https:// address of the source.")).toBeVisible();
  await expect(sheet.getByText("Sample extraction")).toHaveCount(0);
  expect(extractCalls).toBe(0);

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add events" })).toBeFocused();

  // The API refuses it too, whatever the page does.
  const direct = await page.request.post("/api/events/extract", {
    data: { text: NOTICE, source_url: "http://e2e-events.example.org/notice" },
  });
  expect(direct.status()).toBe(422);
  expect(await direct.text()).toContain("bad_source_url");
});

test("a notice over 6,000 characters is held back by the counter", async ({ page }) => {
  let extractCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/events/extract")) extractCalls += 1;
  });
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add events" }).click();
  const sheet = page.getByRole("dialog", { name: "Add events from your source." });
  const box = sheet.getByLabel("Paste the event notice");
  await box.fill("a".repeat(6_010));
  await expect(sheet.getByText("6,010 / 6,000")).toBeVisible();
  await expect(sheet.getByText("6,010 of 6,000 characters. Remove 10 to continue.")).toBeVisible();
  await expect(box).toHaveAttribute("aria-invalid", "true");
  await sheet.getByLabel("Official source link").fill(SOURCE);
  await sheet.getByRole("button", { name: "Read events" }).click();
  await expect(sheet.getByText("Sample extraction")).toHaveCount(0);
  expect(extractCalls).toBe(0);

  // Back under the limit, the error goes away.
  await box.fill("a".repeat(6_000));
  await expect(sheet.getByText("6,000 / 6,000")).toBeVisible();
  await expect(sheet.getByText(/Remove \d+ to continue/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("paste, read as sample extraction, save, plan, preview and delete", async ({ page }) => {
  await page.goto("/calendar");
  await expect(
    page.getByText("You set any rate change. Seedha never suggests a price.").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add events" }).click();
  const sheet = page.getByRole("dialog", { name: "Add events from your source." });
  await sheet.getByLabel("Paste the event notice").fill(NOTICE);
  await expect(sheet.getByText(`${NOTICE.length} / 6,000`)).toBeVisible();
  await sheet.getByLabel("Official source link").fill(SOURCE);
  await sheet.getByRole("button", { name: "Read events" }).click();

  await expect(sheet.getByText("Sample extraction").first()).toBeVisible();
  await expect(sheet.getByText("No Claude key is set")).toBeVisible();
  await expect(sheet.getByText(/Likely overnight demand: (Low|Medium|High)/).first()).toBeVisible();
  await expect(sheet).not.toContainText("₹");
  await sheet.getByRole("button", { name: "Save events" }).click();
  await expect(sheet).toHaveCount(0);

  // Saved on the API: still there after a reload, labelled as the owner's own sample read.
  await page.reload();
  const card = page.locator("article").filter({ hasText: "From your sources" }).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Sample extraction");
  await expect(card).toContainText(/Likely overnight demand/);
  const link = card.getByRole("link", { name: /e2e-events\.example\.org/ });
  await expect(link).toHaveText("e2e-events.example.org");
  await expect(link).toHaveAttribute("href", SOURCE);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(card).not.toContainText("₹");

  await card.getByRole("button", { name: "Add to plan" }).click();
  await expect(card.getByRole("button", { name: "Remove from plan" })).toBeVisible();
  await page.reload();
  await expect(card.getByRole("button", { name: "Remove from plan" })).toBeVisible();
  await card.getByRole("button", { name: "Remove from plan" }).click();
  await expect(card.getByRole("button", { name: "Add to plan" })).toBeVisible();

  const preview = page.getByRole("region", { name: "Morning WhatsApp preview" });
  await expect(preview.getByText("Simulated send").first()).toBeVisible();
  await preview.getByRole("button", { name: "हिंदी" }).click();
  await preview.getByRole("button", { name: "English" }).click();
  await preview.getByRole("button", { name: "Send to me (simulated)" }).click();
  await expect(page.getByText("Simulated send logged")).toBeVisible();

  await card.getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Delete event" }).click();
  await expect(page.locator("article").filter({ hasText: "From your sources" })).toHaveCount(0);
});
