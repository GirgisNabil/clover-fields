"use client";

import { cn } from "cn";
import { Coins, Hand, Move, ShoppingBasket, Shovel, Tractor, Warehouse, X } from "lucide-react";
import type { ReactNode } from "react";
import { FEATURE_LEVEL, getCrop } from "@/domain";
import { openVehicles } from "@/game/input/vehicles";
import { useGame } from "@/game/store/gameStore";
import { type Tool, useUi } from "@/game/store/uiStore";
import { ArrangeBar } from "./ArrangeBar";
import { VehicleBar } from "./vehicles/VehicleBar";

function ToolButton({
  active,
  label,
  hotkey,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  hotkey: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${hotkey})`}
      data-coach={`tool-${label.toLowerCase()}`}
      aria-pressed={active}
      className={cn(
        "flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl font-display text-xs font-semibold shadow-[inset_0_-4px_0_rgb(0_0_0/0.12)] transition-transform active:translate-y-0.5 sm:size-[4.5rem]",
        active
          ? "bg-sun text-ink shadow-[inset_0_-4px_0_#d9821f]"
          : "bg-wheat text-ink hover:bg-[#f7ead0]",
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export function Toolbar() {
  const tool = useUi((s) => s.tool);
  const seedId = useUi((s) => s.seedId);
  const setTool = useUi((s) => s.setTool);
  const openDialog = useUi((s) => s.openDialog);
  const openMarket = useUi((s) => s.openMarket);
  const placing = useUi((s) => s.placing !== null);
  const vehiclesUnlocked = useGame((s) => s.farm.progress.level >= FEATURE_LEVEL.vehicles);
  const queued = useGame((s) => s.queue.length);
  const cancelQueue = useGame((s) => s.cancelQueue);
  const visiting = useGame((s) => s.visit !== null);
  const seed = getCrop(seedId);
  const choose = (next: Tool) => () => setTool(next);
  if (visiting) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3">
      <ArrangeBar />
      <VehicleBar />
      {queued > 0 && (
        <button
          type="button"
          onClick={cancelQueue}
          className="pointer-events-auto flex items-center gap-2 rounded-full border-4 border-wood bg-cream py-1 pr-2 pl-3 font-display text-sm font-semibold text-ink shadow-press"
          title="Stop the farmer and cancel queued jobs (Esc)"
        >
          🧑‍🌾 {queued} {queued === 1 ? "job" : "jobs"} queued
          <span className="grid size-6 place-items-center rounded-full bg-berry text-white">
            <X className="size-4" />
          </span>
        </button>
      )}
      <nav className="pointer-events-auto flex flex-wrap justify-center gap-1.5 rounded-2xl sm:gap-2 border-4 border-wood bg-cream p-2 shadow-press">
        <ToolButton active={tool === "hand"} label="Farm" hotkey="1" onClick={choose("hand")}>
          <Hand className="size-6" />
        </ToolButton>
        <ToolButton active={tool === "plow"} label="Plow" hotkey="2" onClick={choose("plow")}>
          <Shovel className="size-6" />
        </ToolButton>
        <ToolButton
          active={tool === "seed"}
          label="Seeds"
          hotkey="3"
          onClick={() => openDialog("seeds")}
        >
          <span className="text-2xl leading-none">{seed?.icon ?? "🌱"}</span>
        </ToolButton>
        <ToolButton active={placing} label="Market" hotkey="4" onClick={() => openMarket()}>
          <ShoppingBasket className="size-6" />
        </ToolButton>
        {vehiclesUnlocked && (
          <ToolButton active={tool === "drive"} label="Vehicles" hotkey="V" onClick={openVehicles}>
            <Tractor className="size-6" />
          </ToolButton>
        )}
        <ToolButton
          active={tool === "arrange"}
          label="Arrange"
          hotkey="5"
          onClick={choose("arrange")}
        >
          <Move className="size-6" />
        </ToolButton>
        <ToolButton active={tool === "sell"} label="Sell" hotkey="6" onClick={choose("sell")}>
          <Coins className="size-6" />
        </ToolButton>
        <ToolButton active={false} label="Shed" hotkey="7" onClick={() => openDialog("storage")}>
          <Warehouse className="size-6" />
        </ToolButton>
      </nav>
    </div>
  );
}
