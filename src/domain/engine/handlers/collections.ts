import { SWAP_COST, setReward } from "../../catalog/balance";
import { COLLECTIONS, getSet, SLOT_RARITY } from "../../catalog/collections";
import { FEATURE_LEVEL } from "../../catalog/levels";
import { addMaterial, removeMaterial } from "../../rules/materials";
import { bumpStat } from "../../rules/progression";
import { grantReward, type Reward } from "../../rules/reward";
import type { InstantCommand } from "../../types/commands";
import type { FarmState } from "../../types/state";
import type { PlanContext, Step } from "../step";

type Cmd<T extends InstantCommand["type"]> = Extract<InstantCommand, { type: T }>;

const locked = (state: FarmState): Step | null =>
  state.progress.level < FEATURE_LEVEL.collections
    ? { code: "FEATURE_LOCKED", level: FEATURE_LEVEL.collections }
    : null;

/** What turning a set in pays, given how many times it was turned in before. */
export function redeemReward(setId: string, timesBefore: number): Reward {
  const set = getSet(setId);
  if (!set) return {};
  const { coins, xp } = setReward(set.baseCoins, timesBefore);
  const times = timesBefore + 1;
  return {
    coins,
    xp,
    // The first turn-in also gives the set's trophy and a Golden Clover; every 5th a Brass Cog.
    ...(times === 1 ? { clovers: 1, items: { [`trophy_${setId}`]: 1 } } : {}),
    ...(times % 5 === 0 ? { materials: { brass_cog: 1 } } : {}),
  };
}

/** Turns in one of each of a set's six items. */
export function planRedeemSet(state: FarmState, cmd: Cmd<"redeemSet">, { now }: PlanContext): Step {
  const lock = locked(state);
  if (lock) return lock;
  const set = getSet(cmd.setId);
  if (!set) return { code: "UNKNOWN_DEF" };
  const missing = set.items.find((item) => (state.materials[item.id] ?? 0) < 1);
  if (missing) return { code: "NOT_ENOUGH_ITEMS", id: missing.id, need: 1, have: 0 };
  const timesBefore = state.collections[set.id]?.redeemed ?? 0;
  const reward = redeemReward(set.id, timesBefore);
  return (draft, emit) => {
    for (const item of set.items) removeMaterial(draft, item.id, 1, emit);
    draft.collections[set.id] = { redeemed: timesBefore + 1 };
    bumpStat(draft, "collect:redeem");
    emit({ t: "setRedeemed", setId: set.id, times: timesBefore + 1 });
    grantReward(draft, reward, emit, "collection", now);
  };
}

/** Spare copies (beyond the first) of each item in a set. */
export function duplicatesIn(state: FarmState, setId: string): number {
  const set = getSet(setId);
  if (!set) return 0;
  return set.items.reduce((sum, item) => sum + Math.max(0, (state.materials[item.id] ?? 0) - 1), 0);
}

export const swapCost = (setId: string, itemId: string): number => {
  const index = getSet(setId)?.items.findIndex((i) => i.id === itemId) ?? -1;
  return SWAP_COST[SLOT_RARITY[index] ?? "common"];
};

/**
 * Trades spare copies from the same set for one missing piece. Spares are taken one at a time
 * from whichever item has the most, so the result never depends on the UI.
 */
export function planSwapCollectible(state: FarmState, cmd: Cmd<"swapCollectible">): Step {
  const lock = locked(state);
  if (lock) return lock;
  const set = COLLECTIONS.find((s) => s.items.some((i) => i.id === cmd.want));
  if (!set) return { code: "UNKNOWN_DEF" };
  if ((state.materials[cmd.want] ?? 0) > 0) return { code: "WRONG_STATE" };
  const cost = swapCost(set.id, cmd.want);
  const have = duplicatesIn(state, set.id);
  if (have < cost) return { code: "NOT_ENOUGH_ITEMS", id: cmd.want, need: cost, have };
  return (draft, emit) => {
    for (let paid = 0; paid < cost; paid++) {
      let best = set.items[0];
      for (const item of set.items) {
        if ((draft.materials[item.id] ?? 0) > (draft.materials[best?.id ?? ""] ?? 0)) best = item;
      }
      if (best) removeMaterial(draft, best.id, 1, emit);
    }
    addMaterial(draft, cmd.want, 1, emit);
    bumpStat(draft, "collect:swap");
  };
}
