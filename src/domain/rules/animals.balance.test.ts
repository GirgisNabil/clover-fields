import { describe, expect, it } from "vitest";
import { HOUR, MINUTE } from "../constants";
import { applyCommand } from "../engine/apply";
import { emptyFarm, must, T0, withLevel } from "../testing";
import type { Command } from "../types/commands";
import type { FarmState } from "../types/state";

const CROP = "sweetcob_corn"; // 4 h

/** Crop income over a day of tending a 6×6 field every 20 minutes, with or without a herd. */
function cropIncome(herd: Array<[string, number, number]>): number {
  let farm: FarmState = withLevel(emptyFarm(T0, 10_000_000), 30, 22_900);
  farm = { ...farm, animals: { settledAt: T0 } };
  const field: Array<[number, number]> = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) field.push([x, y]);
  for (const [x, y] of field) {
    farm = must(farm, { type: "plow", x, y }, T0).state;
    farm = must(farm, { type: "plant", x, y, cropId: CROP }, T0).state;
  }
  for (const [defId, x, y] of herd) {
    farm = must(farm, { type: "buyPlace", defId, x, y, rot: 0 }, T0).state;
  }
  let income = 0;
  for (let t = T0; t <= T0 + 24 * HOUR; t += 20 * MINUTE) {
    for (const [x, y] of field) {
      const cmds: Command[] = [
        { type: "harvest", x, y },
        { type: "plow", x, y },
        { type: "plant", x, y, cropId: CROP },
      ];
      for (const cmd of cmds) {
        const result = applyCommand(farm, cmd, { now: t });
        if (!result.ok) break;
        for (const e of result.events) if (e.t === "harvested") income += e.coins;
        farm = result.state;
      }
    }
  }
  return income;
}

describe("manure balance", () => {
  // Manure is +15% per crop and never stacks; nights (no manure) cap coverage near 2/3, so a
  // herd helps noticeably but can never more than ~20% the income of a field.
  it("a typical herd adds a few percent to crop income, never more than 20%", () => {
    const without = cropIncome([]);
    const withHerd = cropIncome([
      ["russet_hen", 6, 0],
      ["russet_hen", 6, 2],
      ["russet_hen", 6, 4],
      ["russet_hen", 7, 1],
      ["dapple_cow", 7, 5],
    ]);
    const gain = withHerd / without - 1;
    expect(gain).toBeGreaterThan(0.03);
    expect(gain).toBeLessThanOrEqual(0.2);
  });
});
