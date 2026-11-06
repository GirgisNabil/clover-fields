"use client";

import { useEffect, useRef } from "react";
import { type DomainEvent, getEvent, getMaterial, type Tile } from "@/domain";
import { getView } from "@/game/camera/cameraStore";
import { worldToScreen } from "@/game/math/iso";
import { gameBus } from "@/game/store/eventBus";

const POOL = 24;
const LIFE_MS = 1400;

interface Floater {
  node: HTMLDivElement | null;
  active: boolean;
  x: number;
  z: number;
  born: number;
}

/** Sums one command's coin and XP changes into a label like "+35 🪙  +1 ⭐". */
function summarize(events: DomainEvent[]): { text: string; at: Tile; spend: boolean } | null {
  let coins = 0;
  let xp = 0;
  let at: Tile | undefined;
  const items: string[] = [];
  let manured = 0;
  for (const event of events) {
    if (event.t === "eventTokens") {
      items.push(`+${event.delta} ${getEvent(event.eventId)?.token.icon ?? "🎟️"}`);
    }
    if (event.t === "manured") {
      manured++;
      at ??= event.at;
    }
    if (event.t === "material" && event.at && event.delta > 0) {
      items.push(`+${event.delta} ${getMaterial(event.id)?.icon ?? "📦"}`);
      at ??= event.at;
    }
    if (event.t === "coins" && event.at) {
      coins += event.delta;
      at ??= event.at;
    } else if (event.t === "xp" && event.at) {
      xp += event.amount;
      at ??= event.at;
    }
  }
  if (!at || (coins === 0 && xp === 0 && items.length === 0 && manured === 0)) return null;
  const parts: string[] = [...items];
  if (manured > 0) parts.push(manured > 1 ? `🌱 Manured ×${manured}` : "🌱 Manured");
  if (coins !== 0) parts.push(`${coins > 0 ? "+" : "−"}${Math.abs(coins).toLocaleString()} 🪙`);
  if (xp > 0) parts.push(`+${xp} ⭐`);
  return { text: parts.join("  "), at, spend: coins < 0 };
}

/** Floating "+coins +XP" text above tiles, drawn with a fixed pool of DOM nodes (no React renders). */
export function FloatLayer() {
  const floaters = useRef<Floater[]>(
    Array.from({ length: POOL }, () => ({ node: null, active: false, x: 0, z: 0, born: 0 })),
  );

  useEffect(() => {
    let next = 0;
    const off = gameBus.on((signal) => {
      if (signal.type !== "events") return;
      const label = summarize(signal.events);
      if (!label) return;
      const floater = floaters.current[next];
      next = (next + 1) % POOL;
      if (!floater?.node) return;
      floater.active = true;
      floater.x = label.at.x + 0.5;
      floater.z = label.at.y + 0.5;
      floater.born = performance.now();
      floater.node.textContent = label.text;
      floater.node.dataset.tone = label.spend ? "spend" : "earn";
      floater.node.style.display = "block";
    });

    let frame = requestAnimationFrame(function loop() {
      const view = getView();
      const now = performance.now();
      for (const f of floaters.current) {
        if (!f.active || !f.node) continue;
        const age = (now - f.born) / LIFE_MS;
        if (age >= 1) {
          f.active = false;
          f.node.style.display = "none";
          continue;
        }
        const p = worldToScreen(view, f.x, 0.9 + age * 0.9, f.z);
        f.node.style.transform = `translate(${p.px}px, ${p.py}px) translate(-50%, -100%) scale(${0.85 + Math.min(age * 6, 0.25)})`;
        f.node.style.opacity = String(age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3);
      }
      frame = requestAnimationFrame(loop);
    });

    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {floaters.current.map((f, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size pool of reusable nodes
          key={i}
          ref={(node) => {
            f.node = node;
          }}
          style={{ display: "none" }}
          className="absolute top-0 left-0 font-display text-lg font-bold whitespace-nowrap text-white [text-shadow:0_2px_0_#2c6b18,0_0_4px_rgb(0_0_0/0.35)] data-[tone=spend]:text-[#ffe4e0] data-[tone=spend]:[text-shadow:0_2px_0_#8a2a20,0_0_4px_rgb(0_0_0/0.35)]"
        />
      ))}
    </div>
  );
}
