"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Sprite } from "three";
import { useShallow } from "zustand/react/shallow";
import { getBuilding, getProducer, type ObjectId, producerStatus, rectOf } from "@/domain";
import { OBJECT_VISUALS } from "../assets/catalogVisuals";
import { emojiTexture } from "../assets/emojiTexture";
import { modelTransform } from "../assets/useModel";
import { clock } from "../clock";
import { VisualModels } from "../layers/ObjectLayer";
import { useGraphics } from "../quality/graphicsStore";
import { ModelBoundary } from "../render/ModelBoundary";
import { useGame, viewFarm } from "../store/gameStore";
import { trackAnimal, untrackAnimal } from "./registry";
import { type AnimalSpot, animalSpots } from "./spots";
import { Walker } from "./Walker";

const ONE = { w: 1, h: 1 };
/** Live animation mixers; animals past the budget hold a still pose. */
const MIXERS = { high: 24, low: 8 } as const;
const FAST = new Set(["meadow_donkey", "chestnut_horse"]);

function isMothHut(defId: string): boolean {
  const role = getBuilding(defId)?.role;
  return role?.type === "housing" && role.accepts === "moth";
}

function spotById(id: string): AnimalSpot | undefined {
  return animalSpots(viewFarm(useGame.getState()), clock.now()).find((s) => s.id === id);
}

/** Every roaming or resting animal, drawn where its walker is. */
export function AnimalLayer() {
  // Re-render the list only when the set of drawn animals changes.
  const [ids, setIds] = useState<string[]>(() =>
    animalSpots(viewFarm(useGame.getState()), clock.now()).map((s) => s.id),
  );
  const huts = useGame(
    useShallow((s) =>
      Object.values(viewFarm(s).objects)
        .filter((o) => o.kind === "building" && o.occupants.length > 0 && isMothHut(o.defId))
        .map((o) => o.id),
    ),
  );
  const quality = useGraphics((s) => s.quality);
  const farmId = useGame((s) => viewFarm(s).meta.farmId);
  const last = useRef(ids.join());
  useFrame(() => {
    const next = animalSpots(viewFarm(useGame.getState()), clock.now()).map((s) => s.id);
    const joined = next.join();
    if (joined !== last.current) {
      last.current = joined;
      setIds(next);
    }
  });
  return (
    <>
      {ids.map((id, i) => (
        <AnimalView key={`${farmId}:${id}`} id={id} animate={i < MIXERS[quality]} />
      ))}
      {huts.map((id) => (
        <MothSwarm key={`${farmId}:${id}`} hutId={id} />
      ))}
    </>
  );
}

function AnimalView({ id, animate }: { id: string; animate: boolean }) {
  const first = spotById(id);
  const defId = first?.defId ?? "";
  const visual = OBJECT_VISUALS[defId];
  const producer = getProducer(defId);
  // The walker lives as long as this animal is drawn (the component is keyed by id).
  const [walker] = useState(() =>
    first ? new Walker(id, first, FAST.has(defId) ? 1.3 : 0.85) : null,
  );
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const bubble = useRef<Sprite>(null);
  const zzz = useRef<Sprite>(null);
  const moving = useRef(false);
  const height = visual ? modelTransform(visual, ONE).height : 0.6;
  const seed = useMemo(() => [...id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) >>> 0, [id]);

  useEffect(() => () => untrackAnimal(id), [id]);

  useFrame((_, dt) => {
    const spot = spotById(id);
    const g = group.current;
    if (!spot || !walker || !g) return;
    const now = clock.now();
    walker.update(Math.min(dt, 0.1), viewFarm(useGame.getState()), spot);
    const visible = !walker.indoors;
    g.visible = visible;
    g.position.set(walker.x, 0, walker.z);
    g.rotation.y = walker.heading;
    moving.current = walker.moving;
    const t = now / 1000 + (seed % 97);
    if (body.current) {
      // Still models (no clips) hop while walking and breathe while idle; rigged ones animate.
      const still = !visual?.idle;
      body.current.position.y = still
        ? walker.moving
          ? Math.abs(Math.sin(t * 9)) * 0.05
          : Math.abs(Math.sin(t * 1.7)) * 0.012
        : 0;
    }
    const ready = producer ? producerStatus(spot.cycleStart, producer.cycleMs, now).ready : false;
    if (bubble.current) {
      bubble.current.visible = visible && ready && !spot.housed;
      bubble.current.position.y = height + 0.35 + Math.sin(t * 3) * 0.06;
    }
    if (zzz.current) {
      zzz.current.visible = visible && spot.resting && !walker.moving && spot.roams;
      zzz.current.position.y = height + 0.25 + Math.sin(t * 1.5) * 0.05;
    }
    trackAnimal(id, { x: walker.x, z: walker.z, height, visible });
  });

  if (!first || !walker) return null;
  const fallback = (
    <sprite position={[0, 0.3, 0]} scale={[0.5, 0.5, 1]}>
      <spriteMaterial map={emojiTexture(producer?.icon ?? "🐾")} transparent depthWrite={false} />
    </sprite>
  );
  return (
    <group ref={group}>
      <group ref={body}>
        {visual ? (
          <ModelBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <VisualModels
                visual={visual}
                footprint={ONE}
                seed={seed}
                moving={moving}
                animate={animate}
              />
            </Suspense>
          </ModelBoundary>
        ) : (
          fallback
        )}
      </group>
      {producer && (
        <sprite ref={bubble} visible={false} scale={[0.5, 0.5, 1]} renderOrder={10}>
          <spriteMaterial
            map={emojiTexture(producer.product.icon, true)}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      )}
      <sprite ref={zzz} visible={false} scale={[0.4, 0.4, 1]} renderOrder={10}>
        <spriteMaterial
          map={emojiTexture("💤", true)}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

/** Silk moths fluttering in loops around their hut (they never roam the farm). */
function MothSwarm({ hutId }: { hutId: string }) {
  const hut = useGame((s) => viewFarm(s).objects[hutId as ObjectId]);
  const sprites = useRef<Array<Sprite | null>>([]);
  const count = hut?.kind === "building" ? Math.min(hut.occupants.length, 8) : 0;
  const rect = hut ? rectOf(hut) : { x: 0, y: 0, w: 1, h: 1 };
  useFrame(() => {
    const t = clock.now() / 1000;
    sprites.current.forEach((s, i) => {
      if (!s) return;
      const a = t * (0.6 + i * 0.07) + (i * Math.PI * 2) / Math.max(1, count);
      const r = 0.9 + 0.3 * Math.sin(t * 0.7 + i);
      s.position.set(
        rect.x + rect.w / 2 + Math.cos(a) * r * (rect.w / 2 + 0.3),
        1.3 + Math.sin(t * 2.3 + i) * 0.25,
        rect.y + rect.h / 2 + Math.sin(a) * r * (rect.h / 2 + 0.3),
      );
      s.scale.setScalar(0.28 + Math.abs(Math.sin(t * 9 + i)) * 0.06);
    });
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <sprite
          // biome-ignore lint/suspicious/noArrayIndexKey: moths are interchangeable
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
          userData={{ noAO: true }}
        >
          <spriteMaterial map={emojiTexture("🦋")} transparent depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}
