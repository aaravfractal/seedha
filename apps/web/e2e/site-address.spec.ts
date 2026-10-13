import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { axeViolations, resetSampleHotel, signIn } from "./helpers";

/**
 * Hotel addresses (docs/SITE_REAL.md section 5): publish under a chosen slug,
 * the public page at /h/<slug> and at <slug>.localhost:<port> (Chromium
 * resolves *.localhost itself), renamed and old addresses, the not-live 404,
 * owner pages 404 on a hotel host, branding, Copy, Share on WhatsApp and the
 * QR download. Sample data only; the hotel is reset before and after.
 */

const SLUG = "deodar-e2e";
const NOT_LIVE = "This hotel site isn't live yet";

function hotelOrigin(baseURL: string | undefined, slug: string): string {
  const url = new URL(baseURL ?? "http://localhost:3000");
  return `${url.protocol}//${slug}.localhost:${url.port}`;
}

async function apiCall(page: Page, method: "PATCH" | "POST", path: string, data: object) {
  return page.request.fetch(`/api/${path}`, { method, data });
}

test.describe.configure({ mode: "serial" });

test("publish under a chosen address, then open, share and protect it", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(page);
  await resetSampleHotel(page);

  // Publish through the API: bad and reserved slugs are refused with their codes.
  expect((await apiCall(page, "PATCH", "site", { stage: "review" })).ok()).toBe(true);

  // The Publish panel checks the address as the owner types and previews it.
  await page.goto("/site");
  const picker = page.getByRole("region", { name: "Pick your address" });
  const box = picker.getByLabel("Address", { exact: true });
  await expect(box).toHaveValue("deodar-view");
  await box.fill("admin");
  await expect(picker.getByText("This address is reserved. Please pick another.")).toBeVisible();
  await expect(picker.getByRole("button", { name: "Publish site" })).toBeDisabled();
  await box.fill("Deodar E2E");
  await expect(box).toHaveValue(SLUG);
  await expect(picker.getByText("Available")).toBeVisible();
  await expect(picker.getByText(new RegExp(`/h/${SLUG}$`))).toBeVisible();
  await expect(picker.getByRole("button", { name: "Publish site" })).toBeEnabled();
  expect(await axeViolations(page)).toEqual([]);

  const reserved = await apiCall(page, "POST", "site/publish", { slug: "admin" });
  expect(reserved.status()).toBe(422);
  expect((await reserved.json()).error.code).toBe("slug_reserved");
  const invalid = await apiCall(page, "POST", "site/publish", { slug: "a--b" });
  expect((await invalid.json()).error.code).toBe("slug_invalid");
  const published = await apiCall(page, "POST", "site/publish", { slug: SLUG });
  expect(published.ok()).toBe(true);
  const body = (await published.json()) as { slug: string; url: string; published: boolean };
  expect(body).toMatchObject({ slug: SLUG, published: true });
  expect(body.url).toMatch(new RegExp(`/h/${SLUG}$`));
  const address = (await (await page.request.get("/api/site/address")).json()) as Record<string, unknown>;
  expect(address).toMatchObject({ slug: SLUG, published: true, root_domain: "" });

  // The public page at /h/<slug>, with Seedha branding.
  const live = await page.goto(`/h/${SLUG}`);
  expect(live?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Powered by Seedha", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Book direct · Powered by Seedha/ })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  // The old /hotel/<slug> address and the pre-rename slug both 308 to the new address.
  await page.goto("/hotel/deodar-view");
  await expect(page).toHaveURL(new RegExp(`/h/${SLUG}$`));
  const moved = await page.request.get("/h/deodar-view", { maxRedirects: 0 });
  expect(moved.status()).toBe(308);
  expect(moved.headers()["location"]).toMatch(new RegExp(`/h/${SLUG}$`));

  // The hotel's own host: the page at "/", nothing else.
  const host = hotelOrigin(baseURL, SLUG);
  const onHost = await page.goto(`${host}/`);
  expect(onHost?.status()).toBe(200);
  await expect(page.getByRole("link", { name: "Powered by Seedha", exact: true })).toBeVisible();
  for (const path of ["/login", "/home", "/site", "/settings", `/h/${SLUG}`]) {
    const res = await page.goto(`${host}${path}`);
    expect(res?.status(), path).toBe(404);
  }
  const ownerApi = await page.goto(`${host}/api/site`);
  expect(ownerApi?.status()).toBe(404);

  // Unknown addresses: a real 404 with the not-live sentence, on both forms.
  for (const url of ["/h/no-such-hotel", `${hotelOrigin(baseURL, "no-such-hotel")}/`]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(404);
    await expect(page.getByText(NOT_LIVE).first()).toBeVisible();
  }

  // The Pro setting hides the branding.
  expect((await apiCall(page, "PATCH", "site/branding", { hide_branding: true })).ok()).toBe(true);
  await page.goto(`/h/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Powered by Seedha", exact: true })).toHaveCount(0);
  await expect(page.getByText("Powered by Seedha")).toHaveCount(0);
  expect((await apiCall(page, "PATCH", "site/branding", { hide_branding: false })).ok()).toBe(true);

  // The owner's Publish panel: Copy, Share on WhatsApp and the QR download.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(baseURL ?? "").origin,
  });
  await page.goto("/site");
  const panel = page.getByRole("region", { name: "Your site is live" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: new RegExp(`/h/${SLUG}$`) })).toBeVisible();

  await panel.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByText("Address copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(body.url);

  const share = panel.getByRole("link", { name: "Share on WhatsApp" });
  const href = (await share.getAttribute("href")) ?? "";
  expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  expect(decodeURIComponent(href.slice("https://wa.me/?text=".length))).toContain(body.url);

  await expect(panel.getByRole("img", { name: /QR code for/ })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("link", { name: "Download QR code" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`${SLUG}-qr.png`);
  expect(await axeViolations(page)).toEqual([]);

  await resetSampleHotel(page);
});
