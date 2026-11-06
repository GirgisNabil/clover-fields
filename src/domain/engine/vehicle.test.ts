import { describe, expect, it } from "vitest";
import { MINUTE } from "../constants";
import { emptyProjection, tryExtend } from "../queue/projection";
import { objectAt } from "../rules/grid";
import { emptyFarm, must, T0, withLevel } from "../testing";
import type { FarmState, PlotObject } from "../types/state";
import { applyCommand } from "./apply";

/** A level-30 farm with lots of coins, some fuel, and a vehicle parked at (9, 9). */
function withVehicle(defId: string, fuel = 50): { farm: FarmState; id: `o${number}` } {
  let farm = withLevel(emptyFarm(T0, 100_000), 30, 22_900);
  farm = { ...farm, fuel: { units: fuel, anchor: T0 } };
  farm = must(farm, { type: "buyPlace", defId, x: 9, y: 9, rot: 0 }, T0).state;
  const id = objectAt(farm, 9, 9)?.id;
  if (!id) throw new Error("vehicle missing");
  return { farm, id };
}

const plotAt = (farm: FarmState, x: number, y: number) => objectAt(farm, x, y) as PlotObject | null;

describe("vehicle passes", () => {
  it("plow a 2×2 area for the same coins and XP as by hand, plus fuel", () => {
    const { farm, id } = withVehicle("clodbuster_tractor");
    const { state, events } = must(farm, { type: "drive", vehicleId: id, x: 0, y: 0 }, T0);
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      expect(plotAt(state, x, y)?.soil).toBe("plowed");
    }
    expect(state.wallet.coins).toBe(farm.wallet.coins - 40);
    expect(state.progress.xp - farm.progress.xp).toBe(4);
    expect(state.fuel.units).toBe(46);
    expect(events.at(-1)).toMatchObject({
      t: "vehiclePass",
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    });
  });

  it("skip tiles with nothing to do, charging no fuel for them", () => {
    let { farm, id } = withVehicle("clodbuster_tractor");
    farm = must(farm, { type: "plow", x: 0, y: 0 }, T0).state;
    const { state } = must(farm, { type: "drive", vehicleId: id, x: 0, y: 0 }, T0);
    expect(state.fuel.units).toBe(47);
  });

  it("stop when fuel runs out, in row-major order", () => {
    const { farm, id } = withVehicle("clodbuster_tractor", 3);
    const { state } = must(farm, { type: "drive", vehicleId: id, x: 0, y: 0 }, T0);
    expect(plotAt(state, 1, 0)?.soil).toBe("plowed");
    expect(plotAt(state, 0, 1)?.soil).toBe("plowed");
    expect(plotAt(state, 1, 1)).toBeNull();
    expect(state.fuel.units).toBe(0);
  });

  it("refuse to start without fuel, or with nothing to do", () => {
    const { farm, id } = withVehicle("clodbuster_tractor", 0);
    expect(
      applyCommand(farm, { type: "drive", vehicleId: id, x: 0, y: 0 }, { now: T0 }),
    ).toMatchObject({
      ok: false,
      error: { code: "NOT_ENOUGH", currency: "fuel" },
    });
    const harvester = withVehicle("reapwell_harvester");
    expect(
      applyCommand(
        harvester.farm,
        { type: "drive", vehicleId: harvester.id, x: 0, y: 0 },
        { now: T0 },
      ),
    ).toMatchObject({ ok: false, error: { code: "NOTHING_TO_DO" } });
  });

  it("let the combine harvest, plow and replant in one pass", () => {
    let { farm, id } = withVehicle("triplet_combine");
    for (const [x, y] of [
      [0, 0],
      [1, 0],
    ] as const) {
      farm = must(farm, { type: "plow", x, y }, T0).state;
      farm = must(farm, { type: "plant", x, y, cropId: "clover_sprout" }, T0).state;
    }
    const later = T0 + 3 * MINUTE;
    const { state } = must(
      farm,
      { type: "drive", vehicleId: id, x: 0, y: 0, cropId: "button_carrot" },
      later,
    );
    expect(plotAt(state, 0, 0)?.crop).toMatchObject({ cropId: "button_carrot", plantedAt: later });
    expect(plotAt(state, 0, 1)?.crop).toMatchObject({ cropId: "button_carrot" });
    expect(state.mastery.clover_sprout?.count).toBe(2);
    expect(state.fuel.units).toBeLessThan(farm.fuel.units);
  });

  it("queue through the projection, so a repeat pass over the same area does nothing", () => {
    const { farm, id } = withVehicle("clodbuster_tractor");
    const first = tryExtend(
      emptyProjection(farm),
      { type: "drive", vehicleId: id, x: 0, y: 0 },
      { now: T0 },
    );
    if (!first.ok) throw new Error("first pass refused");
    const second = tryExtend(first.p, { type: "drive", vehicleId: id, x: 0, y: 0 }, { now: T0 });
    expect(second).toMatchObject({ ok: false, error: { code: "NOTHING_TO_DO" } });
  });

  it("upgrade to a 3×3 area with coins and Brass Cogs", () => {
    const { farm, id } = withVehicle("clodbuster_tractor");
    expect(applyCommand(farm, { type: "upgrade", id }, { now: T0 })).toMatchObject({
      ok: false,
      error: { code: "NOT_ENOUGH_ITEMS", id: "brass_cog" },
    });
    const rich = { ...farm, materials: { brass_cog: 4 } };
    const upgraded = must(rich, { type: "upgrade", id }, T0).state;
    expect(upgraded.materials.brass_cog).toBeUndefined();
    const { state } = must(upgraded, { type: "drive", vehicleId: id, x: 0, y: 0 }, T0);
    expect(plotAt(state, 2, 2)?.soil).toBe("plowed");
  });

  it("buying fuel cans settles regeneration first and may overfill the tank", () => {
    const farm = { ...withLevel(emptyFarm(), 12, 2100), fuel: { units: 40, anchor: T0 } };
    const { state } = must(farm, { type: "buyItem", defId: "fuel_can", qty: 2 }, T0 + 50 * MINUTE);
    expect(state.fuel.units).toBe(100);
  });
});
