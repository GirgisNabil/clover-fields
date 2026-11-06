"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getEvent, getMaterial, getNpc, getQuest, getRibbon, getSet, TIER_NAMES } from "@/domain";
import { gameBus } from "@/game/store/eventBus";

interface Celebration {
  key: number;
  icon: string;
  title: string;
  detail: string;
}

const SHOW_MS = 3200;

/**
 * One banner at a time for ribbons and turned-in collections (they never stack); quick toasts
 * for keepsake finds. Level-ups keep their own modal.
 */
export function Celebrations() {
  const [queue, setQueue] = useState<Celebration[]>([]);

  useEffect(() => {
    let key = 0;
    return gameBus.on((signal) => {
      if (signal.type !== "events") return;
      const next: Celebration[] = [];
      for (const event of signal.events) {
        if (event.t === "ribbon") {
          const ribbon = getRibbon(event.id);
          next.push({
            key: key++,
            icon: ribbon?.icon ?? "🎀",
            title: `${TIER_NAMES[event.tier - 1] ?? ""} ribbon: ${ribbon?.name ?? event.id}`,
            detail: "Reward added to your farm. See the Farm Book (J).",
          });
        } else if (event.t === "setRedeemed") {
          const set = getSet(event.setId);
          next.push({
            key: key++,
            icon: set?.icon ?? "🏆",
            title: `${set?.name ?? "Collection"} turned in!`,
            detail:
              event.times === 1
                ? "Its trophy is waiting in your Tool Shed."
                : `${event.times} times so far.`,
          });
        } else if (event.t === "questStep") {
          const npc = getNpc(event.npc);
          const step = getQuest(event.lineId)?.steps[event.step];
          next.push({
            key: key++,
            icon: npc?.icon ?? "📜",
            title: event.last
              ? `${getQuest(event.lineId)?.name ?? "Quest"} complete!`
              : `${step?.title ?? "Step"} done!`,
            detail: `${npc?.name ?? ""}: thank you! Reward added.`,
          });
        } else if (event.t === "questStarted" && event.lineId !== "welcome") {
          const npc = getNpc(event.npc);
          toast(`${npc?.icon ?? "📜"} ${npc?.name ?? "A neighbour"} has a task for you`, {
            description: `${getQuest(event.lineId)?.name ?? ""} · see the quest rail on the left`,
            duration: 4000,
          });
        } else if (event.t === "eventSettled" && event.coins > 0) {
          const ev = getEvent(event.eventId);
          toast(`${ev?.icon ?? "🎟️"} ${ev?.name ?? "The event"} has ended`, {
            description: `Your ${event.tokens} leftover ${ev?.token.name ?? "tokens"} became 🪙 ${event.coins}.`,
            duration: 7000,
          });
        } else if (event.t === "found") {
          const item = getMaterial(event.id);
          const set = getSet(event.setId);
          toast(`${item?.icon ?? "🏺"} Found: ${item?.name ?? event.id}`, {
            description: `${set?.name ?? "Collection"} keepsake · Farm Book (J)`,
            duration: 2500,
          });
        }
      }
      if (next.length) setQueue((q) => [...q, ...next]);
    });
  }, []);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {current && (
          <motion.button
            type="button"
            key={current.key}
            initial={{ y: -24, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            onClick={() => setQueue((q) => q.slice(1))}
            data-testid="celebration"
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-4 border-sun bg-cream px-4 py-2 text-left shadow-press"
          >
            <span className="text-4xl">{current.icon}</span>
            <span className="flex flex-col">
              <span className="font-display text-lg font-semibold text-ink">{current.title}</span>
              <span className="text-xs text-muted-foreground">{current.detail}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
