import { type BufferGeometry, Group, InstancedMesh, type Material, type Matrix4 } from "three";

/**
 * Many copies of one model in a single draw call. Instances are keyed by id; removal
 * swaps the last instance into the freed slot. Capacity grows by doubling.
 */
export class InstancedPool {
  readonly group = new Group();
  private mesh: InstancedMesh;
  private ids: string[] = [];
  private slots = new Map<string, number>();

  constructor(
    private readonly geometry: BufferGeometry,
    private readonly material: Material,
    private readonly shadows: { cast: boolean; receive: boolean } = { cast: true, receive: true },
    capacity = 16,
  ) {
    this.mesh = this.createMesh(capacity);
  }

  get count(): number {
    return this.ids.length;
  }

  has(id: string): boolean {
    return this.slots.has(id);
  }

  set(id: string, matrix: Matrix4): void {
    let slot = this.slots.get(id);
    if (slot === undefined) {
      if (this.ids.length >= this.mesh.instanceMatrix.count) this.grow();
      slot = this.ids.length;
      this.ids.push(id);
      this.slots.set(id, slot);
      this.mesh.count = this.ids.length;
    }
    this.mesh.setMatrixAt(slot, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  remove(id: string): void {
    const slot = this.slots.get(id);
    if (slot === undefined) return;
    const lastSlot = this.ids.length - 1;
    const lastId = this.ids[lastSlot];
    if (slot !== lastSlot && lastId !== undefined) {
      const m = this.mesh.instanceMatrix.array;
      m.copyWithin(slot * 16, lastSlot * 16, lastSlot * 16 + 16);
      this.ids[slot] = lastId;
      this.slots.set(lastId, slot);
    }
    this.ids.pop();
    this.slots.delete(id);
    this.mesh.count = this.ids.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.group.remove(this.mesh);
    this.mesh.dispose();
  }

  private createMesh(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity);
    mesh.count = this.ids.length;
    mesh.frustumCulled = false;
    mesh.castShadow = this.shadows.cast;
    mesh.receiveShadow = this.shadows.receive;
    this.group.add(mesh);
    return mesh;
  }

  private grow(): void {
    const old = this.mesh;
    const next = this.createMesh(old.instanceMatrix.count * 2);
    next.instanceMatrix.array.set(old.instanceMatrix.array);
    next.count = this.ids.length;
    next.instanceMatrix.needsUpdate = true;
    this.group.remove(old);
    old.dispose();
    this.mesh = next;
  }
}
