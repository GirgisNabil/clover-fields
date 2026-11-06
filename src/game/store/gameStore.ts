import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  type ApplyContext,
  applyCommand,
  createFarm,
  type DomainError,
  emptyProjection,
  type FarmState,
  type FieldCommand,
  type InstantCommand,
  type Projection,
  performHead,
  projectedState,
  type QueueEntry,
  refold,
  tryExtend,
  visitFarm,
} from "@/domain";
import { clock, DEV_TOOLS } from "../clock";
import { gameBus } from "./eventBus";

export interface GameStore {
  status: "loading" | "ready";
  /** The real farm. Queued work is not in here until the farmer performs it. */
  farm: FarmState;
  queue: QueueEntry[];
  projection: Projection;
  /** Bumped on every committed change; the save with the highest rev wins. */
  rev: number;
  /** While visiting a neighbour, the world draws their farm; `farm` stays yours and keeps saving. */
  visit: { npcId: string; farm: FarmState } | null;
  startVisit(npcId: string): void;
  endVisit(): void;
  /** Re-draws the visited farm after a help (its chores change). */
  refreshVisit(): void;
  hydrate(farm: FarmState, rev: number): void;
  enqueue(cmd: FieldCommand): DomainError | null;
  dispatch(cmd: InstantCommand): DomainError | null;
  performHead(): void;
  cancelQueue(): void;
}

const ctx = (): ApplyContext => ({ now: clock.now(), dev: DEV_TOOLS });

let qidCounter = 0;

export const useGame = create<GameStore>()(
  subscribeWithSelector((set, get) => {
    const placeholder = createFarm({ farmId: "placeholder", seed: 0, salt: 0, now: 0 });
    return {
      status: "loading",
      farm: placeholder,
      queue: [],
      projection: emptyProjection(placeholder),
      rev: 0,
      visit: null,

      startVisit(npcId) {
        set({ visit: { npcId, farm: visitFarm(get().farm, npcId, clock.now()) } });
      },

      endVisit() {
        set({ visit: null });
      },

      refreshVisit() {
        const { visit, farm } = get();
        if (visit)
          set({ visit: { npcId: visit.npcId, farm: visitFarm(farm, visit.npcId, clock.now()) } });
      },

      hydrate(farm, rev) {
        set({ status: "ready", farm, queue: [], projection: emptyProjection(farm), rev });
      },

      enqueue(cmd) {
        const { projection, queue } = get();
        const now = clock.now();
        const result = tryExtend(projection, cmd, { now, dev: DEV_TOOLS });
        if (!result.ok) return result.error;
        qidCounter += 1;
        set({
          queue: [...queue, { qid: `q${qidCounter}`, cmd, enqueuedAt: now }],
          projection: result.p,
        });
        return null;
      },

      dispatch(cmd) {
        const { farm, queue, projection, rev } = get();
        const context = ctx();
        // Validate against the projection so instant purchases can't spend coins queued work needs.
        const check = applyCommand(projectedState(projection), cmd, context);
        if (!check.ok) {
          gameBus.emit({ type: "refused", cmd, error: check.error });
          return check.error;
        }
        const result = applyCommand(farm, cmd, context);
        if (!result.ok) {
          gameBus.emit({ type: "refused", cmd, error: result.error });
          return result.error;
        }
        const folded = refold(result.state, queue, context);
        set({ farm: result.state, queue: folded.kept, projection: folded.p, rev: rev + 1 });
        gameBus.emit({ type: "events", source: "instant", cmd, events: result.events });
        for (const { entry, error } of folded.dropped) {
          gameBus.emit({ type: "rejected", cmd: entry.cmd, error, when: "requeue" });
        }
        return null;
      },

      performHead() {
        const { farm, queue, rev } = get();
        const head = queue[0];
        if (!head) return;
        const result = performHead(farm, queue, ctx());
        set({
          farm: result.farm,
          queue: result.kept,
          projection: result.p,
          rev: result.rejected ? rev : rev + 1,
        });
        if (result.rejected) {
          gameBus.emit({
            type: "rejected",
            cmd: result.rejected.entry.cmd,
            error: result.rejected.error,
            when: "perform",
          });
        } else {
          gameBus.emit({ type: "events", source: "farmer", cmd: head.cmd, events: result.events });
        }
        for (const { entry, error } of result.dropped) {
          gameBus.emit({ type: "rejected", cmd: entry.cmd, error, when: "requeue" });
        }
      },

      cancelQueue() {
        const { farm } = get();
        set({ queue: [], projection: emptyProjection(farm) });
      },
    };
  }),
);

export const projectedFarm = (s: Pick<GameStore, "projection">) => projectedState(s.projection);

/** The farm the world draws: a visited neighbour's, or your own. */
export const viewFarm = (s: Pick<GameStore, "farm" | "visit">): FarmState =>
  s.visit?.farm ?? s.farm;
