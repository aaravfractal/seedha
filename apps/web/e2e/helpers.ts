import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Sign in to the sample hotel with Direct beta login (D4); lands on Overview. */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.click("#beta-login");
  await expect(page).toHaveURL(/\/home$/);
}
