import { create } from "zustand";

export type Quality = "high" | "low";

const KEY = "cf:quality";

function initialQuality(): Quality {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "high" || saved === "low") return saved;
  } catch {
    // Storage blocked: fall through to the heuristic.
  }
  if (typeof navigator === "undefined") return "high";
  // Small touch screens with few cores get the cheap path by default.
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
  const phone = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  return weak && phone ? "low" : "high";
}

interface GraphicsState {
  quality: Quality;
  setQuality(quality: Quality): void;
}

export const useGraphics = create<GraphicsState>((set) => ({
  quality: initialQuality(),
  setQuality(quality) {
    try {
      localStorage.setItem(KEY, quality);
    } catch {
      // Not persisted; still applies for this session.
    }
    set({ quality });
  },
}));
