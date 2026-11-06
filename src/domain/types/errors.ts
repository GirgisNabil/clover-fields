import type { Ms, ObjectId } from "./ids";

export type DomainError =
  | { code: "OUT_OF_BOUNDS" }
  | { code: "OCCUPIED"; by: ObjectId }
  | { code: "NO_TARGET" }
  | { code: "TARGET_CHANGED" }
  | { code: "WRONG_STATE" }
  | { code: "NOT_READY"; readyAt: Ms }
  | { code: "WITHERED" }
  | {
      code: "NOT_ENOUGH";
      currency: "coins" | "clovers" | "fuel" | "tokens";
      need: number;
      have: number;
    }
  | { code: "NOT_ENOUGH_ITEMS"; id: string; need: number; have: number }
  | { code: "LOCKED"; level: number }
  | { code: "FEATURE_LOCKED"; level: number }
  | { code: "UNKNOWN_DEF" }
  | { code: "NOT_FOR_SALE" }
  | { code: "NOT_SELLABLE" }
  | { code: "NOT_STORABLE" }
  | { code: "NOT_EMPTY" }
  | { code: "INVENTORY_FULL" }
  | { code: "NONE_OWNED" }
  | { code: "WRONG_HOUSING" }
  | { code: "BUILDING_FULL" }
  | { code: "MAX_TIER" }
  | { code: "MAX_LAND" }
  | { code: "NOTHING_TO_DO" }
  | { code: "QUEUE_FULL" }
  | { code: "DEV_ONLY" }
  | { code: "OUT_OF_SEASON" };

export type ErrorCode = DomainError["code"];

export function describeError(error: DomainError): string {
  switch (error.code) {
    case "OUT_OF_BOUNDS":
      return "That's outside your farm.";
    case "OCCUPIED":
      return "Something is already there.";
    case "NO_TARGET":
      return "There's nothing there.";
    case "TARGET_CHANGED":
      return "That spot changed.";
    case "WRONG_STATE":
      return "You can't do that here right now.";
    case "NOT_READY":
      return "It isn't ready yet.";
    case "WITHERED":
      return "That crop has withered.";
    case "NOT_ENOUGH":
      if (error.currency === "coins") return `You need ${error.need.toLocaleString()} coins.`;
      if (error.currency === "fuel") return `You need ${error.need} more fuel ⛽.`;
      if (error.currency === "tokens") return `You need ${error.need} event tokens.`;
      return `You need ${error.need} Golden Clovers.`;
    case "NOT_ENOUGH_ITEMS":
      return `You need ${error.need - error.have} more ${error.id.replace(/_/g, " ")}.`;
    case "LOCKED":
      return `Unlocks at level ${error.level}.`;
    case "FEATURE_LOCKED":
      return `Unlocks at level ${error.level}.`;
    case "UNKNOWN_DEF":
      return "Unknown item.";
    case "NOT_FOR_SALE":
      return "That isn't sold in the market.";
    case "NOT_SELLABLE":
      return "That can't be sold.";
    case "NOT_STORABLE":
      return "That can't go in the Tool Shed.";
    case "NOT_EMPTY":
      return "Empty it first.";
    case "INVENTORY_FULL":
      return "Your Tool Shed is full.";
    case "NONE_OWNED":
      return "You don't have any of those.";
    case "WRONG_HOUSING":
      return "That doesn't live there.";
    case "BUILDING_FULL":
      return "That building is full.";
    case "MAX_TIER":
      return "Already fully upgraded.";
    case "MAX_LAND":
      return "Your farm is as big as it gets.";
    case "NOTHING_TO_DO":
      return "There's nothing to use that on.";
    case "QUEUE_FULL":
      return "Your farmer has enough to do for now.";
    case "DEV_ONLY":
      return "Developer command.";
    case "OUT_OF_SEASON":
      return "That's only available during its seasonal event.";
  }
}
