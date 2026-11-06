"use client";

import { cn } from "cn";
import { useState } from "react";
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
  getBuilding,
  getConsumable,
  getDef,
  getMaterial,
  getPlaceable,
  inventoryCapacity,
  inventoryUsed,
} from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { ItemCard, PriceTag } from "./market/ItemCard";

type BagTab = "shed" | "good" | "bushel" | "supply";

const TABS: { id: BagTab; label: string }[] = [
  { id: "shed", label: "🧰 Shed" },
  { id: "good", label: "🥧 Goods" },
  { id: "bushel", label: "🧺 Bushels" },
  { id: "supply", label: "⚙️ Supplies" },
];

const EMPTY: Record<Exclude<BagTab, "shed">, string> = {
  good: "No goods yet. Craft them in a Mill, Bakery or Press.",
  bushel: "No bushels yet. Harvested crops sometimes drop one (from level 15).",
  supply: "No supplies yet.",
};

/** Bushels, goods and supplies: sell them, or burn fuel goods. */
function MaterialList({ kind }: { kind: Exclude<BagTab, "shed"> }) {
  const materials = useGame((s) => s.farm.materials);
  const rows = Object.entries(materials)
    .map(([id, n]) => ({ def: getMaterial(id), n }))
    .filter((r) => r.def?.mkind === kind && r.n > 0);
  const act = (
    cmd: Parameters<ReturnType<typeof useGame.getState>["dispatch"]>[0],
    done: string,
  ) => {
    const error = useGame.getState().dispatch(cmd);
    if (error) toast(describeError(error));
    else toast.success(done);
  };
  if (rows.length === 0) {
    return <p className="p-8 text-center font-display text-muted-foreground">{EMPTY[kind]}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {rows.map(({ def, n }) =>
        def ? (
          <ItemCard
            key={def.id}
            icon={def.icon}
            name={def.name}
            lines={[`× ${n} of ${def.cap}`, def.sale ? `sells 🪙${def.sale}` : "not for sale"]}
            price={null}
            footer={
              <span className="mt-auto flex gap-1.5" data-testid={`bag-${def.id}`}>
                {def.id === "fertilizer_sack" ? (
                  <button
                    type="button"
                    className="rounded-full bg-sky px-3 py-0.5 font-display text-sm font-semibold text-ink"
                    onClick={() => {
                      useUi.getState().setTool("fertilize");
                      useUi.getState().openDialog(null);
                      toast("🌿 Click a field to fertilize a 3×3 patch", {
                        description: "Growing crops ripen sooner and pay +15%. Esc to stop.",
                      });
                    }}
                  >
                    Use
                  </button>
                ) : null}
                {def.fuel ? (
                  <button
                    type="button"
                    className="rounded-full bg-sky px-3 py-0.5 font-display text-sm font-semibold text-ink"
                    onClick={() => act({ type: "useMaterial", id: def.id }, `⛽ +${def.fuel} fuel`)}
                  >
                    Use
                  </button>
                ) : null}
                {def.sale ? (
                  <button
                    type="button"
                    className="rounded-full bg-[#fff1cf] px-3 py-0.5 font-display text-sm font-semibold text-ink"
                    onClick={() =>
                      act(
                        { type: "sellMaterial", id: def.id, qty: 1 },
                        `Sold ${def.icon} for 🪙${def.sale}`,
                      )
                    }
                  >
                    Sell
                  </button>
                ) : null}
              </span>
            }
          />
        ) : null,
      )}
    </div>
  );
}

export function StorageDialog() {
  const open = useUi((s) => s.dialog === "storage");
  const [tab, setTab] = useState<BagTab>("shed");
  const openDialog = useUi((s) => s.openDialog);
  const farm = useGame((s) => s.farm);
  const items = Object.entries(farm.inventory.items).filter(([, n]) => n > 0);
  const shed = Object.values(farm.objects).find(
    (o) => o.kind === "building" && o.defId === "tool_shed",
  );
  const shedDef = getBuilding("tool_shed");
  const tier = shed?.kind === "building" ? shed.tier : 1;
  const upgrade = tier < 3 ? shedDef?.upgrades[tier - 1] : undefined;

  const use = (defId: string) => {
    const consumable = getConsumable(defId);
    if (consumable) {
      const error = useGame.getState().dispatch({ type: "useItem", defId });
      if (error) toast(describeError(error));
      else toast.success(`${consumable.icon} ${consumable.name} used!`);
      return;
    }
    if (getPlaceable(defId)) useUi.getState().startPlacing({ defId, rot: 0, source: "storage" });
  };

  const upgradeShed = () => {
    if (!shed) return;
    const error = useGame.getState().dispatch({ type: "upgrade", id: shed.id });
    if (error) toast(describeError(error));
    else toast.success("Tool Shed upgraded! 🧰");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "storage" : null)}>
      <DialogContent className="flex max-h-[85dvh] flex-col border-4 border-wood bg-cream sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {tab === "shed" ? "🧰 Tool Shed" : "🎒 Bag"}
          </DialogTitle>
          <DialogDescription>
            {tab === "shed"
              ? `${inventoryUsed(farm)} / ${inventoryCapacity(farm)} spaces used. Click an item to place or use it.`
              : "Crafting materials. They don't take shed space; each kind holds up to its cap."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-xl px-3 py-1.5 font-display text-sm font-semibold",
                tab === t.id
                  ? "bg-sun text-ink shadow-[inset_0_-3px_0_#d9821f]"
                  : "bg-wheat text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab !== "shed" ? (
            <MaterialList kind={tab} />
          ) : items.length === 0 ? (
            <p className="p-8 text-center font-display text-muted-foreground">
              Your shed is empty. Use Arrange to put things away.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map(([defId, count]) => {
                const def = getDef(defId);
                return (
                  <ItemCard
                    key={defId}
                    icon={def?.icon ?? "📦"}
                    name={def?.name ?? defId}
                    lines={[`× ${count}`]}
                    price={null}
                    footer={
                      <span className="mt-auto rounded-full bg-[#fff1cf] px-3 py-0.5 font-display text-sm font-semibold text-ink">
                        {getConsumable(defId) ? "Use" : "Place"}
                      </span>
                    }
                    onClick={() => use(defId)}
                  />
                );
              })}
            </div>
          )}
        </div>
        {tab === "shed" && upgrade && (
          <button
            type="button"
            onClick={upgradeShed}
            className="self-center rounded-full bg-grass px-4 py-2 font-display font-semibold text-white shadow-press-sm disabled:opacity-60"
            disabled={farm.progress.level < upgrade.level}
          >
            {farm.progress.level < upgrade.level ? (
              `Bigger shed at level ${upgrade.level}`
            ) : (
              <>
                Upgrade to hold{" "}
                {(shedDef?.capacity as readonly number[] | undefined)?.[tier] ?? "more"} ·{" "}
                <PriceTag price={upgrade.price} />
              </>
            )}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
