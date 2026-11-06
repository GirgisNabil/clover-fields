import { createStore } from "zustand/vanilla";
import type { IsoView } from "../math/iso";

/** Camera state lives outside React so DOM overlays and input code can project points cheaply. */
export const cameraStore = createStore<IsoView>(() => ({
  targetX: 6,
  targetZ: 6,
  zoom: 36,
  width: 1,
  height: 1,
}));

export const getView = (): IsoView => cameraStore.getState();
