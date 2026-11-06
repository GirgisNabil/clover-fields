import { expect, type Page, test } from "@playwright/test";
import { game, openFarm } from "./helpers";

// Visual regression on key screens. A fixed date (no seasonal event, midday) and reduced motion
// (no crop sway, weather or coin flights) keep frames stable; a small tolerance absorbs the
// starter hen wandering and idle animations.
test.use({ reducedMotion: "reduce" });

const SNAPSHOT = { maxDiffPixelRatio: 0.02, animations: "disabled" as const };

async function freezeAt(page: Page) {
  await game(page, (h) => {
    const target = Date.UTC(2030, 2, 12, 12, 0, 0);
    h.clock.advance(Math.max(0, target - h.clock.now()));
    h.setCamera({ targetX: 6, targetZ: 6, zoom: 46 });
  });
  await page.waitForTimeout(1500);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`farm, market and farm book look right (${viewport.name})`, async ({ page }) => {
      await openFarm(page);
      await freezeAt(page);
      await expect(page).toHaveScreenshot(`farm-${viewport.name}.png`, SNAPSHOT);
      await page.keyboard.press("4");
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`market-${viewport.name}.png`, SNAPSHOT);
      await page.keyboard.press("Escape");
      await game(page, (h) => h.dispatch({ type: "dev", op: { kind: "grant", xp: 1200 } }));
      for (let i = 0; i < 20; i++) {
        if (!(await page.getByRole("heading", { name: "Level up!" }).isVisible())) break;
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
      }
      await page.keyboard.press("j");
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`book-${viewport.name}.png`, SNAPSHOT);
    });
  });
}
