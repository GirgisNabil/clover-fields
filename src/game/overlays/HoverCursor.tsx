"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { type Group, MeshBasicMaterial } from "three";
import { useGame, viewFarm } from "../store/gameStore";
import { useUi } from "../store/uiStore";

const EDGE = 0.06;

const SIDES: Array<[number, number, number, number]> = [
  [0, -0.5 + EDGE / 2, 1, EDGE],
  [0, 0.5 - EDGE / 2, 1, EDGE],
  [-0.5 + EDGE / 2, 0, EDGE, 1 - 2 * EDGE],
  [0.5 - EDGE / 2, 0, EDGE, 1 - 2 * EDGE],
];

/** A glowing outline on the tile under the pointer. */
export function HoverCursor() {
  const group = useRef<Group>(null);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: "#fffbe6", transparent: true, depthWrite: false }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock: frameClock }) => {
    const g = group.current;
    if (!g) return;
    const hover = useUi.getState().hover;
    const size = viewFarm(useGame.getState()).land.size;
    const visible =
      hover !== null && hover.x >= 0 && hover.y >= 0 && hover.x < size && hover.y < size;
    g.visible = visible;
    if (!visible || !hover) return;
    g.position.set(hover.x + 0.5, 0.012, hover.y + 0.5);
    material.opacity = 0.75 + Math.sin(frameClock.elapsedTime * 5) * 0.2;
  });

  return (
    <group ref={group} visible={false}>
      {SIDES.map(([x, z, w, d]) => (
        <mesh
          key={`${x}:${z}`}
          position={[x, 0.11, z]}
          rotation-x={-Math.PI / 2}
          material={material}
          renderOrder={5}
        >
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
    </group>
  );
}
