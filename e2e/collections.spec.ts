import { expect, type Page, test } from "@playwright/test";
import { expectNoErrors, game, openFarm } from "./helpers";

async function dismissLevelUps(page: Page) {
  for (let i = 0; i < 20; i++) {
    if (!(await page.getByRole("heading", { name: "Level up!" }).isVisible())) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

test("trade spares, turn in a collection, and see ribbons in the Farm Book", async ({ page }) => {
  const errors = await openFarm(page);
  await game(page, (h) =>
    h.dispatch({
      type: "dev",
      op: {
        kind: "grant",
        xp: 1200,
        materials: {
          col_plowmans_finds_1: 4,
          col_plowmans_finds_2: 4,
          col_plowmans_finds_3: 1,
          col_plowmans_finds_4: 1,
          col_plowmans_finds_6: 1,
        },
      },
    }),
  );
  await dismissLevelUps(page);

  await page.keyboard.press("j");
  await expect(page.getByRole("heading", { name: /Farm Book/ })).toBeVisible();
  const card = page.getByTestId("set-plowmans_finds");
  await expect(card).toContainText("5/6 found");
  await expect(card.getByRole("button", { name: /^Turn in/ })).toBeDisabled();

  // Six spares buy the missing rare piece.
  await card.getByRole("button", { name: "Trade 6" }).click();
  await expect(card).toContainText("6/6 found");
  await page.screenshot({ path: "test-results/farm-book.png" });

  const coins = await game(page, (h) => h.getFarm().wallet.coins);
  await card.getByRole("button", { name: /^Turn in/ }).click();
  await expect(page.getByTestId("celebration").first()).toBeVisible();
  const farm = await game(page, (h) => h.getFarm());
  expect(farm.wallet.coins).toBeGreaterThan(coins);
  expect(farm.collections.plowmans_finds).toEqual({ redeemed: 1 });
  expect(farm.inventory.items.trophy_plowmans_finds).toBe(1);

  await page.getByRole("tab", { name: /Ribbons/ }).click();
  await expect(page.getByTestId("ribbon-collector")).toContainText("Green");
  await page.screenshot({ path: "test-results/farm-book-ribbons.png" });
  await expectNoErrors(errors);
});
