import {
  animalSpot,
  approachTiles,
  type FieldCommand,
  isWalkableObject,
  objectAt,
  rectOf,
  type Tile,
  validateCommand,
  walkableGrid,
} from "@/domain";
import { clock, DEV_TOOLS } from "../clock";
import { useGame } from "../store/gameStore";
import { findPath, smoothPath } from "./astar";

export type FarmerState = "idle" | "walk" | "work";

interface Job {
  qid: string;
  /** Point the farmer turns to face while working. */
  face: { x: number; z: number };
}

const BASE_SPEED = 2.6; // tiles per second
const BASE_WORK = 0.55; // seconds
const STOP_SHORT = 0.42; // how far from a walkable target's center the farmer stops

/**
 * Walks the farmer through the action queue: plan a path to the head job, walk it,
 * play the work animation, and apply the command partway through the swing.
 * Plain class ticked from useFrame, so no React renders happen per frame.
 */
export class FarmerController {
  x = 6.5;
  z = 8.5;
  heading = Math.PI * 0.75;
  state: FarmerState = "idle";
  /** Test hook: a paused farmer stands still and leaves the queue alone. */
  paused = false;
  /** 0–1 progress through the current work swing. */
  work = 0;
  /** Accumulates while walking; drives the leg swing. */
  stride = 0;
  private path: { x: number; z: number }[] = [];
  private job: Job | null = null;
  private applied = false;

  update(dt: number): void {
    const store = useGame.getState();
    // While you visit a neighbour your farmer waits at home; the queue resumes when you return.
    if (store.status !== "ready" || this.paused || store.visit) return;
    const head = store.queue[0];
    // The queue moved on without us (cancelled, or the head was dropped): stop and re-plan.
    if (this.job && head?.qid !== this.job.qid) this.reset();
    if (this.state === "idle") {
      if (!head) return;
      this.startJob(head.qid, head.cmd);
    }
    // Vehicle jobs are quick: the farmer hurries over and the pass itself is animated separately.
    const driving = store.queue[0]?.cmd.type === "drive";
    const hurry = (1 + Math.min(store.queue.length / 10, 1)) * (driving ? 2.5 : 1);
    if (this.state === "walk") this.walk(dt * BASE_SPEED * hurry);
    if (this.state === "work") this.doWork(dt / (BASE_WORK / hurry));
  }

  /** Puts the farmer next to the farm's center (used on load). */
  placeAt(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.reset();
  }

  private reset() {
    this.state = "idle";
    this.job = null;
    this.path = [];
    this.work = 0;
    this.applied = false;
  }

  private startJob(qid: string, cmd: FieldCommand) {
    const store = useGame.getState();
    const farm = store.farm;
    // Something changed since this was queued; let the store reject it straight away.
    if (validateCommand(farm, cmd, { now: clock.now(), dev: DEV_TOOLS })) {
      store.performHead();
      return;
    }
    // A roaming animal may have wandered since it was queued: walk to where it is now.
    const spot = cmd.type === "collectAnimal" ? animalSpot(farm, cmd.id, clock.now()) : null;
    const target: Tile = spot ? spot.tile : { x: cmd.x, y: cmd.y };
    const obj = objectAt(farm, target.x, target.y);
    const grid = walkableGrid(farm);
    const blocked = obj !== null && !isWalkableObject(obj);
    const goals = blocked && obj ? approachTiles(farm, obj) : [target];
    const start = { x: Math.floor(this.x), y: Math.floor(this.z) };
    const tiles = findPath(grid, start, goals);
    let face = { x: target.x + 0.5, z: target.y + 0.5 };
    if (blocked && obj) {
      const r = rectOf(obj);
      face = { x: r.x + r.w / 2, z: r.y + r.h / 2 };
    }
    this.job = { qid, face };
    this.applied = false;
    this.work = 0;
    if (!tiles) {
      // Nowhere to stand: work from where we are rather than getting stuck.
      this.state = "work";
      return;
    }
    const points = smoothPath(grid, tiles).map((t) => ({ x: t.x + 0.5, z: t.y + 0.5 }));
    points[0] = { x: this.x, z: this.z };
    if (!blocked) {
      // Stop at the edge of a walkable target instead of standing in the crop.
      const last = points.at(-1);
      const prev = points.at(-2) ?? { x: this.x, z: this.z };
      if (last) {
        const dx = last.x - prev.x;
        const dz = last.z - prev.z;
        const len = Math.hypot(dx, dz);
        if (len > STOP_SHORT) {
          last.x -= (dx / len) * STOP_SHORT;
          last.z -= (dz / len) * STOP_SHORT;
        } else {
          points.pop();
        }
      }
    }
    this.path = points.slice(1);
    this.state = this.path.length > 0 ? "walk" : "work";
  }

  private walk(distance: number) {
    let left = distance;
    while (left > 0 && this.path.length > 0) {
      const next = this.path[0];
      if (!next) break;
      const dx = next.x - this.x;
      const dz = next.z - this.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-4) this.turnToward(Math.atan2(dz, dx), 0.35);
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
    this.stride += distance;
    if (this.path.length === 0) {
      this.state = "work";
      this.work = 0;
    }
  }

  private doWork(progress: number) {
    if (this.job) {
      this.turnToward(Math.atan2(this.job.face.z - this.z, this.job.face.x - this.x), 0.25);
    }
    this.work = Math.min(1, this.work + progress);
    if (!this.applied && this.work >= 0.6) {
      this.applied = true;
      const store = useGame.getState();
      if (store.queue[0]?.qid === this.job?.qid) store.performHead();
    }
    if (this.work >= 1) this.reset();
  }

  private turnToward(angle: number, rate: number) {
    let delta = angle - this.heading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.heading += delta * Math.min(1, rate * 2);
  }
}

export const farmer = new FarmerController();
