"use client";

import { useEffect, useState } from "react";
import { cropStage, getQuest } from "@/domain";
import { animalPosition } from "@/game/animals/registry";
import { getView } from "@/game/camera/cameraStore";
import { clock } from "@/game/clock";
import { worldToScreen } from "@/game/math/iso";
import { useGame } from "@/game/store/gameStore";
import { useUi } from "@/game/store/uiStore";
import { Portrait } from "../quests/Portrait";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 10;
const skipKey = (farmId: string) => `cf:tutorial-skip:${farmId}`;
const railKey = (farmId: string) => `cf:tutorial-rail:${farmId}`;

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Not persisted: the coach mark simply shows again next time.
  }
}

/** Screen box around some world points (x, y, z). */
function boxOf(points: Array<[number, number, number]>): Rect | null {
  if (points.length === 0) return null;
  const view = getView();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y, z] of points) {
    const p = worldToScreen(view, x, y, z);
    minX = Math.min(minX, p.px);
    maxX = Math.max(maxX, p.px);
    minY = Math.min(minY, p.py);
    maxY = Math.max(maxY, p.py);
  }
  return { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
}

function domBox(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return null;
  return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 };
}

/** What the current tutorial step points at, measured fresh each frame. */
function target(step: number): Rect | null {
  const { farm } = useGame.getState();
  const ui = useUi.getState();
  const now = clock.now();
  switch (step) {
    case 0: {
      const points: Array<[number, number, number]> = [];
      for (const obj of Object.values(farm.objects)) {
        if (obj.kind !== "plot" || !obj.crop) continue;
        if (cropStage(obj.id, obj.crop, farm.meta.witherSalt, now).stage !== "ripe") continue;
        points.push(
          [obj.x, 0, obj.y],
          [obj.x + 1, 0, obj.y + 1],
          [obj.x + 1, 0.4, obj.y],
          [obj.x, 0.4, obj.y + 1],
        );
      }
      return boxOf(points);
    }
    case 1:
      return ui.tool === "plow" ? null : domBox('[data-coach="tool-plow"]');
    case 2:
      return ui.tool === "seed" ? null : domBox('[data-coach="tool-seeds"]');
    case 3: {
      const hen = Object.values(farm.objects).find((o) => o.kind === "animal");
      const live = hen ? animalPosition(hen.id) : undefined;
      if (!live?.visible) return null;
      return boxOf([
        [live.x - 0.4, 0, live.z - 0.4],
        [live.x + 0.4, 0, live.z + 0.4],
        [live.x, live.height, live.z],
      ]);
    }
    case 4:
      return ui.placing ? null : domBox('[data-coach="tool-shed"]');
    default:
      return null;
  }
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h) < 2);

/**
 * Coach marks for the welcome questline: a soft scrim with a spotlight on the thing to use and
 * Auntie Marigold explaining it. Steps follow the quest, so a reload resumes where you were.
 * It never blocks input: you can click straight through the scrim.
 */
export function Tutorial() {
  const farmId = useGame((s) => s.farm.meta.farmId);
  const welcome = useGame((s) => s.farm.quests.active.welcome);
  const welcomeDone = useGame((s) => s.farm.quests.done.welcome !== undefined);
  const dialogOpen = useUi((s) => s.dialog !== null);
  // `cf:tutorial-off` turns coach marks off on this device (used by automated tests).
  const [skipped, setSkipped] = useState(
    () => readFlag(skipKey(farmId)) || readFlag("cf:tutorial-off"),
  );
  const [railSeen, setRailSeen] = useState(() => readFlag(railKey(farmId)));
  const [rect, setRect] = useState<Rect | null>(null);
  // Other popups (level-ups, dialogs) take priority; the coach waits until they close.
  const [covered, setCovered] = useState(false);

  const step = welcome?.step ?? -1;
  const showRail = welcomeDone && !railSeen && !skipped;
  const active = !skipped && !dialogOpen && (step >= 0 || showRail);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last: Rect | null = null;
    let lastCovered = false;
    const tick = () => {
      const popup = document.querySelector('[role="dialog"][data-state="open"]') !== null;
      if (popup !== lastCovered) {
        lastCovered = popup;
        setCovered(popup);
      }
      const next = step >= 0 ? target(step) : domBox('[data-coach="quest-rail"]');
      if (!sameRect(next, last)) {
        last = next;
        setRect(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [active, step]);

  if (!active || covered) return null;
  const quest = getQuest("welcome");
  const text =
    step >= 0
      ? (quest?.steps[step]?.text ?? "")
      : "Neighbours bring you tasks with rewards. They wait here, and at the edge of your farm. Click one any time!";
  const skip = () => {
    writeFlag(skipKey(farmId));
    setSkipped(true);
  };
  const doneRail = () => {
    writeFlag(railKey(farmId));
    setRailSeen(true);
  };

  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  // The bubble sits beside the spotlight, on whichever side has room.
  const below = !rect || rect.y + rect.h + 190 < vh;
  const bubbleTop = rect ? (below ? rect.y + rect.h + 14 : Math.max(12, rect.y - 176)) : vh * 0.3;
  const bubbleLeft = rect
    ? Math.min(Math.max(12, rect.x + rect.w / 2 - 170), vw - 352)
    : vw / 2 - 170;

  return (
    <div className="pointer-events-none fixed inset-0 z-30" data-testid="tutorial">
      <svg width="100%" height="100%" className="absolute inset-0" aria-hidden>
        <defs>
          <mask id="coach-hole">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={16} fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(45, 30, 12, 0.32)" mask="url(#coach-hole)" />
        {rect && (
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            rx={16}
            fill="none"
            stroke="#ffd23f"
            strokeWidth={4}
            className="animate-pulse"
          />
        )}
      </svg>
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Tutorial"
        className="pointer-events-auto absolute flex w-[340px] max-w-[calc(100vw-24px)] gap-3 rounded-2xl border-4 border-leaf bg-cream p-3 shadow-press"
        style={{ top: bubbleTop, left: bubbleLeft }}
      >
        <Portrait npc="marigold" size={52} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-display text-sm font-semibold text-ink">
            Auntie Marigold{step >= 0 ? ` · ${step + 1}/${quest?.steps.length ?? 5}` : ""}
          </span>
          <p className="text-sm text-ink">{text}</p>
          <div className="flex justify-end gap-2">
            {step >= 0 ? (
              <button
                type="button"
                onClick={skip}
                className="text-xs text-muted-foreground underline"
              >
                Skip tutorial
              </button>
            ) : (
              <button
                type="button"
                onClick={doneRail}
                className="rounded-full bg-grass px-3 py-1 font-display text-sm font-semibold text-white"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
