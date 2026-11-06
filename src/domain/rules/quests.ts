import { type Goal, getQuest, MAX_ACTIVE_QUESTS, QUESTS, type QuestLine } from "../catalog/quests";
import type { Emit } from "../types/events";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";
import { activeEvent } from "./events";
import { removeMaterial } from "./materials";
import { grantReward } from "./reward";

export interface GoalProgress {
  goal: Goal;
  have: number;
  need: number;
  done: boolean;
}

/** How many of a catalog item are on the farm, counting animals that live in buildings. */
export function ownedCount(state: FarmState, defId: string): number {
  let n = 0;
  for (const obj of Object.values(state.objects)) {
    if (obj.defId === defId) n++;
    if (obj.kind === "building") n += obj.occupants.filter((o) => o.defId === defId).length;
  }
  return n;
}

function goalValue(state: FarmState, goal: Goal, base: Record<string, number>): number {
  switch (goal.kind) {
    case "count":
      return (state.stats.counters[goal.stat] ?? 0) - (base[goal.stat] ?? 0);
    case "own":
      return ownedCount(state, goal.defId);
    case "ownKind":
      return Object.values(state.objects).filter((o) => o.kind === goal.objectKind).length;
    case "level":
      return state.progress.level;
    case "stars":
      return Object.values(state.mastery).reduce((sum, m) => sum + (m?.stars ?? 0), 0);
    case "expand":
      return state.land.expansionIndex;
    case "deliver":
      return state.materials[goal.id] ?? 0;
  }
}

/** Progress of a line's current step, or null if the line isn't active. */
export function questProgress(state: FarmState, lineId: string): GoalProgress[] | null {
  const active = state.quests.active[lineId];
  const step = active ? getQuest(lineId)?.steps[active.step] : undefined;
  if (!active || !step) return null;
  return step.goals.map((goal) => {
    const have = Math.max(0, goalValue(state, goal, active.base));
    return { goal, have: Math.min(have, goal.n), need: goal.n, done: have >= goal.n };
  });
}

export const isStepComplete = (state: FarmState, lineId: string) =>
  questProgress(state, lineId)?.every((g) => g.done) ?? false;

/** Stats the step's count goals measure from. */
function baseline(state: FarmState, line: QuestLine, step: number): Record<string, number> {
  const base: Record<string, number> = {};
  for (const goal of line.steps[step]?.goals ?? []) {
    if (goal.kind === "count") base[goal.stat] = state.stats.counters[goal.stat] ?? 0;
  }
  return base;
}

export function startLine(draft: FarmState, line: QuestLine, now: Ms, emit?: Emit) {
  draft.quests.active[line.id] = { step: 0, startedAt: now, base: baseline(draft, line, 0) };
  emit?.({ t: "questStarted", lineId: line.id, npc: line.npc });
}

/** Pays a finished step (using up deliveries) and moves the line on, or finishes it. */
export function claimStep(draft: FarmState, lineId: string, emit: Emit, now: Ms) {
  const line = getQuest(lineId);
  const active = draft.quests.active[lineId];
  const step = active ? line?.steps[active.step] : undefined;
  if (!line || !active || !step) return;
  for (const goal of step.goals) {
    if (goal.kind === "deliver") removeMaterial(draft, goal.id, goal.n, emit);
  }
  const index = active.step;
  const last = index + 1 >= line.steps.length;
  emit({ t: "questStep", lineId, npc: line.npc, step: index, last });
  if (last) {
    delete draft.quests.active[lineId];
    draft.quests.done[lineId] = now;
  } else {
    draft.quests.active[lineId] = {
      step: index + 1,
      startedAt: now,
      base: baseline(draft, line, index + 1),
    };
  }
  grantReward(draft, step.reward, emit, "quest", now);
}

/**
 * After every command: claim finished auto steps, then start waiting lines whose level and
 * prerequisite are met while fewer than MAX_ACTIVE_QUESTS run. Idempotent.
 */
export function updateQuests(draft: FarmState, emit: Emit, now: Ms): boolean {
  let changed = false;
  for (const lineId of Object.keys(draft.quests.active)) {
    const line = getQuest(lineId);
    const active = draft.quests.active[lineId];
    if (!line || !active) {
      delete draft.quests.active[lineId];
      changed = true;
      continue;
    }
    if (line.steps[active.step]?.auto && isStepComplete(draft, lineId)) {
      claimStep(draft, lineId, emit, now);
      changed = true;
    }
  }
  for (const line of QUESTS) {
    if (Object.keys(draft.quests.active).length >= MAX_ACTIVE_QUESTS) break;
    if (draft.quests.active[line.id] || draft.quests.done[line.id] !== undefined) continue;
    if (draft.progress.level < line.unlockLevel) continue;
    if (line.after && draft.quests.done[line.after] === undefined) continue;
    if (line.event && activeEvent(now)?.def.id !== line.event) continue;
    if (line.skipFrom !== undefined && draft.progress.level >= line.skipFrom) {
      draft.quests.done[line.id] = now;
      changed = true;
      continue;
    }
    startLine(draft, line, now, emit);
    changed = true;
  }
  return changed;
}
