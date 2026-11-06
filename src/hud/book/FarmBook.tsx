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
  type CollectionView,
  collectionsView,
  describeError,
  FEATURE_LEVEL,
  type RibbonView,
  ribbonsView,
} from "@/domain";
import { useGame } from "@/game/store/gameStore";
import { type BookTab, useUi } from "@/game/store/uiStore";

const TABS: Array<{ id: BookTab; label: string }> = [
  { id: "collections", label: "🏺 Collections" },
  { id: "ribbons", label: "🎀 Ribbons" },
  { id: "stats", label: "📊 Stats" },
];

const TIER_COLORS = ["#d8cdb8", "#4cb92c", "#cd7f32", "#b8c4cc", "#f6c945"] as const;

/** The Farm Book (J): collections, ribbons and lifetime stats. */
export function FarmBook() {
  const open = useUi((s) => s.dialog === "book");
  const tab = useUi((s) => s.bookTab);
  const openDialog = useUi((s) => s.openDialog);
  return (
    <Dialog open={open} onOpenChange={(next) => openDialog(next ? "book" : null)}>
      <DialogContent className="flex max-h-[88dvh] flex-col border-4 border-wood bg-cream sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">📖 Farm Book</DialogTitle>
          <DialogDescription>
            Keepsakes you've found, ribbons you've won and your farm's story.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => useUi.setState({ bookTab: t.id })}
              className={cn(
                "rounded-xl px-3 py-1.5 font-display text-sm font-semibold text-ink",
                tab === t.id ? "bg-sun shadow-[inset_0_-3px_0_#d9821f]" : "bg-wheat",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Focusable so keyboard users can scroll the page (axe: scrollable-region-focusable). */}
        <section
          aria-label={TABS.find((t) => t.id === tab)?.label ?? "Farm Book"}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable regions must be keyboard reachable
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto pr-1 outline-none focus-visible:ring-2 focus-visible:ring-sun"
        >
          {tab === "collections" && <Collections />}
          {tab === "ribbons" && <Ribbons />}
          {tab === "stats" && <Stats />}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Collections() {
  const farm = useGame((s) => s.farm);
  if (farm.progress.level < FEATURE_LEVEL.collections) {
    return (
      <p className="p-8 text-center font-display text-muted-foreground">
        🔒 Collections open at level {FEATURE_LEVEL.collections}. Keepsakes turn up while you
        harvest, collect and plow.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {collectionsView(farm).map((set) => (
        <SetCard key={set.id} set={set} />
      ))}
    </div>
  );
}

function SetCard({ set }: { set: CollectionView }) {
  const redeem = () => {
    const error = useGame.getState().dispatch({ type: "redeemSet", setId: set.id });
    if (error) toast(describeError(error));
  };
  const trade = (want: string) => {
    const error = useGame.getState().dispatch({ type: "swapCollectible", want });
    if (error) toast(describeError(error));
  };
  return (
    <section
      data-testid={`set-${set.id}`}
      className={cn(
        "flex flex-col gap-2 rounded-2xl bg-white p-3",
        set.complete && "ring-4 ring-sun/70",
      )}
    >
      <header className="flex items-center gap-2">
        <span className="text-2xl">{set.icon}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display font-semibold text-ink">{set.name}</span>
          <span className="text-[11px] text-muted-foreground">
            {set.found}/6 found{set.redeemed ? ` · turned in ${set.redeemed}×` : ""}
          </span>
        </div>
      </header>
      <ul className="grid grid-cols-6 gap-1">
        {set.items.map((item) => {
          const tradable = item.count === 0 && set.spares >= item.swapCost;
          return (
            <li key={item.id} className="flex flex-col items-center gap-0.5">
              <div
                title={item.count ? item.name : `Found by ${set.hint}`}
                className={cn(
                  "relative grid aspect-square w-full place-items-center rounded-lg text-2xl",
                  item.count ? "bg-wheat" : "bg-[#efe6d4]",
                  item.rarity === "veryRare" && "ring-2 ring-[#b56cff]/60",
                  item.rarity === "rare" && "ring-2 ring-[#3aa0ff]/50",
                )}
              >
                <span className={item.count ? "" : "opacity-25 grayscale brightness-0"}>
                  {item.icon}
                </span>
                {item.count > 1 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1 text-[10px] font-bold text-white">
                    ×{item.count}
                  </span>
                )}
              </div>
              {tradable && (
                <button
                  type="button"
                  onClick={() => trade(item.id)}
                  title={`Trade ${item.swapCost} spares for ${item.name}`}
                  className="rounded-full bg-sky px-1.5 text-[10px] font-semibold text-ink"
                >
                  Trade {item.swapCost}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Found by {set.hint}.
        {set.spares ? ` ${set.spares} spare${set.spares > 1 ? "s" : ""} to trade.` : ""}
      </p>
      <button
        type="button"
        disabled={!set.complete}
        onClick={redeem}
        className="rounded-full bg-grass px-3 py-1.5 font-display text-sm font-semibold text-white shadow-press-sm disabled:bg-wheat disabled:text-muted-foreground disabled:shadow-none"
      >
        Turn in · 🪙 {set.nextReward.coins.toLocaleString()} ⭐ {set.nextReward.xp}
        {set.redeemed === 0 ? " · 🏆 + 🍀" : ""}
      </button>
    </section>
  );
}

function Ribbons() {
  const farm = useGame((s) => s.farm);
  if (farm.progress.level < FEATURE_LEVEL.ribbons) {
    return (
      <p className="p-8 text-center font-display text-muted-foreground">
        🔒 Ribbons start at level {FEATURE_LEVEL.ribbons}.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {ribbonsView(farm).map((r) => (
        <RibbonRow key={r.id} ribbon={r} />
      ))}
    </ul>
  );
}

function RibbonRow({ ribbon }: { ribbon: RibbonView }) {
  return (
    <li
      data-testid={`ribbon-${ribbon.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white p-2.5"
    >
      <div
        className="grid size-12 shrink-0 place-items-center rounded-full border-4 text-xl"
        style={{ borderColor: TIER_COLORS[ribbon.tier] ?? TIER_COLORS[0] }}
        title={ribbon.tierName ? `${ribbon.tierName} ribbon` : "Not earned yet"}
      >
        {ribbon.icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display font-semibold text-ink">{ribbon.name}</span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {ribbon.tierName ?? "—"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {ribbon.next === null ? "Gold! Every tier earned." : ribbon.goal}
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-wheat">
          <div
            className="h-full rounded-full"
            style={{
              width: `${ribbon.progress * 100}%`,
              background: TIER_COLORS[Math.min(4, ribbon.tier + 1)],
            }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">
          {ribbon.value.toLocaleString()}
          {ribbon.next === null ? "" : ` / ${ribbon.next.toLocaleString()}`}
        </span>
      </div>
    </li>
  );
}

const STATS: Array<[string, string]> = [
  ["harvest:crop", "🌾 Crops harvested"],
  ["plow", "⛏️ Plots plowed"],
  ["plant", "🌱 Seeds planted"],
  ["collect:animal", "🐔 Animal collections"],
  ["collect:tree", "🍎 Tree collections"],
  ["harvest:manured", "💩 Manured harvests"],
  ["craft:done", "🥖 Goods crafted"],
  ["collect:find", "🏺 Keepsakes found"],
  ["collect:redeem", "🏆 Collections turned in"],
  ["vehicle:tiles", "🚜 Tiles worked by vehicle"],
  ["coins:earned", "🪙 Coins earned"],
];

function Stats() {
  const counters = useGame((s) => s.farm.stats.counters);
  return (
    <dl className="grid gap-1.5 sm:grid-cols-2">
      {STATS.map(([key, label]) => (
        <div key={key} className="flex justify-between rounded-xl bg-white px-3 py-2 text-sm">
          <dt className="text-ink">{label}</dt>
          <dd className="font-display font-semibold text-ink">
            {(counters[key] ?? 0).toLocaleString()}
          </dd>
        </div>
      ))}
    </dl>
  );
}
