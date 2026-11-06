import { BufferGeometry, Float32BufferAttribute, type Matrix4, type Mesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PLANT_MESHES, PLANTS_URL, type PlantMesh } from "../plantManifest";

// The baked plant meshes (crops and fruit trees), loaded once at boot so the field renderer and
// object models can build geometry synchronously afterwards.

const geometries = new Map<string, BufferGeometry>();

/**
 * Copies a (possibly quantized) mesh into plain float attributes with its node transform applied,
 * so callers can clone, transform and merge it freely.
 */
function toFloat(source: BufferGeometry, world: Matrix4): BufferGeometry {
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const color = source.getAttribute("color");
  const index = source.getIndex();
  const count = index ? index.count : position.count;
  const p = new Float32Array(count * 3);
  const n = new Float32Array(count * 3);
  const c = new Float32Array(count * 3);
  const v = new Vector3();
  const normalMatrix = world.clone().invert().transpose();
  for (let i = 0; i < count; i++) {
    const k = index ? index.getX(i) : i;
    v.fromBufferAttribute(position, k)
      .applyMatrix4(world)
      .toArray(p, i * 3);
    if (normal)
      v.fromBufferAttribute(normal, k)
        .applyMatrix4(normalMatrix)
        .setLength(1)
        .toArray(n, i * 3);
    else n[i * 3 + 1] = 1;
    c[i * 3] = color ? color.getX(k) : 1;
    c[i * 3 + 1] = color ? color.getY(k) : 1;
    c[i * 3 + 2] = color ? color.getZ(k) : 1;
  }
  const out = new BufferGeometry();
  out.setAttribute("position", new Float32BufferAttribute(p, 3));
  out.setAttribute("normal", new Float32BufferAttribute(n, 3));
  out.setAttribute("color", new Float32BufferAttribute(c, 3));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}
let loading: Promise<void> | null = null;

export function loadPlants(): Promise<void> {
  loading ??= new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(PLANTS_URL)
    .then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const geometry = toFloat(mesh.geometry, mesh.matrixWorld);
        geometry.name = mesh.name;
        geometries.set(mesh.name, geometry);
        mesh.geometry.dispose();
      });
    })
    .catch((error: unknown) => {
      // Procedural fallbacks keep the game playable if the file can't load.
      console.warn("Plant models failed to load; using procedural plants.", error);
    });
  return loading;
}

/** The baked geometry for a plant mesh, or null before loading (or if it failed). */
export function plantGeometry(name: PlantMesh): BufferGeometry | null {
  return geometries.get(name) ?? null;
}

export function plantBounds(name: PlantMesh) {
  return PLANT_MESHES[name];
}
