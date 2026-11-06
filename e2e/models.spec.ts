import { expect, test } from "@playwright/test";

test("every CC0 model loads and renders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("/dev/models");
  await page.waitForFunction(() => window.__clover?.ready === true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/model-gallery.png" });
  expect(errors.filter((e) => !e.includes("GPU stall") && !e.includes("THREE.Clock"))).toEqual([]);
});
