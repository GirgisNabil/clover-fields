import { getView } from "../camera/cameraStore";
import { worldToScreen } from "../math/iso";

/** Where each drawn animal is right now (render space), for clicks and tooltips. */
interface Live {
  x: number;
  z: number;
  height: number;
  visible: boolean;
}

const live = new Map<string, Live>();

export function trackAnimal(id: string, state: Live) {
  live.set(id, state);
}

export function untrackAnimal(id: string) {
  live.delete(id);
}

export function animalPosition(id: string): Live | undefined {
  return live.get(id);
}

/**
 * The animal drawn under a screen point, if any: the closest one whose body (a vertical capsule
 * from its feet to its height) covers the point. Nearer-to-camera animals win ties.
 */
export function pickAnimal(px: number, py: number): string | null {
  const view = getView();
  let best: { id: string; score: number } | null = null;
  for (const [id, a] of live) {
    if (!a.visible) continue;
    const foot = worldToScreen(view, a.x, 0, a.z);
    const top = worldToScreen(view, a.x, a.height, a.z);
    const radius = Math.max(10, Math.abs(foot.py - top.py) * 0.55);
    const cx = foot.px;
    const minY = Math.min(top.py, foot.py) - radius * 0.2;
    const maxY = Math.max(top.py, foot.py) + radius * 0.2;
    const dx = Math.abs(px - cx);
    if (dx > radius || py < minY || py > maxY) continue;
    // Prefer the animal nearest the camera (lowest on screen), then the closest center.
    const score = -foot.py + dx * 0.1;
    if (!best || score < best.score) best = { id, score };
  }
  return best?.id ?? null;
}

/** A visible animal standing on a tile (keyboard play). */
export function animalOnTile(tile: { x: number; y: number }): string | null {
  for (const [id, a] of live) {
    if (
      a.visible &&
      !id.startsWith("npc:") &&
      Math.floor(a.x) === tile.x &&
      Math.floor(a.z) === tile.y
    ) {
      return id;
    }
  }
  return null;
}
