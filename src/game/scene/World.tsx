"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AnimalLayer } from "../animals/AnimalLayer";
import { CameraRig } from "../camera/CameraRig";
import { installTestHooks } from "../dev/testHooks";
import { Farmer } from "../farmer/Farmer";
import { VehiclePassFx } from "../fx/VehiclePassFx";
import { FieldLayer } from "../layers/FieldLayer";
import { ObjectLayer } from "../layers/ObjectLayer";
import { DriveGhost } from "../overlays/DriveGhost";
import { HelpMarkers } from "../overlays/HelpMarkers";
import { HoverCursor } from "../overlays/HoverCursor";
import { PlacementGhost } from "../overlays/PlacementGhost";
import { QueueMarkers } from "../overlays/QueueMarkers";
import { useGraphics } from "../quality/graphicsStore";
import { NpcLayer } from "../quests/NpcLayer";
import { PostFX } from "../render/PostFX";
import { useGame, viewFarm } from "../store/gameStore";
import { Ground } from "./Ground";
import { Lighting } from "./Lighting";
import { MOODS, useMood } from "./mood";
import { Scenery } from "./Scenery";
import { Weather } from "./Weather";

export function World() {
  const farmSize = useGame((s) => viewFarm(s).land.size);
  const quality = useGraphics((s) => s.quality);
  const visiting = useGame((s) => s.visit !== null);
  const mood = useMood();
  const preset = MOODS[mood ?? "default"];
  return (
    <>
      {quality === "high" && <PostFX />}
      <fog attach="fog" args={[preset.background, 125, 190]} />
      <color attach="background" args={[preset.background]} />
      <CameraRig />
      <Lighting farmSize={farmSize} preset={preset} />
      <Ground farmSize={farmSize} tint={preset.grass} />
      {mood && <Weather mood={mood} />}
      <Scenery farmSize={farmSize} />
      <FieldLayer />
      <ObjectLayer />
      <AnimalLayer />
      {visiting ? (
        <HelpMarkers />
      ) : (
        <>
          <NpcLayer />
          <Farmer />
          <QueueMarkers />
          <PlacementGhost />
          <DriveGhost />
          <VehiclePassFx />
        </>
      )}
      <HoverCursor />
      <ReadySignal />
    </>
  );
}

function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) installTestHooks({ ready: true });
  });
  return null;
}
