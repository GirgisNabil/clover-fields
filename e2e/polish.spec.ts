import { expect, test } from "@playwright/test";
import { expectNoErrors, game, openFarm } from "./helpers";

test("level-ups are celebrated one at a time", async ({ page }) => {
  const errors = await openFarm(page);
  await game(page, (h) => h.dispatch({ type: "dev", op: { kind: "grant", xp: 60 } }));
  await expect(page.getByRole("heading", { name: "Level up!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  await page.screenshot({ path: "test-results/level-up.png" });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Hooray!" }).click();
  await expect(page.getByRole("heading", { name: "Level up!" })).toBeHidden();
  expect(await game(page, (h) => h.getFarm().progress.level)).toBe(3);
  await expectNoErrors(errors);
});

test("works on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openFarm(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/phone.png" });
  await expectNoErrors(errors);
});
