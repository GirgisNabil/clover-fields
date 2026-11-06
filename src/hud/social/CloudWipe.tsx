"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store/gameStore";

/** A puff of clouds across the screen whenever you travel to a neighbour's farm or back. */
export function CloudWipe() {
  const visitKey = useGame((s) => s.visit?.npcId ?? "home");
  const first = useRef(true);
  const [show, setShow] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the wipe plays when the destination changes
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setShow((n) => n + 1);
    const timer = setTimeout(() => setShow(0), 900);
    return () => clearTimeout(timer);
  }, [visitKey]);
  return (
    <AnimatePresence>
      {show > 0 && (
        <motion.div
          key={show}
          className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <motion.span
              // biome-ignore lint/suspicious/noArrayIndexKey: decorative clouds
              key={i}
              className="absolute text-[9rem] leading-none drop-shadow"
              style={{ top: `${(i % 3) * 30 - 5}%`, left: `${Math.floor(i / 3) * 34 - 10}%` }}
              initial={{ x: "-60vw", opacity: 0.4 }}
              animate={{ x: "20vw", opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: (i % 3) * 0.05 }}
            >
              ☁️
            </motion.span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
