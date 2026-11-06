import { bushelChance, POLLINATION } from "../catalog/balance";
import type { CropId } from "../catalog/crops";
import { FEATURE_LEVEL } from "../catalog/levels";
import { getBuilding, getCrop } from "../catalog/registry";
import { roll } from "../rng/hash";
import type { Emit } from "../types/events";
import type { Tile } from "../types/ids";
import type { FarmState } from "../types/state";
import { rectOf } from "./grid";
import { addMaterial } from "./materials";

// Every command consumes a FIXED number of hidden rolls, whatever happens, so replays stay
// exact and reordering queued work can't reroll a drop:
//   crop harvest 3 (bushel, collectible find, event item) · plow 1 · producer/building/craft
//   collect 1 (collectible find).

export interface CropRolls {
  find: number;
  event: number;
}

export function cropHarvestDrops(
  draft: FarmState,
  cropId: CropId,
  fertilized: boolean,
  emit: Emit,
  at: Tile,
  pollinated = false,
): CropRolls {
  const bushel = roll(draft);
  const find = roll(draft);
  const event = roll(draft);
  const def = getCrop(cropId);
  if (def && draft.progress.level >= FEATURE_LEVEL.crafting) {
    const stars = draft.mastery[cropId]?.stars ?? 0;
    const mult = pollinated ? POLLINATION.bushelMult : 1;
    if (bushel < bushelChance(def.growMs, stars, fertilized) * mult) {
      addMaterial(draft, `bushel_${cropId}`, 1, emit, at);
    }
  }
  return { find, event };
}

/** One roll for a collectible find when plowing. */
export const plowRolls = (draft: FarmState) => roll(draft);

/** One roll for a collectible find when collecting animals, trees or a building. */
export const collectRolls = (draft: FarmState) => roll(draft);

/** True if a silk moth hut with at least one moth stands within POLLINATION.radius of (x, y). */
export function isPollinated(state: FarmState, x: number, y: number): boolean {
  for (const obj of Object.values(state.objects)) {
    if (obj.kind !== "building" || obj.occupants.length === 0) continue;
    const role = getBuilding(obj.defId)?.role;
    if (role?.type !== "housing" || role.accepts !== "moth") continue;
    const r = rectOf(obj);
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w - 1));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h - 1));
    if (Math.max(dx, dy) <= POLLINATION.radius) return true;
  }
  return false;
}
