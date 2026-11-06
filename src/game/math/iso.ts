// Projection math for the fixed isometric camera (azimuth 45°, elevation 30°).
// World space is Y-up with the farm on the ground plane y = 0. Grid tile (x, y)
// covers world [x, x + 1) × [z, z + 1) where z is the grid y. With this camera a
// tile renders as an exact 2:1 diamond and larger x + z is nearer the viewer.

export type Vec3 = readonly [number, number, number];

const AZIMUTH = Math.PI / 4;
const ELEVATION = Math.PI / 6;

/** Unit vector from the camera target toward the camera. */
export const CAMERA_DIR: Vec3 = [
  Math.cos(ELEVATION) * Math.sin(AZIMUTH),
  Math.sin(ELEVATION),
  Math.cos(ELEVATION) * Math.cos(AZIMUTH),
];

/** World-space direction of screen right. */
export const SCREEN_RIGHT: Vec3 = [Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH)];

/** World-space direction of screen up. */
export const SCREEN_UP: Vec3 = [
  -Math.sin(ELEVATION) * Math.sin(AZIMUTH),
  Math.cos(ELEVATION),
  -Math.sin(ELEVATION) * Math.cos(AZIMUTH),
];

export interface IsoView {
  /** Camera target on the ground plane (world x). */
  targetX: number;
  /** Camera target on the ground plane (world z). */
  targetZ: number;
  /** CSS pixels per world unit. */
  zoom: number;
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
}

export interface ScreenPoint {
  px: number;
  py: number;
}

export interface GroundPoint {
  x: number;
  z: number;
}

const dot = (ax: number, ay: number, az: number, b: Vec3) => ax * b[0] + ay * b[1] + az * b[2];

export function worldToScreen(view: IsoView, x: number, y: number, z: number): ScreenPoint {
  const dx = x - view.targetX;
  const dz = z - view.targetZ;
  const u = dot(dx, y, dz, SCREEN_RIGHT);
  const v = dot(dx, y, dz, SCREEN_UP);
  return { px: view.width / 2 + u * view.zoom, py: view.height / 2 - v * view.zoom };
}

/** Point on the plane through the camera target that is seen at the given pixel. */
function viewPlanePoint(view: IsoView, px: number, py: number): [number, number, number] {
  const u = (px - view.width / 2) / view.zoom;
  const v = (view.height / 2 - py) / view.zoom;
  return [
    view.targetX + u * SCREEN_RIGHT[0] + v * SCREEN_UP[0],
    u * SCREEN_RIGHT[1] + v * SCREEN_UP[1],
    view.targetZ + u * SCREEN_RIGHT[2] + v * SCREEN_UP[2],
  ];
}

/** Where the view ray through a pixel meets the ground plane y = height. */
export function screenToGround(view: IsoView, px: number, py: number, height = 0): GroundPoint {
  const [qx, qy, qz] = viewPlanePoint(view, px, py);
  const t = (qy - height) / CAMERA_DIR[1];
  return { x: qx - t * CAMERA_DIR[0], z: qz - t * CAMERA_DIR[2] };
}

/** View ray through a pixel: starts `lift` units above the ground and points into the scene. */
export function screenRay(view: IsoView, px: number, py: number, lift = 50) {
  const ground = screenToGround(view, px, py);
  const origin: Vec3 = [
    ground.x + CAMERA_DIR[0] * (lift / CAMERA_DIR[1]),
    lift,
    ground.z + CAMERA_DIR[2] * (lift / CAMERA_DIR[1]),
  ];
  const dir: Vec3 = [-CAMERA_DIR[0], -CAMERA_DIR[1], -CAMERA_DIR[2]];
  return { origin, dir };
}

export function tileAtScreen(view: IsoView, px: number, py: number): { x: number; y: number } {
  const g = screenToGround(view, px, py);
  return { x: Math.floor(g.x), y: Math.floor(g.z) };
}

/** Screen position of a tile's center on the ground. */
export function tileCenterToScreen(view: IsoView, x: number, y: number): ScreenPoint {
  return worldToScreen(view, x + 0.5, 0, y + 0.5);
}

/** Camera position for a target, `distance` units back along the view direction. */
export function cameraPosition(targetX: number, targetZ: number, distance: number): Vec3 {
  return [
    targetX + CAMERA_DIR[0] * distance,
    CAMERA_DIR[1] * distance,
    targetZ + CAMERA_DIR[2] * distance,
  ];
}

/** On-screen size, in world units, of a size × size square farm (its diamond's bounding box). */
export function farmScreenExtent(size: number): { width: number; height: number } {
  return {
    width: size * (Math.abs(SCREEN_RIGHT[0]) + Math.abs(SCREEN_RIGHT[2])),
    height: size * (Math.abs(SCREEN_UP[0]) + Math.abs(SCREEN_UP[2])),
  };
}

/** Zoom that fits the whole farm diamond into the viewport with a margin in world units. */
export function fitZoom(size: number, width: number, height: number, margin = 2): number {
  const extent = farmScreenExtent(size);
  return Math.min(width / (extent.width + margin), height / (extent.height + margin));
}
