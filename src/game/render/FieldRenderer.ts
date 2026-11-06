import { type BufferGeometry, Euler, type Group, Matrix4, Quaternion, Vector3 } from "three";
import {
  type CropDef,
  cropStage,
  type FarmState,
  getCrop,
  type ObjectId,
  type PlotObject,
} from "@/domain";
import { bakedCropGeometry } from "../assets/plants/cropLooks";
import { stringSeed } from "../assets/procedural/builder";
import { buildCropGeometry, type CropVisual } from "../assets/procedural/crops";
import {
  buildFallowSoil,
  buildManurePile,
  buildPlowedSoil,
  SOIL_TOP,
} from "../assets/procedural/soil";
import { InstancedPool } from "./InstancedPool";
import { cropMaterial, flatMaterial, witheredMaterial } from "./materials";

type CropKey = `${string}:${CropVisual | "withered"}`;

interface PlotView {
  obj: PlotObject;
  soil: "plowed" | "fallow";
  crop: CropKey | null;
}

const RECHECK_MS = 250;

const pos = new Vector3();
const quat = new Quaternion();
const euler = new Euler();
const scl = new Vector3();
const matrix = new Matrix4();

/** Keeps instanced soil and crop meshes in step with the farm's plots. */
export class FieldRenderer {
  private plowed: InstancedPool;
  private fallow: InstancedPool;
  private manure: InstancedPool;
  private crops = new Map<CropKey, InstancedPool>();
  private geometries: BufferGeometry[] = [];
  private plots = new Map<ObjectId, PlotView>();
  private salt = 0;
  private lastCheck = 0;

  constructor(private readonly root: Group) {
    const plowedGeo = buildPlowedSoil();
    const fallowGeo = buildFallowSoil();
    this.geometries.push(plowedGeo, fallowGeo);
    this.plowed = new InstancedPool(plowedGeo, flatMaterial, { cast: false, receive: true }, 64);
    this.fallow = new InstancedPool(fallowGeo, flatMaterial, { cast: false, receive: true }, 16);
    const manureGeo = buildManurePile();
    this.geometries.push(manureGeo);
    this.manure = new InstancedPool(manureGeo, flatMaterial, { cast: false, receive: true }, 32);
    root.add(this.plowed.group, this.fallow.group, this.manure.group);
  }

  /** Reconciles with a new farm state; only plots whose object changed are touched. */
  sync(farm: FarmState, now: number): void {
    this.salt = farm.meta.witherSalt;
    const seen = new Set<ObjectId>();
    for (const obj of Object.values(farm.objects)) {
      if (obj.kind !== "plot") continue;
      seen.add(obj.id);
      const view = this.plots.get(obj.id);
      if (view?.obj === obj) continue;
      this.updatePlot(obj, now);
    }
    for (const id of this.plots.keys()) {
      if (!seen.has(id)) this.removePlot(id);
    }
  }

  /** Re-evaluates growth stages a few times per second. */
  tick(now: number): void {
    if (now - this.lastCheck < RECHECK_MS) return;
    this.lastCheck = now;
    for (const view of this.plots.values()) {
      if (!view.obj.crop) continue;
      const key = this.cropKey(view.obj, now);
      if (key !== view.crop) this.placeCrop(view, key);
    }
  }

  dispose(): void {
    this.plowed.dispose();
    this.fallow.dispose();
    this.manure.dispose();
    for (const pool of this.crops.values()) pool.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.crops.clear();
    this.plots.clear();
  }

  private updatePlot(obj: PlotObject, now: number) {
    let view = this.plots.get(obj.id);
    const soil = obj.soil === "fallow" ? "fallow" : "plowed";
    if (!view) {
      view = { obj, soil, crop: null };
      this.plots.set(obj.id, view);
      this.placeSoil(view);
    } else {
      view.obj = obj;
      if (view.soil !== soil) {
        (view.soil === "plowed" ? this.plowed : this.fallow).remove(obj.id);
        view.soil = soil;
        this.placeSoil(view);
      }
    }
    this.placeCrop(view, obj.crop ? this.cropKey(obj, now) : null);
    this.placeManure(obj);
  }

  /** A manured crop shows a little pile on its front corner. */
  private placeManure(obj: PlotObject) {
    if (!obj.crop?.manure) {
      this.manure.remove(obj.id);
      return;
    }
    pos.set(obj.x + 0.8, SOIL_TOP, obj.y + 0.8);
    euler.set(0, (stringSeed(obj.id) % 7) * 0.9, 0);
    matrix.compose(pos, quat.setFromEuler(euler), scl.set(1.7, 1.7, 1.7));
    this.manure.set(obj.id, matrix);
  }

  private removePlot(id: ObjectId) {
    const view = this.plots.get(id);
    if (!view) return;
    (view.soil === "plowed" ? this.plowed : this.fallow).remove(id);
    if (view.crop) this.crops.get(view.crop)?.remove(id);
    this.manure.remove(id);
    this.plots.delete(id);
  }

  private placeSoil(view: PlotView) {
    pos.set(view.obj.x + 0.5, 0, view.obj.y + 0.5);
    matrix.compose(pos, quat.identity(), scl.set(1, 1, 1));
    (view.soil === "plowed" ? this.plowed : this.fallow).set(view.obj.id, matrix);
  }

  private cropKey(obj: PlotObject, now: number): CropKey | null {
    if (!obj.crop) return null;
    const stage = cropStage(obj.id, obj.crop, this.salt, now);
    const visual =
      stage.stage === "growing" ? stage.visual : stage.stage === "ripe" ? "ripe" : "withered";
    return `${obj.crop.cropId}:${visual}`;
  }

  private placeCrop(view: PlotView, key: CropKey | null) {
    if (view.crop && view.crop !== key) this.crops.get(view.crop)?.remove(view.obj.id);
    view.crop = key;
    if (!key) return;
    const pool = this.pool(key);
    if (!pool) return;
    const seed = stringSeed(view.obj.id);
    const withered = key.endsWith(":withered");
    const yaw = ((seed & 3) * Math.PI) / 2 + (((seed >> 2) & 15) / 15 - 0.5) * 0.2;
    const s = 1.16 + ((seed >> 6) & 15) / 200;
    pos.set(view.obj.x + 0.5, SOIL_TOP, view.obj.y + 0.5);
    euler.set(withered ? 0.12 : 0, yaw, withered ? -0.1 : 0);
    matrix.compose(pos, quat.setFromEuler(euler), scl.set(s, withered ? s * 0.7 : s, s));
    pool.set(view.obj.id, matrix);
  }

  private pool(key: CropKey): InstancedPool | null {
    const existing = this.crops.get(key);
    if (existing) return existing;
    const split = key.lastIndexOf(":");
    const cropId = key.slice(0, split);
    const visual = key.slice(split + 1);
    const def: CropDef | undefined = getCrop(cropId);
    if (!def) return null;
    const withered = visual === "withered";
    const stage: CropVisual = withered
      ? 3
      : visual === "ripe"
        ? "ripe"
        : (Number(visual) as 0 | 1 | 2 | 3);
    const geometry = bakedCropGeometry(def.id, stage) ?? buildCropGeometry(def, stage);
    this.geometries.push(geometry);
    const pool = new InstancedPool(geometry, withered ? witheredMaterial : cropMaterial);
    this.crops.set(key, pool);
    this.root.add(pool.group);
    return pool;
  }
}
