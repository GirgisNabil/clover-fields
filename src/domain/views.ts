import { SWAP_COST, setReward } from "./catalog/balance";
import { COLLECTIONS, SLOT_RARITY } from "./catalog/collections";
import { FEATURE_LEVEL } from "./catalog/levels";
import { QUESTS } from "./catalog/quests";
import { RIBBONS, TIER_NAMES, tierFor } from "./catalog/ribbons";
import type { Rarity } from "./catalog/types";
import { duplicatesIn } from "./engine/handlers/collections";
import { questProgress } from "./rules/quests";
import type { Reward } from "./rules/reward";
import type { FarmState } from "./types/state";

// Read-only views for the Farm Book. The HUD renders these; it never computes rules itself.

export interface CollectionItemView {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  count: number;
  /** Spares needed to trade for this piece (only meaningful when count is 0). */
  swapCost: number;
}

export interface CollectionView {
  id: string;
  name: string;
  icon: string;
  hint: string;
  items: CollectionItemView[];
  found: number;
  complete: boolean;
  redeemed: number;
  nextReward: { coins: number; xp: number };
  spares: number;
}

export function collectionsView(state: FarmState): CollectionView[] {
  return COLLECTIONS.map((set) => {
    const items = set.items.map((item, i) => {
      const rarity = SLOT_RARITY[i] ?? "common";
      return {
        id: item.id,
        name: item.name,
        icon: item.icon,
        rarity,
        count: state.materials[item.id] ?? 0,
        swapCost: SWAP_COST[rarity],
      };
    });
    const found = items.filter((i) => i.count > 0).length;
    const redeemed = state.collections[set.id]?.redeemed ?? 0;
    return {
      id: set.id,
      name: set.name,
      icon: set.icon,
      hint: set.hint,
      items,
      found,
      complete: found === items.length,
      redeemed,
      nextReward: setReward(set.baseCoins, redeemed),
      spares: duplicatesIn(state, set.id),
    };
  });
}

export const setsReady = (state: FarmState) =>
  state.progress.level >= FEATURE_LEVEL.collections
    ? collectionsView(state).filter((s) => s.complete).length
    : 0;

export interface RibbonView {
  id: string;
  name: string;
  icon: string;
  tier: number;
  tierName: string | null;
  value: number;
  /** Next threshold, or null once gold. */
  next: number | null;
  goal: string;
  progress: number;
}

export function ribbonsView(state: FarmState): RibbonView[] {
  return RIBBONS.map((ribbon) => {
    const value = ribbon.value(state);
    const tier = state.ribbons[ribbon.id] ?? 0;
    const shown = Math.max(tier, 0);
    const next = ribbon.thresholds[shown] ?? null;
    const prev = shown > 0 ? (ribbon.thresholds[shown - 1] ?? 0) : 0;
    return {
      id: ribbon.id,
      name: ribbon.name,
      icon: ribbon.icon,
      tier,
      tierName: tier > 0 ? (TIER_NAMES[tier - 1] ?? null) : null,
      value,
      next,
      goal: ribbon.goal(next ?? ribbon.thresholds[3]),
      progress: next === null ? 1 : Math.min(1, Math.max(0, (value - prev) / (next - prev))),
    };
  });
}

/** Tier-1 ribbons are worth checking: reached but not yet awarded can't happen after a command. */
export const ribbonTierCount = (state: FarmState) =>
  Object.values(state.ribbons).reduce((sum, t) => sum + t, 0);

export { tierFor };

export interface QuestStepView {
  lineId: string;
  lineName: string;
  npc: string;
  step: number;
  steps: number;
  title: string;
  text: string;
  goals: Array<{ label: string; have: number; need: number; done: boolean }>;
  reward: Reward;
  complete: boolean;
  /** Claimed automatically (tutorial steps). */
  auto: boolean;
  /** 0–1 across the step's goals. */
  progress: number;
}

/** Every running questline's current step, in catalog order. */
export function questsView(state: FarmState): QuestStepView[] {
  const out: QuestStepView[] = [];
  for (const line of QUESTS) {
    const active = state.quests.active[line.id];
    const step = active ? line.steps[active.step] : undefined;
    const goals = questProgress(state, line.id);
    if (!active || !step || !goals) continue;
    const complete = goals.every((g) => g.done);
    out.push({
      lineId: line.id,
      lineName: line.name,
      npc: line.npc,
      step: active.step,
      steps: line.steps.length,
      title: step.title,
      text: step.text,
      goals: goals.map((g) => ({ label: g.goal.label, have: g.have, need: g.need, done: g.done })),
      reward: step.reward,
      complete,
      auto: step.auto ?? false,
      progress: goals.reduce((sum, g) => sum + g.have / g.need, 0) / Math.max(1, goals.length),
    });
  }
  return out;
}

/** Neighbours with something running, and whether one of their steps waits to be claimed. */
export function npcsWithQuests(state: FarmState): Array<{ npc: string; claimable: boolean }> {
  const by = new Map<string, boolean>();
  for (const q of questsView(state)) {
    by.set(q.npc, (by.get(q.npc) ?? false) || (q.complete && !q.auto));
  }
  return [...by].map(([npc, claimable]) => ({ npc, claimable }));
}
