import { describe, expect, it } from "vitest";
import {
  CAMERA_DIR,
  fitZoom,
  type IsoView,
  SCREEN_RIGHT,
  SCREEN_UP,
  screenRay,
  screenToGround,
  tileAtScreen,
  tileCenterToScreen,
  worldToScreen,
} from "./iso";

const view: IsoView = { targetX: 6, targetZ: 6, zoom: 40, width: 1280, height: 800 };

const length = (v: readonly number[]) => Math.hypot(...v);
const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

describe("iso basis", () => {
  it("is orthonormal", () => {
    expect(length(CAMERA_DIR)).toBeCloseTo(1, 12);
    expect(length(SCREEN_RIGHT)).toBeCloseTo(1, 12);
    expect(length(SCREEN_UP)).toBeCloseTo(1, 12);
    expect(dot(CAMERA_DIR, SCREEN_RIGHT)).toBeCloseTo(0, 12);
    expect(dot(CAMERA_DIR, SCREEN_UP)).toBeCloseTo(0, 12);
    expect(dot(SCREEN_RIGHT, SCREEN_UP)).toBeCloseTo(0, 12);
  });
});

describe("worldToScreen", () => {
  it("puts the camera target at the viewport center", () => {
    const p = worldToScreen(view, view.targetX, 0, view.targetZ);
    expect(p.px).toBeCloseTo(640, 9);
    expect(p.py).toBeCloseTo(400, 9);
  });

  it("draws a tile as a 2:1 diamond", () => {
    const top = worldToScreen(view, 3, 0, 3);
    const right = worldToScreen(view, 4, 0, 3);
    const left = worldToScreen(view, 3, 0, 4);
    const bottom = worldToScreen(view, 4, 0, 4);
    const width = right.px - left.px;
    const height = bottom.py - top.py;
    expect(width / height).toBeCloseTo(2, 9);
    expect(top.px).toBeCloseTo(bottom.px, 9);
    expect(left.py).toBeCloseTo(right.py, 9);
  });

  it("draws tiles with larger x + y nearer the bottom of the screen", () => {
    expect(tileCenterToScreen(view, 5, 5).py).toBeGreaterThan(tileCenterToScreen(view, 4, 5).py);
    expect(tileCenterToScreen(view, 5, 5).py).toBeGreaterThan(tileCenterToScreen(view, 5, 4).py);
  });

  it("raises objects up the screen", () => {
    expect(worldToScreen(view, 2, 1, 2).py).toBeLessThan(worldToScreen(view, 2, 0, 2).py);
  });
});

describe("screenToGround", () => {
  it("inverts worldToScreen on the ground", () => {
    for (let i = 0; i < 200; i++) {
      const x = (i * 7.31) % 26;
      const z = (i * 3.17) % 26;
      const zoomed = { ...view, zoom: 20 + (i % 9) * 11, targetX: (i * 1.3) % 12 };
      const s = worldToScreen(zoomed, x, 0, z);
      const g = screenToGround(zoomed, s.px, s.py);
      expect(g.x).toBeCloseTo(x, 9);
      expect(g.z).toBeCloseTo(z, 9);
    }
  });

  it("supports raised planes", () => {
    const s = worldToScreen(view, 2.5, 1.5, 7.25);
    const g = screenToGround(view, s.px, s.py, 1.5);
    expect(g.x).toBeCloseTo(2.5, 9);
    expect(g.z).toBeCloseTo(7.25, 9);
  });

  it("finds the tile under a tile center", () => {
    for (let x = 0; x < 12; x++) {
      for (let y = 0; y < 12; y++) {
        const c = tileCenterToScreen(view, x, y);
        expect(tileAtScreen(view, c.px, c.py)).toEqual({ x, y });
      }
    }
  });
});

describe("screenRay", () => {
  it("passes through the ground point under the pixel", () => {
    const g = screenToGround(view, 300, 200);
    const { origin, dir } = screenRay(view, 300, 200);
    const t = origin[1] / -dir[1];
    expect(origin[0] + dir[0] * t).toBeCloseTo(g.x, 9);
    expect(origin[2] + dir[2] * t).toBeCloseTo(g.z, 9);
  });
});

describe("fitZoom", () => {
  it("keeps the whole farm diamond on screen", () => {
    for (const size of [12, 14, 20, 26]) {
      const zoom = fitZoom(size, 1280, 800);
      const fitted = { ...view, zoom, targetX: size / 2, targetZ: size / 2 };
      for (const [x, z] of [
        [0, 0],
        [size, 0],
        [0, size],
        [size, size],
      ] as const) {
        const p = worldToScreen(fitted, x, 0, z);
        expect(p.px).toBeGreaterThanOrEqual(0);
        expect(p.px).toBeLessThanOrEqual(1280);
        expect(p.py).toBeGreaterThanOrEqual(0);
        expect(p.py).toBeLessThanOrEqual(800);
      }
    }
  });
});
