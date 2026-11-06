"use client";

import { RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { describeError, getDef } from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";

const chip =
  "flex items-center gap-1.5 rounded-full bg-wheat px-3 py-1.5 font-display text-sm font-semibold text-ink hover:bg-[#f7ead0]";

/** Controls for the item being placed or moved. */
export function ArrangeBar() {
  const placing = useUi((s) => s.placing);
  const tool = useUi((s) => s.tool);
  if (!placing && tool !== "arrange" && tool !== "sell") return null;

  if (!placing) {
    return (
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border-4 border-wood bg-cream px-3 py-1 font-display text-sm text-ink shadow-press">
        {tool === "arrange"
          ? "✋ Click something on your farm to move it"
          : "💰 Click something to sell it"}
        <button type="button" className={chip} onClick={() => useUi.getState().setTool("hand")}>
          Done
        </button>
      </div>
    );
  }

  const def = getDef(placing.defId);
  const moving =
    typeof placing.source === "object" && "move" in placing.source ? placing.source.move : null;
  const act = (type: "store" | "sell") => {
    if (!moving) return;
    const error = useGame.getState().dispatch({ type, id: moving });
    if (error) toast(describeError(error));
    else {
      useUi.getState().stopPlacing();
      useUi.getState().setTool("arrange");
    }
  };

  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border-4 border-wood bg-cream px-3 py-1 shadow-press">
      <span className="font-display text-sm font-semibold text-ink">
        {def?.icon} {def?.name}
      </span>
      <button
        type="button"
        className={chip}
        onClick={() => useUi.getState().rotatePlacing()}
        title="Rotate (R)"
      >
        <RotateCw className="size-4" /> Rotate
      </button>
      {moving && (
        <>
          <button type="button" className={chip} onClick={() => act("store")}>
            🧰 Store
          </button>
          <button type="button" className={chip} onClick={() => act("sell")}>
            💰 Sell
          </button>
        </>
      )}
      <button
        type="button"
        className={chip}
        onClick={() => useUi.getState().stopPlacing()}
        title="Cancel (Esc)"
      >
        <X className="size-4" /> {placing.source === "market" ? "Done" : "Cancel"}
      </button>
    </div>
  );
}
