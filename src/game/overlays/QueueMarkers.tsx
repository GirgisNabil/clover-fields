"use client";

import { useEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { getVehicle, MAX_QUEUE } from "@/domain";
import { useGame } from "../store/gameStore";

const COLORS = {
  plow: new Color("#c9853f"),
  plant: new Color("#7dd35a"),
  harvest: new Color("#ffd23f"),
  drive: new Color("#6ac8ff"),
  collectAnimal: new Color("#ffd23f"),
} as const;

const matrix = new Matrix4();
const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const pos = new Vector3();
const areaScale = new Vector3(0.84, 0.84, 1);

/** Soft colored squares on every tile with queued work, so you can see what the farmer will do. */
export function QueueMarkers() {
  const mesh = useRef<InstancedMesh>(null);
  const colors = useMemo(() => new Float32Array(MAX_QUEUE * 3).fill(1), []);

  useEffect(() => {
    const update = (queue: ReturnType<typeof useGame.getState>["queue"]) => {
      const m = mesh.current;
      if (!m) return;
      queue.forEach((entry, i) => {
        // A vehicle pass highlights its whole area.
        let side = 1;
        if (entry.cmd.type === "drive") {
          const vehicle = useGame.getState().farm.objects[entry.cmd.vehicleId];
          if (vehicle?.kind === "vehicle")
            side = getVehicle(vehicle.defId)?.area[vehicle.tier - 1] ?? 2;
        }
        pos.set(entry.cmd.x + side / 2, 0.13, entry.cmd.y + side / 2);
        matrix.compose(pos, flat, areaScale.set(0.84 * side, 0.84 * side, 1));
        m.setMatrixAt(i, matrix);
        m.setColorAt(i, COLORS[entry.cmd.type]);
      });
      m.count = queue.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    update(useGame.getState().queue);
    return useGame.subscribe((s) => s.queue, update);
  }, []);

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, MAX_QUEUE]}
      count={0}
      frustumCulled={false}
      renderOrder={4}
    >
      <planeGeometry args={[1, 1]} />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      <meshBasicMaterial transparent opacity={0.42} depthWrite={false} />
    </instancedMesh>
  );
}
