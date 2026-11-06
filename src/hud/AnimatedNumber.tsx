"use client";

import { animate } from "motion";
import { useEffect, useRef } from "react";

/** A number that counts up or down to its new value. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    if (from === value) return;
    const controls = animate(from, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => {
        shown.current = latest;
        if (node.current) node.current.textContent = Math.round(latest).toLocaleString();
      },
    });
    return () => controls.stop();
  }, [value]);

  return (
    <span ref={node} className={className}>
      {Math.round(shown.current).toLocaleString()}
    </span>
  );
}
