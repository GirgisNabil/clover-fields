import { tileStatus } from "@/domain";
import { animalOnTile } from "../animals/registry";
import { cameraStore, getView } from "../camera/cameraStore";
import { clock } from "../clock";
import { clampTarget, zoomAt, zoomLimits } from "../math/cameraMath";
import { screenToGround } from "../math/iso";
import { useGame, viewFarm } from "../store/gameStore";
import { useUi } from "../store/uiStore";
import { describeAnimal, describeStatus } from "./describe";
import { activeController } from "./InputController";
import { openVehicles } from "./vehicles";

const PAN_PX = 90;

const CURSOR_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, -1],
  s: [0, 1],
};

const isFarmFocused = () =>
  typeof document !== "undefined" &&
  document.activeElement?.hasAttribute("data-farm-surface") === true;

/** Describes the cursor tile for screen readers. */
export function announceCursor() {
  const cursor = useUi.getState().cursor;
  if (!cursor) return;
  const farm = viewFarm(useGame.getState());
  const animal = animalOnTile(cursor);
  const text = animal
    ? describeAnimal(farm, animal, clock.now())
    : describeStatus(tileStatus(farm, cursor.x, cursor.y, clock.now()).status, clock.now());
  const where = `Tile ${cursor.x + 1}, ${cursor.y + 1}`;
  useUi.setState({
    announce: text ? `${where}: ${text.title}. ${text.detail}` : `${where}: grass`,
  });
}

/** Moves the keyboard cursor one tile and keeps the camera on it. */
export function moveCursor(dx: number, dy: number) {
  const size = viewFarm(useGame.getState()).land.size;
  const current = useUi.getState().cursor ?? { x: Math.floor(size / 2), y: Math.floor(size / 2) };
  const next = {
    x: Math.max(0, Math.min(size - 1, current.x + dx)),
    y: Math.max(0, Math.min(size - 1, current.y + dy)),
  };
  useUi.setState({ cursor: next, hover: next });
  const view = getView();
  cameraStore.setState(
    clampTarget({ ...view, targetX: next.x + 0.5, targetZ: next.y + 0.5 }, size),
  );
  announceCursor();
}

function panScreen(dx: number, dy: number) {
  const view = getView();
  const cx = view.width / 2;
  const cy = view.height / 2;
  const a = screenToGround(view, cx, cy);
  const b = screenToGround(view, cx + dx, cy + dy);
  cameraStore.setState(
    clampTarget(
      { ...view, targetX: view.targetX + (b.x - a.x), targetZ: view.targetZ + (b.z - a.z) },
      viewFarm(useGame.getState()).land.size,
    ),
  );
}

function zoomCenter(factor: number) {
  const view = getView();
  const limits = zoomLimits(viewFarm(useGame.getState()).land.size, view.width, view.height);
  cameraStore.setState(zoomAt(view, view.width / 2, view.height / 2, factor, limits));
}

/** Keyboard shortcuts: tools (1–7), R rotate, Esc, camera pan (WASD / arrows) and zoom (+ / −). */
export function installHotkeys(): () => void {
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
      return;
    const ui = useUi.getState();
    if (ui.dialog) return; // dialogs handle their own keys (Esc closes them)
    const game = useGame.getState();
    // Keyboard play: while the farm itself has focus, arrows move a tile cursor and Enter acts.
    if (isFarmFocused()) {
      const step = CURSOR_KEYS[event.key];
      if (step) {
        event.preventDefault();
        // The first arrow press after a mouse click places the cursor where it is.
        if (!useUi.getState().cursor) moveCursor(0, 0);
        else moveCursor(step[0], step[1]);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const cursor = useUi.getState().cursor;
        if (cursor) activeController?.actAt(cursor);
        announceCursor();
        return;
      }
    }
    if (game.visit) {
      // Visiting: only the camera keys work, and H (or Esc) goes home.
      if (event.key === "h" || event.key === "H" || event.key === "Escape") {
        game.endVisit();
        return;
      }
      if (/^[1-7bBvVjJrR]$/.test(event.key)) return;
    }
    switch (event.key) {
      case "1":
        ui.setTool("hand");
        break;
      case "2":
        ui.setTool("plow");
        break;
      case "3":
        ui.openDialog("seeds");
        break;
      case "4":
        ui.openMarket();
        break;
      case "5":
        ui.setTool("arrange");
        break;
      case "6":
        ui.setTool("sell");
        break;
      case "j":
      case "J":
        ui.openDialog("book");
        break;
      case "7":
      case "b":
        ui.openDialog("storage");
        break;
      case "v":
      case "V":
        openVehicles();
        break;
      case "r":
      case "R":
        ui.rotatePlacing();
        break;
      case "Escape":
        if (ui.placing) ui.stopPlacing();
        else if (ui.tool !== "hand") ui.setTool("hand");
        else useGame.getState().cancelQueue();
        break;
      case "ArrowLeft":
      case "a":
        panScreen(-PAN_PX, 0);
        break;
      case "ArrowRight":
      case "d":
        panScreen(PAN_PX, 0);
        break;
      case "ArrowUp":
      case "w":
        panScreen(0, -PAN_PX);
        break;
      case "ArrowDown":
      case "s":
        panScreen(0, PAN_PX);
        break;
      case "+":
      case "=":
        zoomCenter(1.2);
        break;
      case "-":
      case "_":
        zoomCenter(1 / 1.2);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
