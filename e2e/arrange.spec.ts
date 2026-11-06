import { expect, test } from "@playwright/test";
import { click, coins, expectNoErrors, game, openFarm } from "./helpers";

const objectAt = (x: number, y: number) => ({ x, y }) as { x: number; y: number };

async function defAt(page: import("@playwright/test").Page, x: number, y: number) {
  return game(
    page,
    (h, at: { x: number; y: number }) =>
      Object.values(h.getFarm().objects).find((o) => o.x === at.x && o.y === at.y)?.defId ?? null,
    objectAt(x, y),
  );
}

test("buy from the market, place from the shed and move things around", async ({ page }) => {
  const errors = await openFarm(page);

  // Market → Decor → Rail Fence, then place two (decorations stay on the cursor).
  await page.keyboard.press("4");
  await page.getByRole("button", { name: /Decor/ }).click();
  await page.getByRole("button", { name: /Rail Fence/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await click(page, 0, 10);
  await click(page, 1, 10);
  await page.keyboard.press("Escape");
  expect(await defAt(page, 0, 10)).toBe("rail_fence");
  expect(await defAt(page, 1, 10)).toBe("rail_fence");
  expect(await coins(page)).toBe(600 - 40);

  // Tool Shed → Daisy Bed (a starter gift) → place it.
  await page.keyboard.press("7");
  await page.getByRole("button", { name: /Daisy Bed/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await click(page, 3, 10);
  expect(await defAt(page, 3, 10)).toBe("daisy_bed");

  // Arrange: pick up the scarecrow and drop it somewhere else.
  await page.keyboard.press("5");
  await click(page, 1, 4);
  await click(page, 5, 10);
  expect(await defAt(page, 5, 10)).toBe("straw_sentinel");
  expect(await defAt(page, 1, 4)).toBeNull();

  await game(page, (h) => h.setCamera({ targetX: 3, targetZ: 9, zoom: 80 }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/arrange.png" });
  await expectNoErrors(errors);
});
