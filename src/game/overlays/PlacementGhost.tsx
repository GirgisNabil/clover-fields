"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, type Sprite, Vector3 } from "three";
import { canPlace, footprint, getDef, projectedState, rectOf } from "@/domain";
import { emojiTexture } from "../assets/emojiTexture";
import { housingTarget, placementAnchor } from "../input/placement";
import { useGame } from "../store/gameStore";
import { useUi } from "../store/uiStore";

const MAX_TILES = 64;
const OK = new Color("#7dff6a");
const BAD = new Color("#ff5a4e");
const HOME = new Color("#6ac8ff");

const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const pos = new Vector3();
const scale = new Vector3(0.92, 0.92, 1);
const matrix = new Matrix4();

/** Shows where the held item would go: green tiles if it fits, red if not, blue for a new home. */
export function PlacementGhost() {
  const tiles = useRef<InstancedMesh>(null);
  const icon = useRef<Sprite>(null);
  const colors = useMemo(() => new Float32Array(MAX_TILES * 3).fill(1), []);
  const lastIcon = useRef("");

  useFrame(({ clock: frameClock }) => {
    const mesh = tiles.current;
    const sprite = icon.current;
    if (!mesh || !sprite) return;
    const { placing, hover } = useUi.getState();
    if (!placing || !hover) {
      mesh.count = 0;
      sprite.visible = false;
      return;
    }
    const farm = projectedState(useGame.getState().projection);
    const home = housingTarget(placing, hover);
    const anchor = placementAnchor(hover, placing.defId, placing.rot);
    const ignore =
      typeof placing.source === "object" && "move" in placing.source
        ? placing.source.move
        : undefined;
    const rect = home ? rectOf(home) : { ...anchor, ...footprint(placing.defId, placing.rot) };
    const fits =
      home !== null ||
      canPlace(farm, placing.defId, anchor.x, anchor.y, placing.rot, ignore) === null;
    const color = home ? HOME : fits ? OK : BAD;
    let i = 0;
    for (let y = rect.y; y < rect.y + rect.h && i < MAX_TILES; y++) {
      for (let x = rect.x; x < rect.x + rect.w && i < MAX_TILES; x++) {
        pos.set(x + 0.5, 0.14, y + 0.5);
        mesh.setMatrixAt(i, matrix.compose(pos, flat, scale));
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const emoji = getDef(placing.defId)?.icon ?? "📦";
    if (lastIcon.current !== emoji) {
      lastIcon.current = emoji;
      sprite.material.map = emojiTexture(emoji, true);
      sprite.material.needsUpdate = true;
    }
    sprite.visible = true;
    sprite.position.set(
      rect.x + rect.w / 2,
      1.1 + Math.sin(frameClock.elapsedTime * 4) * 0.06,
      rect.y + rect.h / 2,
    );
  });

  return (
    <>
      <instancedMesh
        ref={tiles}
        args={[undefined, undefined, MAX_TILES]}
        count={0}
        frustumCulled={false}
        renderOrder={6}
      >
        <planeGeometry args={[1, 1]} />
        <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
        <meshBasicMaterial transparent opacity={0.5} depthWrite={false} />
      </instancedMesh>
      <sprite ref={icon} visible={false} scale={[0.7, 0.7, 1]} renderOrder={11}>
        <spriteMaterial transparent depthTest={false} depthWrite={false} />
      </sprite>
    </>
  );
}
