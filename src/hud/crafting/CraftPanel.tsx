"use client";

import { cn } from "cn";
import { toast } from "sonner";
import {
  type BuildingObject,
  describeError,
  getDef,
  getMaterial,
  getRecipe,
  type RecipeDef,
  recipesFor,
  type Station,
} from "@/domain";
import { formatDuration } from "@/game/input/describe";
import { useGame } from "@/game/store/gameStore";
import { useNow } from "../useNow";

const nameOf = (id: string) => getDef(id)?.name ?? id;
const iconOf = (id: string) => getDef(id)?.icon ?? "📦";

/** Recipe list, ingredient check and the job strip for a craft building. */
export function CraftPanel({
  building,
  station,
  slots,
}: {
  building: BuildingObject;
  station: Station;
  slots: number;
}) {
  const now = useNow(1000);
  const level = useGame((s) => s.farm.progress.level);
  const materials = useGame((s) => s.farm.materials);
  const recipes = recipesFor(station);
  const full = building.jobs.length >= slots;
  const ready = building.jobs.filter((j) => j.readyAt <= now).length;

  const start = (recipe: RecipeDef) => {
    const error = useGame
      .getState()
      .dispatch({ type: "craft", buildingId: building.id, recipeId: recipe.id });
    if (error) toast(describeError(error));
    else toast.success(`${recipe.icon} ${recipe.name} started`);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex gap-2" data-testid="craft-jobs">
        {Array.from({ length: slots }, (_, i) => {
          const job = building.jobs[i];
          const recipe = job ? getRecipe(job.recipeId) : undefined;
          if (!job || !recipe) {
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
                key={`slot-${i}`}
                className="flex h-16 flex-1 items-center justify-center rounded-xl border-2 border-dashed border-wood/40 text-xs text-muted-foreground"
              >
                Empty slot
              </div>
            );
          }
          const done = job.readyAt <= now;
          const progress = Math.min(1, (now - job.startedAt) / (job.readyAt - job.startedAt));
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
              key={`slot-${i}`}
              className="flex h-16 flex-1 flex-col justify-center gap-1 rounded-xl bg-white px-2"
            >
              <span className="truncate text-sm font-semibold text-ink">
                {recipe.icon} {recipe.name}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-wheat">
                <div
                  className={cn("h-full rounded-full", done ? "bg-leaf" : "bg-sun")}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                {done ? "Ready!" : formatDuration(job.readyAt - now)}
              </span>
            </div>
          );
        })}
      </div>

      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {recipes.map((recipe) => {
          const locked = level < recipe.unlockLevel;
          const inputs = Object.entries(recipe.inputs);
          const canMake = inputs.every(([id, n]) => (materials[id] ?? 0) >= n);
          const sale = getMaterial(recipe.id)?.sale;
          return (
            <li
              key={recipe.id}
              data-testid={`recipe-${recipe.id}`}
              className={cn(
                "flex items-center gap-3 rounded-xl bg-white px-3 py-2",
                locked && "opacity-55",
              )}
            >
              <span className="text-3xl">{recipe.icon}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-display font-semibold text-ink">{recipe.name}</span>
                <span className="flex flex-wrap gap-x-2 text-xs">
                  {inputs.map(([id, n]) => {
                    const have = materials[id] ?? 0;
                    return (
                      <span
                        key={id}
                        title={nameOf(id)}
                        className={have >= n ? "text-leaf-dark" : "text-destructive"}
                      >
                        {iconOf(id)} {have}/{n} {have >= n ? "✓" : ""}
                      </span>
                    );
                  })}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDuration(recipe.timeMs)}
                  {sale ? ` · sells 🪙${sale}` : ""}
                  {recipe.fuel ? ` · ⛽ +${recipe.fuel}` : ""}
                </span>
              </div>
              <button
                type="button"
                disabled={locked || full || !canMake}
                onClick={() => start(recipe)}
                className="rounded-full bg-grass px-3 py-1.5 font-display text-sm font-semibold text-white shadow-press-sm disabled:opacity-50"
              >
                {locked ? `Lv ${recipe.unlockLevel}` : full ? "Busy" : "Make"}
              </button>
            </li>
          );
        })}
      </ul>
      {ready > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {ready} ready. The farmer walks over to collect.
        </p>
      )}
    </div>
  );
}
