/** Milliseconds since the Unix epoch. */
export type Ms = number;
export type ObjectId = `o${number}`;
export type Rotation = 0 | 1 | 2 | 3;

export interface Tile {
  x: number;
  y: number;
}
