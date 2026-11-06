"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  Euler,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import type { Mood } from "@/domain";
import { getView } from "../camera/cameraStore";
import { useGraphics } from "../quality/graphicsStore";
import { prefersReducedMotion } from "./mood";

interface Style {
  colors: string[];
  size: number;
  fall: number;
  drift: number;
  spin: number;
  /** Fireflies float upward and glow instead of falling. */
  rise?: boolean;
}

const STYLES: Record<Mood, Style> = {
  autumn: {
    colors: ["#e8762b", "#c9452c", "#f2b134", "#a8531f"],
    size: 0.14,
    fall: 0.6,
    drift: 0.5,
    spin: 2.2,
  },
  winter: { colors: ["#ffffff", "#eef6ff"], size: 0.07, fall: 0.45, drift: 0.25, spin: 0.4 },
  spring: {
    colors: ["#ffc4dd", "#ffe3ee", "#ff9fc4"],
    size: 0.1,
    fall: 0.35,
    drift: 0.6,
    spin: 1.6,
  },
  summer: {
    colors: ["#fff3a8", "#ffe066"],
    size: 0.06,
    fall: -0.12,
    drift: 0.3,
    spin: 0,
    rise: true,
  },
};

const AREA = 26;
const TOP = 9;

/** Seasonal weather: leaves, snow, petals or summer motes drifting around the camera's view. */
export function Weather({ mood }: { mood: Mood }) {
  const quality = useGraphics((s) => s.quality);
  const count = quality === "high" ? 260 : 90;
  const style = STYLES[mood];
  const mesh = useRef<InstancedMesh>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const geometry = useMemo(() => new PlaneGeometry(1, mood === "autumn" ? 0.7 : 1), [mood]);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        side: DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * AREA,
        y: Math.random() * TOP,
        z: (Math.random() - 0.5) * AREA,
        phase: Math.random() * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.6,
        color: new Color(style.colors[i % style.colors.length]),
      })),
    [count, style],
  );
  const m = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const e = useMemo(() => new Euler(), []);
  const p = useMemo(() => new Vector3(), []);
  const s = useMemo(() => new Vector3(), []);

  useFrame((state, dt) => {
    const inst = mesh.current;
    if (!inst) return;
    const view = getView();
    const t = state.clock.elapsedTime;
    particles.forEach((pt, i) => {
      pt.y -= style.fall * pt.speed * Math.min(dt, 0.05);
      if (pt.y < 0) pt.y += TOP;
      if (pt.y > TOP) pt.y -= TOP;
      const sway = Math.sin(t * pt.speed + pt.phase) * style.drift;
      p.set(
        view.targetX + pt.x + sway,
        pt.y,
        view.targetZ + pt.z + Math.cos(t * 0.7 + pt.phase) * style.drift,
      );
      e.set(t * style.spin + pt.phase, t * style.spin * 0.6, pt.phase);
      q.setFromEuler(e);
      const size = style.rise
        ? style.size * (0.6 + 0.4 * Math.abs(Math.sin(t * 2 + pt.phase)))
        : style.size;
      s.set(size, size, size);
      inst.setMatrixAt(i, m.compose(p, q, s));
      inst.setColorAt(i, pt.color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  if (reduced) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
      renderOrder={5}
      userData={{ noAO: true }}
    />
  );
}
