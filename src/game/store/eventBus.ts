import type { Command, DomainError, DomainEvent, FieldCommand } from "@/domain";

/** Signals for effects (floating text, sounds, toasts). Kept out of React state on purpose. */
export type GameSignal =
  | { type: "events"; source: "farmer" | "instant"; cmd: Command; events: DomainEvent[] }
  | { type: "rejected"; cmd: FieldCommand; error: DomainError; when: "perform" | "requeue" }
  | { type: "refused"; cmd: Command; error: DomainError }
  | { type: "loaded"; isNew: boolean; ready: number };

type Listener = (signal: GameSignal) => void;

const listeners = new Set<Listener>();

export const gameBus = {
  emit(signal: GameSignal) {
    for (const listener of listeners) listener(signal);
  },
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
