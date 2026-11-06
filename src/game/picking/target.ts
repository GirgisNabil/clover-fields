import { type FarmObject, type FarmState, footprint, objectAt, rectOf, type Tile } from "@/domain";
import { OBJECT_VISUALS } from "../assets/catalogVisuals";
import { objectModel } from "../assets/procedural/objects";
import { modelTransform } from "../assets/useModel";
import { type IsoView, screenToGround } from "../math/iso";
import { pickObject } from "./pick";

const heights = new Map<string, number>();

/** How tall an object is drawn, for picking. Plots stay flat so crops never block clicks. */
export function objectHeight(obj: FarmObject): number {
  if (obj.kind === "plot") return 0;
  const key = `${obj.kind}:${obj.defId}`;
  const cached = heights.get(key);
  if (cached !== undefined) return cached;
  const visual = OBJECT_VISUALS[obj.defId];
  const height = visual
    ? modelTransform(visual, footprint(obj.defId, 0)).height
    : (objectModel(obj.kind, obj.defId)?.height ?? 0.8);
  heights.set(key, height);
  return height;
}

/** The ground tile under a screen point. */
export function groundTile(view: IsoView, px: number, py: number): Tile {
  const g = screenToGround(view, px, py);
  return { x: Math.floor(g.x), y: Math.floor(g.z) };
}

/**
 * The tile a click means: the anchor tile of whatever object is drawn there (so a barn roof
 * selects the barn), or the ground tile when nothing tall is in the way.
 */
export function targetTile(view: IsoView, px: number, py: number, farm: FarmState): Tile {
  const hit = pickObject(view, px, py, (x, y) => {
    const obj = objectAt(farm, x, y);
    if (!obj || obj.kind === "plot") return null;
    return { id: obj.id, ...rectOf(obj), height: objectHeight(obj) };
  });
  return hit ? { x: hit.x, y: hit.y } : groundTile(view, px, py);
}
