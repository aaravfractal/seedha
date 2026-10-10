import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * M11: the flip is interactive in under a second on the production build.
 * Runs after loop.spec.ts, so the 1,500 statement lines are loaded.
 */
test("the flip renders and re-ranks in under a second", async ({ page }) => {
  await signIn(page);

  const timings: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    await page.goto("/flip", { waitUntil: "commit" });
    // Interactive: ranked rows are on screen and the toggle is wired up.
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".row .nm").length >= 6 &&
        document.querySelector<HTMLButtonElement>(".toggle button[aria-pressed='false']") !== null,
      undefined,
      { polling: "raf" },
    );
    timings.push(await page.evaluate(() => performance.now()));
  }
  const ready = Math.max(...timings);
  test.info().annotations.push({
    type: "flip ready (ms)",
    description: timings.map((t) => Math.round(t)).join(", "),
  });
  expect(ready).toBeLessThan(1000);

  // Measured in the page, so Playwright's own click checks are not counted.
  const reranked = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".toggle button")).find(
          (b) => b.textContent?.trim() === "By money kept",
        );
        const started = performance.now();
        button?.click();
        const check = () => {
          if (document.querySelectorAll(".row .nm")[4]?.textContent === "MakeMyTrip") {
            resolve(performance.now() - started);
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      }),
  );
  test.info().annotations.push({ type: "re-ranked (ms)", description: String(Math.round(reranked)) });
  expect(reranked).toBeLessThan(300);
});
