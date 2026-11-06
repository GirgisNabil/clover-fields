import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { coins, expectNoErrors, game, openFarm } from "./helpers";

async function dismissLevelUps(page: Page) {
  await page
    .getByRole("heading", { name: "Level up!" })
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  for (let i = 0; i < 30; i++) {
    if (!(await page.getByRole("heading", { name: "Level up!" }).isVisible())) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

/** Serious and critical axe violations in the open dialog (or the whole HUD). */
async function seriousViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (include) builder = builder.include(include);
  const result = await builder.analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
}

test("the HUD and every dialog have no serious accessibility issues", async ({ page }) => {
  const errors = await openFarm(page);
  await game(page, (h) =>
    h.dispatch({ type: "dev", op: { kind: "grant", xp: 4000, coins: 10_000 } }),
  );
  await dismissLevelUps(page);
  expect(await seriousViolations(page)).toEqual([]);

  const dialogs: Array<[string, () => Promise<void>]> = [
    ["Market", () => page.keyboard.press("4")],
    ["Tool Shed", () => page.keyboard.press("b")],
    ["Farm Book", () => page.keyboard.press("j")],
    ["Settings", () => page.getByTitle("Settings").click()],
    ["Daily Bonus", () => page.getByTestId("rail-daily").click()],
    ["Neighbours", () => page.getByTestId("rail-neighbors").click()],
  ];
  for (const [name, open] of dialogs) {
    await open();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.waitForTimeout(400); // let the open animation finish (contrast is checked on final colors)
    expect(await seriousViolations(page, '[role="dialog"]'), name).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  }
  await expectNoErrors(errors);
});

test("the farm can be played with the keyboard alone", async ({ page }) => {
  const errors = await openFarm(page);
  const start = await coins(page);
  await page.locator("[data-farm-surface]").focus();
  // The cursor starts mid-farm; walk it to the ripe clovers at (2..5, 4) and harvest each.
  const cursor = await game(page, (h) => h.getFarm().land.size);
  const mid = Math.floor(cursor / 2);
  for (let i = 0; i < mid - 2; i++) await page.keyboard.press("ArrowLeft");
  for (let i = 0; i < mid - 4; i++) await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("announcer")).toContainText("Tile 3, 5");
  await expect(page.getByTestId("announcer")).toContainText("Clover");
  for (let x = 2; x <= 5; x++) {
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
  }
  await game(page, (h) => h.flushQueue());
  expect(await coins(page)).toBeGreaterThan(start);
  await expectNoErrors(errors);
});
