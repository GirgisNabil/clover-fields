import { describe, expect, it } from "vitest";
import { HOUR, MINUTE } from "../constants";
import { objectAt } from "../rules/grid";
import { emptyFarm, must, T0, withLevel } from "../testing";
import type { BuildingObject, FarmState } from "../types/state";
import { applyCommand } from "./apply";

/** A level-30 farm with a Windgrist Mill at (6, 6) and some wheat bushels. */
function withMill(materials: Record<string, number> = { bushel_goldenstalk_wheat: 10 }) {
  let farm: FarmState = withLevel(emptyFarm(T0, 100_000), 30, 22_900);
  farm = must(farm, { type: "buyPlace", defId: "windgrist_mill", x: 6, y: 6, rot: 0 }, T0).state;
  farm = { ...farm, materials };
  const id = objectAt(farm, 6, 6)?.id;
  if (!id) throw new Error("mill missing");
  return { farm, id };
}

const mill = (farm: FarmState, id: `o${number}`) => farm.objects[id] as BuildingObject;

describe("crafting", () => {
  it("takes inputs at start and queues a job", () => {
    const { farm, id } = withMill();
    const { state, events } = must(
      farm,
      { type: "craft", buildingId: id, recipeId: "wheat_flour" },
      T0,
    );
    expect(state.materials.bushel_goldenstalk_wheat).toBe(8);
    expect(mill(state, id).jobs).toEqual([
      { recipeId: "wheat_flour", startedAt: T0, readyAt: T0 + 2 * HOUR },
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ t: "craftStarted", recipeId: "wheat_flour" }),
    );
  });

  it("respects the slot count per tier", () => {
    const { farm, id } = withMill();
    const once = must(farm, { type: "craft", buildingId: id, recipeId: "wheat_flour" }, T0).state;
    expect(
      applyCommand(once, { type: "craft", buildingId: id, recipeId: "wheat_flour" }, { now: T0 }),
    ).toMatchObject({ ok: false, error: { code: "BUILDING_FULL" } });
    const tier2 = must(
      { ...once, wallet: { ...once.wallet, coins: 100_000 } },
      { type: "upgrade", id },
      T0,
    ).state;
    const twice = must(tier2, { type: "craft", buildingId: id, recipeId: "wheat_flour" }, T0).state;
    expect(mill(twice, id).jobs).toHaveLength(2);
  });

  it("refuses missing inputs, wrong stations and locked recipes", () => {
    const { farm, id } = withMill({ bushel_goldenstalk_wheat: 1 });
    const run = (recipeId: string, state = farm) =>
      applyCommand(state, { type: "craft", buildingId: id, recipeId }, { now: T0 });
    expect(run("wheat_flour")).toMatchObject({
      ok: false,
      error: { code: "NOT_ENOUGH_ITEMS", id: "bushel_goldenstalk_wheat", need: 2, have: 1 },
    });
    expect(run("berry_tart")).toMatchObject({ ok: false, error: { code: "WRONG_STATE" } });
    expect(run("wheat_flour", withLevel(farm, 14, 1))).toMatchObject({
      ok: false,
      error: { code: "FEATURE_LOCKED" },
    });
  });

  it("collects only finished jobs through harvest", () => {
    let { farm, id } = withMill();
    farm = must(farm, { type: "upgrade", id }, T0).state;
    farm = must(farm, { type: "upgrade", id }, T0).state;
    farm = must(farm, { type: "craft", buildingId: id, recipeId: "wheat_flour" }, T0).state;
    farm = must(farm, { type: "craft", buildingId: id, recipeId: "wheat_flour" }, T0 + HOUR).state;
    farm = must(
      { ...farm, materials: { ...farm.materials, bushel_sweetcob_corn: 2 } },
      { type: "craft", buildingId: id, recipeId: "cornmeal" },
      T0 + HOUR,
    ).state;
    const b = mill(farm, id);
    expect(
      applyCommand(farm, { type: "harvest", x: b.x, y: b.y }, { now: T0 + 30 * MINUTE }),
    ).toMatchObject({
      ok: false,
      error: { code: "NOT_READY", readyAt: T0 + 2 * HOUR },
    });
    const at = T0 + 2 * HOUR + 30 * MINUTE;
    const { state, events } = must(farm, { type: "harvest", x: b.x, y: b.y }, at);
    expect(state.materials.wheat_flour).toBe(1);
    expect(state.materials.cornmeal).toBe(1);
    expect(mill(state, id).jobs).toHaveLength(1);
    expect(state.stats.counters["craft:done"]).toBe(2);
    expect(state.progress.xp).toBeGreaterThan(farm.progress.xp);
    expect(events).toContainEqual(expect.objectContaining({ t: "crafted" }));
  });

  it("sells goods and burns fuel goods", () => {
    const { farm } = withMill({ sunseed_oil: 2, wheat_flour: 1 });
    const sold = must(farm, { type: "sellMaterial", id: "wheat_flour", qty: 1 }, T0).state;
    expect(sold.materials.wheat_flour).toBeUndefined();
    expect(sold.wallet.coins).toBeGreaterThan(farm.wallet.coins);
    expect(
      applyCommand(farm, { type: "sellMaterial", id: "wheat_flour", qty: 2 }, { now: T0 }),
    ).toMatchObject({ ok: false, error: { code: "NOT_ENOUGH_ITEMS" } });
    const fueled = must(
      { ...farm, fuel: { units: 10, anchor: T0 } },
      { type: "useMaterial", id: "sunseed_oil" },
      T0,
    ).state;
    expect(fueled.fuel.units).toBe(25);
    expect(fueled.materials.sunseed_oil).toBe(1);
    expect(
      applyCommand(farm, { type: "useMaterial", id: "wheat_flour" }, { now: T0 }),
    ).toMatchObject({
      ok: false,
      error: { code: "WRONG_STATE" },
    });
  });

  it("dev grant hands out materials", () => {
    const { farm } = withMill({});
    const r = applyCommand(
      farm,
      { type: "dev", op: { kind: "grant", materials: { brass_cog: 3 } } },
      { now: T0, dev: true },
    );
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.state.materials.brass_cog).toBe(3);
  });
});
