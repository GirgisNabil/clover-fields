"use client";

import { useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import type { AnimationAction, Group } from "three";
import type { ModelVisual } from "../assets/catalogVisuals";
import { seededRandom } from "../assets/procedural/builder";
import { modelTransform, useModel } from "../assets/useModel";

/**
 * A third-party model seated on its footprint. Animated models drift between idle clips, and
 * switch to their "Walk" clip while `moving.current` is true. `animate={false}` skips the mixer
 * entirely (used past the live-animation budget).
 */
export function ModelObject({
  visual,
  footprint,
  seed,
  moving,
  animate = true,
}: {
  visual: ModelVisual;
  footprint: { w: number; h: number };
  seed: number;
  moving?: RefObject<boolean>;
  animate?: boolean;
}) {
  const { scene, clips } = useModel(visual.model);
  const transform = useMemo(() => modelTransform(visual, footprint), [visual, footprint]);
  const root = useRef<Group>(null);
  const { actions } = useAnimations(animate ? clips : [], root);
  const current = useRef<AnimationAction | null>(null);
  const walking = useRef(false);
  const idleNames = useMemo(
    () => (visual.idle ?? []).filter((name) => actions[name]),
    [actions, visual.idle],
  );

  const play = (action: AnimationAction | null | undefined, offset = 0, fade = 0.5) => {
    if (!action || action === current.current) return;
    action.reset().fadeIn(fade).play();
    action.time = offset * action.getClip().duration;
    current.current?.fadeOut(fade);
    current.current = action;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: `play` only touches refs
  useEffect(() => {
    if (!animate || idleNames.length === 0) return;
    const rnd = seededRandom(seed);
    play(actions[idleNames[0] ?? "Idle"], rnd());
    const timer = setInterval(
      () => {
        if (walking.current) return;
        if (rnd() < 0.6) play(actions[idleNames[Math.floor(rnd() * idleNames.length)] ?? "Idle"]);
      },
      2500 + (seed % 2500),
    );
    return () => {
      clearInterval(timer);
      current.current?.stop();
      current.current = null;
    };
  }, [actions, idleNames, seed, animate]);

  useFrame(() => {
    if (!animate || !moving) return;
    const want = moving.current ?? false;
    if (want === walking.current) return;
    walking.current = want;
    if (want) play(actions.Walk, 0, 0.25);
    else play(actions[idleNames[0] ?? "Idle"], 0, 0.35);
  });

  return (
    <group rotation-y={visual.rotY ?? 0}>
      <group ref={root}>
        <primitive object={scene} scale={transform.scale} position={transform.offset} />
      </group>
    </group>
  );
}
