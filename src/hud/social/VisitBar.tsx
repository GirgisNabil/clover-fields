"use client";

import { getNpc, HELPS_PER_DAY, helpedToday, neighborState } from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { Portrait } from "../quests/Portrait";
import { useNow } from "../useNow";
import { Hearts } from "./NeighborsDialog";

/** Replaces the toolbar while visiting: whose farm, chores left, and the way home. */
export function VisitBar() {
  const visit = useGame((s) => s.visit);
  const farm = useGame((s) => s.farm);
  const now = useNow(1000);
  if (!visit) return null;
  const npc = getNpc(visit.npcId);
  const left = HELPS_PER_DAY - helpedToday(farm, visit.npcId, now).length;
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center p-3">
      <div
        data-testid="visit-bar"
        className="flex items-center gap-3 rounded-2xl border-4 border-wood bg-cream px-4 py-2 shadow-press"
      >
        <Portrait npc={visit.npcId} size={48} />
        <div className="flex flex-col">
          <span className="font-display font-semibold text-ink">
            Visiting {npc?.name ?? "a neighbour"}
          </span>
          <span className="text-xs text-muted-foreground">
            {left > 0
              ? `🤝 ${left} chore${left === 1 ? "" : "s"} left · click 🤝 crops, trees and ready animals`
              : "All done for today. Thank you!"}
          </span>
          <Hearts friendship={neighborState(farm, visit.npcId).friendship} />
        </div>
        <button
          type="button"
          onClick={() => useGame.getState().endVisit()}
          className="rounded-full bg-grass px-4 py-2 font-display font-semibold text-white shadow-press-sm"
        >
          🏠 Home (H)
        </button>
      </div>
    </div>
  );
}
