import { settleAnimals } from "../rules/animals";
import { updateDailyTasks } from "../rules/daily";
import { settleEvents } from "../rules/events";
import { updateQuests } from "../rules/quests";
import { awardRibbons } from "../rules/ribbons";
import type { Emit } from "../types/events";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";

type Observer = (draft: FarmState, emit: Emit, now: Ms) => boolean;

type Before = (draft: FarmState, emit: Emit, now: Ms) => void;

/** Runs before a command's effect: time-based settling (roaming animals, later day rollover). */
const BEFORE: Before[] = [settleAnimals, settleEvents];

/** Runs after a command's effect: quests and ribbons react to the new stats. Return true if changed. */
const AFTER: Observer[] = [updateQuests, updateDailyTasks, awardRibbons];

export function registerBefore(fn: Before) {
  BEFORE.push(fn);
}

export function registerAfter(fn: Observer) {
  AFTER.push(fn);
}

export function beforeStep(draft: FarmState, emit: Emit, now: Ms) {
  for (const fn of BEFORE) fn(draft, emit, now);
}

/** Loops until nothing changes (a reward can level you up, which can finish another goal). */
export function afterStep(draft: FarmState, emit: Emit, now: Ms) {
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const fn of AFTER) changed = fn(draft, emit, now) || changed;
    if (!changed) return;
  }
}
