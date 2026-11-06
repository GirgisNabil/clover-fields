import { MAX_QUEUE } from "../constants";
import { type ApplyContext, applyCommand } from "../engine/apply";
import type { FieldCommand } from "../types/commands";
import type { DomainError } from "../types/errors";
import type { DomainEvent } from "../types/events";
import type { Ms } from "../types/ids";
import type { FarmState } from "../types/state";

/** A field command waiting for the farmer. Nothing in the queue has touched the real farm. */
export interface QueueEntry {
  qid: string;
  cmd: FieldCommand;
  enqueuedAt: Ms;
}

/** steps[i] is the farm after entries[0..i]; the last step is what the HUD shows. */
export interface Projection {
  base: FarmState;
  steps: FarmState[];
}

export interface Dropped {
  entry: QueueEntry;
  error: DomainError;
}

export const emptyProjection = (base: FarmState): Projection => ({ base, steps: [] });

export const projectedState = (p: Projection): FarmState => p.steps.at(-1) ?? p.base;

/** Validates a command against everything already queued and appends its step. */
export function tryExtend(
  p: Projection,
  cmd: FieldCommand,
  ctx: ApplyContext,
): { ok: true; p: Projection } | { ok: false; error: DomainError } {
  if (p.steps.length >= MAX_QUEUE) return { ok: false, error: { code: "QUEUE_FULL" } };
  const result = applyCommand(projectedState(p), cmd, ctx);
  if (!result.ok) return result;
  return { ok: true, p: { base: p.base, steps: [...p.steps, result.state] } };
}

/** Rebuilds the projection on a new real farm, dropping entries that no longer work. */
export function refold(
  base: FarmState,
  entries: readonly QueueEntry[],
  ctx: ApplyContext,
): { p: Projection; kept: QueueEntry[]; dropped: Dropped[] } {
  const steps: FarmState[] = [];
  const kept: QueueEntry[] = [];
  const dropped: Dropped[] = [];
  let current = base;
  for (const entry of entries) {
    const result = applyCommand(current, entry.cmd, ctx);
    if (result.ok) {
      current = result.state;
      steps.push(current);
      kept.push(entry);
    } else {
      dropped.push({ entry, error: result.error });
    }
  }
  return { p: { base, steps }, kept, dropped };
}

/** Applies the head of the queue to the real farm (the farmer just did it), then re-folds the rest. */
export function performHead(
  farm: FarmState,
  entries: readonly QueueEntry[],
  ctx: ApplyContext,
): {
  farm: FarmState;
  events: DomainEvent[];
  rejected: Dropped | null;
  p: Projection;
  kept: QueueEntry[];
  dropped: Dropped[];
} {
  const [head, ...rest] = entries;
  if (!head) return { farm, events: [], rejected: null, ...refold(farm, [], ctx) };
  const result = applyCommand(farm, head.cmd, ctx);
  const next = result.ok ? result.state : farm;
  return {
    farm: next,
    events: result.ok ? result.events : [],
    rejected: result.ok ? null : { entry: head, error: result.error },
    ...refold(next, rest, ctx),
  };
}
