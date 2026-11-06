import { findChance } from "../catalog/balance";
import { type FindSource, SLOT_WEIGHT, setOf } from "../catalog/collections";
import { FEATURE_LEVEL } from "../catalog/levels";
import type { Emit } from "../types/events";
import type { Tile } from "../types/ids";
import type { FarmState } from "../types/state";
import { addMaterial } from "./materials";
import { bumpStat } from "./progression";

const TOTAL_WEIGHT = SLOT_WEIGHT.reduce((a, b) => a + b, 0);

/**
 * Turns an action's find roll `u` (0–1) into a collectible, or nothing. The same roll picks the
 * item: below the chance it is rescaled across the set's slot weights, so no extra rolls are used.
 */
export function tryFind(
  draft: FarmState,
  source: FindSource,
  u: number,
  emit: Emit,
  at?: Tile,
  chanceOverride?: number,
): string | null {
  if (draft.progress.level < FEATURE_LEVEL.collections) return null;
  const chance = chanceOverride ?? findChance(source);
  if (u >= chance) return null;
  const set = setOf(source);
  if (!set) return null;
  let pick = (u / chance) * TOTAL_WEIGHT;
  let index = 0;
  while (index < SLOT_WEIGHT.length - 1 && pick >= (SLOT_WEIGHT[index] ?? 0)) {
    pick -= SLOT_WEIGHT[index] ?? 0;
    index++;
  }
  const item = set.items[index];
  if (!item) return null;
  addMaterial(draft, item.id, 1, emit, at);
  bumpStat(draft, "collect:find");
  emit(
    at
      ? { t: "found", id: item.id, setId: set.id, at }
      : { t: "found", id: item.id, setId: set.id },
  );
  return item.id;
}
