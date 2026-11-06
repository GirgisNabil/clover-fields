import { getMaterial } from "../catalog/registry";
import type { Emit } from "../types/events";
import type { Tile } from "../types/ids";
import type { FarmState } from "../types/state";

/** Adds materials up to the cap; anything over the cap is lost. Returns how many were added. */
export function addMaterial(draft: FarmState, id: string, count: number, emit: Emit, at?: Tile) {
  const cap = getMaterial(id)?.cap ?? 99;
  const have = draft.materials[id] ?? 0;
  const added = Math.max(0, Math.min(count, cap - have));
  if (added > 0) draft.materials[id] = have + added;
  const event = { t: "material" as const, id, delta: added, capped: added < count };
  emit(at ? { ...event, at } : event);
  return added;
}

export function removeMaterial(draft: FarmState, id: string, count: number, emit: Emit) {
  const left = (draft.materials[id] ?? 0) - count;
  if (left > 0) draft.materials[id] = left;
  else delete draft.materials[id];
  emit({ t: "material", id, delta: -count, capped: false });
}

export const hasMaterials = (state: FarmState, needs: Readonly<Record<string, number>>) =>
  Object.entries(needs).find(([id, n]) => (state.materials[id] ?? 0) < n) ?? null;
