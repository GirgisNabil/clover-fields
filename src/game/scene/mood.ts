import { useEffect, useState } from "react";
import { activeEvent, type Mood } from "@/domain";
import { clock } from "../clock";

export interface MoodPreset {
  sky: string;
  ground: string;
  hemi: number;
  sun: string;
  sunIntensity: number;
  /** Multiplies the meadow and farm grass. */
  grass: string;
  background: string;
}

/** Lighting per season; `null` mood is the everyday look. */
export const MOODS: Record<Mood | "default", MoodPreset> = {
  default: {
    sky: "#cfeaff",
    ground: "#7cbf5a",
    hemi: 1.2,
    sun: "#fff1d6",
    sunIntensity: 2.4,
    grass: "#ffffff",
    background: "#cfe9c0",
  },
  autumn: {
    sky: "#ffe0b8",
    ground: "#a6894a",
    hemi: 1.15,
    sun: "#ffcf8f",
    sunIntensity: 2.5,
    grass: "#f2e2b4",
    background: "#f0dcb4",
  },
  winter: {
    sky: "#e4f1ff",
    ground: "#b8c8d8",
    hemi: 1.35,
    sun: "#f2f6ff",
    sunIntensity: 2.1,
    grass: "#dfe9ee",
    background: "#e3edf5",
  },
  spring: {
    sky: "#ffe6f2",
    ground: "#8fcf72",
    hemi: 1.25,
    sun: "#fff3f6",
    sunIntensity: 2.35,
    grass: "#fbf1f4",
    background: "#f3e2ec",
  },
  summer: {
    sky: "#d6f0ff",
    ground: "#9bd060",
    hemi: 1.2,
    sun: "#fff0b8",
    sunIntensity: 2.7,
    grass: "#fff8d6",
    background: "#e4f2c4",
  },
};

/** The running event's mood, re-checked every few seconds (and when the dev clock jumps). */
export function useMood(): Mood | null {
  const [mood, setMood] = useState<Mood | null>(() => activeEvent(clock.now())?.def.mood ?? null);
  useEffect(() => {
    const timer = setInterval(() => setMood(activeEvent(clock.now())?.def.mood ?? null), 1000);
    return () => clearInterval(timer);
  }, []);
  return mood;
}

/** True when the player asked the OS for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
