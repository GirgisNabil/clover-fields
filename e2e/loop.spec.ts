import { expect, test } from "@playwright/test";
import { coins, drag, expectNoErrors, game, openFarm, queueLength } from "./helpers";

test("harvest, plow, plant, grow and harvest again with real input", async ({ page }) => {
  const errors = await openFarm(page);
  expect(await coins(page)).toBe(600);

  // Drag across the four ripe starter crops with the Farm tool.
  await drag(page, [2, 4], [5, 4]);
  expect(await queueLength(page)).toBe(4);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/loop-walking.png" });

  await game(page, (h) => h.flushQueue());
  // Four clovers at 35, plus 50 from the welcome quest's first step.
  expect(await coins(page)).toBe(600 + 4 * 35 + 50);

  // The harvested plots are fallow; plow them again by dragging with the Plow tool.
  await game(page, (h) => h.setTool("plow"));
  await drag(page, [2, 4], [5, 4]);
  expect(await queueLength(page)).toBe(4);
  await game(page, (h) => h.flushQueue());
  // Plowing costs 10 a plot; the welcome quest's plow step pays 60.
  expect(await coins(page)).toBe(790 - 4 * 10 + 60);

  // Plant clover on the plowed row with the seed tool (plants the last chosen seed).
  await game(page, (h) => h.setTool("seed"));
  await drag(page, [2, 5], [5, 5]);
  await game(page, (h) => h.flushQueue());
  // Seeds cost 10 each; the plant step pays 80, and its XP reaches level 2 (+50).
  expect(await coins(page)).toBe(810 - 4 * 10 + 80 + 50);
  const planted = await game(
    page,
    (h) =>
      Object.values(h.getFarm().objects).filter((o) => o.kind === "plot" && o.soil === "planted")
        .length,
  );
  expect(planted).toBe(4);

  // Close the level-up celebration the plant step triggered.
  await page.getByRole("button", { name: "Hooray!" }).click();

  // Time passes; the crops ripen and can be harvested again.
  await game(page, (h) => h.clock.advance(3 * 60_000));
  await game(page, (h) => h.setTool("hand"));
  await drag(page, [2, 5], [5, 5]);
  expect(await queueLength(page)).toBe(4);
  await game(page, (h) => h.flushQueue());
  expect(await coins(page)).toBe(900 + 4 * 35);

  await game(page, (h) => h.setCamera({ targetX: 5, targetZ: 5, zoom: 95 }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/loop-closeup.png" });
  await expectNoErrors(errors);
});

test("dragging on grass with the Farm tool pans instead of acting", async ({ page }) => {
  await openFarm(page);
  const before = await game(page, (h) => h.camera());
  await drag(page, [3, 10], [7, 10]);
  const after = await game(page, (h) => h.camera());
  expect(await queueLength(page)).toBe(0);
  expect(
    Math.hypot(after.targetX - before.targetX, after.targetZ - before.targetZ),
  ).toBeGreaterThan(1);
});

test("the farm survives a reload and the queue does not", async ({ page }) => {
  await openFarm(page);
  await drag(page, [2, 4], [3, 4]);
  await game(page, (h) => h.flushQueue());
  // Let autosave settle, queue more work, then reload before the farmer gets to it.
  await page.waitForTimeout(2600);
  await drag(page, [4, 4], [5, 4]);
  expect(await queueLength(page)).toBe(2);
  await page.reload();
  await page.waitForFunction(() => window.__clover?.ready === true);
  expect(await coins(page)).toBe(670);
  expect(await queueLength(page)).toBe(0);
});

test("the farmer walks to queued jobs and does them", async ({ page }) => {
  const errors = await openFarm(page, { farmerWorks: true });
  await drag(page, [2, 4], [5, 4]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/farmer-working.png" });
  await expect.poll(() => queueLength(page), { timeout: 15_000 }).toBe(0);
  expect(await coins(page)).toBe(740 + 50); // + the welcome quest's first-harvest reward
  await expectNoErrors(errors);
});
