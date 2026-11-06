import { RIBBON_REWARDS } from "../catalog/balance";
import { FEATURE_LEVEL } from "../catalog/levels";
import { RIBBONS, tierFor } from "../catalog/ribbons";
import type { Emit } from "../types/events";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";
import { grantReward } from "./reward";

/**
 * Awards every ribbon tier the farm has reached but not yet received, lowest first, one event
 * per tier. Idempotent: the tier reached is stored, so running it again changes nothing.
 * Returns true if anything was awarded (rewards can push other counters).
 */
export function awardRibbons(draft: FarmState, emit: Emit, now: Ms): boolean {
  if (draft.progress.level < FEATURE_LEVEL.ribbons) return false;
  let changed = false;
  for (const ribbon of RIBBONS) {
    const reached = tierFor(ribbon, ribbon.value(draft));
    let tier = draft.ribbons[ribbon.id] ?? 0;
    while (tier < reached) {
      tier++;
      draft.ribbons[ribbon.id] = tier;
      emit({ t: "ribbon", id: ribbon.id, tier });
      const reward = RIBBON_REWARDS[tier - 1];
      if (reward) grantReward(draft, reward, emit, "ribbon", now);
      changed = true;
    }
  }
  return changed;
}
