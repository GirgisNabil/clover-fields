"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  describeError,
  type FarmState,
  getMaterial,
  getNpc,
  HELPS_PER_DAY,
  hearts,
  helpedToday,
  isToday,
  MAX_HEARTS,
  NEIGHBORS,
  neighborState,
} from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { Portrait } from "../quests/Portrait";
import { useNow } from "../useNow";

/** Neighbours with chores left or a gift waiting (for the rail badge). */
export function neighborsWaiting(farm: FarmState, now: number): number {
  return NEIGHBORS.filter((n) => {
    const s = neighborState(farm, n.id);
    const giftReady = hearts(s.friendship) >= 1 && !isToday(s.giftAt, now, farm.meta.dayOffsetMin);
    return giftReady || helpedToday(farm, n.id, now).length < HELPS_PER_DAY;
  }).length;
}

export function Hearts({ friendship }: { friendship: number }) {
  const n = hearts(friendship);
  return (
    <span className="text-sm tracking-tight" title={`${n} of ${MAX_HEARTS} hearts`}>
      {"❤️".repeat(n)}
      <span className="opacity-30">{"🤍".repeat(MAX_HEARTS - n)}</span>
    </span>
  );
}

/** Your five neighbours: visit to help, receive their daily gift, or send them one of your goods. */
export function NeighborsDialog() {
  const open = useUi((s) => s.dialog === "neighbors");
  const openDialog = useUi((s) => s.openDialog);
  const farm = useGame((s) => s.farm);
  const now = useNow(1000);
  const goods = Object.entries(farm.materials).filter(
    ([id, n]) => n > 0 && getMaterial(id)?.mkind === "good",
  );
  const act = (cmd: Parameters<ReturnType<typeof useGame.getState>["dispatch"]>[0], ok: string) => {
    const error = useGame.getState().dispatch(cmd);
    if (error) toast(describeError(error));
    else toast.success(ok);
  };
  const visit = (id: string) => {
    openDialog(null);
    useGame.getState().startVisit(id);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "neighbors" : null)}>
      <DialogContent className="flex max-h-[88dvh] flex-col border-4 border-wood bg-cream sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">🏡 Neighbours</DialogTitle>
          <DialogDescription>
            Help with up to {HELPS_PER_DAY} chores per neighbour each day. Friendship earns hearts,
            and a friend sends you a gift once a day.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {NEIGHBORS.map((n) => {
            const npc = getNpc(n.id);
            const state = neighborState(farm, n.id);
            const helped = helpedToday(farm, n.id, now).length;
            const giftReady =
              hearts(state.friendship) >= 1 && !isToday(state.giftAt, now, farm.meta.dayOffsetMin);
            const gaveToday = isToday(state.giftedAt, now, farm.meta.dayOffsetMin);
            const firstGood = goods[0]?.[0];
            return (
              <li
                key={n.id}
                data-testid={`neighbor-${n.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-2.5"
              >
                <Portrait npc={n.id} size={52} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-display font-semibold text-ink">{npc?.name}</span>
                  <Hearts friendship={state.friendship} />
                  <span className="text-[11px] text-muted-foreground">
                    🤝 {HELPS_PER_DAY - helped} of {HELPS_PER_DAY} chores left today
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => visit(n.id)}
                    className="rounded-full bg-grass px-3 py-1 font-display text-sm font-semibold text-white shadow-press-sm"
                  >
                    Visit
                  </button>
                  {giftReady && (
                    <button
                      type="button"
                      onClick={() =>
                        act(
                          { type: "claimGift", npcId: n.id },
                          `${npc?.icon ?? "🎁"} A gift from ${npc?.name}!`,
                        )
                      }
                      className="rounded-full bg-sun px-3 py-1 font-display text-xs font-semibold text-ink"
                    >
                      🎁 Open gift
                    </button>
                  )}
                  {firstGood && !gaveToday && (
                    <button
                      type="button"
                      title={`Give 1 ${getMaterial(firstGood)?.name} (+3 friendship)`}
                      onClick={() =>
                        act(
                          { type: "giftNeighbor", npcId: n.id, id: firstGood },
                          `You gave ${npc?.name} ${getMaterial(firstGood)?.name}. 💛`,
                        )
                      }
                      className="rounded-full bg-wheat px-3 py-1 text-xs font-semibold text-ink"
                    >
                      Give {getMaterial(firstGood)?.icon}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
