import { expect, test } from "@playwright/test";

/**
 * D4: a new owner signs up with a WhatsApp number, types the code (simulated
 * sender; SEEDHA_DEMO=1 shows it in a labelled banner) and finishes the
 * 4-step onboarding, which ends on Upload.
 */
test("sign up, verify the code and finish onboarding", async ({ page }) => {
  await page.goto("/signup");
  await page.fill("#su-name", "Meera Rawat");
  await page.fill("#su-hotel", "Pine Crest Homestay");
  await page.fill("#su-phone", "9811122233");
  const submit = page.locator("#signup-submit");
  await expect(submit).toBeDisabled(); // terms box starts unticked
  await page.check("#su-terms");
  await submit.click();

  await expect(page).toHaveURL(/\/otp/);
  await expect(page.getByText(/\+91 98111 •••33/)).toBeVisible();
  const code = ((await page.locator("#demo-code").textContent()) ?? "").replace(/\D/g, "");
  expect(code).toMatch(/^\d{6}$/);
  await page.fill("#otp-code", code);
  await page.click("#otp-verify");

  await expect(page).toHaveURL(/\/onboard/);
  const next = page.locator("#onboard-next");
  if (!(await page.inputValue("#ob-name"))) await page.fill("#ob-name", "Pine Crest Homestay");
  await page.fill("#ob-town", "Nainital");
  await page.fill("#ob-rooms", "12");
  await next.click(); // property
  await next.click(); // commission contracts (defaults)
  await next.click(); // cost per occupied room (optional)
  await page.getByRole("button", { name: "Connect WhatsApp" }).click();
  await expect(next).toHaveText("Continue to upload");
  await next.click();
  await expect(page).toHaveURL(/\/upload$/);
});
