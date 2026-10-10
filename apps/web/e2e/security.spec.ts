import { expect, test } from "@playwright/test";

/** M11 security pass, checked on the production build. */

const GUEST_PAGES = ["/", "/link", "/link/DEODAR-RS26", "/data-deletion", "/privacy", "/plans", "/login"];

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

test("an OTP number locks for 15 minutes after five wrong codes", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#phone", "9123456789");
  await page.click("#send-code");
  await expect(page).toHaveURL(/\/otp/);
  const real = (await page.locator("#demo-code").textContent())?.replace(/\D/g, "") ?? "";
  expect(real).toMatch(/^\d{6}$/);
  const wrong = real === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i += 1) {
    await page.fill("#otp-code", wrong);
    await page.click("#otp-verify");
    await expect(page.locator("#otp-error")).toBeVisible();
  }
  await expect(page.locator("#otp-error")).toContainText("Too many tries. Try again in 15 minutes.");
  await expect(page.locator("#otp-tries")).toHaveText("0 of 5 tries left");
});
