import { FEATURE_LEVEL } from "../../catalog/levels";
import { getRecipe } from "../../catalog/recipes";
import { getBuilding, getMaterial } from "../../catalog/registry";
import { FUEL, settleFuel } from "../../rules/fuel";
import { hasMaterials, removeMaterial } from "../../rules/materials";
import { bumpStat, credit } from "../../rules/progression";
import type { InstantCommand } from "../../types/commands";
import type { BuildingObject, FarmState } from "../../types/state";
import type { PlanContext, Step } from "../step";

type Cmd<T extends InstantCommand["type"]> = Extract<InstantCommand, { type: T }>;

/** Starts a crafting job: inputs are taken now, the good is collected when ready. */
export function planCraft(state: FarmState, cmd: Cmd<"craft">, { now }: PlanContext): Step {
  if (state.progress.level < FEATURE_LEVEL.crafting) {
    return { code: "FEATURE_LOCKED", level: FEATURE_LEVEL.crafting };
  }
  const building = state.objects[cmd.buildingId];
  if (building?.kind !== "building") return { code: "NO_TARGET" };
  const def = getBuilding(building.defId);
  const recipe = getRecipe(cmd.recipeId);
  if (!def || !recipe) return { code: "UNKNOWN_DEF" };
  if (def.role.type !== "craft" || def.role.station !== recipe.station)
    return { code: "WRONG_STATE" };
  if (state.progress.level < recipe.unlockLevel)
    return { code: "LOCKED", level: recipe.unlockLevel };
  if (building.jobs.length >= (def.capacity[building.tier - 1] ?? 1))
    return { code: "BUILDING_FULL" };
  const missing = hasMaterials(state, recipe.inputs);
  if (missing) {
    return {
      code: "NOT_ENOUGH_ITEMS",
      id: missing[0],
      need: missing[1],
      have: state.materials[missing[0]] ?? 0,
    };
  }
  return (draft, emit) => {
    for (const [id, n] of Object.entries(recipe.inputs)) removeMaterial(draft, id, n, emit);
    const target = draft.objects[building.id] as BuildingObject;
    const readyAt = now + recipe.timeMs;
    target.jobs.push({ recipeId: recipe.id, startedAt: now, readyAt });
    emit({ t: "craftStarted", buildingId: building.id, recipeId: recipe.id, readyAt });
  };
}

export function planSellMaterial(state: FarmState, cmd: Cmd<"sellMaterial">): Step {
  const def = getMaterial(cmd.id);
  if (!def) return { code: "UNKNOWN_DEF" };
  if (!def.sale) return { code: "NOT_SELLABLE" };
  const qty = Math.max(1, Math.floor(cmd.qty));
  const have = state.materials[def.id] ?? 0;
  if (have < qty) return { code: "NOT_ENOUGH_ITEMS", id: def.id, need: qty, have };
  const sale = def.sale;
  return (draft, emit) => {
    removeMaterial(draft, def.id, qty, emit);
    credit(draft, sale * qty, emit, "sell");
    bumpStat(draft, "coins:earned", sale * qty);
  };
}

export function planUseMaterial(
  state: FarmState,
  cmd: Cmd<"useMaterial">,
  { now }: PlanContext,
): Step {
  const def = getMaterial(cmd.id);
  if (!def) return { code: "UNKNOWN_DEF" };
  if ((state.materials[def.id] ?? 0) < 1) return { code: "NONE_OWNED" };
  const fuel = def.fuel;
  if (!fuel) return { code: "WRONG_STATE" };
  return (draft, emit) => {
    removeMaterial(draft, def.id, 1, emit);
    settleFuel(draft, now);
    const before = draft.fuel.units;
    draft.fuel.units = Math.min(FUEL.hardMax, before + fuel);
    emit({ t: "fuel", units: draft.fuel.units, delta: draft.fuel.units - before, reason: "item" });
  };
}
