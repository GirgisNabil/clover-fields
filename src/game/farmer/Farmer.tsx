"use client";

import { useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import { type AnimationAction, type Group, MeshLambertMaterial } from "three";
import { FARMER_VISUAL } from "../assets/catalogVisuals";
import { modelTransform, useModel } from "../assets/useModel";
import { ModelBoundary } from "../render/ModelBoundary";
import { farmer } from "./FarmerController";

const mat = (color: string) => new MeshLambertMaterial({ color, flatShading: true });
const SKIN = mat("#f1c27d");
const SHIRT = mat("#d2453a");
const DENIM = mat("#3f6fb5");
const BOOT = mat("#5b3a22");
const STRAW = mat("#e8c35a");
const BAND = mat("#b5332a");
const HANDLE = mat("#8a5a33");
const METAL = mat("#9aa3ab");
const EYE = mat("#2b2b2b");

/** The player's farmer: the animated CC0 model, or a procedural stand-in while it loads. */
export function Farmer() {
  return (
    <ModelBoundary fallback={<ProceduralFarmer />}>
      <Suspense fallback={<ProceduralFarmer />}>
        <ModelFarmer />
      </Suspense>
    </ModelBoundary>
  );
}

const CLIP_FOR_STATE = { idle: "Idle", walk: "Walk", work: "Interact" } as const;

function ModelFarmer() {
  const { scene, clips } = useModel(FARMER_VISUAL.model);
  const transform = useMemo(() => modelTransform(FARMER_VISUAL, { w: 1, h: 1 }), []);
  const root = useRef<Group>(null);
  const rig = useRef<Group>(null);
  const { actions } = useAnimations(clips, rig);
  const current = useRef<AnimationAction | null>(null);

  useFrame((_, delta) => {
    farmer.update(Math.min(delta, 0.1));
    const r = root.current;
    if (!r) return;
    r.position.set(farmer.x, 0, farmer.z);
    r.rotation.y = -farmer.heading;
    const next = actions[CLIP_FOR_STATE[farmer.state]];
    if (next && next !== current.current) {
      next.reset().fadeIn(0.15).play();
      current.current?.fadeOut(0.15);
      current.current = next;
    }
    if (next && farmer.state === "walk") next.timeScale = 1.6;
    if (next && farmer.state === "work") next.timeScale = 1.8;
  });

  return (
    <group ref={root}>
      <group rotation-y={FARMER_VISUAL.rotY ?? 0}>
        <group ref={rig}>
          <primitive object={scene} scale={transform.scale} position={transform.offset} />
        </group>
      </group>
    </group>
  );
}

/** Procedural farmer: a small character built from boxes, used until the model loads. */
function ProceduralFarmer() {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const hoe = useRef<Group>(null);

  useFrame((_, delta) => {
    farmer.update(Math.min(delta, 0.1));
    const r = root.current;
    if (!r) return;
    r.position.set(farmer.x, 0, farmer.z);
    r.rotation.y = -farmer.heading;
    const walking = farmer.state === "walk";
    const working = farmer.state === "work";
    const phase = farmer.stride * 7;
    const swing = walking ? Math.sin(phase) * 0.7 : 0;
    if (legL.current) legL.current.rotation.z = swing;
    if (legR.current) legR.current.rotation.z = -swing;
    if (armL.current) armL.current.rotation.z = -swing * 0.8;
    if (body.current) {
      body.current.position.y = walking ? Math.abs(Math.sin(phase)) * 0.03 : 0;
      body.current.rotation.z = working ? -Math.sin(farmer.work * Math.PI) * 0.25 : 0;
    }
    if (armR.current) {
      // Raise the hoe, then strike down on the beat where the command applies.
      const strike = working ? Math.sin(Math.min(1, farmer.work * 1.4) * Math.PI) * 2.4 : 0;
      armR.current.rotation.z = working ? strike - 0.6 : swing * 0.8;
    }
    if (hoe.current) hoe.current.visible = working;
  });

  return (
    <group ref={root} scale={1.15}>
      <group ref={body}>
        {[legL, legR].map((ref, i) => (
          <group
            key={ref === legL ? "l" : "r"}
            ref={ref}
            position={[0, 0.28, i === 0 ? -0.055 : 0.055]}
          >
            <mesh position={[0, -0.13, 0]} material={DENIM} castShadow>
              <boxGeometry args={[0.08, 0.26, 0.08]} />
            </mesh>
            <mesh position={[0.02, -0.265, 0]} material={BOOT} castShadow>
              <boxGeometry args={[0.12, 0.04, 0.09]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.41, 0]} material={SHIRT} castShadow>
          <boxGeometry args={[0.16, 0.26, 0.24]} />
        </mesh>
        <mesh position={[0.012, 0.36, 0]} material={DENIM} castShadow>
          <boxGeometry args={[0.16, 0.16, 0.25]} />
        </mesh>
        <group ref={armL} position={[0, 0.52, -0.15]}>
          <mesh position={[0, -0.1, 0]} material={SHIRT} castShadow>
            <boxGeometry args={[0.07, 0.2, 0.07]} />
          </mesh>
          <mesh position={[0, -0.22, 0]} material={SKIN}>
            <boxGeometry args={[0.06, 0.05, 0.06]} />
          </mesh>
        </group>
        <group ref={armR} position={[0, 0.52, 0.15]}>
          <mesh position={[0, -0.1, 0]} material={SHIRT} castShadow>
            <boxGeometry args={[0.07, 0.2, 0.07]} />
          </mesh>
          <mesh position={[0, -0.22, 0]} material={SKIN}>
            <boxGeometry args={[0.06, 0.05, 0.06]} />
          </mesh>
          <group ref={hoe} position={[0, -0.23, 0]} visible={false}>
            <mesh position={[0.16, 0, 0]} rotation-z={Math.PI / 2} material={HANDLE} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.42, 5]} />
            </mesh>
            <mesh position={[0.36, -0.05, 0]} material={METAL} castShadow>
              <boxGeometry args={[0.03, 0.11, 0.12]} />
            </mesh>
          </group>
        </group>
        <mesh position={[0, 0.65, 0]} material={SKIN} castShadow>
          <icosahedronGeometry args={[0.105, 1]} />
        </mesh>
        {[-0.035, 0.035].map((z) => (
          <mesh key={z} position={[0.095, 0.67, z]} material={EYE}>
            <boxGeometry args={[0.012, 0.022, 0.016]} />
          </mesh>
        ))}
        <mesh position={[0, 0.735, 0]} material={STRAW} castShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.02, 12]} />
        </mesh>
        <mesh position={[0, 0.79, 0]} material={STRAW} castShadow>
          <cylinderGeometry args={[0.085, 0.1, 0.1, 10]} />
        </mesh>
        <mesh position={[0, 0.755, 0]} material={BAND}>
          <cylinderGeometry args={[0.102, 0.102, 0.025, 10]} />
        </mesh>
      </group>
    </group>
  );
}
