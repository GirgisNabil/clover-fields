"use client";

import { Canvas } from "@react-three/fiber";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { NeutralToneMapping } from "three";
import { startAudio } from "@/audio/bindings";
import {
  type FarmState,
  type FieldCommand,
  helpTargets,
  type InstantCommand,
  isWalkable,
  readyCount,
  walkableGrid,
  windowOf,
} from "@/domain";
import { Hud } from "@/hud/Hud";
import { applyUiScale, readUiScale } from "@/hud/SettingsDialog";
import {
  ContextLost,
  hasWebGL,
  LoadingScreen,
  NoWebGL,
  SaveBanner,
} from "@/hud/system/SystemScreens";
import { animalPosition } from "./animals/registry";
import { animalSpots } from "./animals/spots";
import { loadPlants } from "./assets/plants/library";
import { cameraStore, getView } from "./camera/cameraStore";
import { clock } from "./clock";
import { installTestHooks } from "./dev/testHooks";
import { farmer } from "./farmer/FarmerController";
import { announceCursor, installHotkeys, moveCursor } from "./input/hotkeys";
import { InputController } from "./input/InputController";
import { type IsoView, tileCenterToScreen, worldToScreen } from "./math/iso";
import { saveNow, startAutosave } from "./persistence/autosave";
import { loadOrCreateFarm } from "./persistence/saveStore";
import { groundTile } from "./picking/target";
import { World } from "./scene/World";
import { gameBus } from "./store/eventBus";
import { useGame } from "./store/gameStore";
import { type Tool, useUi } from "./store/uiStore";

/** The farmer starts on the walkable tile closest to just below the farm's center. */
function startingSpot(farm: FarmState): { x: number; z: number } {
  const grid = walkableGrid(farm);
  const cx = Math.floor(farm.land.size / 2);
  const cy = Math.floor(farm.land.size / 2) + 2;
  for (let r = 0; r < farm.land.size; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        const free =
          isWalkable(grid, x, y) &&
          !Object.values(farm.objects).some((o) => o.x === x && o.y === y);
        if (free) return { x: x + 0.5, z: y + 0.5 };
      }
    }
  }
  return { x: -0.5, z: -0.5 };
}

export function GameRoot() {
  const status = useGame((s) => s.status);
  const [webgl, setWebgl] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  // The splash stays until the farm is ready and the first frames have drawn.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setWebgl(hasWebGL());
    applyUiScale(readUiScale());
  }, []);
  useEffect(() => {
    if (status !== "ready") return;
    const timer = setTimeout(() => setShown(true), 600);
    return () => clearTimeout(timer);
  }, [status]);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let stopAutosave = () => {};
    void Promise.all([loadOrCreateFarm(clock.now()), loadPlants()]).then(async ([loaded]) => {
      if (cancelled) return;
      useGame.getState().hydrate(loaded.farm, loaded.rev);
      const spot = startingSpot(loaded.farm);
      farmer.placeAt(spot.x, spot.z);
      if (loaded.isNew) await saveNow();
      if (cancelled) return;
      stopAutosave = startAutosave();
      gameBus.emit({
        type: "loaded",
        isNew: loaded.isNew,
        ready: readyCount(loaded.farm, clock.now()),
      });
    });
    return () => {
      cancelled = true;
      stopAutosave();
    };
  }, []);

  useEffect(() => {
    if (status !== "ready" || !surface.current) return;
    const input = new InputController(surface.current);
    const stopHotkeys = installHotkeys();
    const stopAudio = startAudio();
    // Roaming animals settle once per visit window, so manure appears while you watch.
    const settleTimer = setInterval(() => {
      const store = useGame.getState();
      if (windowOf(clock.now()) > windowOf(store.farm.animals.settledAt)) {
        store.dispatch({ type: "settle" });
      }
    }, 1000);
    installTestHooks({
      getFarm: () => useGame.getState().farm,
      getQueue: () => useGame.getState().queue,
      enqueue: (cmd: FieldCommand) => useGame.getState().enqueue(cmd),
      dispatch: (cmd: InstantCommand) => useGame.getState().dispatch(cmd),
      flushQueue: () => {
        for (let guard = 0; guard < 500 && useGame.getState().queue.length > 0; guard++) {
          useGame.getState().performHead();
        }
        farmer.placeAt(farmer.x, farmer.z);
      },
      worldToScreen: (x: number, y: number, z: number) => {
        const p = worldToScreen(getView(), x, y, z);
        return { x: p.px, y: p.py };
      },
      groundTileAt: (px: number, py: number) => groundTile(getView(), px, py),
      tileToScreen: (x: number, y: number) => {
        const p = tileCenterToScreen(getView(), x, y);
        return { x: p.px, y: p.py };
      },
      clock: {
        now: () => clock.now(),
        advance: (ms: number) => clock.advance(ms),
        freeze: () => clock.freeze(),
      },
      setTool: (tool: Tool) => useUi.getState().setTool(tool),
      camera: () => getView(),
      setCamera: (view: Partial<IsoView>) => cameraStore.setState(view),
      visit: () => {
        const v = useGame.getState().visit;
        return v ? { npcId: v.npcId, targets: helpTargets(v.farm, clock.now()) } : null;
      },
      animals: () =>
        animalSpots(useGame.getState().farm, clock.now()).map((spot) => ({
          ...spot,
          live: animalPosition(spot.id) ?? null,
        })),
      setFarmerPaused: (paused: boolean) => {
        farmer.paused = paused;
      },
    });
    return () => {
      input.dispose();
      stopHotkeys();
      stopAudio();
      clearInterval(settleTimer);
    };
  }, [status]);

  return (
    <>
      <div
        ref={surface}
        role="application"
        aria-label="Clover Fields farm. Arrow keys move the tile cursor, Enter uses the current tool."
        // Focusable so the whole game can be played with a keyboard (see hotkeys.ts).
        // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" is the game's keyboard widget
        tabIndex={0}
        data-farm-surface
        onFocus={(event) => {
          // Only keyboard focus starts the tile cursor; a mouse click must not move the camera.
          if (!event.currentTarget.matches(":focus-visible")) return;
          if (!useUi.getState().cursor) moveCursor(0, 0);
          else announceCursor();
        }}
        className="fixed inset-0 touch-none select-none outline-none focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:ring-inset"
        onContextMenu={(event) => event.preventDefault()}
      >
        {status === "ready" && webgl && (
          <Canvas
            orthographic
            shadows="soft"
            dpr={[1, 2]}
            gl={{ antialias: true, toneMapping: NeutralToneMapping }}
            camera={{ zoom: 36, near: 0.1, far: 400, position: [60, 60, 60] }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", (event) => {
                event.preventDefault();
                setContextLost(true);
              });
            }}
          >
            <World />
          </Canvas>
        )}
      </div>
      {!webgl ? <NoWebGL /> : status === "ready" ? <Hud /> : null}
      <AnimatePresence>
        {webgl && !shown && <LoadingScreen done={status === "ready"} />}
      </AnimatePresence>
      {contextLost && <ContextLost />}
      <SaveBanner />
    </>
  );
}
