"use client";

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import { MAX_FARM_SIZE } from "@/domain";
import { MeshBuilder, seededRandom } from "../assets/procedural/builder";
import { useGraphics } from "../quality/graphicsStore";

const PX_PER_TILE = 48;

/** Smooth 2D value noise in [0, 1], seeded and tileable over `period`. */
function valueNoise(seed: number, period: number) {
  const rnd = seededRandom(seed);
  const grid = Array.from({ length: period * period }, () => rnd());
  const at = (x: number, y: number) =>
    grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)] ?? 0;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/** Paints soft grass: base color, two octaves of blotchy noise and a scatter of tiny strokes. */
function paintGrass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: Color,
  seed: number,
  period: number,
) {
  const image = ctx.createImageData(w, h);
  const low = valueNoise(seed, period);
  const high = valueNoise(seed + 1, period * 4);
  const c = new Color();
  const rgb = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n =
        low((x / w) * period, (y / h) * period) * 0.7 +
        high((x / w) * period * 4, (y / h) * period * 4) * 0.3;
      c.copy(base).offsetHSL(0.012 * (n - 0.5), 0.05 * (n - 0.5), 0.07 * (n - 0.5));
      // three keeps colors linear; the canvas wants sRGB bytes.
      c.getRGB(rgb, SRGBColorSpace);
      const i = (y * w + x) * 4;
      image.data[i] = rgb.r * 255;
      image.data[i + 1] = rgb.g * 255;
      image.data[i + 2] = rgb.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const rnd = seededRandom(seed + 7);
  for (let i = 0; i < (w * h) / 220; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const light = rnd() < 0.5;
    ctx.strokeStyle = light ? "rgba(255,255,220,0.10)" : "rgba(20,60,10,0.10)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4);
    ctx.stroke();
  }
}

/** The farm: mown grass with a faint tile checker and a soft darker rim. */
function makeFarmTexture(size: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * PX_PER_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  paintGrass(ctx, canvas.width, canvas.height, new Color("#79c257"), 11, Math.max(4, size / 2));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % 2 === 0) continue;
      ctx.fillStyle = "rgba(255,255,230,0.045)";
      ctx.fillRect(x * PX_PER_TILE, y * PX_PER_TILE, PX_PER_TILE, PX_PER_TILE);
    }
  }
  const rim = ctx.createLinearGradient(0, 0, 18, 0);
  rim.addColorStop(0, "rgba(40,80,20,0.25)");
  rim.addColorStop(1, "rgba(40,80,20,0)");
  for (let side = 0; side < 4; side++) {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((side * Math.PI) / 2);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, 18, canvas.height);
    ctx.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Wild meadow: longer, more varied grass that tiles. */
function makeMeadowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  paintGrass(ctx, 512, 512, new Color("#8cca63"), 23, 6);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(24, 24);
  texture.anisotropy = 8;
  return texture;
}

const tuftMaterial = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });

/** A clump of 5 blades, dark at the root and light at the tips. */
function tuftGeometry() {
  const b = new MeshBuilder();
  const blades = 5;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const lean = 0.04 + (i % 2) * 0.03;
    const h = 0.1 + (i % 3) * 0.035;
    const x = Math.cos(a) * 0.03;
    const z = Math.sin(a) * 0.03;
    // One triangle per blade: two root corners and a leaning tip.
    const positions = [
      x - 0.018 * Math.sin(a),
      0,
      z + 0.018 * Math.cos(a),
      x + 0.018 * Math.sin(a),
      0,
      z - 0.018 * Math.cos(a),
      x + Math.cos(a) * lean,
      h,
      z + Math.sin(a) * lean,
    ];
    b.addTriangle(positions, ["#6aa548", "#6aa548", "#c4e88f"]);
  }
  return b.build();
}

const FLOWER_COLORS = ["#ffffff", "#ffe066", "#ff8fb1", "#b9a2ff"];

/** Tufts of grass and little flowers scattered over the meadow, never on the farm itself. */
function MeadowTufts({ count }: { count: number }) {
  const geometry = useMemo(() => tuftGeometry(), []);
  const instances = useMemo(() => {
    const rnd = seededRandom(4242);
    const result: Array<{ x: number; z: number; s: number; r: number; flower: number }> = [];
    const reach = MAX_FARM_SIZE + 26;
    while (result.length < count) {
      const x = -26 + rnd() * reach;
      const z = -26 + rnd() * reach;
      // Keep the farm (and its expansion area) clear.
      if (x > -0.6 && z > -0.6 && x < MAX_FARM_SIZE + 0.6 && z < MAX_FARM_SIZE + 0.6) continue;
      result.push({
        x,
        z,
        s: 0.6 + rnd() * 0.6,
        r: rnd() * Math.PI,
        flower: rnd() < 0.12 ? Math.floor(rnd() * 4) : -1,
      });
    }
    return result;
  }, [count]);

  const ref = (mesh: InstancedMesh | null) => {
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    instances.forEach((t, i) => {
      q.setFromAxisAngle(up, t.r);
      m.compose(new Vector3(t.x, 0, t.z), q, new Vector3(t.s, t.s, t.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  const flowers = instances.filter((t) => t.flower >= 0);
  const flowerRef = (mesh: InstancedMesh | null) => {
    if (!mesh) return;
    const m = new Matrix4();
    const color = new Color();
    flowers.forEach((t, i) => {
      m.makeTranslation(t.x + 0.05, 0.2 * t.s, t.z + 0.03);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(FLOWER_COLORS[t.flower] ?? "#ffffff"));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  return (
    <>
      <instancedMesh ref={ref} args={[geometry, tuftMaterial, instances.length]} receiveShadow />
      <instancedMesh ref={flowerRef} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[0.035, 0]} />
        <meshLambertMaterial />
      </instancedMesh>
    </>
  );
}

export function Ground({ farmSize, tint = "#ffffff" }: { farmSize: number; tint?: string }) {
  const texture = useMemo(() => makeFarmTexture(farmSize), [farmSize]);
  const meadow = useMemo(() => makeMeadowTexture(), []);
  const quality = useGraphics((s) => s.quality);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => meadow.dispose(), [meadow]);
  const center = farmSize / 2;

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[center, 0, center]} receiveShadow>
        <planeGeometry args={[farmSize, farmSize]} />
        <meshLambertMaterial map={texture} color={tint} />
      </mesh>
      {/* Wild meadow around the farm. */}
      <mesh rotation-x={-Math.PI / 2} position={[center, -0.02, center]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshLambertMaterial map={meadow} color={tint} />
      </mesh>
      <MeadowTufts count={quality === "high" ? 2600 : 900} />
    </>
  );
}
