import { expect, type Page, test } from "@playwright/test";
import { expectNoErrors, game, openFarm } from "./helpers";

async function dismissLevelUps(page: Page) {
  await page
    .getByRole("heading", { name: "Level up!" })
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  for (let i = 0; i < 20; i++) {
    if (!(await page.getByRole("heading", { name: "Level up!" }).isVisible())) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

/** Moves the game clock forward to the next given UTC date (month 1–12) at noon. */
async function advanceTo(page: Page, month: number, day: number) {
  await game(
    page,
    (h, target: { month: number; day: number }) => {
      const now = h.clock.now();
      const year = new Date(now).getUTCFullYear();
      let at = Date.UTC(year, target.month - 1, target.day, 12);
      if (at <= now) at = Date.UTC(year + 1, target.month - 1, target.day, 12);
      h.clock.advance(at - now);
    },
    { month, day },
  );
  await page.waitForTimeout(1200); // the HUD and lighting re-check the event each second
}

test("the Lantern Harvest Fair: event crop, tokens, shop, mood, and leftovers after it ends", async ({
  page,
}) => {
  const errors = await openFarm(page, { quality: "high" });
  await game(page, (h) =>
    h.dispatch({ type: "dev", op: { kind: "grant", xp: 330, coins: 50_000 } }),
  );
  await dismissLevelUps(page);
  await advanceTo(page, 10, 27);

  await expect(page.getByTestId("rail-event")).toBeVisible();
  // Grow ten Lantern Gourds (triple tokens) and harvest them.
  await game(page, (h) => {
    h.dispatch({ type: "settle" });
    for (let y = 8; y < 10; y++) {
      for (let x = 7; x < 12; x++) {
        h.enqueue({ type: "plow", x, y });
        h.enqueue({ type: "plant", x, y, cropId: "lantern_gourd" });
      }
    }
    h.flushQueue();
    h.clock.advance(4 * 3_600_000 + 60_000);
    for (let y = 8; y < 10; y++) for (let x = 7; x < 12; x++) h.enqueue({ type: "harvest", x, y });
    h.flushQueue();
  });
  await dismissLevelUps(page);
  const tokens = await game(page, (h) => h.getFarm().events.lantern_fair?.tokens ?? 0);
  expect(tokens).toBeGreaterThanOrEqual(60);

  await page.getByTestId("rail-event").click();
  await expect(page.getByTestId("event-tokens")).toContainText(String(tokens));
  await page.getByTestId("event-item-jack_sentinel").getByRole("button").click();
  expect(await game(page, (h) => h.getFarm().inventory.items.jack_sentinel)).toBe(1);
  await page.screenshot({ path: "test-results/event-shop.png" });
  await page.keyboard.press("Escape");
  await game(page, (h) => h.setCamera({ targetX: 9, targetZ: 8, zoom: 80 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/event-autumn.png" });

  // After the fair: no event button, and the leftovers became coins.
  const left = await game(page, (h) => h.getFarm().events.lantern_fair?.tokens ?? 0);
  const coins = await game(page, (h) => h.getFarm().wallet.coins);
  await advanceTo(page, 11, 20);
  await game(page, (h) => h.dispatch({ type: "settle" }));
  await expect(page.getByTestId("rail-event")).toHaveCount(0);
  expect(await game(page, (h) => h.getFarm().wallet.coins)).toBeGreaterThanOrEqual(
    coins + left * 5,
  );
  expect(await game(page, (h) => h.getFarm().events.lantern_fair?.settled)).toBe(true);
  await expectNoErrors(errors);
});
