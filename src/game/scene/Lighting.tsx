"use client";

import { useMemo } from "react";
import { Object3D } from "three";
import { MOODS, type MoodPreset } from "./mood";

// Warm sun from the screen's left (world -x, +z), 55° above the horizon: the left-front faces
// are lit, the right-front faces are in shade, and shadows fall to the right.
const SUN_ELEVATION = (55 * Math.PI) / 180;
const SUN_DISTANCE = 40;
const SUN_X = -Math.SQRT1_2 * Math.cos(SUN_ELEVATION) * SUN_DISTANCE;
const SUN_Y = Math.sin(SUN_ELEVATION) * SUN_DISTANCE;
const SUN_Z = Math.SQRT1_2 * Math.cos(SUN_ELEVATION) * SUN_DISTANCE;

export function Lighting({
  farmSize,
  preset = MOODS.default,
}: {
  farmSize: number;
  preset?: MoodPreset;
}) {
  const target = useMemo(() => new Object3D(), []);
  const center = farmSize / 2;
  const half = farmSize * 0.75 + 4;

  return (
    <>
      <hemisphereLight args={[preset.sky, preset.ground, preset.hemi]} />
      <primitive object={target} position={[center, 0, center]} />
      <directionalLight
        target={target}
        position={[center + SUN_X, SUN_Y, center + SUN_Z]}
        color={preset.sun}
        intensity={preset.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
    </>
  );
}
