import { getBuilding } from "../catalog/registry";
import { MINUTE } from "../constants";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";

export const FUEL = { regenMs: 5 * MINUTE, baseCap: 50, hardMax: 999 } as const;

/** Regeneration stops at the tank cap; a garage raises it. */
export function tankCap(state: Pick<FarmState, "objects">): number {
  let cap: number = FUEL.baseCap;
  for (const obj of Object.values(state.objects)) {
    if (obj.kind !== "building") continue;
    const def = getBuilding(obj.defId);
    if (def?.role.type === "garage") cap = Math.max(cap, def.role.fuelCap[obj.tier - 1] ?? cap);
  }
  return cap;
}

/** Fuel available at `now`, counting regeneration since the anchor. Fuel cans may overfill. */
export function fuelAt(state: Pick<FarmState, "fuel" | "objects">, now: Ms): number {
  const cap = tankCap(state);
  if (state.fuel.units >= cap) return state.fuel.units;
  const ticks = Math.floor(Math.max(0, now - state.fuel.anchor) / FUEL.regenMs);
  return Math.min(cap, state.fuel.units + ticks);
}

/** Writes regenerated fuel into the state, keeping partial progress toward the next unit. */
export function settleFuel(draft: FarmState, now: Ms): void {
  const cap = tankCap(draft);
  if (draft.fuel.units >= cap) {
    draft.fuel.anchor = now;
    return;
  }
  const ticks = Math.floor(Math.max(0, now - draft.fuel.anchor) / FUEL.regenMs);
  const units = Math.min(cap, draft.fuel.units + ticks);
  draft.fuel.anchor = units >= cap ? now : draft.fuel.anchor + ticks * FUEL.regenMs;
  draft.fuel.units = units;
}
