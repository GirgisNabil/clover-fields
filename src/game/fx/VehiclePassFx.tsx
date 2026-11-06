"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { Tile } from "@/domain";
import { OBJECT_VISUALS } from "../assets/catalogVisuals";
import { objectModel } from "../assets/procedural/objects";
import { VisualModels } from "../layers/ObjectLayer";
import { ModelBoundary } from "../render/ModelBoundary";
import { flatMaterial } from "../render/materials";
import { gameBus } from "../store/eventBus";
import { useGame } from "../store/gameStore";

interface Pass {
  key: number;
  defId: string;
  tiles: Tile[];
}

const TILES_PER_SECOND = 5;
const FOOTPRINT = { w: 2, h: 2 };

/** A vehicle drives across the tiles it just worked. */
function DrivingVehicle({ pass, onDone }: { pass: Pass; onDone: () => void }) {
  const group = useRef<Group>(null);
  const started = useRef<number | null>(null);
  const model = objectModel("vehicle", pass.defId);

  useFrame(({ clock: frameClock }) => {
    const g = group.current;
    if (!g) return;
    started.current ??= frameClock.elapsedTime;
    const t = (frameClock.elapsedTime - started.current) * TILES_PER_SECOND;
    const last = pass.tiles.length - 1;
    if (t > last + 1) {
      onDone();
      return;
    }
    const i = Math.min(last, Math.floor(t));
    const a = pass.tiles[i];
    const b = pass.tiles[Math.min(last, i + 1)] ?? a;
    if (!a || !b) return;
    const f = Math.min(1, t - i);
    g.position.set(
      a.x + 0.5 + (b.x - a.x) * f,
      0.05 + Math.abs(Math.sin(t * 9)) * 0.03,
      a.y + 0.5 + (b.y - a.y) * f,
    );
    if (b.x !== a.x || b.y !== a.y) g.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  });

  const visual = OBJECT_VISUALS[pass.defId];
  const fallback = model ? (
    <mesh geometry={model.geometry} material={flatMaterial} castShadow />
  ) : null;
  return (
    <group ref={group} scale={0.55}>
      {visual ? (
        <ModelBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <VisualModels visual={visual} footprint={FOOTPRINT} seed={pass.key} />
          </Suspense>
        </ModelBoundary>
      ) : (
        fallback
      )}
    </group>
  );
}

/** Plays a short drive across the worked tiles whenever a vehicle pass completes. */
export function VehiclePassFx() {
  const [passes, setPasses] = useState<Pass[]>([]);
  const next = useRef(0);

  useEffect(
    () =>
      gameBus.on((signal) => {
        if (signal.type !== "events") return;
        for (const event of signal.events) {
          if (event.t !== "vehiclePass" || event.tiles.length === 0) continue;
          const vehicle = useGame.getState().farm.objects[event.vehicleId];
          if (vehicle?.kind !== "vehicle") continue;
          next.current += 1;
          const pass = { key: next.current, defId: vehicle.defId, tiles: event.tiles };
          setPasses((list) => [...list, pass]);
        }
      }),
    [],
  );

  return (
    <>
      {passes.map((pass) => (
        <DrivingVehicle
          key={pass.key}
          pass={pass}
          onDone={() => setPasses((list) => list.filter((p) => p.key !== pass.key))}
        />
      ))}
    </>
  );
}
