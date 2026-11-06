import { fitZoom, type IsoView, screenToGround } from "./iso";

export const MAX_ZOOM = 130;

export function zoomLimits(farmSize: number, width: number, height: number) {
  const fit = fitZoom(farmSize, width, height, 4);
  return { min: Math.min(fit * 0.85, MAX_ZOOM), max: MAX_ZOOM, fit };
}

/** Keeps the camera target over (or just around) the farm. */
export function clampTarget(view: IsoView, farmSize: number, margin = 2): IsoView {
  const lo = -margin;
  const hi = farmSize + margin;
  return {
    ...view,
    targetX: Math.min(hi, Math.max(lo, view.targetX)),
    targetZ: Math.min(hi, Math.max(lo, view.targetZ)),
  };
}

/** Zooms by `factor` while keeping the ground point under (px, py) fixed on screen. */
export function zoomAt(
  view: IsoView,
  px: number,
  py: number,
  factor: number,
  limits: { min: number; max: number },
): IsoView {
  const zoom = Math.min(limits.max, Math.max(limits.min, view.zoom * factor));
  if (zoom === view.zoom) return view;
  const anchor = screenToGround(view, px, py);
  const ratio = view.zoom / zoom;
  return {
    ...view,
    zoom,
    targetX: anchor.x + (view.targetX - anchor.x) * ratio,
    targetZ: anchor.z + (view.targetZ - anchor.z) * ratio,
  };
}

/** Moves the target so the ground point `anchor` ends up under pixel (px, py) — exact drag-to-pan. */
export function panToAnchor(
  view: IsoView,
  anchor: { x: number; z: number },
  px: number,
  py: number,
): IsoView {
  const under = screenToGround(view, px, py);
  return {
    ...view,
    targetX: view.targetX + (anchor.x - under.x),
    targetZ: view.targetZ + (anchor.z - under.z),
  };
}
