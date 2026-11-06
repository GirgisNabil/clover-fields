import type { Emit, Reason } from "../types/events";
import type { Ms, Tile } from "../types/ids";
import type { FarmState } from "../types/state";
import { FUEL, settleFuel } from "./fuel";
import { addItem } from "./inventory";
import { addMaterial } from "./materials";
import { credit, creditClovers, grantXp } from "./progression";

/** One reward shape for quests, ribbons, sets, the daily bonus, gifts and events. */
export interface Reward {
  coins?: number;
  xp?: number;
  clovers?: number;
  fuel?: number;
  /** Placeables and consumables, into the Tool Shed. */
  items?: Readonly<Record<string, number>>;
  materials?: Readonly<Record<string, number>>;
}

export function grantReward(
  draft: FarmState,
  reward: Reward,
  emit: Emit,
  reason: Reason,
  now: Ms,
  at?: Tile,
) {
  if (reward.coins) credit(draft, reward.coins, emit, reason, at);
  if (reward.clovers) creditClovers(draft, reward.clovers, emit, reason);
  if (reward.fuel) {
    settleFuel(draft, now);
    const before = draft.fuel.units;
    draft.fuel.units = Math.min(FUEL.hardMax, before + reward.fuel);
    emit({ t: "fuel", units: draft.fuel.units, delta: draft.fuel.units - before, reason });
  }
  for (const [id, n] of Object.entries(reward.items ?? {})) {
    addItem(draft, id, n);
    emit({ t: "inventory", defId: id, delta: n });
  }
  for (const [id, n] of Object.entries(reward.materials ?? {})) addMaterial(draft, id, n, emit, at);
  // XP last, so any level-up happens after everything else in the reward landed.
  if (reward.xp) grantXp(draft, reward.xp, emit, reason, at);
}
