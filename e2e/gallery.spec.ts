import { expect, test } from "@playwright/test";

test("every crop renders at every growth stage", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1400, height: 1400 });
  await page.goto("/dev/crops");
  await page.waitForFunction(() => window.__clover?.ready === true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/crop-gallery.png" });
  expect(errors).toEqual([]);
});
