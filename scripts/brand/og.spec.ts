import { readFileSync } from "node:fs";
import { test } from "@playwright/test";
import { game, openFarm } from "../../e2e/helpers";

// Builds the Open Graph / social share image (src/app/opengraph-image.png) from a real in-game
// scene. Run: npx playwright test --config scripts/brand/playwright.config.ts
test.use({ viewport: { width: 1200, height: 630 } });
test("og image", async ({ page }) => {
  test.setTimeout(150_000);
  await openFarm(page, { quality: "high" });
  await game(page, (h) => {
    h.clock.advance(Math.max(0, Date.UTC(2030, 2, 12, 11, 0) - h.clock.now()));
    h.dispatch({ type: "dev", op: { kind: "grant", xp: 40_000, coins: 500_000 } });
  });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 80; i++) {
    if (!(await page.getByRole("heading", { name: "Level up!" }).isVisible())) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }
  await game(page, (h) => {
    const buy = (defId: string, x: number, y: number) =>
      h.dispatch({ type: "buyPlace", defId, x, y, rot: 0 });
    buy("windgrist_mill", 0, 0);
    buy("crumbhearth_bakery", 3, 0);
    buy("hen_house", 0, 8);
    buy("dapple_cow", 6, 10);
    buy("puffwool_sheep", 8, 10);
    buy("russet_hen", 5, 9);
    buy("russet_hen", 9, 8);
    buy("rosy_apple", 9, 5);
    buy("sunny_lemon", 10, 7);
    buy("clodbuster_tractor", 9, 9);
    buy("daisy_bed", 7, 3);
    buy("lantern_post", 6, 2);
    const crops = ["goldenstalk_wheat", "sweetcob_corn", "patchwork_pumpkin", "sunflower_crown"];
    for (let y = 3; y < 7; y++) for (let x = 0; x < 6; x++) h.enqueue({ type: "plow", x, y });
    h.flushQueue();
    crops.forEach((cropId, i) => {
      for (let x = 0; x < 6; x++) h.enqueue({ type: "plant", x, y: 3 + i, cropId });
    });
    h.flushQueue();
    h.clock.advance(20 * 3_600_000);
    h.setCamera({ targetX: 5.5, targetZ: 6.5, zoom: 62 });
  });
  const hide = await page.addStyleTag({
    content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }",
  });
  await page.waitForTimeout(3000);
  const scene = (await page.screenshot()).toString("base64");
  await hide.evaluate((el) => el.parentNode?.removeChild(el));

  const mark = readFileSync("public/brand/clover-mark.svg", "utf8");
  await page.evaluate(
    ({ scene, mark }) => {
      const chips = ["Cozy 3D farming", "Roaming animals", "Seasonal events"]
        .map(
          (t) =>
            `<span style="font-size:20px;font-weight:600;color:#3b2a1a;background:#f6c945;border-radius:999px;padding:8px 16px">${t}</span>`,
        )
        .join("");
      document.body.innerHTML = `
        <div id="og" style="position:fixed;inset:0;width:1200px;height:630px;overflow:hidden;font-family:var(--font-fredoka),sans-serif;z-index:999">
          <img src="data:image/png;base64,${scene}" style="position:absolute;inset:0;width:1200px;height:630px;object-fit:cover"/>
          <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,248,234,.95) 0%,rgba(255,248,234,.88) 36%,rgba(255,248,234,0) 60%)"></div>
          <div style="position:absolute;left:64px;top:110px;display:flex;flex-direction:column;gap:22px">
            <div style="width:132px;height:132px">${mark.replace("<svg ", '<svg width="132" height="132" ')}</div>
            <div style="font-size:78px;font-weight:600;color:#2f7d1f;line-height:1;letter-spacing:-1px">Clover Fields</div>
            <div style="font-size:30px;font-weight:500;color:#3b2a1a;line-height:1.25;max-width:470px">Plow, plant and harvest your way to the farm of your dreams.</div>
            <div style="display:flex;gap:10px;margin-top:6px">${chips}</div>
          </div>
        </div>`;
    },
    { scene, mark },
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: "src/app/opengraph-image.png" });
});
