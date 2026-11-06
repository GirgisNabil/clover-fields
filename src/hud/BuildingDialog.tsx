"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeError, getBuilding, getProducer, producerStatus } from "@/domain";
import { formatDuration } from "@/game/input/describe";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { CraftPanel } from "./crafting/CraftPanel";
import { PriceTag } from "./market/ItemCard";
import { useNow } from "./useNow";

const HOUSING_HINT: Record<string, string> = {
  poultry: "hens and ducks",
  barnyard: "sheep, goats, cows and pigs",
  stable: "donkeys and horses",
  orchard: "fruit trees",
};

export function BuildingDialog() {
  const open = useUi((s) => s.dialog === "building");
  const id = useUi((s) => s.buildingId);
  const openDialog = useUi((s) => s.openDialog);
  const building = useGame((s) => (id ? s.farm.objects[id] : undefined));
  const level = useGame((s) => s.farm.progress.level);
  const now = useNow(1000);
  if (building?.kind !== "building") return null;
  const def = getBuilding(building.defId);
  if (!def) return null;
  if (def.role.type === "storage") return null;
  const capacity = def.capacity[building.tier - 1] ?? 0;
  const upgrade = building.tier < 3 ? def.upgrades[building.tier - 1] : undefined;
  const role = def.role;
  const ready =
    role.type === "craft"
      ? building.jobs.filter((j) => j.readyAt <= now).length
      : building.occupants.filter((o) => {
          const p = getProducer(o.defId);
          return p && producerStatus(o.cycleStart, p.cycleMs, now).ready;
        }).length;

  const collect = () => {
    const error = useGame.getState().enqueue({
      type: "harvest",
      x: building.x,
      y: building.y,
      expect: building.id,
    });
    if (error) toast(describeError(error));
    openDialog(null);
  };
  const doUpgrade = () => {
    const error = useGame.getState().dispatch({ type: "upgrade", id: building.id });
    if (error) toast(describeError(error));
    else toast.success(`${def.name} upgraded! ⬆️`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "building" : null)}>
      <DialogContent className="border-4 border-wood bg-cream sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {def.icon} {def.name}{" "}
            <span className="text-base text-muted-foreground">tier {building.tier}</span>
          </DialogTitle>
          <DialogDescription>
            {role.type === "craft" ? (
              <>
                Turns bushels into goods. {building.jobs.length} / {capacity} slots busy.
              </>
            ) : (
              <>
                {building.occupants.length} / {capacity} inside. Holds{" "}
                {role.type === "housing" ? HOUSING_HINT[role.accepts] : "items"}. Use Arrange to
                move animals onto it.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {role.type === "craft" ? (
          <CraftPanel building={building} station={role.station} slots={capacity} />
        ) : (
          <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
            {building.occupants.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nobody lives here yet.
              </p>
            )}
            {building.occupants.map((occupant) => {
              const producer = getProducer(occupant.defId);
              if (!producer) return null;
              const status = producerStatus(occupant.cycleStart, producer.cycleMs, now);
              return (
                <div
                  key={occupant.id}
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5"
                >
                  <span className="text-2xl">{producer.icon}</span>
                  <span className="flex-1 text-sm font-semibold text-ink">{producer.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {status.ready
                      ? `${producer.product.icon} ready`
                      : `in ${formatDuration(status.readyAt - now)}`}
                  </span>
                  <button
                    type="button"
                    className="rounded-full bg-wheat px-2 py-0.5 text-xs font-semibold"
                    onClick={() =>
                      useUi.getState().startPlacing({
                        defId: occupant.defId,
                        rot: 0,
                        source: { release: { buildingId: building.id, occupantId: occupant.id } },
                      })
                    }
                  >
                    Let out
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={ready === 0}
            onClick={collect}
            className="rounded-full bg-sun px-4 py-2 font-display font-semibold text-ink shadow-press-sm disabled:opacity-50"
          >
            Collect {ready > 0 ? `(${ready})` : ""}
          </button>
          {upgrade && (
            <button
              type="button"
              disabled={level < upgrade.level}
              onClick={doUpgrade}
              className="rounded-full bg-grass px-4 py-2 font-display font-semibold text-white shadow-press-sm disabled:opacity-50"
            >
              {level < upgrade.level ? (
                `Upgrade at level ${upgrade.level}`
              ) : (
                <>
                  Upgrade to {(def.capacity as readonly number[])[building.tier]}
                  {role.type === "craft" ? " slots" : ""} · <PriceTag price={upgrade.price} />
                </>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
