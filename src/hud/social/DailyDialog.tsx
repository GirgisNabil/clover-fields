"use client";

import { cn } from "cn";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dailyReward, dailyStatus, dailyTasksView, describeError, getMaterial } from "@/domain";
import { clock } from "@/game/clock";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { useNow } from "../useNow";

function rewardText(day: number, level: number): { icon: string; label: string } {
  const r = dailyReward(day, level);
  if (r.clovers) return { icon: "🍀", label: `${r.clovers} Golden Clover` };
  if (r.fuel) return { icon: "⛽", label: `${r.fuel} fuel` };
  const [id, n] = Object.entries(r.materials ?? {})[0] ?? [];
  if (id)
    return { icon: getMaterial(id)?.icon ?? "🎁", label: `${n} ${getMaterial(id)?.name ?? id}` };
  return { icon: "🪙", label: `${(r.coins ?? 0).toLocaleString()} coins` };
}

/** The daily chest: a 7-day streak calendar, today's claim, and the three daily tasks. */
export function DailyDialog() {
  const open = useUi((s) => s.dialog === "daily");
  const openDialog = useUi((s) => s.openDialog);
  const farm = useGame((s) => s.farm);
  const now = useNow(1000);
  const status = dailyStatus(farm, now);
  const tasks = dailyTasksView(farm);
  const claim = () => {
    const error = useGame.getState().dispatch({ type: "claimDaily" });
    if (error) toast(describeError(error));
  };
  // Claimed days in this cycle: today included once claimed.
  const claimedInCycle = status.claimedToday ? status.cycleDay + 1 : status.cycleDay;
  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "daily" : null)}>
      <DialogContent className="border-4 border-wood bg-cream sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">🎁 Daily Bonus</DialogTitle>
          <DialogDescription>
            Come back every day: each day in a row is worth more. Missing a day starts the week
            over.
            {farm.daily.best > 1 ? ` Best streak: ${farm.daily.best} days.` : ""}
          </DialogDescription>
        </DialogHeader>
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7" data-testid="daily-calendar">
          {Array.from({ length: 7 }, (_, day) => {
            const { icon, label } = rewardText(day, farm.progress.level);
            const claimed = day < claimedInCycle;
            const today = day === status.cycleDay && !status.claimedToday;
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: the seven days are fixed
                key={day}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl p-2 text-center",
                  today ? "bg-sun ring-4 ring-sun/40" : claimed ? "bg-leaf/20" : "bg-white",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    today ? "text-ink" : "text-muted-foreground",
                  )}
                >
                  Day {day + 1}
                </span>
                <span className="text-2xl">{claimed ? "✅" : icon}</span>
                <span className="text-[10px] leading-tight text-ink">{label}</span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          disabled={status.claimedToday}
          onClick={claim}
          className="self-center rounded-full bg-grass px-6 py-2 font-display text-lg font-semibold text-white shadow-press-sm disabled:bg-wheat disabled:text-muted-foreground disabled:shadow-none"
        >
          {status.claimedToday ? "Come back tomorrow!" : `Claim day ${status.cycleDay + 1}`}
        </button>
        {tasks.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="font-display font-semibold text-ink">Today's tasks</h3>
            {tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-1 rounded-xl bg-white px-3 py-2">
                <span className="flex justify-between text-sm text-ink">
                  <span>
                    {task.done ? "✅" : "▫️"} {task.label}
                  </span>
                  <span className="text-xs text-muted-foreground">🪙 {task.coins}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-wheat">
                  <span
                    className="block h-full rounded-full bg-leaf"
                    style={{ width: `${(task.have / task.need) * 100}%` }}
                  />
                </span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Finish all three for a bonus: 🪙 300 · ⭐ 40 · 🍀 1. New tasks every day.
            </p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** True when today's bonus hasn't been claimed yet. */
export const dailyReady = (farm: ReturnType<typeof useGame.getState>["farm"]) =>
  !dailyStatus(farm, clock.now()).claimedToday;
