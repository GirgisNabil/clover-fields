"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import type { Group, Sprite } from "three";
import { useShallow } from "zustand/react/shallow";
import { NPCS, npcsWithQuests } from "@/domain";
import { trackAnimal, untrackAnimal } from "../animals/registry";
import type { ModelVisual } from "../assets/catalogVisuals";
import { emojiTexture } from "../assets/emojiTexture";
import { clock } from "../clock";
import { VisualModels } from "../layers/ObjectLayer";
import { ModelBoundary } from "../render/ModelBoundary";
import { useGame } from "../store/gameStore";

const ONE = { w: 1, h: 1 };
const PERSON = { mode: "height", value: 1.2 } as const;
const VISUALS: Record<string, ModelVisual> = {
  marigold: { model: "npc_marigold", fit: PERSON, idle: ["Idle", "Wave"] },
  pip: { model: "npc_pip", fit: PERSON, idle: ["Idle", "Wave"] },
  barnaby: { model: "npc_barnaby", fit: PERSON, idle: ["Idle", "Wave"] },
  juniper: { model: "npc_juniper", fit: PERSON, idle: ["Idle", "Wave"] },
  hollis: { model: "npc_hollis", fit: PERSON, idle: ["Idle", "Wave"] },
  dot: { model: "animal_duck", fit: { mode: "height", value: 0.6 } },
};

/** Where neighbour number `i` stands: in a row just past the farm's front edge. */
export function npcSpot(i: number, size: number) {
  return { x: 1.2 + i * 1.6, z: size + 1.1 };
}

/** Neighbours who have a task for you wait at the farm's edge; click them for their quest card. */
export function NpcLayer() {
  const size = useGame((s) => s.farm.land.size);
  const present = useGame(
    useShallow((s) => npcsWithQuests(s.farm).map((n) => `${n.npc}:${n.claimable ? 1 : 0}`)),
  );
  const ordered = NPCS.map((def) => {
    const entry = present.find((p) => p.startsWith(`${def.id}:`));
    return entry ? { id: def.id, claimable: entry.endsWith(":1") } : null;
  }).filter((n): n is { id: string; claimable: boolean } => n !== null);
  return (
    <>
      {ordered.map((npc, i) => (
        <Npc key={npc.id} id={npc.id} claimable={npc.claimable} spot={npcSpot(i, size)} />
      ))}
    </>
  );
}

function Npc({
  id,
  claimable,
  spot,
}: {
  id: string;
  claimable: boolean;
  spot: { x: number; z: number };
}) {
  const visual = VISUALS[id];
  const bubble = useRef<Sprite>(null);
  const group = useRef<Group>(null);
  const height = id === "dot" ? 0.6 : 1.2;

  useEffect(() => {
    trackAnimal(`npc:${id}`, { x: spot.x, z: spot.z, height, visible: true });
    return () => untrackAnimal(`npc:${id}`);
  }, [id, spot.x, spot.z, height]);

  useFrame(() => {
    const t = clock.now() / 1000;
    if (bubble.current) {
      bubble.current.position.y = height + 0.4 + Math.sin(t * 3 + spot.x) * 0.07;
      const pulse = claimable ? 1 + Math.abs(Math.sin(t * 4)) * 0.15 : 1;
      bubble.current.scale.set(0.5 * pulse, 0.5 * pulse, 1);
    }
  });

  if (!visual) return null;
  return (
    // Turned to face the camera, which looks from +x/+z.
    <group ref={group} position={[spot.x, 0, spot.z]} rotation-y={Math.PI / 4}>
      <ModelBoundary fallback={null}>
        <Suspense fallback={null}>
          <VisualModels visual={visual} footprint={ONE} seed={id.length * 17} />
        </Suspense>
      </ModelBoundary>
      <sprite ref={bubble} renderOrder={10} userData={{ noAO: true }}>
        <spriteMaterial
          map={emojiTexture(claimable ? "❗" : "💬", true)}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}
