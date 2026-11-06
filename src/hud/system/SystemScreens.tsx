"use client";

import { useProgress } from "@react-three/drei";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { useSaveStatus } from "@/game/persistence/saveStatus";

const TIPS = [
  "Animals fertilize the crops they wander over.",
  "Fences steer where your animals roam.",
  "Collections hide in every harvest. Check your Farm Book (J).",
  "Neighbours love help: up to five chores each, every day.",
  "Seasonal events bring their own crops and shop.",
];

/** The splash while the farm and its models load, with real progress. */
export function LoadingScreen({ done }: { done: boolean }) {
  const { progress, active } = useProgress();
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)] ?? TIPS[0]);
  const shown = done && !active ? 100 : Math.max(5, Math.round(progress));
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-sky"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      data-testid="loading"
    >
      <div className="flex w-72 flex-col items-center gap-4">
        <Logo size={64} textClassName="text-4xl" />
        <div
          className="h-4 w-full overflow-hidden rounded-full border-4 border-white bg-white/40"
          role="progressbar"
          aria-label="Loading"
          aria-valuenow={shown}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-leaf transition-[width] duration-300"
            style={{ width: `${shown}%` }}
          />
        </div>
        <p className="text-center text-sm font-semibold text-white drop-shadow">{tip}</p>
      </div>
    </motion.div>
  );
}

/** True if this browser can draw WebGL at all. */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function NoWebGL() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-sky p-6" role="alert">
      <div className="max-w-md rounded-2xl border-4 border-wood bg-cream p-6 text-center shadow-press">
        <Logo size={56} wordmark={false} className="mb-2" />
        <p className="font-display text-2xl font-semibold text-ink">
          Clover Fields needs 3D graphics
        </p>
        <p className="mt-2 text-sm text-ink">
          Your browser couldn't start WebGL. Try turning on hardware acceleration in its settings,
          updating it, or using another browser. Your farm is safe and waiting.
        </p>
      </div>
    </div>
  );
}

/** Shown if the GPU drops the canvas (driver reset, too many tabs): one click brings it back. */
export function ContextLost() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6" role="alert">
      <div className="max-w-sm rounded-2xl border-4 border-wood bg-cream p-6 text-center shadow-press">
        <p className="font-display text-xl font-semibold text-ink">The graphics took a nap 😴</p>
        <p className="mt-2 text-sm text-ink">
          Your farm is saved. Reload to pick up where you left off.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-full bg-grass px-5 py-2 font-display font-semibold text-white shadow-press-sm"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/** A banner while autosave keeps failing, with a retry and a pointer to backups. */
export function SaveBanner() {
  const failed = useSaveStatus((s) => s.failed);
  const retry = useSaveStatus((s) => s.retry);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (failed) setHidden(false);
  }, [failed]);
  if (!failed || hidden) return null;
  return (
    <div
      role="alert"
      className="pointer-events-auto fixed inset-x-0 top-20 z-40 mx-auto flex w-fit max-w-[calc(100vw-24px)] items-center gap-3 rounded-2xl border-4 border-berry bg-cream px-4 py-2 shadow-press"
    >
      <span className="text-sm text-ink">
        ⚠️ Your farm couldn't be saved (storage may be full or blocked). Export a backup from
        Settings.
      </span>
      <button
        type="button"
        onClick={() => retry?.()}
        className="rounded-full bg-sun px-3 py-1 text-sm font-semibold text-ink"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="text-sm text-muted-foreground underline"
      >
        Hide
      </button>
    </div>
  );
}
