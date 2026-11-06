// Prints what each raw model contains: bounds, triangles, materials, textures and animation clips.
// Usage: node --experimental-strip-types scripts/assets/inspect.ts [key...]

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { rawPath, SOURCES } from "./sources.ts";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const only = new Set(process.argv.slice(2));

for (const source of SOURCES) {
  if (only.size > 0 && !only.has(source.key)) continue;
  const doc = await io.read(rawPath(source));
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const bounds = scene ? getBounds(scene) : null;
  let tris = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : (prim.getAttribute("POSITION")?.getCount() ?? 0);
      tris += Math.floor(count / 3);
    }
  }
  const size = bounds ? bounds.max.map((v, i) => +(v - (bounds.min[i] ?? 0)).toFixed(2)) : [];
  const materials = root
    .listMaterials()
    .map((m) => `${m.getName() || "?"}${m.getBaseColorTexture() ? "[tex]" : ""}`)
    .slice(0, 8);
  const clips = root.listAnimations().map((a) => a.getName());
  console.log(
    `${source.key.padEnd(20)} tris=${String(tris).padStart(5)} size=${JSON.stringify(size)} min=${JSON.stringify(bounds?.min.map((v) => +v.toFixed(2)))} skins=${root.listSkins().length} textures=${root.listTextures().length}`,
  );
  console.log(`  materials: ${materials.join(", ")}${root.listMaterials().length > 8 ? " …" : ""}`);
  if (clips.length) console.log(`  clips: ${clips.join(", ")}`);
}
