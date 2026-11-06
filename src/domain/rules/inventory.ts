import { getBuilding, getPlaceable } from "../catalog/registry";
import type { FarmState } from "../types/state";

/** Placeable, non-reward items take a Tool Shed slot; consumables and rewards don't. */
export function takesShedSlot(defId: string): boolean {
  const def = getPlaceable(defId);
  if (!def) return false;
  return !(def.kind === "decoration" && def.rewardOnly);
}

export function inventoryUsed(state: Pick<FarmState, "inventory">): number {
  let used = 0;
  for (const [defId, count] of Object.entries(state.inventory.items)) {
    if (takesShedSlot(defId)) used += count;
  }
  return used;
}

export function inventoryCapacity(state: Pick<FarmState, "objects">): number {
  const shedDef = getBuilding("tool_shed");
  const fallback = shedDef?.capacity[0] ?? 20;
  for (const obj of Object.values(state.objects)) {
    if (obj.kind === "building" && obj.defId === "tool_shed") {
      return shedDef?.capacity[obj.tier - 1] ?? fallback;
    }
  }
  return fallback;
}

export function addItem(draft: FarmState, defId: string, count = 1) {
  draft.inventory.items[defId] = (draft.inventory.items[defId] ?? 0) + count;
}

export function removeItem(draft: FarmState, defId: string, count = 1) {
  const left = (draft.inventory.items[defId] ?? 0) - count;
  if (left > 0) draft.inventory.items[defId] = left;
  else delete draft.inventory.items[defId];
}
