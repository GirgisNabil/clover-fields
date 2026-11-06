import { expect, type Page, test } from "@playwright/test";
import { click, expectNoErrors, game, openFarm, queueLength } from "./helpers";

/** Closes every queued level-up window. */
async function dismissLevelUps(page: Page) {
  for (let i = 0; i < 20; i++) {
    const heading = page.getByRole("heading", { name: "Level up!" });
    if (!(await heading.isVisible())) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

test("buy a tractor and plow an area in one pass", async ({ page }) => {
  const errors = await openFarm(page);
  await game(page, (h) =>
    h.dispatch({ type: "dev", op: { kind: "grant", xp: 2100, coins: 20_000 } }),
  );
  await dismissLevelUps(page);
  await game(page, (h) =>
    h.dispatch({ type: "buyPlace", defId: "clodbuster_tractor", x: 9, y: 9, rot: 0 }),
  );
  await game(page, (h) => h.dispatch({ type: "buyItem", defId: "fuel_can", qty: 1 }));
  const fuelBefore = await game(page, (h) => h.getFarm().fuel.units);

  await page.keyboard.press("v");
  await expect(page.getByRole("button", { name: /Clodbuster Tractor/ })).toBeVisible();
  await click(page, 1, 10);
  expect(await queueLength(page)).toBe(1);
  await game(page, (h) => h.flushQueue());

  const plowed = await game(page, (h) =>
    Object.values(h.getFarm().objects)
      .filter((o) => o.kind === "plot" && o.soil === "plowed" && o.y >= 10)
      .map((o) => `${o.x},${o.y}`)
      .sort(),
  );
  expect(plowed).toEqual(["1,10", "1,11", "2,10", "2,11"]);
  expect(await game(page, (h) => h.getFarm().fuel.units)).toBe(fuelBefore - 4);

  await game(page, (h) => h.setCamera({ targetX: 5, targetZ: 9, zoom: 75 }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/vehicles.png" });
  await expectNoErrors(errors);
});
