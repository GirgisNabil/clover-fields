import { describe, expect, it } from "vitest";
import { type IsoView, tileCenterToScreen, worldToScreen } from "../math/iso";
import { type PickBox, pickObject } from "./pick";

const view: IsoView = { targetX: 6, targetZ: 6, zoom: 50, width: 1280, height: 800 };

function world(boxes: PickBox[]) {
  return (x: number, y: number) =>
    boxes.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
}

describe("pickObject", () => {
  const barn: PickBox = { id: "barn", x: 4, y: 4, w: 3, h: 3, height: 2.5 };

  it("picks a tall object by its roof, above tiles that belong to something else", () => {
    // A point high on the barn's front wall projects onto ground tiles behind... in front of it.
    const roof = worldToScreen(view, 5.5, 2.2, 6.9);
    expect(pickObject(view, roof.px, roof.py, world([barn]))?.id).toBe("barn");
  });

  it("prefers the object nearest the camera when two overlap on screen", () => {
    const front: PickBox = { id: "front", x: 7, y: 7, w: 1, h: 1, height: 1.5 };
    const back: PickBox = { id: "back", x: 6, y: 6, w: 1, h: 1, height: 1.5 };
    const top = worldToScreen(view, 7.5, 1.2, 7.5);
    expect(pickObject(view, top.px, top.py, world([front, back]))?.id).toBe("front");
  });

  it("returns null over bare ground and in the sky above short objects", () => {
    const grass = tileCenterToScreen(view, 10, 1);
    expect(pickObject(view, grass.px, grass.py, world([barn]))).toBeNull();
    const fence: PickBox = { id: "fence", x: 2, y: 2, w: 1, h: 1, height: 0.4 };
    const above = worldToScreen(view, 2.5, 1.5, 2.5);
    expect(pickObject(view, above.px, above.py, world([fence]))).toBeNull();
  });
});
