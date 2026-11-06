import { DAILY_BONUS, DAILY_TASK_COUNT, DAILY_TASKS, dailyReward } from "../catalog/daily";
import { FEATURE_LEVEL } from "../catalog/levels";
import { hash32 } from "../rng/hash";
import type { Emit } from "../types/events";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";
import { dayIndex, isToday } from "./day";
import { grantReward } from "./reward";

export interface DailyStatus {
  claimedToday: boolean;
  /** The streak after today's claim (or today's streak if already claimed). */
  streak: number;
  /** Cycle day 0–6 of today's claim. */
  cycleDay: number;
}

/** Where today's claim falls in the 7-day cycle. A missed day starts the streak over. */
export function dailyStatus(state: FarmState, now: Ms): DailyStatus {
  const { lastClaimAt, streak } = state.daily;
  const offset = state.meta.dayOffsetMin;
  const claimedToday = isToday(lastClaimAt, now, offset);
  const continuing =
    lastClaimAt !== null && dayIndex(lastClaimAt, offset) === dayIndex(now, offset) - 1;
  const next = claimedToday ? streak : continuing ? streak + 1 : 1;
  return { claimedToday, streak: next, cycleDay: (Math.max(1, next) - 1) % 7 };
}

export function claimDaily(draft: FarmState, emit: Emit, now: Ms) {
  const status = dailyStatus(draft, now);
  const reward = dailyReward(status.cycleDay, draft.progress.level);
  draft.daily.lastClaimAt = now;
  draft.daily.streak = status.streak;
  draft.daily.best = Math.max(draft.daily.best, status.streak);
  emit({ t: "dailyClaimed", day: status.cycleDay, streak: status.streak });
  grantReward(draft, reward, emit, "daily", now);
}

/** Today's three tasks, chosen by a hash of the farm and the day from what the level allows. */
function pickTasks(state: FarmState, now: Ms) {
  const day = dayIndex(now, state.meta.dayOffsetMin);
  return DAILY_TASKS.filter((t) => t.minLevel <= state.progress.level)
    .map((t) => ({ t, k: hash32("daily-task", state.meta.farmId, day, t.id) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, DAILY_TASK_COUNT)
    .map(({ t }) => ({ id: t.id, base: state.stats.counters[t.stat] ?? 0, done: false }));
}

/**
 * After every command: deal a fresh set of tasks on a new day, mark finished ones (paying their
 * coins) and pay the bonus when the last of the three is done. Idempotent.
 */
export function updateDailyTasks(draft: FarmState, emit: Emit, now: Ms): boolean {
  if (draft.progress.level < FEATURE_LEVEL.daily) return false;
  let changed = false;
  if (!isToday(draft.daily.taskAt, now, draft.meta.dayOffsetMin)) {
    draft.daily.taskAt = now;
    draft.daily.tasks = pickTasks(draft, now);
    changed = true;
  }
  const wasAllDone = draft.daily.tasks.length > 0 && draft.daily.tasks.every((t) => t.done);
  for (const task of draft.daily.tasks) {
    if (task.done) continue;
    const def = DAILY_TASKS.find((d) => d.id === task.id);
    if (!def) continue;
    if ((draft.stats.counters[def.stat] ?? 0) - task.base < def.n) continue;
    task.done = true;
    emit({ t: "dailyTask", id: task.id });
    grantReward(draft, { coins: def.coins, xp: Math.round(def.coins / 10) }, emit, "daily", now);
    changed = true;
  }
  const allDone = draft.daily.tasks.length > 0 && draft.daily.tasks.every((t) => t.done);
  if (allDone && !wasAllDone) {
    emit({ t: "dailyBonus" });
    grantReward(draft, DAILY_BONUS, emit, "daily", now);
  }
  return changed;
}

/** Progress of today's tasks (for the HUD). */
export function dailyTasksView(state: FarmState) {
  return state.daily.tasks.map((task) => {
    const def = DAILY_TASKS.find((d) => d.id === task.id);
    const have = def ? Math.min(def.n, (state.stats.counters[def.stat] ?? 0) - task.base) : 0;
    return {
      id: task.id,
      label: def?.label ?? task.id,
      have: Math.max(0, have),
      need: def?.n ?? 1,
      done: task.done,
      coins: def?.coins ?? 0,
    };
  });
}
