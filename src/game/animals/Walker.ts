import { type FarmState, hash32, type Tile, walkableGrid } from "@/domain";
import { findPath, smoothPath } from "../farmer/astar";
import type { AnimalSpot } from "./spots";

const STEP_EVERY = [2.5, 6] as const; // seconds between idle shuffles

/**
 * Cosmetic movement for one animal: when its visit tile changes it walks there on an A* path
 * (and walks home at dusk), then shuffles about the tile. The rules never read this.
 */
export class Walker {
  x: number;
  z: number;
  heading: number;
  moving = false;
  /** True once a housed animal has walked home for the night (it is then drawn inside). */
  indoors = false;
  private path: Array<{ x: number; z: number }> = [];
  private key = "";
  private idleIn = 0;
  private seq = 0;

  constructor(
    private readonly id: string,
    spot: AnimalSpot,
    private readonly speed: number,
  ) {
    const p = this.spotPoint(spot.tile, 0);
    this.x = p.x;
    this.z = p.z;
    this.heading = (hash32("face", id) % 628) / 100;
    this.key = keyOf(spot);
    this.indoors = spot.housed && spot.resting;
  }

  /** A stable point inside a tile, so animals sharing it don't stack. */
  private spotPoint(tile: Tile, salt: number) {
    const h = hash32("spot", this.id, tile.x, tile.y, salt);
    return {
      x: tile.x + 0.5 + ((h & 0xff) / 255 - 0.5) * 0.5,
      z: tile.y + 0.5 + (((h >> 8) & 0xff) / 255 - 0.5) * 0.5,
    };
  }

  update(dt: number, farm: FarmState, spot: AnimalSpot) {
    const key = keyOf(spot);
    if (key !== this.key) {
      this.key = key;
      this.indoors = false;
      this.plan(farm, spot.tile);
    } else if (this.path.length === 0) {
      if (spot.housed && spot.resting) this.indoors = true;
      else if (spot.roams && !spot.resting) {
        this.idleIn -= dt;
        if (this.idleIn <= 0) {
          this.seq++;
          const h = hash32("idle", this.id, this.seq);
          this.idleIn = STEP_EVERY[0] + ((h % 1000) / 1000) * (STEP_EVERY[1] - STEP_EVERY[0]);
          this.path = [this.spotPoint(spot.tile, this.seq)];
        }
      }
    }
    this.walk(dt * this.speed * (this.path.length > 1 ? 1 : 0.6));
  }

  private plan(farm: FarmState, tile: Tile) {
    const grid = walkableGrid(farm);
    const start = { x: Math.floor(this.x), y: Math.floor(this.z) };
    const tiles = findPath(grid, start, [tile]);
    const end = this.spotPoint(tile, 0);
    if (!tiles || tiles.length === 0) {
      this.path = [end];
      return;
    }
    const points = smoothPath(grid, tiles).map((t) => ({ x: t.x + 0.5, z: t.y + 0.5 }));
    points.shift();
    points.pop();
    this.path = [...points, end];
  }

  private walk(distance: number) {
    let left = distance;
    this.moving = this.path.length > 0;
    while (left > 0 && this.path.length > 0) {
      const next = this.path[0];
      if (!next) break;
      const dx = next.x - this.x;
      const dz = next.z - this.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-3) {
        const target = Math.atan2(dx, dz);
        let diff = target - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.heading += diff * Math.min(1, 0.25);
      }
      if (len <= left) {
        this.x = next.x;
        this.z = next.z;
        left -= len;
        this.path.shift();
      } else {
        this.x += (dx / len) * left;
        this.z += (dz / len) * left;
        left = 0;
      }
    }
  }
}

const keyOf = (spot: AnimalSpot) => `${spot.tile.x},${spot.tile.y}:${spot.resting ? 1 : 0}`;
