import { tilesAlong } from "../math/dda";
import { CAMERA_DIR, type IsoView, screenToGround } from "../math/iso";

/** An object's pickable box: its footprint on the ground, `height` tall. */
export interface PickBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
}

/** Does the view ray, from ground point (gx, gz) back toward the camera, pass through the box? */
function rayHitsBox(gx: number, gz: number, box: PickBox, maxT: number): boolean {
  // Ray: P(t) = g + CAMERA_DIR * t, t in [0, maxT]. Slab test on x, y and z.
  let t0 = 0;
  let t1 = maxT;
  const slabs: Array<[number, number, number, number]> = [
    [gx, CAMERA_DIR[0], box.x, box.x + box.w],
    [0, CAMERA_DIR[1], 0, box.height],
    [gz, CAMERA_DIR[2], box.y, box.y + box.h],
  ];
  for (const [origin, dir, lo, hi] of slabs) {
    if (Math.abs(dir) < 1e-9) {
      if (origin < lo || origin > hi) return false;
      continue;
    }
    let a = (lo - origin) / dir;
    let b = (hi - origin) / dir;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * The object drawn at a screen point, nearest the camera first, so clicking a barn roof picks the
 * barn rather than the tile behind it. Returns null when only ground is under the pointer.
 */
export function pickObject(
  view: IsoView,
  px: number,
  py: number,
  boxAt: (x: number, y: number) => PickBox | null,
  maxHeight = 3,
): PickBox | null {
  const g = screenToGround(view, px, py);
  const maxT = maxHeight / CAMERA_DIR[1];
  const topX = g.x + CAMERA_DIR[0] * maxT;
  const topZ = g.z + CAMERA_DIR[2] * maxT;
  const seen = new Set<string>();
  // Tiles where the ray is high up come first; those are nearer the camera.
  for (const tile of tilesAlong(topX, topZ, g.x, g.z)) {
    const box = boxAt(tile.x, tile.y);
    if (!box || seen.has(box.id)) continue;
    seen.add(box.id);
    if (rayHitsBox(g.x, g.z, box, maxT)) return box;
  }
  return null;
}
