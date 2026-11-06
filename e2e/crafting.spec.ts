import { expect, type Page, test } from "@playwright/test";
import { click, expectNoErrors, game, openFarm, queueLength } from "./helpers";

async function dismissLevelUps(page: Page) {
  for (let i = 0; i < 20; i++) {
    const heading = page.getByRole("heading", { name: "Level up!" });
    if (!(await heading.isVisible())) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

test("mill flour from bushels, wait, collect it and find it in the bag", async ({ page }) => {
  const errors = await openFarm(page);
  await game(page, (h) =>
    h.dispatch({
      type: "dev",
      op: { kind: "grant", xp: 3800, coins: 20_000, materials: { bushel_goldenstalk_wheat: 4 } },
    }),
  );
  await dismissLevelUps(page);
  expect(
    await game(page, (h) =>
      h.dispatch({ type: "buyPlace", defId: "windgrist_mill", x: 9, y: 9, rot: 0 }),
    ),
  ).toBeNull();

  // Click the mill: nothing to collect yet, so its crafting window opens.
  await click(page, 10, 10);
  await expect(page.getByRole("heading", { name: /Windgrist Mill/ })).toBeVisible();
  const flour = page.getByTestId("recipe-wheat_flour");
  await expect(flour).toContainText("4/2");
  await flour.getByRole("button", { name: "Make" }).click();
  await expect(page.getByTestId("craft-jobs")).toContainText("Wheat Flour");
  // One slot at tier 1, so everything else waits.
  await expect(page.getByTestId("recipe-cornmeal").getByRole("button")).toHaveText("Busy");
  await page.screenshot({ path: "test-results/crafting-dialog.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await game(page, (h) => h.clock.advance(2 * 60 * 60 * 1000 + 1000));
  await click(page, 10, 10);
  expect(await queueLength(page)).toBe(1);
  await game(page, (h) => h.flushQueue());
  const farm = await game(page, (h) => h.getFarm());
  expect(farm.materials.wheat_flour).toBe(1);
  expect(farm.materials.bushel_goldenstalk_wheat).toBe(2);

  await page.keyboard.press("b");
  await page.getByRole("tab", { name: /Goods/ }).click();
  await expect(page.getByTestId("bag-wheat_flour")).toBeVisible();
  await page.screenshot({ path: "test-results/crafting-bag.png" });
  await page.getByTestId("bag-wheat_flour").getByRole("button", { name: "Sell" }).click();
  await expect.poll(() => game(page, (h) => h.getFarm().materials.wheat_flour ?? 0)).toBe(0);
  await expectNoErrors(errors);
});
