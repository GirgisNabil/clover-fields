import { expect, test } from "@playwright/test";
import { expectNoErrors, game, openFarm } from "./helpers";

test("clicking a building's roof opens that building, not the grass behind it", async ({
  page,
}) => {
  const errors = await openFarm(page);
  // A point on the Tool Shed's roof (the shed covers tiles 9–11 × 0–1 and is about 1.6 tall).
  const roof = await game(page, (h) => h.worldToScreen(10.5, 1.4, 1.6));
  const ground = await game(
    page,
    (h, p: { x: number; y: number }) => h.groundTileAt(p.x, p.y),
    roof,
  );
  // The ground under that pixel lies behind the shed, not on one of its own tiles.
  const onShed = ground.x >= 9 && ground.x <= 11 && ground.y >= 0 && ground.y <= 1;
  expect(onShed).toBe(false);
  await page.mouse.click(roof.x, roof.y);
  await expect(page.getByRole("heading", { name: /Tool Shed/ })).toBeVisible();
  await expectNoErrors(errors);
});
