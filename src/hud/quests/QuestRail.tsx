"use client";

import { cn } from "cn";
import { useMemo } from "react";
import { getNpc, questsView } from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { Portrait } from "./Portrait";

/** Running quests down the left edge: a portrait per line with a progress ring and a "!" when ready. */
export function QuestRail() {
  const farm = useGame((s) => s.farm);
  const quests = useMemo(
    () =>
      questsView(farm).map((q) => ({
        lineId: q.lineId,
        npc: q.npc,
        title: q.title,
        progress: q.progress,
        ready: q.complete && !q.auto,
      })),
    [farm],
  );
  const visiting = useGame((s) => s.visit !== null);
  if (quests.length === 0 || visiting) return null;
  return (
    <nav
      aria-label="Quests"
      data-coach="quest-rail"
      className="pointer-events-auto absolute top-24 left-3 flex flex-col gap-2"
    >
      {quests.map((q) => (
        <button
          key={q.lineId}
          type="button"
          data-testid={`rail-${q.lineId}`}
          title={`${getNpc(q.npc)?.name ?? ""}: ${q.title}`}
          onClick={() => useUi.setState({ questNpc: q.npc, dialog: "quest" })}
          className={cn(
            "relative rounded-full shadow-press transition-transform hover:scale-105",
            q.ready && "animate-bounce",
          )}
        >
          <Portrait npc={q.npc} size={52} progress={Math.max(0.04, q.progress)} />
          {q.ready && (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-berry text-xs font-bold text-white">
              !
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
