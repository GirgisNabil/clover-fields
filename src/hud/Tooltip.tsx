"use client";

import { tileStatus } from "@/domain";
import { describeAnimal, describeStatus } from "@/game/input/describe";
import { useGame, viewFarm } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { useNow } from "./useNow";

/** Follows the mouse and describes the hovered tile (desktop only). */
export function Tooltip() {
  const hover = useUi((s) => s.hover);
  const hoverAnimal = useUi((s) => s.hoverAnimal);
  const pointer = useUi((s) => s.pointer);
  const dialogOpen = useUi((s) => s.dialog !== null);
  const farm = useGame(viewFarm);
  const now = useNow(250);
  if (!hover || !pointer.inside || dialogOpen) return null;
  const size = farm.land.size;
  if (hover.x < 0 || hover.y < 0 || hover.x >= size || hover.y >= size) return null;
  const text = hoverAnimal
    ? describeAnimal(farm, hoverAnimal, now)
    : describeStatus(tileStatus(farm, hover.x, hover.y, now).status, now);
  if (!text) return null;
  return (
    <div
      className="pointer-events-none fixed z-20 max-w-60 rounded-xl border-2 border-wood bg-cream/95 px-3 py-1.5 shadow-press-sm"
      style={{ left: pointer.x + 18, top: pointer.y + 18 }}
    >
      <div className="font-display text-sm font-semibold text-ink">{text.title}</div>
      <div className="text-xs text-muted-foreground">{text.detail}</div>
    </div>
  );
}
