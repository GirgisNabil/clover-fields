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
import {
  type AnyDef,
  defsByTab,
  describeError,
  EXPANSIONS,
  type MarketTab,
  type Price,
  priceClovers,
  priceCoins,
  tabUnlockLevel,
} from "@/domain";
import { formatDuration } from "@/game/input/describe";
import { projectedFarm, useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { ItemCard, PriceTag } from "./ItemCard";

const TABS: Array<{ id: MarketTab; label: string }> = [
  { id: "seeds", label: "🌱 Seeds" },
  { id: "trees", label: "🌳 Trees" },
  { id: "animals", label: "🐄 Animals" },
  { id: "buildings", label: "🏠 Buildings" },
  { id: "decorations", label: "🌷 Decor" },
  { id: "specials", label: "✨ Specials" },
  { id: "vehicles", label: "🚜 Vehicles" },
  { id: "expansions", label: "🗺️ Land" },
];

function detailLines(def: AnyDef): string[] {
  switch (def.kind) {
    case "crop":
      return [`⏱ ${formatDuration(def.growMs)}`, `Sells 🪙${def.sale} · +${def.plantXp}⭐`];
    case "animal":
    case "tree":
      return [
        `${def.product.icon} every ${formatDuration(def.cycleMs)}`,
        `🪙${def.payout} each · +${def.xpOnBuy}⭐`,
      ];
    case "building":
      return [
        def.role.type === "housing" ? `Holds ${def.capacity[0]} animals or trees` : "Storage",
        `${def.footprint[0]}×${def.footprint[1]} · +${def.xpOnBuy}⭐`,
      ];
    case "decoration":
      return [`${def.footprint[0]}×${def.footprint[1]} · +${def.xpOnBuy}⭐`];
    case "consumable":
      return [
        def.effect.type === "unwither"
          ? "Revives every withered crop"
          : def.effect.type === "coins"
            ? `+${def.effect.amount.toLocaleString()} coins`
            : def.effect.type === "material"
              ? "Manures a 3×3 patch of growing crops"
              : `+${def.effect.units} fuel`,
      ];
    case "vehicle":
      return [
        `Works ${def.area[0]}×${def.area[0]} tiles per trip`,
        `⛽ ${def.fuelPerTile} per tile · +${def.xpOnBuy}⭐`,
      ];
    case "material":
      return def.sale ? [`Sells 🪙${def.sale}`] : [];
  }
}

const priceOf = (def: AnyDef): Price | null =>
  def.kind === "crop" ? { coins: def.seedCost } : def.kind === "material" ? null : def.price;

export function MarketDialog() {
  const open = useUi((s) => s.dialog === "market");
  const tab = useUi((s) => s.marketTab);
  const openDialog = useUi((s) => s.openDialog);
  const level = useGame((s) => s.farm.progress.level);
  const wallet = useGame((s) => projectedFarm(s).wallet);
  const land = useGame((s) => s.farm.land);
  const tabLocked = level < tabUnlockLevel(tab);

  const choose = (def: AnyDef) => {
    const ui = useUi.getState();
    if (def.kind === "crop") return ui.chooseSeed(def.id);
    if (def.kind === "consumable") {
      const error = useGame.getState().dispatch({ type: "buyItem", defId: def.id, qty: 1 });
      if (error) toast(describeError(error));
      else toast.success(`Bought ${def.icon} ${def.name}`);
      return;
    }
    ui.startPlacing({ defId: def.id, rot: 0, source: "market" });
  };

  const afford = (price: Price | null) =>
    wallet.coins >= priceCoins(price) && wallet.clovers >= priceClovers(price);

  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "market" : null)}>
      <DialogContent className="flex max-h-[88dvh] flex-col border-4 border-wood bg-cream sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Market</DialogTitle>
          <DialogDescription>
            Buy something, then click a spot on your farm to place it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const lockedAt = tabUnlockLevel(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => useUi.setState({ marketTab: t.id })}
                className={cn(
                  "rounded-xl px-3 py-1.5 font-display text-sm font-semibold",
                  tab === t.id
                    ? "bg-sun text-ink shadow-[inset_0_-3px_0_#d9821f]"
                    : "bg-wheat text-ink",
                )}
              >
                {t.label}
                {level < lockedAt ? ` 🔒${lockedAt}` : ""}
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tabLocked ? (
            <p className="p-8 text-center font-display text-lg text-muted-foreground">
              🔒 This part of the market opens at level {tabUnlockLevel(tab)}.
            </p>
          ) : tab === "expansions" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {EXPANSIONS.slice(1).map((expansion) => {
                const owned = land.size >= expansion.size;
                const next = expansion.index === land.expansionIndex + 1;
                const locked = !owned && level < expansion.level;
                const buy = (pay: "coins" | "clovers") => {
                  const error = useGame.getState().dispatch({ type: "expand", pay });
                  if (error) toast(describeError(error));
                  else toast.success(`Your farm is now ${expansion.size}×${expansion.size}! 🎉`);
                };
                return (
                  <ItemCard
                    key={expansion.size}
                    icon="🗺️"
                    name={`${expansion.size}×${expansion.size} farm`}
                    lines={[`${expansion.size * expansion.size} tiles of land`]}
                    price={expansion.price}
                    lockedAt={locked ? expansion.level : undefined}
                    footer={
                      owned ? (
                        <span className="mt-auto font-display text-sm font-semibold text-leaf-dark">
                          ✅ Owned
                        </span>
                      ) : locked ? undefined : next ? (
                        <span className="mt-auto flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => buy("coins")}
                            className={cn(
                              "rounded-full px-3 py-0.5 font-display text-sm font-semibold",
                              afford(expansion.price)
                                ? "bg-[#fff1cf] text-ink"
                                : "bg-[#fde2df] text-berry",
                            )}
                          >
                            <PriceTag price={expansion.price} />
                          </button>
                          <button
                            type="button"
                            onClick={() => buy("clovers")}
                            className={cn(
                              "rounded-full px-3 py-0.5 font-display text-sm font-semibold",
                              afford(expansion.alt)
                                ? "bg-[#fff1cf] text-ink"
                                : "bg-[#fde2df] text-berry",
                            )}
                          >
                            or <PriceTag price={expansion.alt} />
                          </button>
                        </span>
                      ) : (
                        <span className="mt-auto text-xs text-muted-foreground">
                          Buy the smaller size first
                        </span>
                      )
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {defsByTab(tab).map((def) => {
                const price = priceOf(def);
                return (
                  <ItemCard
                    key={def.id}
                    icon={def.icon}
                    name={def.name}
                    lines={detailLines(def)}
                    price={price}
                    lockedAt={level < def.unlockLevel ? def.unlockLevel : undefined}
                    poor={!afford(price)}
                    onClick={() => choose(def)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
