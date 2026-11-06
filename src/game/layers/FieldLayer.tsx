"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import { clock } from "../clock";
import { FieldRenderer } from "../render/FieldRenderer";
import { swayUniforms } from "../render/materials";
import { prefersReducedMotion } from "../scene/mood";
import { useGame, viewFarm } from "../store/gameStore";

/** Plots and crops, drawn with instancing and updated outside React renders. */
export function FieldLayer() {
  const root = useRef<Group>(null);
  const renderer = useRef<FieldRenderer | null>(null);

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    const field = new FieldRenderer(group);
    renderer.current = field;
    const unsubscribe = useGame.subscribe(
      (s) => viewFarm(s),
      (farm) => field.sync(farm, clock.now()),
      { fireImmediately: true },
    );
    return () => {
      unsubscribe();
      field.dispose();
      renderer.current = null;
    };
  }, []);

  // Reduced motion keeps the crops still.
  useEffect(() => {
    swayUniforms.uSway.value = prefersReducedMotion() ? 0 : 1;
  }, []);
  useFrame((state) => {
    swayUniforms.uTime.value = state.clock.elapsedTime;
    renderer.current?.tick(clock.now());
  });

  return <group ref={root} />;
}
