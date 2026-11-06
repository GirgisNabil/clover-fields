"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import type { OrthographicCamera } from "three";
import { clampTarget, zoomLimits } from "../math/cameraMath";
import { cameraPosition } from "../math/iso";
import { useGame, viewFarm } from "../store/gameStore";
import { cameraStore } from "./cameraStore";

const CAMERA_DISTANCE = 120;

/** Drives the orthographic camera from cameraStore; fits the farm on first load. */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const farmSize = useGame((s) => viewFarm(s).land.size);
  const fitted = useRef(false);

  useLayoutEffect(() => {
    const limits = zoomLimits(farmSize, width, height);
    if (!fitted.current) {
      fitted.current = true;
      cameraStore.setState({
        targetX: farmSize / 2,
        targetZ: farmSize / 2,
        // Phones start closer in; pinch out to see the whole farm.
        zoom: Math.min(limits.max, limits.fit * (width < 640 ? 1.5 : 1)),
        width,
        height,
      });
      return;
    }
    const view = cameraStore.getState();
    const zoom = Math.min(limits.max, Math.max(limits.min, view.zoom));
    cameraStore.setState(clampTarget({ ...view, zoom, width, height }, farmSize));
  }, [farmSize, width, height]);

  useFrame(() => {
    const view = cameraStore.getState();
    const [x, y, z] = cameraPosition(view.targetX, view.targetZ, CAMERA_DISTANCE);
    camera.position.set(x, y, z);
    camera.lookAt(view.targetX, 0, view.targetZ);
    if (camera.zoom !== view.zoom) {
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
    }
  }, -1);

  return null;
}
