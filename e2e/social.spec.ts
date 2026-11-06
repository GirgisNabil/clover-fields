import { expect, type Page, test } from "@playwright/test";
import { click, coins, expectNoErrors, game, openFarm } from "./helpers";

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

test("daily bonus streak, then a Fertilizer Sack from day two", async ({ page }) => {
  const errors = await openFarm(page);
  await game(page, (h) => h.dispatch({ type: "dev", op: { kind: "grant", xp: 330, coins: 5000 } }));
  await dismissLevelUps(page);

  await page.getByTestId("rail-daily").click();
  await expect(page.getByTestId("daily-calendar")).toBeVisible();
  const before = await coins(page);
  await page.getByRole("button", { name: "Claim day 1" }).click();
  await expect(page.getByRole("button", { name: "Come back tomorrow!" })).toBeDisabled();
  expect(await coins(page)).toBeGreaterThan(before);
  await page.screenshot({ path: "test-results/daily.png" });
  await page.keyboard.press("Escape");

  await game(page, (h) => h.clock.advance(24 * 3_600_000));
  await page.getByTestId("rail-daily").click();
  await page.getByRole("button", { name: "Claim day 2" }).click();
  expect(await game(page, (h) => h.getFarm().materials.fertilizer_sack)).toBe(2);
  await page.keyboard.press("Escape");

  // Use a sack on a freshly planted patch.
  await game(page, (h) => {
    for (let y = 8; y < 11; y++) {
      for (let x = 9; x < 12; x++) {
        h.enqueue({ type: "plow", x, y });
        h.enqueue({ type: "plant", x, y, cropId: "button_carrot" });
      }
    }
    h.flushQueue();
  });
  await dismissLevelUps(page);
  await page.keyboard.press("b");
  await page.getByRole("tab", { name: /Supplies/ }).click();
  await page.getByTestId("bag-fertilizer_sack").getByRole("button", { name: "Use" }).click();
  await page.waitForTimeout(400); // let the Bag close
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  await click(page, 10, 9);
  await page.waitForTimeout(500);
  const manured = await game(
    page,
    (h) =>
      Object.values(h.getFarm().objects).filter((o) => o.kind === "plot" && o.crop?.manure).length,
  );
  expect(manured).toBe(9);
  await expectNoErrors(errors);
});

test("visit a neighbour, do chores, earn a heart and open their gift", async ({ page }) => {
  const errors = await openFarm(page);
  await game(page, (h) => h.dispatch({ type: "dev", op: { kind: "grant", xp: 330 } }));
  await dismissLevelUps(page);

  await page.getByTestId("rail-neighbors").click();
  await page.getByTestId("neighbor-barnaby").getByRole("button", { name: "Visit" }).click();
  await expect(page.getByTestId("visit-bar")).toContainText("Barnaby Quill");
  await expect(page.getByTitle("Farm (1)")).toHaveCount(0); // toolbar hidden
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/visit.png" });

  const home = await game(page, (h) => h.getFarm().wallet.coins);
  for (let i = 0; i < 5; i++) {
    const target = await game(
      page,
      (h) => h.visit()?.targets.find((t) => t.kind !== "animal") ?? null,
    );
    if (!target) throw new Error("no chores left");
    await click(page, target.x, target.y);
    await expect(page.getByTestId("visit-bar")).toContainText(
      i === 4 ? "All done for today" : `${4 - i} chore`,
    );
  }
  expect(await game(page, (h) => h.getFarm().wallet.coins)).toBeGreaterThan(home);
  expect(await game(page, (h) => h.getFarm().neighbors.barnaby?.friendship)).toBe(5);

  await page.keyboard.press("h");
  await expect(page.getByTestId("visit-bar")).toHaveCount(0);
  await expect(page.getByTitle("Farm (1)")).toBeVisible();

  await page.getByTestId("rail-neighbors").click();
  await page
    .getByTestId("neighbor-barnaby")
    .getByRole("button", { name: /Open gift/ })
    .click();
  await expect(
    page.getByTestId("neighbor-barnaby").getByRole("button", { name: /Open gift/ }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/neighbors.png" });
  await expectNoErrors(errors);
});
