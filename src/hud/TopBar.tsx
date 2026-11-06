"use client";

import { BookOpen, Settings } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { displayWallet, FEATURE_LEVEL, fuelAt, levelProgress, setsReady } from "@/domain";
import { projectedFarm, useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { AnimatedNumber } from "./AnimatedNumber";
import { useNow } from "./useNow";

const panel =
  "pointer-events-auto flex items-center gap-2 rounded-2xl border-4 border-wood bg-cream px-3 py-1.5 shadow-press";

export function TopBar() {
  const farm = useGame((s) => s.farm);
  const projected = useGame(projectedFarm);
  const level = levelProgress(farm);
  const wallet = displayWallet(farm, projected);

  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div className={panel}>
        <div
          data-anchor="xp"
          className="relative grid size-12 shrink-0 place-items-center font-display text-lg font-bold text-ink"
          title={`Level ${level.level}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="absolute inset-0 size-full drop-shadow-[0_2px_0_#d9821f]"
            aria-hidden
          >
            <path
              d="M12 1.8l3.1 6.4 7 .9-5.1 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.9 9.1l7-.9z"
              fill="#ffd34d"
              stroke="#d9821f"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="relative pt-0.5">{level.level}</span>
        </div>
        <div className="min-w-32 sm:min-w-44">
          <div className="font-display text-sm font-semibold leading-tight text-ink">
            {level.title}
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-wood bg-wheat">
            <div
              className="h-full rounded-full bg-gradient-to-b from-[#ffe27a] to-sun transition-[width] duration-500"
              style={{ width: `${Math.round(level.fraction * 100)}%` }}
            />
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
            {level.maxed
              ? "Max level!"
              : `${level.into.toLocaleString()} / ${level.span.toLocaleString()} XP`}
          </div>
        </div>
      </div>

      <div className="hidden pt-1.5 md:block">
        <Logo size={30} textClassName="text-xl drop-shadow-[0_2px_0_#2f7d1f]" />
      </div>

      <div className="flex flex-col items-end gap-2 sm:flex-row">
        <div className={panel} title="Coins" data-anchor="coins">
          <span className="text-xl" aria-hidden>
            🪙
          </span>
          <AnimatedNumber
            value={wallet.coins}
            className="min-w-14 text-right font-display text-lg font-semibold text-ink"
          />
          <span className="sr-only">coins</span>
        </div>
        <FuelPill />
        <div className={panel} title="Golden Clovers">
          <span className="text-xl" aria-hidden>
            🍀
          </span>
          <AnimatedNumber
            value={wallet.clovers}
            className="min-w-6 text-right font-display text-lg font-semibold text-ink"
          />
          <span className="sr-only">Golden Clovers</span>
        </div>
        <BookButton />
        <button
          type="button"
          title="Settings"
          onClick={() => useUi.getState().openDialog("settings")}
          className="pointer-events-auto grid size-11 place-items-center rounded-full border-4 border-wood bg-cream text-ink shadow-press"
        >
          <Settings className="size-5" />
        </button>
      </div>
    </div>
  );
}

function FuelPill() {
  const farm = useGame((s) => s.farm);
  const now = useNow(5000);
  if (farm.progress.level < FEATURE_LEVEL.vehicles) return null;
  return (
    <div className={panel} title="Fuel for vehicles (regenerates 1 every 5 minutes)">
      <span className="text-xl" aria-hidden>
        ⛽
      </span>
      <span className="min-w-6 text-right font-display text-lg font-semibold text-ink">
        {fuelAt(farm, now)}
      </span>
      <span className="sr-only">fuel</span>
    </div>
  );
}

/** Opens the Farm Book; a badge counts collections ready to turn in. */
function BookButton() {
  const level = useGame((s) => s.farm.progress.level);
  const ready = useGame((s) => setsReady(s.farm));
  if (level < FEATURE_LEVEL.ribbons) return null;
  return (
    <button
      type="button"
      title="Farm Book (J)"
      onClick={() => useUi.getState().openDialog("book")}
      className="pointer-events-auto relative grid size-11 place-items-center rounded-full border-4 border-wood bg-cream text-ink shadow-press"
    >
      <BookOpen className="size-5" />
      {ready > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-berry px-1 text-[11px] font-bold text-white">
          {ready}
        </span>
      )}
    </button>
  );
}
