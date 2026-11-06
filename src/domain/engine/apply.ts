import { produce } from "immer";
import type { Command } from "../types/commands";
import type { DomainError } from "../types/errors";
import type { DomainEvent } from "../types/events";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";
import { planRedeemSet, planSwapCollectible } from "./handlers/collections";
import { planCraft, planSellMaterial, planUseMaterial } from "./handlers/craft";
import { planDev } from "./handlers/dev";
import { planBuyEventItem } from "./handlers/events";
import { planCollectAnimal, planHarvest, planPlant, planPlow } from "./handlers/field";
import {
  planBuyItem,
  planBuyPlace,
  planExpand,
  planHouse,
  planMove,
  planPlaceStored,
  planRelease,
  planSell,
  planStore,
  planUpgrade,
  planUseItem,
} from "./handlers/market";
import { planClaimQuest } from "./handlers/quests";
import {
  planClaimDaily,
  planClaimGift,
  planFertilize,
  planGiftNeighbor,
  planHelpNeighbor,
} from "./handlers/social";
import { planDrive } from "./handlers/vehicle";
import { afterStep, beforeStep } from "./observers";
import { isEffect, type PlanContext, type Step } from "./step";

export interface ApplyContext {
  now: Ms;
  /** Allows developer commands. Never set by a server. */
  dev?: boolean;
}

export type ApplyResult =
  | { ok: true; state: FarmState; events: DomainEvent[] }
  | { ok: false; error: DomainError };

/** Time never runs backwards past the latest command, so turning the clock back changes nothing. */
const effectiveNow = (state: FarmState, now: Ms) => Math.max(now, state.meta.lastNow);

function plan(state: FarmState, cmd: Command, ctx: PlanContext): Step {
  switch (cmd.type) {
    case "plow":
      return planPlow(state, cmd, ctx);
    case "plant":
      return planPlant(state, cmd, ctx);
    case "harvest":
      return planHarvest(state, cmd, ctx);
    case "drive":
      return planDrive(state, cmd, ctx);
    case "collectAnimal":
      return planCollectAnimal(state, cmd, ctx);
    case "settle":
      return () => {};
    case "buyEventItem":
      return planBuyEventItem(state, cmd, ctx);
    case "claimDaily":
      return planClaimDaily(state, ctx);
    case "helpNeighbor":
      return planHelpNeighbor(state, cmd, ctx);
    case "claimGift":
      return planClaimGift(state, cmd, ctx);
    case "giftNeighbor":
      return planGiftNeighbor(state, cmd, ctx);
    case "fertilize":
      return planFertilize(state, cmd, ctx);
    case "claimQuest":
      return planClaimQuest(state, cmd, ctx);
    case "redeemSet":
      return planRedeemSet(state, cmd, ctx);
    case "swapCollectible":
      return planSwapCollectible(state, cmd);
    case "dev":
      return planDev(cmd.op, ctx);
    case "buyPlace":
      return planBuyPlace(state, cmd, ctx);
    case "buyItem":
      return planBuyItem(state, cmd, ctx);
    case "move":
      return planMove(state, cmd, ctx);
    case "sell":
      return planSell(state, cmd);
    case "store":
      return planStore(state, cmd);
    case "placeStored":
      return planPlaceStored(state, cmd, ctx);
    case "house":
      return planHouse(state, cmd);
    case "release":
      return planRelease(state, cmd, ctx);
    case "upgrade":
      return planUpgrade(state, cmd);
    case "expand":
      return planExpand(state, cmd);
    case "useItem":
      return planUseItem(state, cmd, ctx);
    case "craft":
      return planCraft(state, cmd, ctx);
    case "sellMaterial":
      return planSellMaterial(state, cmd);
    case "useMaterial":
      return planUseMaterial(state, cmd, ctx);
  }
}

/**
 * Applies time-based settling (roaming animals) up to `now`. Commands are planned against the
 * settled state, so a harvest sees manure that landed in windows that already finished.
 */
function settle(state: FarmState, now: Ms): { state: FarmState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const next = produce(state, (draft) => beforeStep(draft, (e) => events.push(e), now));
  return { state: next, events };
}

export function validateCommand(
  state: FarmState,
  cmd: Command,
  ctx: ApplyContext,
): DomainError | null {
  const now = effectiveNow(state, ctx.now);
  const step = plan(settle(state, now).state, cmd, { now, dev: ctx.dev ?? false });
  return isEffect(step) ? null : step;
}

/** The single entry point for changing a farm. Pure: same inputs, same outputs. */
export function applyCommand(state: FarmState, cmd: Command, ctx: ApplyContext): ApplyResult {
  const now = effectiveNow(state, ctx.now);
  const settled = settle(state, now);
  const step = plan(settled.state, cmd, { now, dev: ctx.dev ?? false });
  if (!isEffect(step)) return { ok: false, error: step };
  const events: DomainEvent[] = [...settled.events];
  const next = produce(settled.state, (draft) => {
    const emit = (event: DomainEvent) => events.push(event);
    draft.meta.lastNow = now;
    step(draft, emit);
    afterStep(draft, emit, now);
  });
  return { ok: true, state: next, events };
}
