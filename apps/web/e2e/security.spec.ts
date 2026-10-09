import { expect, test } from "@playwright/test";

/** M11 security pass, checked on the production build. */

const GUEST_PAGES = ["/link", "/link/DEODAR-RS26", "/data-deletion", "/privacy", "/plans", "/login"];

test("pages send security headers and load without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
  });
  for (const path of GUEST_PAGES) {
    const res = await page.goto(path, { waitUntil: "networkidle" });
    const headers = res?.headers() ?? {};
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'self'");
    expect(headers["content-security-policy"], path).not.toContain("unsafe-eval");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("SAMEORIGIN");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
  expect(violations).toEqual([]);
});

test("owner login locks out after repeated wrong passcodes", async ({ page }) => {
  await page.goto("/login");
  let status = 0;
  for (let i = 0; i < 12 && status !== 429; i += 1) {
    const res = await page.request.post("/api/session", { data: { passcode: `wrong-${i}` } });
    status = res.status();
  }
  expect(status).toBe(429);
  await page.fill("#passcode", "still-wrong");
  await page.click("button[type=submit]");
  await expect(page.locator("#login-error")).toContainText("Too many tries");
});
