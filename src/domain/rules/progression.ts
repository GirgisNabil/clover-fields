import { LEVEL_XP, levelUpClovers, levelUpCoins, titleFor } from "../catalog/levels";
import { unlocksAt } from "../catalog/registry";
import { MAX_LEVEL } from "../constants";
import type { Emit, Reason } from "../types/events";
import type { Tile } from "../types/ids";
import type { FarmState } from "../types/state";

/** Adds XP and applies every level-up it causes, one event per level, in order. */
export function grantXp(draft: FarmState, amount: number, emit: Emit, reason: Reason, at?: Tile) {
  if (amount <= 0) return;
  draft.progress.xp += amount;
  emit(at ? { t: "xp", amount, reason, at } : { t: "xp", amount, reason });
  while (
    draft.progress.level < MAX_LEVEL &&
    draft.progress.xp >= (LEVEL_XP[draft.progress.level + 1] ?? Number.POSITIVE_INFINITY)
  ) {
    draft.progress.level += 1;
    const level = draft.progress.level;
    const coins = levelUpCoins(level);
    const clovers = levelUpClovers(level);
    draft.wallet.coins += coins;
    draft.wallet.clovers += clovers;
    if (level === MAX_LEVEL) {
      draft.inventory.items.monarch_throne = (draft.inventory.items.monarch_throne ?? 0) + 1;
    }
    emit({
      t: "levelUp",
      level,
      title: titleFor(level),
      coins,
      clovers,
      unlocks: unlocksAt(level),
    });
  }
}

export function credit(draft: FarmState, coins: number, emit: Emit, reason: Reason, at?: Tile) {
  if (coins === 0) return;
  draft.wallet.coins += coins;
  emit(at ? { t: "coins", delta: coins, reason, at } : { t: "coins", delta: coins, reason });
}

export function creditClovers(draft: FarmState, clovers: number, emit: Emit, reason: Reason) {
  if (clovers === 0) return;
  draft.wallet.clovers += clovers;
  emit({ t: "clovers", delta: clovers, reason });
}

export function bumpStat(draft: FarmState, key: string, by = 1) {
  draft.stats.counters[key] = (draft.stats.counters[key] ?? 0) + by;
}
