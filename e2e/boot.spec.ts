import { expect, test } from "@playwright/test";

test("boots and renders the farm", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.waitForFunction(() => window.__clover?.ready === true);
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/boot.png" });

  expect(errors).toEqual([]);
});
