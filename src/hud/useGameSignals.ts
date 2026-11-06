"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { describeError, getCrop } from "@/domain";
import { gameBus } from "@/game/store/eventBus";

/** Turns game signals into toasts: level-ups, mastery stars, problems and the welcome message. */
export function useGameSignals() {
  useEffect(
    () =>
      gameBus.on((signal) => {
        switch (signal.type) {
          case "events":
            for (const event of signal.events) {
              if (event.t === "manured") showManureTip();
              if (event.t === "masteryStar") {
                const crop = getCrop(event.cropId);
                toast.success(`${"★".repeat(event.star)} ${crop?.name ?? event.cropId} mastery!`, {
                  description: `+${event.coins.toLocaleString()} 🪙  +${event.xp} ⭐${event.signGranted ? "  · Mastery sign added to your Tool Shed" : ""}`,
                  duration: 6000,
                });
              }
            }
            break;
          case "rejected":
            toast(describeError(signal.error), { id: `rejected-${signal.error.code}` });
            break;
          case "refused":
            toast(describeError(signal.error), { id: `refused-${signal.error.code}` });
            break;
          case "loaded":
            // A new farm is greeted by the tutorial (Auntie Marigold) instead of a toast.
            if (signal.isNew) break;
            if (signal.ready > 0) {
              toast(
                `Welcome back! ${signal.ready} ${signal.ready === 1 ? "thing is" : "things are"} ready 🧺`,
              );
            } else {
              toast("Welcome back! 🍀");
            }
            break;
        }
      }),
    [],
  );
}

const MANURE_TIP = "cf:tip:manure";

/** Explains manure the first time it lands on this device. */
function showManureTip() {
  try {
    if (localStorage.getItem(MANURE_TIP)) return;
    localStorage.setItem(MANURE_TIP, "1");
  } catch {
    return;
  }
  toast("🐔 Animals fertilize crops they wander over!", {
    description: "Manured crops ripen sooner and pay +15%. Fences decide which fields they roam.",
    duration: 8000,
  });
}
