import { toast } from "sonner";
import {
  type DomainError,
  describeError,
  type FieldCommand,
  type ObjectStatus,
  projectedState,
  type Tile,
  tileStatus,
} from "@/domain";
import { animalOnTile, pickAnimal } from "../animals/registry";
import { cameraStore, getView } from "../camera/cameraStore";
import { clock } from "../clock";
import { clampTarget, panToAnchor, zoomAt, zoomLimits } from "../math/cameraMath";
import { tilesAlong } from "../math/dda";
import { type GroundPoint, screenToGround } from "../math/iso";
import { groundTile, targetTile } from "../picking/target";
import { useGame } from "../store/gameStore";
import { type Tool, useUi } from "../store/uiStore";
import { describeStatus } from "./describe";
import {
  animalTap,
  driveAt,
  fertilizeAt,
  helpAt,
  openBuildingAt,
  pickUp,
  placeAt,
  sellAt,
} from "./placement";

type Category = "plow" | "plant" | "collect";
type TapAction =
  | "plow"
  | "info"
  | "hint-plow-first"
  | "hint-cant-plow"
  | "place"
  | "pick"
  | "sell"
  | "drive"
  | "animal"
  | "fertilize"
  | "help"
  | "none";

interface Point {
  x: number;
  y: number;
}

type Gesture =
  | {
      kind: "pan";
      pointerId: number;
      anchor: GroundPoint;
      start: Point;
      moved: boolean;
      tap: Tile | null;
      tapAction: TapAction;
      touch: boolean;
      /** The animal pressed on, for "animal" taps. */
      animal?: string;
    }
  | {
      kind: "paint";
      pointerId: number;
      category: Category;
      visited: Set<string>;
      last: GroundPoint;
      start: Point;
      committed: boolean;
      first: Tile;
      errors: DomainError[];
    }
  | {
      kind: "pinch";
      ids: [number, number];
      startDistance: number;
      startZoom: number;
      anchor: GroundPoint;
    };

const TAP_SLOP = 6;
/** Tools that act on what's drawn, so a press on an animal goes to the animal. */
const ANIMAL_TOOLS = new Set<Tool>(["hand", "seed", "arrange", "sell"]);
const TOUCH_COMMIT = 8;

const isReady = (status: ObjectStatus) =>
  status.kind === "ripe" ||
  (status.kind === "producer" && status.ready) ||
  (status.kind === "building" && status.readyCount > 0);

/**
 * Turns pointer, wheel and touch input into camera moves or queued farm actions.
 * A press on a tile the current tool can act on starts a paint stroke; anything else pans.
 */
/** The live controller, for keyboard play (hotkeys.ts). */
export let activeController: InputController | null = null;

export class InputController {
  private gesture: Gesture | null = null;
  private pointers = new Map<number, Point>();
  private cleanup: Array<() => void> = [];

  constructor(private readonly el: HTMLElement) {
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, handler, options);
      this.cleanup.push(() => el.removeEventListener(type, handler, options));
    };
    on("pointerdown", this.onDown);
    on("pointermove", this.onMove);
    on("pointerup", this.onUp);
    on("pointercancel", this.onCancel);
    on("pointerleave", this.onLeave);
    on("wheel", this.onWheel, { passive: false });
    activeController = this;
  }

  /** Keyboard play: do what a click on this tile would do with the current tool. */
  actAt(tile: Tile) {
    if (useGame.getState().visit) {
      helpAt(tile);
      return;
    }
    const tool = useUi.getState().tool;
    const animal = ANIMAL_TOOLS.has(tool) ? animalOnTile(tile) : null;
    if (animal) {
      animalTap(animal, tool);
      return;
    }
    const intent = this.classify(tool, tile);
    if (intent.kind === "paint") {
      const g: Extract<Gesture, { kind: "paint" }> = {
        kind: "paint",
        pointerId: -1,
        category: intent.category,
        visited: new Set(),
        last: { x: tile.x + 0.5, z: tile.y + 0.5 },
        start: { x: 0, y: 0 },
        committed: true,
        first: tile,
        errors: [],
      };
      this.paintTile(g, tile);
      const error = g.errors[0];
      if (error) toast(describeError(error));
    } else {
      // "touch" so info taps describe the tile in a toast (there's no mouse tooltip).
      this.tap(tile, intent.tap, true);
    }
  }

  dispose() {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    if (activeController === this) activeController = null;
  }

  private local(event: PointerEvent | WheelEvent): Point {
    const rect = this.el.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Object tools (Farm, Arrange, Sell) aim at what's drawn; the rest aim at the ground. */
  private tileAt(p: Point, tool = useUi.getState().tool): Tile {
    const view = getView();
    if (tool === "hand" || tool === "arrange" || tool === "sell") {
      const store = useGame.getState();
      return targetTile(view, p.x, p.y, store.visit?.farm ?? projectedState(store.projection));
    }
    return groundTile(view, p.x, p.y);
  }

  private onDown = (event: PointerEvent) => {
    const p = this.local(event);
    this.pointers.set(event.pointerId, p);
    this.el.setPointerCapture(event.pointerId);

    if (this.pointers.size === 2) {
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    const anchor = screenToGround(getView(), p.x, p.y);
    const touch = event.pointerType === "touch";
    if (event.button !== 0) {
      this.gesture = {
        kind: "pan",
        pointerId: event.pointerId,
        anchor,
        start: p,
        moved: false,
        tap: null,
        tapAction: "none",
        touch,
      };
      return;
    }
    if (useGame.getState().visit) {
      // On a neighbour's farm every click is a chore: an animal, or the tile under the pointer.
      const animal = pickAnimal(p.x, p.y);
      this.gesture = {
        kind: "pan",
        pointerId: event.pointerId,
        anchor,
        start: p,
        moved: false,
        tap: groundTile(getView(), p.x, p.y),
        tapAction: "help",
        touch,
        ...(animal ? { animal } : {}),
      };
      return;
    }
    const tile = this.tileAt(p);
    const tool = useUi.getState().tool;
    // Animals roam above the tiles, so object tools test them first.
    const animal = ANIMAL_TOOLS.has(tool) ? pickAnimal(p.x, p.y) : null;
    if (animal) {
      this.gesture = {
        kind: "pan",
        pointerId: event.pointerId,
        anchor,
        start: p,
        moved: false,
        tap: tile,
        tapAction: "animal",
        touch,
        animal,
      };
      return;
    }
    const intent = this.classify(tool, tile);
    if (intent.kind === "paint") {
      this.gesture = {
        kind: "paint",
        pointerId: event.pointerId,
        category: intent.category,
        visited: new Set(),
        last: anchor,
        start: p,
        committed: !touch,
        first: tile,
        errors: [],
      };
      if (!touch) this.paintTile(this.gesture, tile);
    } else {
      this.gesture = {
        kind: "pan",
        pointerId: event.pointerId,
        anchor,
        start: p,
        moved: false,
        tap: tile,
        tapAction: intent.tap,
        touch,
      };
    }
  };

  private onMove = (event: PointerEvent) => {
    const p = this.local(event);
    if (event.pointerType === "mouse") {
      const tile = this.tileAt(p);
      const ui = useUi.getState();
      if (ui.hover?.x !== tile.x || ui.hover?.y !== tile.y) useUi.setState({ hover: tile });
      const animal = pickAnimal(p.x, p.y);
      if (ui.hoverAnimal !== animal) useUi.setState({ hoverAnimal: animal });
      useUi.setState({ pointer: { x: event.clientX, y: event.clientY, inside: true } });
    }
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, p);
    const g = this.gesture;
    if (!g) return;

    if (g.kind === "pinch") {
      this.updatePinch(g);
    } else if (g.kind === "pan" && g.pointerId === event.pointerId) {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) > TAP_SLOP) g.moved = true;
      if (g.moved) this.setView(panToAnchor(getView(), g.anchor, p.x, p.y));
    } else if (g.kind === "paint" && g.pointerId === event.pointerId) {
      if (!g.committed) {
        if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < TOUCH_COMMIT) return;
        g.committed = true;
        this.paintTile(g, g.first);
      }
      const ground = screenToGround(getView(), p.x, p.y);
      for (const tile of tilesAlong(g.last.x, g.last.z, ground.x, ground.z))
        this.paintTile(g, tile);
      g.last = ground;
    }
  };

  private onUp = (event: PointerEvent) => {
    const g = this.gesture;
    this.pointers.delete(event.pointerId);
    if (this.el.hasPointerCapture(event.pointerId)) this.el.releasePointerCapture(event.pointerId);
    if (!g) return;
    if (g.kind === "pinch") {
      if (this.pointers.size < 2) this.gesture = null;
      return;
    }
    if (g.pointerId !== event.pointerId) return;
    if (g.kind === "pan" && !g.moved && g.animal) animalTap(g.animal, useUi.getState().tool);
    else if (g.kind === "pan" && !g.moved && g.tap) this.tap(g.tap, g.tapAction, g.touch);
    if (g.kind === "paint") {
      if (!g.committed) {
        g.committed = true;
        this.paintTile(g, g.first);
      }
      const error = g.errors[0];
      if (error) toast(describeError(error));
    }
    this.gesture = null;
  };

  private onCancel = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    this.gesture = null;
  };

  private onLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      useUi.setState({
        hover: null,
        hoverAnimal: null,
        pointer: { x: event.clientX, y: event.clientY, inside: false },
      });
    }
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const p = this.local(event);
    const view = getView();
    const size = useGame.getState().farm.land.size;
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
    this.setView(zoomAt(view, p.x, p.y, factor, zoomLimits(size, view.width, view.height)));
  };

  private startPinch() {
    const g = this.gesture;
    // A touch paint that hasn't moved yet was the start of a pinch, not an action.
    if (g?.kind === "paint" && g.committed) {
      const error = g.errors[0];
      if (error) toast(describeError(error));
    }
    const [a, b] = [...this.pointers.entries()];
    if (!a || !b) return;
    const mid = { x: (a[1].x + b[1].x) / 2, y: (a[1].y + b[1].y) / 2 };
    this.gesture = {
      kind: "pinch",
      ids: [a[0], b[0]],
      startDistance: Math.max(1, Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y)),
      startZoom: getView().zoom,
      anchor: screenToGround(getView(), mid.x, mid.y),
    };
  }

  private updatePinch(g: Extract<Gesture, { kind: "pinch" }>) {
    const a = this.pointers.get(g.ids[0]);
    const b = this.pointers.get(g.ids[1]);
    if (!a || !b) return;
    const view = getView();
    const size = useGame.getState().farm.land.size;
    const limits = zoomLimits(size, view.width, view.height);
    const zoom = Math.min(
      limits.max,
      Math.max(limits.min, (g.startZoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.startDistance),
    );
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.setView(panToAnchor({ ...view, zoom }, g.anchor, mid.x, mid.y));
  }

  private setView(view: ReturnType<typeof getView>) {
    cameraStore.setState(clampTarget(view, useGame.getState().farm.land.size));
  }

  /** What a press on this tile should do with the current tool. */
  private classify(
    tool: Tool,
    tile: Tile,
  ): { kind: "paint"; category: Category } | { kind: "pan"; tap: TapAction } {
    const store = useGame.getState();
    const farm = projectedState(store.projection);
    const size = farm.land.size;
    if (tile.x < 0 || tile.y < 0 || tile.x >= size || tile.y >= size)
      return { kind: "pan", tap: "none" };
    const { status } = tileStatus(farm, tile.x, tile.y, clock.now());
    const plowable =
      status.kind === "grass" || status.kind === "fallow" || status.kind === "withered";
    switch (tool) {
      case "place":
        return { kind: "pan", tap: "place" };
      case "arrange":
        return { kind: "pan", tap: "pick" };
      case "sell":
        return { kind: "pan", tap: "sell" };
      case "drive":
        return { kind: "pan", tap: "drive" };
      case "fertilize":
        return { kind: "pan", tap: "fertilize" };
      case "hand":
        if (isReady(status) || status.kind === "withered")
          return { kind: "paint", category: "collect" };
        if (status.kind === "plowed") return { kind: "paint", category: "plant" };
        if (status.kind === "fallow") return { kind: "paint", category: "plow" };
        return { kind: "pan", tap: status.kind === "grass" ? "plow" : "info" };
      case "plow":
        return plowable
          ? { kind: "paint", category: "plow" }
          : { kind: "pan", tap: "hint-cant-plow" };
      case "seed":
        if (status.kind === "plowed") return { kind: "paint", category: "plant" };
        if (isReady(status)) return { kind: "paint", category: "collect" };
        return {
          kind: "pan",
          tap: status.kind === "grass" || status.kind === "fallow" ? "hint-plow-first" : "info",
        };
    }
  }

  private paintTile(g: Extract<Gesture, { kind: "paint" }>, tile: Tile) {
    const key = `${tile.x},${tile.y}`;
    if (g.visited.has(key)) return;
    g.visited.add(key);
    const store = useGame.getState();
    const farm = projectedState(store.projection);
    if (tile.x < 0 || tile.y < 0 || tile.x >= farm.land.size || tile.y >= farm.land.size) return;
    const { obj, status } = tileStatus(farm, tile.x, tile.y, clock.now());
    let cmd: FieldCommand | null = null;
    if (g.category === "plow") {
      if (status.kind === "grass" || status.kind === "fallow" || status.kind === "withered") {
        cmd = { type: "plow", x: tile.x, y: tile.y };
      }
    } else if (g.category === "plant") {
      if (status.kind === "plowed") {
        cmd = { type: "plant", x: tile.x, y: tile.y, cropId: useUi.getState().seedId };
      }
    } else if (isReady(status) && obj) {
      cmd = { type: "harvest", x: tile.x, y: tile.y, expect: obj.id };
    } else if (status.kind === "withered") {
      cmd = { type: "plow", x: tile.x, y: tile.y };
    }
    if (!cmd) return;
    const error = store.enqueue(cmd);
    if (error) g.errors.push(error);
  }

  private tap(tile: Tile, action: TapAction, touch: boolean) {
    const store = useGame.getState();
    if (action === "place") return placeAt(tile);
    if (action === "pick") return pickUp(tile);
    if (action === "sell") return sellAt(tile);
    if (action === "drive") return driveAt(tile);
    if (action === "fertilize") return fertilizeAt(tile);
    if (action === "help") return helpAt(tile);
    if (action === "info" && openBuildingAt(tile)) return;
    if (action === "plow") {
      const error = store.enqueue({ type: "plow", x: tile.x, y: tile.y });
      if (error) toast(describeError(error));
    } else if (action === "hint-plow-first") {
      toast("Plow this spot first ⛏️");
    } else if (action === "hint-cant-plow") {
      toast("You can only plow empty grass.");
    } else if (action === "info" && touch) {
      const farm = projectedState(store.projection);
      const { status } = tileStatus(farm, tile.x, tile.y, clock.now());
      const text = describeStatus(status, clock.now());
      if (text) toast(text.title, { description: text.detail });
    }
  }
}
