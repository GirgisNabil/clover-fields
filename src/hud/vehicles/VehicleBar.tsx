"use client";

import { cn } from "cn";
import { X } from "lucide-react";
import { toast } from "sonner";
import { describeError, fuelAt, getCrop, getVehicle, tankCap } from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { useNow } from "../useNow";

const chip =
  "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-sm font-semibold text-ink";

/** Vehicles tool controls: choose a vehicle, watch fuel, buy more. */
export function VehicleBar() {
  const tool = useUi((s) => s.tool);
  const vehicleId = useUi((s) => s.vehicleId);
  const seedId = useUi((s) => s.seedId);
  const farm = useGame((s) => s.farm);
  const now = useNow(2000);
  if (tool !== "drive") return null;

  const vehicles = Object.values(farm.objects).filter((o) => o.kind === "vehicle");
  const fuel = fuelAt(farm, now);
  const cap = tankCap(farm);
  const selected = vehicleId ? farm.objects[vehicleId] : undefined;
  const op = selected?.kind === "vehicle" ? getVehicle(selected.defId)?.op : undefined;
  const seed = getCrop(seedId);

  const buyFuel = () => {
    const error = useGame.getState().dispatch({ type: "buyItem", defId: "fuel_can", qty: 1 });
    if (error) toast(describeError(error));
  };

  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-2 rounded-3xl border-4 border-wood bg-cream px-3 py-1.5 shadow-press">
      {vehicles.map((v) => {
        const def = v.kind === "vehicle" ? getVehicle(v.defId) : undefined;
        if (!def || v.kind !== "vehicle") return null;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => useUi.setState({ vehicleId: v.id })}
            className={cn(chip, v.id === vehicleId ? "bg-sun" : "bg-wheat hover:bg-[#f7ead0]")}
          >
            {def.icon} {def.name}
            <span className="text-xs opacity-70">
              {def.area[v.tier - 1]}×{def.area[v.tier - 1]}
            </span>
          </button>
        );
      })}
      <span className={cn(chip, "bg-white")} title="Fuel regenerates 1 every 5 minutes">
        ⛽ {fuel} / {cap}
      </span>
      <button type="button" className={cn(chip, "bg-wheat hover:bg-[#f7ead0]")} onClick={buyFuel}>
        + Fuel 🪙250
      </button>
      {(op === "plant" || op === "combine") && (
        <button
          type="button"
          className={cn(chip, "bg-wheat hover:bg-[#f7ead0]")}
          onClick={() => useUi.getState().openDialog("seeds")}
          title="The seed this vehicle plants"
        >
          {seed?.icon} {seed?.name}
        </button>
      )}
      <button
        type="button"
        className={cn(chip, "bg-wheat hover:bg-[#f7ead0]")}
        onClick={() => useUi.getState().setTool("hand")}
      >
        <X className="size-4" /> Done
      </button>
    </div>
  );
}
