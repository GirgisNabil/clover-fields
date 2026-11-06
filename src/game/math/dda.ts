import type { Tile } from "@/domain";

/**
 * Every grid tile a straight segment passes through, in order (Amanatides–Woo traversal).
 * Used to fill gaps when the pointer moves fast during a paint stroke.
 */
export function tilesAlong(x0: number, z0: number, x1: number, z1: number, maxTiles = 256): Tile[] {
  let tx = Math.floor(x0);
  let tz = Math.floor(z0);
  const endX = Math.floor(x1);
  const endZ = Math.floor(z1);
  const tiles: Tile[] = [{ x: tx, y: tz }];
  const dx = x1 - x0;
  const dz = z1 - z0;
  const stepX = Math.sign(dx);
  const stepZ = Math.sign(dz);
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = stepX > 0 ? (tx + 1 - x0) / dx : stepX < 0 ? (x0 - tx) / -dx : Infinity;
  let tMaxZ = stepZ > 0 ? (tz + 1 - z0) / dz : stepZ < 0 ? (z0 - tz) / -dz : Infinity;

  while ((tx !== endX || tz !== endZ) && tiles.length < maxTiles) {
    if (tMaxX < tMaxZ) {
      tx += stepX;
      tMaxX += tDeltaX;
    } else {
      tz += stepZ;
      tMaxZ += tDeltaZ;
    }
    tiles.push({ x: tx, y: tz });
  }
  return tiles;
}
