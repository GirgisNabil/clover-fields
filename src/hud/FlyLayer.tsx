"use client";

import { useEffect, useRef } from "react";
import { getView } from "@/game/camera/cameraStore";
import { worldToScreen } from "@/game/math/iso";
import { prefersReducedMotion } from "@/game/scene/mood";
import { gameBus } from "@/game/store/eventBus";

const MAX_ICONS = 6;

/** Sends a few coin and star icons from a harvested tile to the HUD counters. */
export function FlyLayer() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    return gameBus.on((signal) => {
      const layer = root.current;
      if (signal.type !== "events" || !layer) return;
      let coins = 0;
      let xp = 0;
      let at: { x: number; y: number } | undefined;
      for (const e of signal.events) {
        if (e.t === "coins" && e.delta > 0 && e.at && e.reason === "harvest") {
          coins += e.delta;
          at ??= e.at;
        } else if (e.t === "xp" && e.at && e.amount > 0) {
          xp += e.amount;
          at ??= e.at;
        }
      }
      if (!at) return;
      const from = worldToScreen(getView(), at.x + 0.5, 0.4, at.y + 0.5);
      const fly = (icon: string, anchor: string, n: number) => {
        const target = document.querySelector(`[data-anchor="${anchor}"]`)?.getBoundingClientRect();
        if (!target) return;
        const to = { x: target.left + 18, y: target.top + target.height / 2 };
        for (let i = 0; i < n; i++) {
          const el = document.createElement("span");
          el.textContent = icon;
          el.className = "pointer-events-none absolute text-xl drop-shadow";
          el.style.left = `${from.px}px`;
          el.style.top = `${from.py}px`;
          layer.appendChild(el);
          const spread = (i - (n - 1) / 2) * 14;
          const lift = -60 - Math.random() * 30;
          el.animate(
            [
              { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
              {
                transform: `translate(calc(-50% + ${spread}px), calc(-50% + ${lift}px)) scale(1.1)`,
                opacity: 1,
                offset: 0.3,
              },
              {
                transform: `translate(calc(-50% + ${to.x - from.px}px), calc(-50% + ${to.y - from.py}px)) scale(0.7)`,
                opacity: 0.9,
              },
            ],
            { duration: 750 + i * 70, easing: "cubic-bezier(.5,0,.6,1)", fill: "forwards" },
          ).onfinish = () => el.remove();
        }
      };
      if (coins > 0) fly("🪙", "coins", Math.min(MAX_ICONS, 2 + Math.floor(Math.log2(coins))));
      if (xp > 0) fly("⭐", "xp", Math.min(3, xp));
    });
  }, []);

  return <div ref={root} className="pointer-events-none fixed inset-0 z-20 overflow-hidden" />;
}
