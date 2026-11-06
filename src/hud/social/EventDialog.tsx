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
  activeEvent,
  describeError,
  EVENT_CROPS,
  getDef,
  nextEvent,
  TOKEN_COIN_VALUE,
  tokensNow,
} from "@/domain";
import { formatDuration } from "@/game/input/describe";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { useNow } from "../useNow";

/** The running seasonal event: time left, how to earn tokens, its crop and its shop. */
export function EventDialog() {
  const open = useUi((s) => s.dialog === "event");
  const openDialog = useUi((s) => s.openDialog);
  const farm = useGame((s) => s.farm);
  const now = useNow(1000);
  const active = activeEvent(now);
  if (!active) {
    const next = nextEvent(now);
    return (
      <Dialog open={open} onOpenChange={(v) => openDialog(v ? "event" : null)}>
        <DialogContent className="border-4 border-wood bg-cream sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{next.def.icon} Coming soon</DialogTitle>
            <DialogDescription>
              {next.def.name} starts in {formatDuration(next.start - now)}.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }
  const { def } = active;
  const tokens = tokensNow(farm, now);
  const crop = EVENT_CROPS.find((c) => c.id === def.crop);
  const buy = (defId: string) => {
    const error = useGame.getState().dispatch({ type: "buyEventItem", eventId: def.id, defId });
    if (error) toast(describeError(error));
    else
      toast.success(`${getDef(defId)?.icon ?? "🎁"} ${getDef(defId)?.name} is in your Tool Shed!`);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => openDialog(v ? "event" : null)}>
      <DialogContent className="flex max-h-[88dvh] flex-col border-4 border-sun bg-cream sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {def.icon} {def.name}
          </DialogTitle>
          <DialogDescription>
            {def.blurb} Ends in {formatDuration(active.end - now)}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
          <div className="flex flex-col">
            <span
              className="font-display text-2xl font-semibold text-ink"
              data-testid="event-tokens"
            >
              {def.token.icon} {tokens.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{def.token.name}</span>
          </div>
          <p className="max-w-60 text-right text-xs text-muted-foreground">
            Every harvest and collection earns tokens; {crop?.name ?? "the event crop"} earn triple.
            Leftovers become {TOKEN_COIN_VALUE} coins each when the event ends.
          </p>
        </div>
        {crop && (
          <div className="flex items-center gap-3 rounded-2xl bg-[#fff6e0] px-4 py-2 text-sm text-ink">
            <span className="text-3xl">{crop.icon}</span>
            <span className="flex-1">
              <b>{crop.name}</b> are in the Seeds menu for the event only. 🪙 {crop.seedCost} seeds,
              sells for 🪙 {crop.sale}.
            </span>
          </div>
        )}
        <div className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
          {def.shop.map((item) => {
            const d = getDef(item.defId);
            const afford = tokens >= item.tokens;
            return (
              <div
                key={item.defId}
                data-testid={`event-item-${item.defId}`}
                className="flex flex-col items-center gap-1 rounded-2xl bg-white p-3 text-center"
              >
                <span className="text-4xl">{d?.icon ?? "🎁"}</span>
                <span className="font-display text-sm font-semibold text-ink">{d?.name}</span>
                <button
                  type="button"
                  disabled={!afford}
                  onClick={() => buy(item.defId)}
                  className="mt-auto rounded-full bg-sun px-3 py-1 font-display text-sm font-semibold text-ink disabled:bg-wheat disabled:text-muted-foreground"
                >
                  {def.token.icon} {item.tokens}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
