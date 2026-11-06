"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import {
  type AnimationClip,
  type Material,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type { Fit, ModelVisual } from "./catalogVisuals";
import { MODELS, type ModelKey } from "./manifest";

const prepared = new WeakSet<Object3D>();
const lambertCache = new WeakMap<Material, Material>();

/** Lambert matches the procedural models' look and lighting (and is cheaper than PBR). */
function toLambert(material: Material): Material {
  const cached = lambertCache.get(material);
  if (cached) return cached;
  let result: Material = material;
  if (material instanceof MeshStandardMaterial) {
    result = new MeshLambertMaterial({
      color: material.color,
      map: material.map,
      vertexColors: material.vertexColors,
      transparent: material.transparent,
      opacity: material.opacity,
      alphaTest: material.alphaTest,
      side: material.side,
    });
    result.name = material.name;
  }
  lambertCache.set(material, result);
  return result;
}

function prepare(scene: Object3D) {
  if (prepared.has(scene)) return;
  prepared.add(scene);
  scene.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = Array.isArray(child.material)
        ? child.material.map(toLambert)
        : toLambert(child.material);
    }
  });
}

/** A fresh copy of a model (own skeleton, shared geometry and materials) plus its clips. */
export function useModel(key: ModelKey): { scene: Object3D; clips: AnimationClip[] } {
  const gltf = useGLTF(MODELS[key].url);
  prepare(gltf.scene);
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  return { scene, clips: gltf.animations };
}

export function preloadModel(key: ModelKey) {
  useGLTF.preload(MODELS[key].url);
}

/** Uniform scale and offset that seat a model on its footprint, centered, resting on the ground. */
export function modelTransform(visual: ModelVisual, footprint: { w: number; h: number }) {
  const entry = MODELS[visual.model];
  const size = [0, 1, 2].map((i) => (entry.max[i] ?? 0) - (entry.min[i] ?? 0)) as [
    number,
    number,
    number,
  ];
  const quarterTurn = Math.abs(Math.round((visual.rotY ?? 0) / (Math.PI / 2))) % 2 === 1;
  const sizeX = quarterTurn ? size[2] : size[0];
  const sizeZ = quarterTurn ? size[0] : size[2];
  const fit: Fit = visual.fit;
  let scale: number;
  if (fit.mode === "height") scale = fit.value / size[1];
  else if (fit.mode === "length") scale = fit.value / Math.max(size[0], size[2]);
  else {
    const margin = fit.margin ?? 0.9;
    scale = Math.min((footprint.w * margin) / sizeX, (footprint.h * margin) / sizeZ);
  }
  const center = [0, 2].map((i) => ((entry.min[i] ?? 0) + (entry.max[i] ?? 0)) / 2);
  return {
    scale,
    /** Applied inside the rotated group, in model space. */
    offset: [-(center[0] ?? 0) * scale, -entry.min[1] * scale, -(center[1] ?? 0) * scale] as [
      number,
      number,
      number,
    ],
    height: size[1] * scale,
  };
}
