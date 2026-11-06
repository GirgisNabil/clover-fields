import {
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Vec3Tuple = [number, number, number];

export interface PartOptions {
  at?: Vec3Tuple;
  rot?: Vec3Tuple;
  /** Euler order for `rot`; "YXZ" means tilt (x) first, then turn (y). */
  order?: "XYZ" | "YXZ";
  scale?: number | Vec3Tuple;
}

const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpEuler = new Euler();
const tmpPos = new Vector3();
const tmpScale = new Vector3();

/**
 * Merges primitive shapes into one vertex-colored, non-indexed geometry, so a whole model
 * renders in a single draw call (and instances cheaply). Pair with a flat-shaded
 * `vertexColors` material for the low-poly look.
 */
export class MeshBuilder {
  private parts: BufferGeometry[] = [];

  add(geometry: BufferGeometry, color: string | Color, options: PartOptions = {}): this {
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    part.deleteAttribute("uv");
    const { at = [0, 0, 0], rot = [0, 0, 0], order = "XYZ", scale = 1 } = options;
    tmpPos.set(...at);
    tmpQuat.setFromEuler(tmpEuler.set(rot[0], rot[1], rot[2], order));
    if (typeof scale === "number") tmpScale.setScalar(scale);
    else tmpScale.set(...scale);
    part.applyMatrix4(tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
    const c = color instanceof Color ? color : new Color(color);
    const count = part.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    part.setAttribute("color", new Float32BufferAttribute(colors, 3));
    this.parts.push(part);
    return this;
  }

  /**
   * Adds one raw triangle with a color per corner. Normals point straight up, which lights
   * thin foliage like the ground it grows from (no dark backfaces).
   */
  addTriangle(positions: number[], colors: [string, string, string]): this {
    const part = new BufferGeometry();
    part.setAttribute("position", new Float32BufferAttribute(positions, 3));
    part.setAttribute("normal", new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    const rgb = colors.flatMap((c) => new Color(c).toArray());
    part.setAttribute("color", new Float32BufferAttribute(rgb, 3));
    this.parts.push(part);
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const part of this.parts) part.dispose();
    this.parts = [];
    if (!merged) throw new Error("MeshBuilder: parts could not be merged");
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Small deterministic PRNG (mulberry32) so procedural models look the same every load. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stringSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Mixes two colors; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): Color {
  return new Color(a).lerp(new Color(b), t);
}

export function shade(color: string, amount: number): Color {
  const c = new Color(color);
  return amount >= 0 ? c.lerp(new Color("#ffffff"), amount) : c.lerp(new Color("#000000"), -amount);
}
