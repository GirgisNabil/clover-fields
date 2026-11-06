"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect } from "react";
import { NeutralToneMapping, type OrthographicCamera } from "three";
import { footprint } from "@/domain";
import { FARMER_VISUAL, OBJECT_VISUALS } from "../assets/catalogVisuals";
import { VisualModels } from "../layers/ObjectLayer";
import { cameraPosition } from "../math/iso";
import { Lighting } from "../scene/Lighting";
import { installTestHooks } from "./testHooks";

const ENTRIES = [
  ...Object.entries(OBJECT_VISUALS).map(([defId, visual]) => ({
    defId,
    visual,
    size: footprint(defId, 0),
  })),
  { defId: "farmer", visual: FARMER_VISUAL, size: { w: 1, h: 1 } },
];

const COLS = 4;
const STEP = 5;
// Columns run screen-right (+x, -z), rows run screen-down (+x, +z).
const cell = (i: number): [number, number] => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return [(col + row) * STEP, (row - col) * STEP];
};

function GalleryCamera() {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  useLayoutEffect(() => {
    const rows = Math.ceil(ENTRIES.length / COLS);
    const cx = ((COLS - 1) / 2 + (rows - 1) / 2) * STEP;
    const cz = ((rows - 1) / 2 - (COLS - 1) / 2) * STEP;
    const [x, y, z] = cameraPosition(cx, cz, 120);
    camera.position.set(x, y, z);
    camera.lookAt(cx, 0, cz);
    camera.zoom = 48;
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function Ready() {
  useLayoutEffect(() => installTestHooks({ ready: true }), []);
  return null;
}

/** Dev-only: every CC0 model as it is sized on the farm, each on its footprint. */
export function ModelGallery() {
  return (
    <div className="fixed inset-0 bg-sky">
      <Canvas
        orthographic
        shadows="percentage"
        gl={{ antialias: true, toneMapping: NeutralToneMapping }}
        camera={{ zoom: 48, near: 0.1, far: 400, position: [60, 60, 60] }}
      >
        <color attach="background" args={["#9fd47e"]} />
        <GalleryCamera />
        <Lighting farmSize={40} />
        {ENTRIES.map((entry, i) => {
          const [x, z] = cell(i);
          return (
            <group key={entry.defId} position={[x, 0, z]}>
              <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} receiveShadow>
                <planeGeometry args={[entry.size.w, entry.size.h]} />
                <meshLambertMaterial color="#7cc35a" />
              </mesh>
              <Suspense fallback={null}>
                <VisualModels visual={entry.visual} footprint={entry.size} seed={i * 97} />
              </Suspense>
            </group>
          );
        })}
        <Suspense fallback={null}>
          <Ready />
        </Suspense>
      </Canvas>
    </div>
  );
}
