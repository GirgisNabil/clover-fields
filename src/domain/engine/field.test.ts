import { describe, expect, it } from "vitest";
import { HOUR, MINUTE, PLOW_COST } from "../constants";
import { objectAt } from "../rules/grid";
import { animalAt, emptyFarm, freshFarm, must, T0, withLevel } from "../testing";
import type { PlotObject } from "../types/state";
import { applyCommand } from "./apply";

describe("plow", () => {
  it("turns grass into a plowed plot for coins and XP", () => {
    const farm = emptyFarm();
    const { state, events } = must(farm, { type: "plow", x: 3, y: 3 }, T0);
    const plot = objectAt(state, 3, 3) as PlotObject;
    expect(plot).toMatchObject({ kind: "plot", soil: "plowed", id: `o${farm.meta.nextId}` });
    expect(state.wallet.coins).toBe(farm.wallet.coins - PLOW_COST);
    expect(state.progress.xp).toBe(1);
    expect(events.map((e) => e.t)).toEqual(["plowed", "coins", "xp"]);
  });

  it("refuses plowed soil, occupied tiles, the edge of the world and empty pockets", () => {
    const farm = freshFarm();
    expect(applyCommand(farm, { type: "plow", x: 2, y: 5 }, { now: T0 })).toMatchObject({
      ok: false,
      error: { code: "WRONG_STATE" },
    });
    expect(applyCommand(farm, { type: "plow", x: 3, y: 7 }, { now: T0 })).toMatchObject({
      ok: false,
      error: { code: "OCCUPIED" },
    });
    expect(applyCommand(farm, { type: "plow", x: 12, y: 0 }, { now: T0 })).toMatchObject({
      ok: false,
      error: { code: "OUT_OF_BOUNDS" },
    });
    const broke = { ...emptyFarm(), wallet: { coins: 9, clovers: 0 } };
    expect(applyCommand(broke, { type: "plow", x: 0, y: 0 }, { now: T0 })).toMatchObject({
      ok: false,
      error: { code: "NOT_ENOUGH", currency: "coins", need: 10, have: 9 },
    });
  });
});

describe("plant", () => {
  it("plants on plowed soil, charging the seed and granting plant XP", () => {
    let farm = withLevel(emptyFarm(), 2, 15);
    farm = must(farm, { type: "plow", x: 0, y: 0 }, T0).state;
    const { state } = must(farm, { type: "plant", x: 0, y: 0, cropId: "goldenstalk_wheat" }, T0);
    const plot = objectAt(state, 0, 0) as PlotObject;
    expect(plot.soil).toBe("planted");
    expect(plot.crop).toMatchObject({ cropId: "goldenstalk_wheat", plantedAt: T0 });
    expect(state.wallet.coins).toBe(farm.wallet.coins - 80);
    expect(state.progress.xp).toBe(farm.progress.xp + 3);
  });

  it("marks beginner crops wither-proof and later crops not", () => {
    const beginner = must(
      must(emptyFarm(), { type: "plow", x: 0, y: 0 }, T0).state,
      {
        type: "plant",
        x: 0,
        y: 0,
        cropId: "clover_sprout",
      },
      T0,
    ).state;
    expect((objectAt(beginner, 0, 0) as PlotObject).crop?.witherProof).toBe(true);
    const veteran = withLevel(emptyFarm(), 6, 330);
    const planted = must(
      must(veteran, { type: "plow", x: 0, y: 0 }, T0).state,
      {
        type: "plant",
        x: 0,
        y: 0,
        cropId: "clover_sprout",
      },
      T0,
    ).state;
    expect((objectAt(planted, 0, 0) as PlotObject).crop?.witherProof).toBe(false);
  });

  it("refuses locked crops and unplowed tiles", () => {
    const farm = must(emptyFarm(), { type: "plow", x: 0, y: 0 }, T0).state;
    expect(
      applyCommand(farm, { type: "plant", x: 0, y: 0, cropId: "sweetcob_corn" }, { now: T0 }),
    ).toMatchObject({ ok: false, error: { code: "LOCKED", level: 6 } });
    expect(
      applyCommand(farm, { type: "plant", x: 1, y: 1, cropId: "clover_sprout" }, { now: T0 }),
    ).toMatchObject({ ok: false, error: { code: "WRONG_STATE" } });
  });
});

describe("harvest", () => {
  it("pays the sale price, leaves the plot fallow and counts mastery", () => {
    const farm = freshFarm();
    const { state, events } = must(farm, { type: "harvest", x: 2, y: 4 }, T0);
    const plot = objectAt(state, 2, 4) as PlotObject;
    expect(plot).toMatchObject({ soil: "fallow", crop: null });
    expect(state.wallet.coins).toBe(farm.wallet.coins + 35);
    expect(state.mastery.clover_sprout).toEqual({ count: 1, stars: 0 });
    expect(events[0]).toMatchObject({ t: "harvested", coins: 35, defId: "clover_sprout" });
  });

  it("is refused while growing and after withering, and plowing clears a withered plot", () => {
    let farm = withLevel(emptyFarm(), 6, 330);
    farm = must(farm, { type: "plow", x: 0, y: 0 }, T0).state;
    farm = must(farm, { type: "plant", x: 0, y: 0, cropId: "clover_sprout" }, T0).state;
    expect(applyCommand(farm, { type: "harvest", x: 0, y: 0 }, { now: T0 + MINUTE })).toMatchObject(
      {
        ok: false,
        error: { code: "NOT_READY", readyAt: T0 + 2 * MINUTE },
      },
    );
    const late = T0 + 2 * MINUTE + 31 * MINUTE;
    expect(applyCommand(farm, { type: "harvest", x: 0, y: 0 }, { now: late })).toMatchObject({
      ok: false,
      error: { code: "WITHERED" },
    });
    const cleared = must(farm, { type: "plow", x: 0, y: 0 }, late);
    expect(objectAt(cleared.state, 0, 0)).toMatchObject({ soil: "plowed", crop: null });
    expect(cleared.events[0]).toMatchObject({ t: "plowed", clearedWithered: true });
    expect(cleared.state.stats.counters["wither:lost"]).toBe(1);
  });

  it("collects ready producers and restarts their cycle", () => {
    const farm = freshFarm();
    const hen = animalAt(farm, 8, 7);
    if (!hen) throw new Error("hen missing");
    const collect = { type: "collectAnimal", id: hen.id, x: 8, y: 7 } as const;
    const { state } = must(farm, collect, T0 + 5 * HOUR);
    expect(state.wallet.coins).toBe(farm.wallet.coins + 13);
    expect(state.objects[hen.id]).toMatchObject({ kind: "animal", cycleStart: T0 + 5 * HOUR });
    expect(applyCommand(state, collect, { now: T0 + 5 * HOUR })).toMatchObject({
      ok: false,
      error: { code: "NOT_READY" },
    });
  });

  it("checks the expected target", () => {
    const farm = freshFarm();
    expect(
      applyCommand(farm, { type: "harvest", x: 2, y: 4, expect: "o999" }, { now: T0 }),
    ).toMatchObject({ ok: false, error: { code: "TARGET_CHANGED" } });
  });
});
