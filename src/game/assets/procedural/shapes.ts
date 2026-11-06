import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
} from "three";

// Low-poly primitives. The `*Up` variants have their base at y = 0 so they pivot like plants.

export const ball = (r: number, detail = 0) => new IcosahedronGeometry(r, detail);
export const gem = (r: number) => new OctahedronGeometry(r, 0);
export const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

export function coneUp(r: number, h: number, segments = 5) {
  return new ConeGeometry(r, h, segments, 1, true).translate(0, h / 2, 0);
}

export function rodUp(r: number, h: number, segments = 5) {
  return new CylinderGeometry(r * 0.75, r, h, segments, 1, true).translate(0, h / 2, 0);
}

export function disc(r: number, h: number, segments = 8) {
  return new CylinderGeometry(r, r, h, segments);
}

export function cylinderUp(rTop: number, rBottom: number, h: number, segments = 8) {
  return new CylinderGeometry(rTop, rBottom, h, segments).translate(0, h / 2, 0);
}

/** A triangular prism along x, for roofs: `width` along x, `depth` along z, `height` tall. */
export function prism(width: number, depth: number, height: number) {
  const geometry = new CylinderGeometry(0.5, 0.5, width, 3, 1);
  geometry.rotateZ(Math.PI / 2);
  geometry.rotateX(-Math.PI / 2); // turn one triangle corner straight up
  // Equilateral cross-section spans 0.866 wide and 0.75 tall at radius 0.5; stretch to size.
  geometry.scale(1, height / 0.75, depth / 0.866);
  geometry.translate(0, height / 3, 0);
  return geometry;
}
