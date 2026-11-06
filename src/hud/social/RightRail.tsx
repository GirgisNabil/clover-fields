"use client";

import { activeEvent, FEATURE_LEVEL, tokensNow } from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { useNow } from "../useNow";
import { dailyReady } from "./DailyDialog";
import { neighborsWaiting } from "./NeighborsDialog";

function RailButton({
  icon,
  label,
  badge,
  onClick,
  testId,
}: {
  icon: string;
  label: string;
  badge: number | boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      title={label}
      data-testid={testId}
      onClick={onClick}
      className="pointer-events-auto relative grid size-14 place-items-center rounded-2xl border-4 border-wood bg-cream text-2xl shadow-press transition-transform hover:scale-105"
    >
      {icon}
      {badge ? (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-berry px-1 text-[11px] font-bold text-white">
          {badge === true ? "!" : badge}
        </span>
      ) : null}
    </button>
  );
}

/** Daily chest and neighbours, down the right edge once they unlock. */
export function RightRail() {
  const farm = useGame((s) => s.farm);
  const visiting = useGame((s) => s.visit !== null);
  const now = useNow(5000);
  if (visiting) return null;
  const level = farm.progress.level;
  const active = activeEvent(now);
  return (
    <div className="absolute top-24 right-3 flex flex-col gap-2">
      {active && level >= FEATURE_LEVEL.events && (
        <RailButton
          icon={active.def.icon}
          label={`${active.def.name} (${tokensNow(farm, now)} ${active.def.token.name})`}
          testId="rail-event"
          badge={tokensNow(farm, now)}
          onClick={() => useUi.getState().openDialog("event")}
        />
      )}
      {level >= FEATURE_LEVEL.daily && (
        <RailButton
          icon="🎁"
          label="Daily bonus"
          testId="rail-daily"
          badge={dailyReady(farm)}
          onClick={() => useUi.getState().openDialog("daily")}
        />
      )}
      {level >= FEATURE_LEVEL.neighbors && (
        <RailButton
          icon="🏡"
          label="Neighbours"
          testId="rail-neighbors"
          badge={neighborsWaiting(farm, now)}
          onClick={() => useUi.getState().openDialog("neighbors")}
        />
      )}
    </div>
  );
}
