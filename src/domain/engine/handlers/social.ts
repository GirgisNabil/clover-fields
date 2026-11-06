import { FEATURE_LEVEL } from "../../catalog/levels";
import {
  GIFT_TABLE,
  getNeighbor,
  HEART,
  HELPS_PER_DAY,
  helpReward,
  MAX_HEARTS,
} from "../../catalog/neighbors";
import { getMaterial } from "../../catalog/registry";
import type { CropShape } from "../../catalog/types";
import { helpTargets, neighborFarm, tileKey } from "../../npc/farmGen";
import { roll } from "../../rng/hash";
import { tryFind } from "../../rules/collections";
import { claimDaily, dailyStatus } from "../../rules/daily";
import { dayIndex, isToday } from "../../rules/day";
import { objectAt } from "../../rules/grid";
import { removeMaterial } from "../../rules/materials";
import { bumpStat } from "../../rules/progression";
import { grantReward } from "../../rules/reward";
import { cropStage } from "../../rules/time";
import type { InstantCommand } from "../../types/commands";
import type { Ms } from "../../types/ids";
import type { FarmState, NeighborState, PlotObject } from "../../types/state";
import type { PlanContext, Step } from "../step";

type Cmd<T extends InstantCommand["type"]> = Extract<InstantCommand, { type: T }>;

export function planClaimDaily(state: FarmState, { now }: PlanContext): Step {
  if (state.progress.level < FEATURE_LEVEL.daily) {
    return { code: "FEATURE_LOCKED", level: FEATURE_LEVEL.daily };
  }
  if (dailyStatus(state, now).claimedToday) return { code: "WRONG_STATE" };
  return (draft, emit) => {
    claimDaily(draft, emit, now);
    bumpStat(draft, "daily:claim");
  };
}

const EMPTY: NeighborState = {
  helpAt: null,
  helped: [],
  giftAt: null,
  giftedAt: null,
  friendship: 0,
};

export const neighborState = (state: FarmState, id: string): NeighborState =>
  state.neighbors[id] ?? EMPTY;

/** Tiles helped on that neighbour's farm today ("x,y"). */
export function helpedToday(state: FarmState, id: string, now: Ms): string[] {
  const n = neighborState(state, id);
  return isToday(n.helpAt, now, state.meta.dayOffsetMin) ? n.helped : [];
}

/** The neighbour's farm as it looks right now, after today's help. */
export function visitFarm(state: FarmState, id: string, now: Ms): FarmState {
  return neighborFarm(id, dayIndex(now, state.meta.dayOffsetMin), helpedToday(state, id, now), now);
}

/** The neighbour's record inside a draft, created on first contact. */
function neighborDraft(draft: FarmState, id: string): NeighborState {
  const existing = draft.neighbors[id];
  if (existing) return existing;
  const fresh = { ...EMPTY, helped: [] };
  draft.neighbors[id] = fresh;
  return draft.neighbors[id] ?? fresh;
}

export const hearts = (friendship: number) => Math.min(MAX_HEARTS, Math.floor(friendship / HEART));
const MAX_FRIENDSHIP = HEART * MAX_HEARTS;

function locked(state: FarmState): Step | null {
  return state.progress.level < FEATURE_LEVEL.neighbors
    ? { code: "FEATURE_LOCKED", level: FEATURE_LEVEL.neighbors }
    : null;
}

/** One chore on a neighbour's farm: you earn coins, XP, friendship and a chance at a keepsake. */
export function planHelpNeighbor(
  state: FarmState,
  cmd: Cmd<"helpNeighbor">,
  { now }: PlanContext,
): Step {
  const lock = locked(state);
  if (lock) return lock;
  if (!getNeighbor(cmd.npcId)) return { code: "UNKNOWN_DEF" };
  const done = helpedToday(state, cmd.npcId, now);
  if (done.length >= HELPS_PER_DAY) return { code: "NOTHING_TO_DO" };
  const key = tileKey(cmd.x, cmd.y);
  if (done.includes(key)) return { code: "WRONG_STATE" };
  const target = helpTargets(visitFarm(state, cmd.npcId, now), now).find(
    (t) => t.x === cmd.x && t.y === cmd.y,
  );
  if (!target) return { code: "NO_TARGET" };
  return (draft, emit) => {
    const n = neighborDraft(draft, cmd.npcId);
    n.helped = isToday(n.helpAt, now, draft.meta.dayOffsetMin) ? [...n.helped, key] : [key];
    n.helpAt = now;
    n.friendship = Math.min(MAX_FRIENDSHIP, n.friendship + 1);
    bumpStat(draft, "neighbor:help");
    emit({ t: "neighborHelped", npcId: cmd.npcId, x: cmd.x, y: cmd.y, friendship: n.friendship });
    grantReward(draft, helpReward(draft.progress.level), emit, "neighbor", now);
    const source =
      target.kind === "crop"
        ? { kind: "crop" as const, shape: (target.shape ?? "sprig") as CropShape, growMs: 0 }
        : { kind: target.kind };
    tryFind(draft, source, roll(draft), emit, undefined, 0.1);
  };
}

/** Once a day, a neighbour with at least one heart sends you something from their gift table. */
export function planClaimGift(state: FarmState, cmd: Cmd<"claimGift">, { now }: PlanContext): Step {
  const lock = locked(state);
  if (lock) return lock;
  if (!getNeighbor(cmd.npcId)) return { code: "UNKNOWN_DEF" };
  const n = neighborState(state, cmd.npcId);
  if (hearts(n.friendship) < 1) return { code: "LOCKED", level: 0 };
  if (isToday(n.giftAt, now, state.meta.dayOffsetMin)) return { code: "WRONG_STATE" };
  return (draft, emit) => {
    const u = roll(draft);
    const total = GIFT_TABLE.reduce((s, g) => s + g.weight, 0);
    let pick = u * total;
    let gift = GIFT_TABLE[0];
    for (const g of GIFT_TABLE) {
      pick -= g.weight;
      if (pick < 0) {
        gift = g;
        break;
      }
    }
    const n = neighborDraft(draft, cmd.npcId);
    n.giftAt = now;
    emit({ t: "giftReceived", npcId: cmd.npcId });
    if (gift) {
      const { weight: _weight, ...reward } = gift;
      grantReward(draft, reward, emit, "neighbor", now);
    }
  };
}

/** Give a neighbour one crafted good (once a day) for a big friendship boost. */
export function planGiftNeighbor(
  state: FarmState,
  cmd: Cmd<"giftNeighbor">,
  { now }: PlanContext,
): Step {
  const lock = locked(state);
  if (lock) return lock;
  if (!getNeighbor(cmd.npcId)) return { code: "UNKNOWN_DEF" };
  const def = getMaterial(cmd.id);
  if (def?.mkind !== "good") return { code: "WRONG_STATE" };
  if ((state.materials[cmd.id] ?? 0) < 1)
    return { code: "NOT_ENOUGH_ITEMS", id: cmd.id, need: 1, have: 0 };
  if (isToday(neighborState(state, cmd.npcId).giftedAt, now, state.meta.dayOffsetMin)) {
    return { code: "WRONG_STATE" };
  }
  return (draft, emit) => {
    removeMaterial(draft, cmd.id, 1, emit);
    const n = neighborDraft(draft, cmd.npcId);
    n.friendship = Math.min(MAX_FRIENDSHIP, n.friendship + 3);
    n.giftedAt = now;
    emit({ t: "giftGiven", npcId: cmd.npcId, id: cmd.id });
  };
}

/** A Fertilizer Sack manures every growing, unmanured crop in the 3×3 square around (x, y). */
export function planFertilize(state: FarmState, cmd: Cmd<"fertilize">, { now }: PlanContext): Step {
  if ((state.materials.fertilizer_sack ?? 0) < 1) {
    return { code: "NOT_ENOUGH_ITEMS", id: "fertilizer_sack", need: 1, have: 0 };
  }
  const plots: PlotObject[] = [];
  for (let y = cmd.y - 1; y <= cmd.y + 1; y++) {
    for (let x = cmd.x - 1; x <= cmd.x + 1; x++) {
      const obj = objectAt(state, x, y);
      if (obj?.kind !== "plot" || !obj.crop || obj.crop.manure) continue;
      if (cropStage(obj.id, obj.crop, state.meta.witherSalt, now).stage !== "growing") continue;
      plots.push(obj);
    }
  }
  if (plots.length === 0) return { code: "NOTHING_TO_DO" };
  return (draft, emit) => {
    removeMaterial(draft, "fertilizer_sack", 1, emit);
    for (const plot of plots) {
      const target = draft.objects[plot.id] as PlotObject;
      if (!target.crop) continue;
      target.crop.manure = { at: now, by: "fertilizer_sack" };
      target.crop.fertilized = true;
      emit({ t: "manured", plotId: plot.id, at: { x: plot.x, y: plot.y }, by: "fertilizer_sack" });
    }
    bumpStat(draft, "fertilize");
  };
}
