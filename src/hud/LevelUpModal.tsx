"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type DomainEvent, FEATURE_NAMES, getDef, type UnlockRef } from "@/domain";
import { gameBus } from "@/game/store/eventBus";

type LevelUp = Extract<DomainEvent, { t: "levelUp" }>;

function Unlock({ unlock }: { unlock: UnlockRef }) {
  let icon = "✨";
  let label = "";
  if (unlock.kind === "item") {
    const def = getDef(unlock.defId);
    icon = def?.icon ?? "✨";
    label = def?.name ?? unlock.defId;
  } else if (unlock.kind === "feature") {
    icon = "🔓";
    label = FEATURE_NAMES[unlock.feature];
  } else if (unlock.kind === "expansion") {
    icon = "🗺️";
    label = `${unlock.size}×${unlock.size} farm`;
  } else {
    icon = "⬆️";
    label = `${getDef(unlock.defId)?.name ?? unlock.defId} tier ${unlock.tier}`;
  }
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white p-2 text-center">
      <span className="text-3xl leading-none">{icon}</span>
      <span className="text-xs font-semibold text-ink">{label}</span>
    </div>
  );
}

/** Celebrates each level-up in turn, with its rewards and unlocks. */
export function LevelUpModal() {
  const [queue, setQueue] = useState<LevelUp[]>([]);

  useEffect(
    () =>
      gameBus.on((signal) => {
        if (signal.type !== "events") return;
        const ups = signal.events.filter((e): e is LevelUp => e.t === "levelUp");
        if (ups.length) setQueue((q) => [...q, ...ups]);
      }),
    [],
  );

  const current = queue[0];
  const next = () => setQueue((q) => q.slice(1));

  return (
    <Dialog open={current !== undefined} onOpenChange={(open) => !open && next()}>
      {current && (
        <DialogContent className="border-4 border-sun bg-cream text-center sm:max-w-md">
          <div className="mx-auto -mt-2 grid size-24 place-items-center rounded-full bg-gradient-to-b from-[#ffe27a] to-sun font-display text-4xl font-bold text-white shadow-press [text-shadow:0_2px_0_#d9821f]">
            {current.level}
          </div>
          <DialogTitle className="font-display text-3xl text-sun-dark">Level up!</DialogTitle>
          <DialogDescription className="font-display text-lg text-ink">
            You're now a <b>{current.title}</b>
          </DialogDescription>
          <p className="font-display text-lg text-ink">
            +{current.coins.toLocaleString()} 🪙 · +{current.clovers} 🍀
          </p>
          {current.unlocks.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">New in the market:</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {current.unlocks.map((unlock) => (
                  <Unlock key={JSON.stringify(unlock)} unlock={unlock} />
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={next}
            className="mx-auto mt-1 rounded-full bg-grass px-6 py-2 font-display text-lg font-semibold text-white shadow-press"
          >
            {queue.length > 1 ? "Next" : "Hooray!"}
          </button>
        </DialogContent>
      )}
    </Dialog>
  );
}
