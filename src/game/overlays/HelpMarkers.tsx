"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { useShallow } from "zustand/react/shallow";
import { HELPS_PER_DAY, helpedToday, helpTargets } from "@/domain";
import { emojiTexture } from "../assets/emojiTexture";
import { clock } from "../clock";
import { useGame } from "../store/gameStore";

/** While visiting, a bobbing 🤝 over every chore you can still do there today. */
export function HelpMarkers() {
  const targets = useGame(
    useShallow((s) => {
      if (!s.visit) return [];
      const now = clock.now();
      if (helpedToday(s.farm, s.visit.npcId, now).length >= HELPS_PER_DAY) return [];
      // Roaming animals carry their own "ready" bubble; markers go on crops and trees.
      return helpTargets(s.visit.farm, now)
        .filter((t) => t.kind !== "animal")
        .map((t) => `${t.x},${t.y}`);
    }),
  );
  const group = useRef<Group>(null);
  useFrame(() => {
    const t = clock.now() / 1000;
    group.current?.children.forEach((child, i) => {
      child.position.y = 0.95 + Math.sin(t * 3 + i) * 0.08;
    });
  });
  return (
    <group ref={group}>
      {targets.map((key) => {
        const [x, y] = key.split(",").map(Number) as [number, number];
        return (
          <sprite
            key={key}
            position={[x + 0.5, 0.95, y + 0.5]}
            scale={[0.42, 0.42, 1]}
            renderOrder={10}
          >
            <spriteMaterial
              map={emojiTexture("🤝", true)}
              transparent
              depthTest={false}
              depthWrite={false}
            />
          </sprite>
        );
      })}
    </group>
  );
}
