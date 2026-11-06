// Shared helpers for domain tests.
import { applyCommand } from "./engine/apply";
import { createFarm } from "./setup/createFarm";
import type { Command } from "./types/commands";
import type { DomainEvent } from "./types/events";
import type { Ms } from "./types/ids";
import type { AnimalObject, FarmState } from "./types/state";

export const T0: Ms = Date.UTC(2026, 10, 5, 12, 0, 0);

export function freshFarm(now: Ms = T0, overrides: Partial<FarmState> = {}): FarmState {
  return { ...createFarm({ farmId: "test-farm", seed: 1234, salt: 42, now }), ...overrides };
}

/** A farm with nothing on it, for focused tests. */
export function emptyFarm(now: Ms = T0, coins = 10_000): FarmState {
  const farm = freshFarm(now);
  return { ...farm, objects: {}, wallet: { coins, clovers: 10 }, inventory: { items: {} } };
}

/** Applies a command and fails the test if it is rejected. */
export function must(
  state: FarmState,
  cmd: Command,
  now: Ms,
): { state: FarmState; events: DomainEvent[] } {
  const result = applyCommand(state, cmd, { now, dev: true });
  if (!result.ok) throw new Error(`${cmd.type} rejected: ${JSON.stringify(result.error)}`);
  return result;
}

export function withLevel(state: FarmState, level: number, xp?: number): FarmState {
  return { ...state, progress: { level, xp: xp ?? 0 } };
}

/** The free animal whose home anchor is (x, y): animals roam, so `objectAt` never finds them. */
export function animalAt(state: FarmState, x: number, y: number): AnimalObject | null {
  for (const obj of Object.values(state.objects)) {
    if (obj.kind === "animal" && obj.x === x && obj.y === y) return obj;
  }
  return null;
}
