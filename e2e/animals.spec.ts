import { expect, type Page, test } from "@playwright/test";
import { expectNoErrors, game, openFarm, queueLength } from "./helpers";

const HOUR = 3_600_000;

/** Moves the game clock forward to the next given local hour on the farm's own day clock. */
async function advanceToHour(page: Page, hour: number) {
  await game(
    page,
    (h, target: number) => {
      const farm = h.getFarm();
      const now = h.clock.now();
      const day = 24 * 3_600_000;
      const local = (((now + farm.meta.dayOffsetMin * 60_000) % day) + day) % day;
      let delta = target * 3_600_000 - local;
      if (delta <= 0) delta += day;
      h.clock.advance(delta);
    },
    hour,
  );
}

test("animals roam by day, manure crops, rest at night and can be collected anywhere", async ({
  page,
}) => {
  const errors = await openFarm(page);
  await game(page, (h) =>
    h.dispatch({ type: "dev", op: { kind: "grant", coins: 50_000, xp: 330 } }),
  );
  for (let i = 0; i < 10; i++) {
    if (!(await page.getByRole("heading", { name: "Level up!" }).isVisible())) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  await advanceToHour(page, 8);
  // A field of long-growing crops with four hens beside it.
  await game(page, (h) => {
    h.dispatch({ type: "settle" });
    for (let y = 0; y < 3; y++) {
      for (let x = 6; x < 9; x++) {
        h.enqueue({ type: "plow", x, y });
        h.enqueue({ type: "plant", x, y, cropId: "button_carrot" });
      }
    }
    h.flushQueue();
    const spots: Array<[number, number]> = [
      [5, 0],
      [5, 1],
      [5, 2],
      [7, 3],
    ];
    for (const [x, y] of spots) {
      h.dispatch({ type: "buyPlace", defId: "russet_hen", x, y, rot: 0 });
    }
  });

  // Daytime: hens are out roaming.
  await page.waitForTimeout(500);
  const day = await game(page, (h) => h.animals().filter((a) => a.defId === "russet_hen"));
  expect(day.length).toBeGreaterThanOrEqual(4);
  for (const hen of day) expect(hen.resting).toBe(false);

  // Let a few windows pass so the hens wander over the field.
  await game(page, (h) => {
    h.clock.advance(70 * 60_000);
    h.dispatch({ type: "settle" });
  });
  const manured = await game(
    page,
    (h) =>
      Object.values(h.getFarm().objects).filter((o) => o.kind === "plot" && o.crop?.manure).length,
  );
  expect(manured).toBeGreaterThan(0);
  await game(page, (h) => h.setCamera({ targetX: 8, targetZ: 2, zoom: 110 }));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/animals-day.png" });

  // A ready hen can be clicked wherever she has wandered to.
  const coinsBefore = await game(page, (h) => h.getFarm().wallet.coins);
  const target = await game(page, (h) => {
    const hen = h.animals().find((a) => a.defId === "russet_hen" && a.live?.visible);
    if (!hen?.live) return null;
    return h.worldToScreen(hen.live.x, hen.live.height * 0.5, hen.live.z);
  });
  expect(target).not.toBeNull();
  if (target) await page.mouse.click(target.x, target.y);
  expect(await queueLength(page)).toBe(1);
  await game(page, (h) => h.flushQueue());
  expect(await game(page, (h) => h.getFarm().wallet.coins)).toBeGreaterThan(coinsBefore);

  // Evening: everyone heads home and dozes.
  await advanceToHour(page, 21);
  await page.waitForTimeout(500);
  const night = await game(page, (h) => h.animals().filter((a) => a.defId === "russet_hen"));
  for (const hen of night) {
    expect(hen.resting).toBe(true);
    expect(hen.tile).toEqual(hen.home);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/animals-night.png" });

  // No manure lands overnight.
  const before = await game(page, (h) => h.getFarm().animals.settledAt);
  await game(page, (h) => {
    h.clock.advance(3 * 3_600_000);
    h.dispatch({ type: "settle" });
  });
  const overnight = await game(
    page,
    (h) =>
      Object.values(h.getFarm().objects).filter(
        (o) =>
          o.kind === "plot" &&
          o.crop?.manure &&
          o.crop.manure.at > h.getFarm().animals.settledAt - 3 * 3_600_000,
      ).length,
  );
  expect(overnight).toBe(0);
  expect(await game(page, (h) => h.getFarm().animals.settledAt)).toBeGreaterThan(before);

  // Morning: out again.
  await advanceToHour(page, 8);
  const morning = await game(page, (h) => h.animals().filter((a) => a.defId === "russet_hen"));
  for (const hen of morning) expect(hen.resting).toBe(false);
  void HOUR;
  await expectNoErrors(errors);
});
