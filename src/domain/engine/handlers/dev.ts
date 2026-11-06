import { addMaterial } from "../../rules/materials";
import { credit, creditClovers, grantXp } from "../../rules/progression";
import type { DevOp } from "../../types/commands";
import type { PlanContext, Step } from "../step";

/** Developer-only commands. The engine refuses them unless the context says dev mode. */
export function planDev(op: DevOp, ctx: PlanContext): Step {
  if (!ctx.dev) return { code: "DEV_ONLY" };
  switch (op.kind) {
    case "grant":
      return (draft, emit) => {
        if (op.coins) credit(draft, op.coins, emit, "dev");
        if (op.clovers) creditClovers(draft, op.clovers, emit, "dev");
        for (const [id, n] of Object.entries(op.materials ?? {})) addMaterial(draft, id, n, emit);
        if (op.xp) grantXp(draft, op.xp, emit, "dev");
      };
    case "rebaseTime":
      // Shifts every stored timestamp back by deltaMs, undoing a dev time skip.
      return (draft, emit) => {
        const d = op.deltaMs;
        draft.meta.lastNow -= d;
        for (const obj of Object.values(draft.objects)) {
          obj.placedAt -= d;
          if (obj.kind === "plot" && obj.crop) {
            obj.crop.plantedAt -= d;
            if (obj.crop.revivedAt !== null) obj.crop.revivedAt -= d;
            if (obj.crop.manure) obj.crop.manure.at -= d;
          }
          if (obj.kind === "animal" || obj.kind === "tree") obj.cycleStart -= d;
          if (obj.kind === "building") {
            for (const occupant of obj.occupants) occupant.cycleStart -= d;
            for (const job of obj.jobs) {
              job.startedAt -= d;
              job.readyAt -= d;
            }
          }
        }
        // Every other stored timestamp moves too, so no timer jumps after a rebase.
        draft.fuel.anchor -= d;
        draft.animals.settledAt -= d;
        const shift = (t: number | null) => (t === null ? null : t - d);
        draft.daily.lastClaimAt = shift(draft.daily.lastClaimAt);
        draft.daily.taskAt = shift(draft.daily.taskAt);
        for (const quest of Object.values(draft.quests.active)) quest.startedAt -= d;
        for (const id of Object.keys(draft.quests.done)) {
          draft.quests.done[id] = (draft.quests.done[id] ?? 0) - d;
        }
        for (const neighbor of Object.values(draft.neighbors)) {
          neighbor.helpAt = shift(neighbor.helpAt);
          neighbor.giftAt = shift(neighbor.giftAt);
          neighbor.giftedAt = shift(neighbor.giftedAt);
        }
        emit({ t: "timeRebased", deltaMs: d });
      };
  }
}
