import { expect, type Page, test } from "@playwright/test";
import { expectNoErrors, game, openFarm } from "./helpers";

const bubble = (page: Page) => page.getByRole("dialog", { name: "Tutorial" });

test("the welcome tutorial follows the quest, survives a reload and can be skipped", async ({
  page,
}) => {
  const errors = await openFarm(page, { tutorial: true });
  await expect(bubble(page)).toContainText("clover sprouts are ripe");
  await expect(bubble(page)).toContainText("1/5");
  await page.screenshot({ path: "test-results/tutorial-1.png" });

  // Harvest the four ripe clovers (by queueing what the clicks would queue).
  await game(page, (h) => {
    for (let x = 2; x <= 5; x++) h.enqueue({ type: "harvest", x, y: 4 });
    h.flushQueue();
  });
  await expect(bubble(page)).toContainText("pick the Plow");
  await expect(page.getByTestId("celebration")).toContainText("First harvest done!");
  await page.screenshot({ path: "test-results/tutorial-2.png" });

  await game(page, (h) => {
    for (let x = 2; x <= 5; x++) h.enqueue({ type: "plow", x, y: 4 });
    h.flushQueue();
  });
  await expect(bubble(page)).toContainText("Open Seeds");

  // Reload mid-tutorial: it picks up at the same step.
  await page.waitForTimeout(1500); // let autosave run
  await page.reload();
  await page.waitForFunction(() => window.__clover?.ready === true);
  await expect(bubble(page)).toContainText("Open Seeds");
  await expect(bubble(page)).toContainText("3/5");

  await bubble(page).getByRole("button", { name: "Skip tutorial" }).click();
  await expect(page.getByTestId("tutorial")).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__clover?.ready === true);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("tutorial")).toHaveCount(0);
  await expectNoErrors(errors);
});

test("finishing the tutorial introduces the quest rail and Marigold's next task", async ({
  page,
}) => {
  const errors = await openFarm(page, { tutorial: true });
  await game(page, (h) => {
    h.setFarmerPaused(true);
    for (let x = 2; x <= 5; x++) h.enqueue({ type: "harvest", x, y: 4 });
    h.flushQueue();
    for (let x = 2; x <= 5; x++) h.enqueue({ type: "plow", x, y: 4 });
    h.flushQueue();
    for (let x = 2; x <= 5; x++) h.enqueue({ type: "plant", x, y: 4, cropId: "clover_sprout" });
    h.flushQueue();
    h.clock.advance(2 * 3_600_000);
    const hen = Object.values(h.getFarm().objects).find((o) => o.kind === "animal");
    if (hen) h.enqueue({ type: "collectAnimal", id: hen.id, x: hen.x, y: hen.y });
    h.flushQueue();
    h.dispatch({ type: "placeStored", defId: "daisy_bed", x: 0, y: 0, rot: 0 });
  });
  for (let i = 0; i < 10; i++) {
    const hooray = page.getByRole("button", { name: "Hooray!" });
    if (!(await hooray.isVisible())) break;
    await hooray.click();
    await page.waitForTimeout(200);
  }
  await expect(bubble(page)).toContainText("Neighbours bring you tasks");
  await page.screenshot({ path: "test-results/tutorial-rail.png" });
  await bubble(page).getByRole("button", { name: "Got it" }).click();
  await expect(page.getByTestId("tutorial")).toHaveCount(0);

  const farm = await game(page, (h) => h.getFarm());
  expect(farm.quests.done.welcome).toBeDefined();
  expect(farm.progress.level).toBeGreaterThanOrEqual(2);

  // Marigold's next line waits on the rail; her card shows it.
  await page.getByTestId("rail-green_fingers").click();
  await expect(page.getByTestId("quest-green_fingers")).toContainText("Harvest 15 crops");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/quest-card.png" });
  await page.keyboard.press("Escape");
  await expectNoErrors(errors);
});
