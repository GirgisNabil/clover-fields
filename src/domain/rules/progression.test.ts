import { describe, expect, it } from "vitest";
import { MAX_LEVEL } from "../constants";
import { applyCommand } from "../engine/apply";
import { emptyFarm, freshFarm, must, T0, withLevel } from "../testing";
import type { DomainEvent } from "../types/events";
import type { FarmState } from "../types/state";

const levelUps = (events: DomainEvent[]) =>
  events.filter((e): e is Extract<DomainEvent, { t: "levelUp" }> => e.t === "levelUp");

describe("level ups", () => {
  it("chain through every level an XP grant crosses", () => {
    const farm = freshFarm();
    const { state, events } = must(farm, { type: "dev", op: { kind: "grant", xp: 1000 } }, T0);
    expect(levelUps(events).map((e) => e.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(state.progress.level).toBe(9);
    expect(state.wallet.clovers - farm.wallet.clovers).toBe(9);
    expect(state.wallet.coins - farm.wallet.coins).toBe(2750);
    expect(levelUps(events)[0]?.unlocks).toContainEqual({ kind: "item", defId: "russet_hen" });
  });

  it("stop at the level cap but keep counting XP", () => {
    const farm = withLevel(freshFarm(), MAX_LEVEL, 90_000);
    const { state, events } = must(farm, { type: "dev", op: { kind: "grant", xp: 5000 } }, T0);
    expect(state.progress).toEqual({ level: MAX_LEVEL, xp: 95_000 });
    expect(levelUps(events)).toHaveLength(0);
  });

  it("grant the throne at level 50", () => {
    const farm = withLevel(freshFarm(), 49, 84_000);
    const { state } = must(farm, { type: "dev", op: { kind: "grant", xp: 1000 } }, T0);
    expect(state.inventory.items.monarch_throne).toBe(1);
  });

  it("refuse dev commands outside dev mode", () => {
    const result = applyCommand(
      freshFarm(),
      { type: "dev", op: { kind: "grant", xp: 5 } },
      { now: T0 },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "DEV_ONLY" } });
  });
});

describe("mastery", () => {
  it("awards the first star on the threshold harvest, in event order", () => {
    let farm: FarmState = { ...emptyFarm(), mastery: { clover_sprout: { count: 199, stars: 0 } } };
    farm = must(farm, { type: "plow", x: 0, y: 0 }, T0).state;
    farm = must(farm, { type: "plant", x: 0, y: 0, cropId: "clover_sprout" }, T0).state;
    const { state, events } = must(farm, { type: "harvest", x: 0, y: 0 }, T0 + 2 * 60_000);
    expect(state.mastery.clover_sprout).toEqual({ count: 200, stars: 1 });
    expect(events.map((e) => e.t).slice(0, 5)).toEqual([
      "harvested",
      "coins",
      "masteryStar",
      "coins",
      "xp",
    ]);
    expect(events[2]).toMatchObject({ t: "masteryStar", star: 1, coins: 300, xp: 20 });
  });

  it("grants the sign at three stars and +1 XP per harvest after that", () => {
    let farm: FarmState = { ...emptyFarm(), mastery: { clover_sprout: { count: 1199, stars: 2 } } };
    farm = { ...farm, inventory: { items: {} } };
    farm = must(farm, { type: "plow", x: 0, y: 0 }, T0).state;
    farm = must(farm, { type: "plant", x: 0, y: 0, cropId: "clover_sprout" }, T0).state;
    const third = must(farm, { type: "harvest", x: 0, y: 0 }, T0 + 2 * 60_000);
    expect(third.state.mastery.clover_sprout?.stars).toBe(3);
    expect(third.state.inventory.items.sign_clover_sprout).toBe(1);

    let next = must(third.state, { type: "plow", x: 0, y: 0 }, T0 + 3 * 60_000).state;
    next = must(
      next,
      { type: "plant", x: 0, y: 0, cropId: "clover_sprout" },
      T0 + 3 * 60_000,
    ).state;
    const xpBefore = next.progress.xp;
    const bonus = must(next, { type: "harvest", x: 0, y: 0 }, T0 + 5 * 60_000);
    expect(bonus.state.progress.xp).toBe(xpBefore + 1);
  });
});
