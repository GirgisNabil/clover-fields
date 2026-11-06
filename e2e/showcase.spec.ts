import { test } from "@playwright/test";
import { expectNoErrors, game, openFarm } from "./helpers";

// A busy mid-game farm for eyeballing the art. Screenshots land in test-results/showcase-*.png.
test("showcase farm", async ({ page }) => {
  const errors = await openFarm(page, { quality: "high" });
  await game(page, (h) => {
    h.dispatch({ type: "dev", op: { kind: "grant", xp: 40_000, coins: 500_000 } });
  });
  for (let i = 0; i < 40; i++) await page.keyboard.press("Escape");
  await game(page, (h) => {
    const buy = (defId: string, x: number, y: number) =>
      h.dispatch({ type: "buyPlace", defId, x, y, rot: 0 });
    buy("windgrist_mill", 0, 0);
    buy("crumbhearth_bakery", 3, 0);
    buy("hen_house", 0, 8);
    buy("russet_hen", 4, 9);
    buy("dapple_cow", 5, 10);
    buy("puffwool_sheep", 7, 10);
    buy("rosy_apple", 9, 5);
    buy("sunny_lemon", 10, 7);
    buy("clodbuster_tractor", 9, 9);
    buy("straw_sentinel", 6, 2);
    buy("daisy_bed", 7, 3);
    const crops = ["goldenstalk_wheat", "sweetcob_corn", "patchwork_pumpkin", "sunflower_crown"];
    for (let y = 3; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        if (h.getFarm().objects && (x + y) % 7 === 0) continue;
        h.enqueue({ type: "plow", x, y });
      }
    }
    h.flushQueue();
    crops.forEach((cropId, i) => {
      for (let x = 0; x < 6; x++) h.enqueue({ type: "plant", x, y: 3 + i, cropId });
    });
    h.flushQueue();
    h.clock.advance(6 * 3600_000);
    h.setCamera({ targetX: 6, targetZ: 6, zoom: 48 });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/showcase-wide.png" });
  await game(page, (h) => h.setCamera({ targetX: 3, targetZ: 5, zoom: 110 }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/showcase-close.png" });
  await expectNoErrors(errors);
});
