import type { CropId } from "../catalog/crops";
import { getCrop } from "../catalog/registry";
import type { Emit } from "../types/events";
import type { Tile } from "../types/ids";
import type { FarmState } from "../types/state";
import { credit, grantXp } from "./progression";

const STAR_REWARDS = [
  { coins: 300, xp: 20 },
  { coins: 1000, xp: 60 },
  { coins: 3000, xp: 200 },
] as const;

/** Reward multiplier grows with the crop's tier so late crops pay more per star. */
export const masteryMultiplier = (unlockLevel: number) => 1 + Math.floor(unlockLevel / 10);

export function masteryReward(cropId: CropId, star: 1 | 2 | 3): { coins: number; xp: number } {
  const def = getCrop(cropId);
  const base = STAR_REWARDS[star - 1];
  if (!def || !base) return { coins: 0, xp: 0 };
  const m = masteryMultiplier(def.unlockLevel);
  return { coins: base.coins * m, xp: base.xp * m };
}

/** Counts one harvest toward mastery and pays out any stars it earns. */
/** Counts a harvest toward mastery; fertilized (manured) crops count `progress` = 2. */
export function recordHarvest(
  draft: FarmState,
  cropId: CropId,
  emit: Emit,
  at: Tile,
  progress = 1,
) {
  const def = getCrop(cropId);
  if (!def) return;
  const mastery = draft.mastery[cropId] ?? { count: 0, stars: 0 };
  draft.mastery[cropId] = mastery;
  const wasMastered = mastery.stars === 3;
  mastery.count += progress;
  if (wasMastered) {
    grantXp(draft, 1, emit, "harvest", at);
    return;
  }
  const thresholds: readonly number[] = def.mastery;
  while (mastery.stars < 3 && mastery.count >= (thresholds[mastery.stars] ?? Infinity)) {
    const star = (mastery.stars + 1) as 1 | 2 | 3;
    mastery.stars = star;
    const reward = masteryReward(cropId, star);
    const signGranted = star === 3;
    if (signGranted) {
      const signId = `sign_${cropId}`;
      draft.inventory.items[signId] = (draft.inventory.items[signId] ?? 0) + 1;
    }
    emit({ t: "masteryStar", cropId, star, coins: reward.coins, xp: reward.xp, signGranted });
    credit(draft, reward.coins, emit, "mastery", at);
    grantXp(draft, reward.xp, emit, "mastery", at);
  }
}
