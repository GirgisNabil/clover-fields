"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, Suspense, useMemo, useRef } from "react";
import type { Group, Mesh, Sprite } from "three";
import { useShallow } from "zustand/react/shallow";
import {
  type FarmObject,
  footprint,
  getDef,
  getProducer,
  getRecipe,
  type ObjectId,
  producerStatus,
} from "@/domain";
import { type ModelVisual, OBJECT_VISUALS } from "../assets/catalogVisuals";
import { emojiTexture } from "../assets/emojiTexture";
import { stringSeed } from "../assets/procedural/builder";
import { objectModel } from "../assets/procedural/objects";
import { modelTransform } from "../assets/useModel";
import { clock } from "../clock";
import { ModelBoundary } from "../render/ModelBoundary";
import { ModelObject } from "../render/ModelObject";
import { flatMaterial } from "../render/materials";
import { useGame, viewFarm } from "../store/gameStore";

/** Everything on the farm that isn't a plot: buildings, trees, animals and decorations. */
export function ObjectLayer() {
  const ids = useGame(
    useShallow((s) =>
      Object.values(viewFarm(s).objects)
        .filter((o) => o.kind !== "plot" && o.kind !== "animal")
        .map((o) => o.id),
    ),
  );
  // Keyed by farm too, so switching to a neighbour's farm rebuilds every object cleanly.
  const farmId = useGame((s) => viewFarm(s).meta.farmId);
  return (
    <>
      {ids.map((id) => (
        <PlacedObject key={`${farmId}:${id}`} id={id} />
      ))}
    </>
  );
}

function PlacedObject({ id }: { id: ObjectId }) {
  const obj = useGame((s) => viewFarm(s).objects[id]);
  if (!obj || obj.kind === "plot") return null;
  return <ObjectView obj={obj} />;
}

function ObjectView({ obj }: { obj: Exclude<FarmObject, { kind: "plot" }> }) {
  const { w, h } = footprint(obj.defId, obj.rot);
  const base = useMemo(() => footprint(obj.defId, 0), [obj.defId]);
  const def = getDef(obj.defId);
  const producer =
    obj.kind === "animal" || obj.kind === "tree" ? getProducer(obj.defId) : undefined;
  const visual = OBJECT_VISUALS[obj.defId];
  const model = useMemo(() => objectModel(obj.kind, obj.defId), [obj.kind, obj.defId]);
  const fruit = useMemo(
    () => (obj.kind === "tree" ? objectModel("tree", obj.defId, "fruit") : null),
    [obj.kind, obj.defId],
  );
  const seed = stringSeed(obj.id);
  const facing = obj.kind === "animal" ? ((seed % 8) / 8) * Math.PI * 2 : -obj.rot * (Math.PI / 2);

  const body = useRef<Group>(null);
  const bareMesh = useRef<Mesh>(null);
  const fruitMesh = useRef<Mesh>(null);
  const bubble = useRef<Sprite>(null);
  const height = visual ? visualHeight(visual, base) : (model?.height ?? 0.8);
  // Craft buildings show the good of their earliest job once it is done.
  const jobs = obj.kind === "building" ? obj.jobs : undefined;
  const firstJob = jobs?.reduce<(typeof jobs)[number] | undefined>(
    (a, j) => (!a || j.readyAt < a.readyAt ? j : a),
    undefined,
  );
  const bubbleIcon =
    producer?.product.icon ?? (firstJob ? getRecipe(firstJob.recipeId)?.icon : undefined);

  useFrame(() => {
    const now = clock.now();
    const t = now / 1000 + (seed % 100);
    let ready = false;
    if (producer && (obj.kind === "animal" || obj.kind === "tree")) {
      ready = producerStatus(obj.cycleStart, producer.cycleMs, now).ready;
    } else if (firstJob) {
      ready = firstJob.readyAt <= now;
    }
    if (bareMesh.current && fruitMesh.current) {
      fruitMesh.current.visible = ready;
      bareMesh.current.visible = !ready;
    }
    if (bubble.current) {
      bubble.current.visible = ready;
      bubble.current.position.y = height + 0.35 + Math.sin(t * 3) * 0.06;
    }
    if (obj.kind === "animal" && !visual?.idle && body.current) {
      // Static animals get a gentle bob and an occasional peck; rigged models animate themselves.
      const peck = Math.max(0, Math.sin(t * 1.3)) ** 8;
      body.current.rotation.z = -peck * 0.45;
      body.current.position.y = Math.abs(Math.sin(t * 2.1)) * 0.015;
    }
  });

  const procedural = (
    <>
      {model ? (
        <mesh
          ref={bareMesh}
          geometry={model.geometry}
          material={flatMaterial}
          castShadow
          receiveShadow
        />
      ) : (
        <sprite position={[0, 0.45, 0]} scale={[0.8 * Math.max(w, h), 0.8 * Math.max(w, h), 1]}>
          <spriteMaterial map={emojiTexture(def?.icon ?? "❓")} transparent depthWrite={false} />
        </sprite>
      )}
      {fruit && (
        <mesh
          ref={fruitMesh}
          geometry={fruit.geometry}
          material={flatMaterial}
          castShadow
          receiveShadow
          visible={false}
        />
      )}
    </>
  );

  return (
    <group position={[obj.x + w / 2, 0, obj.y + h / 2]}>
      <group rotation-y={facing}>
        <group ref={body}>
          {visual ? (
            <ModelBoundary fallback={procedural}>
              <Suspense fallback={procedural}>
                <VisualModels visual={visual} footprint={base} seed={seed} />
              </Suspense>
            </ModelBoundary>
          ) : (
            procedural
          )}
        </group>
      </group>
      {bubbleIcon && (
        <sprite ref={bubble} visible={false} scale={[0.55, 0.55, 1]} renderOrder={10}>
          <spriteMaterial
            map={emojiTexture(bubbleIcon, true)}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      )}
    </group>
  );
}

/** Tallest part of a visual (for bubble placement). */
function visualHeight(visual: ModelVisual, footprint: { w: number; h: number }): number {
  const parts = [visual, ...(visual.extra ?? [])];
  return Math.max(...parts.map((part) => modelTransform(part, footprint).height));
}

/** A visual's main model plus any extras, each shifted by its `at` offset. */
export function VisualModels({
  visual,
  footprint,
  seed,
  moving,
  animate,
}: {
  visual: ModelVisual;
  footprint: { w: number; h: number };
  seed: number;
  moving?: RefObject<boolean>;
  animate?: boolean;
}) {
  return (
    <>
      {[visual, ...(visual.extra ?? [])].map((part, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the part list is fixed per visual
        <group key={`${part.model}-${i}`} position={[part.at?.[0] ?? 0, 0, part.at?.[1] ?? 0]}>
          <ModelObject
            visual={part}
            footprint={footprint}
            seed={seed + i}
            {...(moving ? { moving } : {})}
            {...(animate === undefined ? {} : { animate })}
          />
        </group>
      ))}
    </>
  );
}
