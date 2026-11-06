"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { NeutralToneMapping, type OrthographicCamera } from "three";
import { CROPS } from "@/domain";
import { bakedCropGeometry } from "../assets/plants/cropLooks";
import { loadPlants } from "../assets/plants/library";
import { buildCropGeometry, type CropVisual } from "../assets/procedural/crops";
import { buildPlowedSoil, SOIL_TOP } from "../assets/procedural/soil";
import { cameraPosition } from "../math/iso";
import { flatMaterial, witheredMaterial } from "../render/materials";
import { Lighting } from "../scene/Lighting";
import { installTestHooks } from "./testHooks";

const COLUMNS: Array<CropVisual | "withered"> = [0, 1, 2, 3, "ripe", "withered"];

// Lay cells out along the screen axes: columns run screen-right (+x, -z), rows run screen-down (+x, +z).
const STEP = 1.6;
const cellPosition = (row: number, col: number): [number, number] => [
  (col + row) * STEP,
  (row - col) * STEP,
];

function GalleryCamera({ rows }: { rows: number }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  useLayoutEffect(() => {
    const [cx, cz] = cellPosition((rows - 1) / 2, (COLUMNS.length - 1) / 2);
    const [x, y, z] = cameraPosition(cx, cz, 120);
    camera.position.set(x, y, z);
    camera.lookAt(cx, 0, cz);
    camera.zoom = 55;
    camera.updateProjectionMatrix();
    installTestHooks({ ready: true });
  }, [camera, rows]);
  return null;
}

/** Dev-only: every crop at every growth stage, for checking crop models. */
export function CropGallery() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void loadPlants().then(() => setLoaded(true));
  }, []);
  return loaded ? <Gallery /> : null;
}

function Gallery() {
  const soil = useMemo(() => buildPlowedSoil(), []);
  const cells = useMemo(
    () =>
      CROPS.flatMap((crop, row) =>
        COLUMNS.map((column, col) => ({
          key: `${crop.id}:${column}`,
          x: cellPosition(row, col)[0],
          z: cellPosition(row, col)[1],
          withered: column === "withered",
          geometry:
            bakedCropGeometry(crop.id, column === "withered" ? 3 : column) ??
            buildCropGeometry(crop, column === "withered" ? 3 : column),
        })),
      ),
    [],
  );

  return (
    <div className="fixed inset-0 bg-sky">
      <Canvas
        orthographic
        shadows="percentage"
        gl={{ antialias: true, toneMapping: NeutralToneMapping }}
        camera={{ zoom: 34, near: 0.1, far: 400, position: [60, 60, 60] }}
      >
        <color attach="background" args={["#9fd47e"]} />
        <GalleryCamera rows={CROPS.length} />
        <Lighting farmSize={CROPS.length * STEP * 2} />
        {cells.map((cell) => (
          <group key={cell.key} position={[cell.x, 0, cell.z]}>
            <mesh geometry={soil} material={flatMaterial} receiveShadow />
            <mesh
              geometry={cell.geometry}
              material={cell.withered ? witheredMaterial : flatMaterial}
              position={[0, SOIL_TOP, 0]}
              scale={[1.16, cell.withered ? 0.8 : 1.16, 1.16]}
              castShadow
            />
          </group>
        ))}
      </Canvas>
    </div>
  );
}
