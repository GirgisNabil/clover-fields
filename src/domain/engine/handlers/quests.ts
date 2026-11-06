import { getQuest } from "../../catalog/quests";
import { claimStep, isStepComplete, questProgress } from "../../rules/quests";
import type { InstantCommand } from "../../types/commands";
import type { FarmState } from "../../types/state";
import type { PlanContext, Step } from "../step";

/** Claims a finished quest step: deliveries are handed over and the reward paid. */
export function planClaimQuest(
  state: FarmState,
  cmd: Extract<InstantCommand, { type: "claimQuest" }>,
  { now }: PlanContext,
): Step {
  if (!getQuest(cmd.lineId) || !state.quests.active[cmd.lineId]) return { code: "NO_TARGET" };
  if (!isStepComplete(state, cmd.lineId)) {
    const missing = questProgress(state, cmd.lineId)?.find((g) => !g.done);
    if (missing?.goal.kind === "deliver") {
      return {
        code: "NOT_ENOUGH_ITEMS",
        id: missing.goal.id,
        need: missing.need,
        have: missing.have,
      };
    }
    return { code: "WRONG_STATE" };
  }
  return (draft, emit) => claimStep(draft, cmd.lineId, emit, now);
}
