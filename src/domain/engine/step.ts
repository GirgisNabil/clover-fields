import type { DomainError } from "../types/errors";
import type { Emit } from "../types/events";
import type { Ms, ObjectId, Tile } from "../types/ids";
import type { FarmState } from "../types/state";

/** A validated command, ready to mutate an immer draft. */
export type Effect = (draft: FarmState, emit: Emit) => void;

/** Planning a command yields either an error or the effect to apply. */
export type Step = DomainError | Effect;

export interface PlanContext {
  now: Ms;
  dev: boolean;
}

export const isEffect = (step: Step): step is Effect => typeof step === "function";

export function newObjectId(draft: FarmState): ObjectId {
  const id: ObjectId = `o${draft.meta.nextId}`;
  draft.meta.nextId += 1;
  return id;
}

export const tile = (x: number, y: number): Tile => ({ x, y });

export function notEnoughCoins(state: FarmState, need: number): DomainError | null {
  return state.wallet.coins < need
    ? { code: "NOT_ENOUGH", currency: "coins", need, have: state.wallet.coins }
    : null;
}

export function notEnoughClovers(state: FarmState, need: number): DomainError | null {
  return state.wallet.clovers < need
    ? { code: "NOT_ENOUGH", currency: "clovers", need, have: state.wallet.clovers }
    : null;
}
