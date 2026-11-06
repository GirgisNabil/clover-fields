"use client";

import { useEffect, useState } from "react";
import { clock } from "@/game/clock";

/** Game time that re-renders the component every `intervalMs` (for countdowns). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
