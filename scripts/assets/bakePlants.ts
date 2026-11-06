// Bakes PLANT_VARIANTS into public/models/plants.glb: one node + mesh per variant, each a single
// triangle primitive with POSITION, NORMAL and COLOR_0 (linear), so the game can instance them
// with one vertex-colored material. Also writes src/game/assets/plantManifest.ts.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, type Node, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { PLANT_PACKS, PLANT_VARIANTS } from "./plants.ts";

export const PLANT_RAW_DIR = "raw-assets/plants";

/** sRGB hex → linear RGB, matching three's Color handling. */
function linear(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return c as [number, number, number];
}

const baseName = (name: string) => name.split(".")[0] ?? name;

function transformPoint(m: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
    (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
  ];
}

function transformNormal(m: number[], x: number, y: number, z: number): [number, number, number] {
  // Uniform scale and rotation only in these packs, so the upper 3×3 works; renormalize.
  const v = [
    (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z,
    (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z,
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z,
  ];
  const len = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0) || 1;
  return [(v[0] ?? 0) / len, (v[1] ?? 0) / len, (v[2] ?? 0) / len];
}

interface Soup {
  positions: number[];
  normals: number[];
  colors: number[];
}

/** Flattens every triangle of a source file into world space, coloring each by its material. */
async function readSoup(
  io: NodeIO,
  file: string,
  recolor: Record<string, string>,
  drop: Set<string>,
) {
  const doc = await io.read(file);
  const soup: Soup = { positions: [], normals: [], colors: [] };
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) throw new Error(`${file}: no scene`);
  const visit = (node: Node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const world = node.getWorldMatrix() as unknown as number[];
      for (const prim of mesh.listPrimitives()) {
        const material = prim.getMaterial();
        const name = baseName(material?.getName() ?? "");
        if (drop.has(name)) continue;
        const factor = material?.getBaseColorFactor() ?? [0.8, 0.8, 0.8, 1];
        const hex = recolor[name];
        const color = hex
          ? linear(hex)
          : ([factor[0], factor[1], factor[2]] as [number, number, number]);
        const pos = prim.getAttribute("POSITION");
        const nor = prim.getAttribute("NORMAL");
        if (!pos) continue;
        const indices = prim.getIndices();
        const count = indices ? indices.getCount() : pos.getCount();
        const p = [0, 0, 0];
        const n = [0, 1, 0];
        for (let i = 0; i < count; i++) {
          const v = indices ? indices.getScalar(i) : i;
          pos.getElement(v, p);
          if (nor) nor.getElement(v, n);
          soup.positions.push(...transformPoint(world, p[0] ?? 0, p[1] ?? 0, p[2] ?? 0));
          soup.normals.push(...transformNormal(world, n[0] ?? 0, n[1] ?? 1, n[2] ?? 0));
          soup.colors.push(...color);
        }
      }
    }
    for (const child of node.listChildren()) visit(child);
  };
  for (const node of scene.listChildren()) visit(node);
  return soup;
}

export async function bakePlants(outDir: string) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene("plants");
  const material = out.createMaterial("plant").setRoughnessFactor(1).setMetallicFactor(0);
  const manifest: Record<string, { tris: number; min: number[]; max: number[] }> = {};

  for (const [name, variant] of Object.entries(PLANT_VARIANTS)) {
    const pack = PLANT_PACKS.find((p) => p.files.includes(variant.from));
    if (!pack) throw new Error(`plant variant ${name}: unknown source ${variant.from}`);
    const soup = await readSoup(
      io,
      join(PLANT_RAW_DIR, `${variant.from}.glb`),
      { ...(variant.recolor ?? {}) },
      new Set(variant.drop ?? []),
    );
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < soup.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = soup.positions[i + k] ?? 0;
        min[k] = Math.min(min[k] ?? 0, v);
        max[k] = Math.max(max[k] ?? 0, v);
      }
    }
    const prim = out
      .createPrimitive()
      .setMaterial(material)
      .setAttribute(
        "POSITION",
        out
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(soup.positions))
          .setBuffer(buffer),
      )
      .setAttribute(
        "NORMAL",
        out
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(soup.normals))
          .setBuffer(buffer),
      )
      .setAttribute(
        "COLOR_0",
        out
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(soup.colors))
          .setBuffer(buffer),
      );
    const mesh = out.createMesh(name).addPrimitive(prim);
    scene.addChild(out.createNode(name).setMesh(mesh));
    const round = (v: number) => Math.round(v * 1000) / 1000;
    manifest[name] = { tris: soup.positions.length / 9, min: min.map(round), max: max.map(round) };
  }

  await out.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const file = join(outDir, "plants.glb");
  await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder })
    .write(file, out);

  const banner = "// GENERATED by scripts/assets/build.ts — do not edit by hand.\n";
  writeFileSync(
    "src/game/assets/plantManifest.ts",
    `${banner}\nexport const PLANTS_URL = "/models/plants.glb";\n\nexport const PLANT_MESHES = ${JSON.stringify(manifest, null, 2)} as const;\n\nexport type PlantMesh = keyof typeof PLANT_MESHES;\n`,
  );
  const tris = Object.values(manifest).reduce((s, m) => s + m.tris, 0);
  console.log(`plants.glb: ${Object.keys(manifest).length} meshes, ${tris} tris`);
  return PLANT_PACKS.map((p) => `- **Plants**: "${p.title}" by Quaternius (CC0 1.0) — ${p.page}`);
}
