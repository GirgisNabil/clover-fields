import { getEvent } from "../../catalog/events";
import { FEATURE_LEVEL } from "../../catalog/levels";
import { activeEvent } from "../../rules/events";
import { addItem } from "../../rules/inventory";
import { bumpStat } from "../../rules/progression";
import type { InstantCommand } from "../../types/commands";
import type { FarmState } from "../../types/state";
import type { PlanContext, Step } from "../step";

/** Buys an item from the running event's shop with its tokens; it goes to the Tool Shed. */
export function planBuyEventItem(
  state: FarmState,
  cmd: Extract<InstantCommand, { type: "buyEventItem" }>,
  { now }: PlanContext,
): Step {
  if (state.progress.level < FEATURE_LEVEL.events) {
    return { code: "FEATURE_LOCKED", level: FEATURE_LEVEL.events };
  }
  const active = activeEvent(now);
  if (!active || active.def.id !== cmd.eventId) return { code: "OUT_OF_SEASON" };
  const item = getEvent(cmd.eventId)?.shop.find((s) => s.defId === cmd.defId);
  if (!item) return { code: "UNKNOWN_DEF" };
  const record = state.events[cmd.eventId];
  const have = record && record.edition === active.edition && !record.settled ? record.tokens : 0;
  if (have < item.tokens)
    return { code: "NOT_ENOUGH", currency: "tokens", need: item.tokens, have };
  return (draft, emit) => {
    const target = draft.events[cmd.eventId];
    if (target) target.tokens -= item.tokens;
    addItem(draft, cmd.defId, 1);
    emit({ t: "inventory", defId: cmd.defId, delta: 1 });
    bumpStat(draft, "event:buy");
  };
}
