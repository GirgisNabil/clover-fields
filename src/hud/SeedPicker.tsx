"use client";

import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { activeEvent, CROPS, EVENT_CROPS, FEATURE_LEVEL, PLOW_COST } from "@/domain";
import { clock } from "@/game/clock";
import { formatDuration } from "@/game/input/describe";
import { projectedFarm, useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";

export function SeedPicker() {
  const open = useUi((s) => s.dialog === "seeds");
  const openDialog = useUi((s) => s.openDialog);
  const chooseSeed = useUi((s) => s.chooseSeed);
  const current = useUi((s) => s.seedId);
  const level = useGame((s) => s.farm.progress.level);
  const coins = useGame((s) => projectedFarm(s).wallet.coins);
  const mastery = useGame((s) => s.farm.mastery);

  // The running event's crop leads the list while the event lasts.
  const active = activeEvent(clock.now());
  const eventSeeds =
    active && level >= FEATURE_LEVEL.events
      ? EVENT_CROPS.filter((c) => c.event === active.def.id)
      : [];
  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "seeds" : null)}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-4 border-wood bg-cream sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Seeds</DialogTitle>
          <DialogDescription>
            Pick a crop, then click or drag across plowed soil to plant it. Plowing costs{" "}
            {PLOW_COST} coins.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[...eventSeeds, ...CROPS].map((crop) => {
            const locked = level < crop.unlockLevel;
            const poor = !locked && coins < crop.seedCost;
            const stars = mastery[crop.id as keyof typeof mastery]?.stars ?? 0;
            return (
              <button
                key={crop.id}
                type="button"
                disabled={locked}
                onClick={() => chooseSeed(crop.id)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl border-4 bg-white p-3 text-center transition-transform",
                  current === crop.id
                    ? "border-leaf bg-[#f1fbe9]"
                    : "border-wheat hover:-translate-y-0.5 hover:border-sun",
                  locked && "cursor-not-allowed opacity-55 grayscale",
                )}
              >
                <span className="text-4xl leading-none">{crop.icon}</span>
                <span className="font-display text-sm font-semibold leading-tight text-ink">
                  {crop.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ⏱ {formatDuration(crop.growMs)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Sells 🪙{crop.sale} · +{crop.plantXp}⭐
                </span>
                <span className="text-xs text-sun-dark">
                  {"★".repeat(stars)}
                  {"☆".repeat(3 - stars)}
                </span>
                <span
                  className={cn(
                    "mt-1 rounded-full px-3 py-0.5 font-display text-sm font-semibold",
                    locked
                      ? "bg-wheat text-ink"
                      : poor
                        ? "bg-[#fde2df] text-berry"
                        : "bg-[#fff1cf] text-ink",
                  )}
                >
                  {locked ? `🔒 Level ${crop.unlockLevel}` : `🪙 ${crop.seedCost}`}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
