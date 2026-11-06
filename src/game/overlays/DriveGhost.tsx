"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { projectedState, validateCommand } from "@/domain";
import { clock } from "../clock";
import { driveArea } from "../input/placement";
import { useGame } from "../store/gameStore";
import { useUi } from "../store/uiStore";

const MAX = 16;
const OK = new Color("#6ac8ff");
const BAD = new Color("#ff5a4e");
const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const pos = new Vector3();
const scale = new Vector3(0.9, 0.9, 1);
const matrix = new Matrix4();

/** Outlines the area a vehicle pass (or a Fertilizer Sack) would cover: blue if it can go, red if not. */
export function DriveGhost() {
  const mesh = useRef<InstancedMesh>(null);
  const colors = useMemo(() => new Float32Array(MAX * 3).fill(1), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const { tool, hover, vehicleId, seedId } = useUi.getState();
    const fertilizing = tool === "fertilize" && hover !== null;
    const area = fertilizing
      ? { x: hover.x - 1, y: hover.y - 1, side: 3 }
      : tool === "drive" && hover
        ? driveArea(hover)
        : null;
    if (!area || (!fertilizing && !vehicleId) || !hover) {
      m.count = 0;
      return;
    }
    const farm = projectedState(useGame.getState().projection);
    const cmd = fertilizing
      ? ({ type: "fertilize", x: hover.x, y: hover.y } as const)
      : ({
          type: "drive",
          vehicleId: vehicleId ?? "o0",
          x: area.x,
          y: area.y,
          cropId: seedId,
        } as const);
    const ok = validateCommand(farm, cmd, { now: clock.now() }) === null;
    let i = 0;
    for (let y = area.y; y < area.y + area.side; y++) {
      for (let x = area.x; x < area.x + area.side; x++) {
        if (x < 0 || y < 0 || x >= farm.land.size || y >= farm.land.size || i >= MAX) continue;
        pos.set(x + 0.5, 0.15, y + 0.5);
        m.setMatrixAt(i, matrix.compose(pos, flat, scale));
        m.setColorAt(i, ok ? OK : BAD);
        i++;
      }
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, MAX]}
      count={0}
      frustumCulled={false}
      renderOrder={6}
    >
      <planeGeometry args={[1, 1]} />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      <meshBasicMaterial transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  );
}
