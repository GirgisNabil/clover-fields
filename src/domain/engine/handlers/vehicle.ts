import { produce } from "immer";
import { FEATURE_LEVEL } from "../../catalog/levels";
import { getVehicle } from "../../catalog/registry";
import type { VehicleDef } from "../../catalog/types";
import { fuelAt, settleFuel } from "../../rules/fuel";
import { invalidateOccupancy } from "../../rules/grid";
import { bumpStat } from "../../rules/progression";
import type { FieldCommand } from "../../types/commands";
import type { Emit } from "../../types/events";
import type { Tile } from "../../types/ids";
import type { FarmState } from "../../types/state";
import { isEffect, type PlanContext, type Step } from "../step";
import { planHarvest, planPlant, planPlow } from "./field";

type Drive = Extract<FieldCommand, { type: "drive" }>;

const OPS: Record<VehicleDef["op"], Array<"harvest" | "plow" | "plant">> = {
  plow: ["plow"],
  plant: ["plant"],
  harvest: ["harvest"],
  combine: ["harvest", "plow", "plant"],
};

/**
 * Works the area tile by tile in row-major order, reusing the hand-work rules for each tile
 * (same coins and XP). Tiles where nothing applies are skipped and cost no fuel; the pass stops
 * when fuel runs out. Returns the tiles that were worked.
 */
function runPass(
  draft: FarmState,
  cmd: Drive,
  def: VehicleDef,
  tier: 1 | 2,
  ctx: PlanContext,
  emit: Emit,
): Tile[] {
  settleFuel(draft, ctx.now);
  const side = def.area[tier - 1] ?? 2;
  const worked: Tile[] = [];
  for (let y = cmd.y; y < cmd.y + side; y++) {
    for (let x = cmd.x; x < cmd.x + side; x++) {
      if (x < 0 || y < 0 || x >= draft.land.size || y >= draft.land.size) continue;
      if (draft.fuel.units < def.fuelPerTile) return worked;
      let acted = false;
      for (const op of OPS[def.op]) {
        if (op === "plant" && !cmd.cropId) continue;
        const step =
          op === "plow"
            ? planPlow(draft, { type: "plow", x, y }, ctx)
            : op === "plant"
              ? planPlant(draft, { type: "plant", x, y, cropId: cmd.cropId ?? "" }, ctx)
              : planHarvest(draft, { type: "harvest", x, y }, ctx);
        if (!isEffect(step)) continue;
        step(draft, emit);
        // The draft's objects map was edited in place; drop the memoized tile lookup.
        invalidateOccupancy(draft.objects);
        acted = true;
      }
      if (acted) {
        draft.fuel.units -= def.fuelPerTile;
        worked.push({ x, y });
      }
    }
  }
  return worked;
}

export function planDrive(state: FarmState, cmd: Drive, ctx: PlanContext): Step {
  const obj = state.objects[cmd.vehicleId];
  if (obj?.kind !== "vehicle") return { code: "NO_TARGET" };
  const def = getVehicle(obj.defId);
  if (!def) return { code: "UNKNOWN_DEF" };
  if (state.progress.level < FEATURE_LEVEL.vehicles) {
    return { code: "FEATURE_LOCKED", level: FEATURE_LEVEL.vehicles };
  }
  const fuel = fuelAt(state, ctx.now);
  if (fuel < def.fuelPerTile) {
    return { code: "NOT_ENOUGH", currency: "fuel", need: def.fuelPerTile, have: fuel };
  }
  // Dry run on a throwaway copy to learn whether the pass would do anything at all.
  let worked = 0;
  produce(state, (draft) => {
    worked = runPass(draft, cmd, def, obj.tier, ctx, () => {}).length;
  });
  if (worked === 0) return { code: "NOTHING_TO_DO" };

  return (draft, emit) => {
    const tiles = runPass(draft, cmd, def, obj.tier, ctx, emit);
    emit({ t: "vehiclePass", vehicleId: obj.id, op: def.op, tiles });
    bumpStat(draft, "vehicle:tiles", tiles.length);
    bumpStat(draft, `vehicle:${def.op}`, tiles.length);
  };
}
