export interface Point {
  x: number;
  y: number;
}

export interface Footprint {
  width: number;
  height: number;
}

export const CARD_WIDTH = 132;
export const CARD_MAX_HEIGHT = 200;
export const SLOT_STEP: Point = { x: 200, y: 200 };
export const DEFAULT_ORIGIN: Point = { x: 200, y: 160 };

export function overlaps(
  a: Point,
  b: Point,
  fp: Footprint = { width: CARD_WIDTH, height: CARD_MAX_HEIGHT },
): boolean {
  return Math.abs(a.x - b.x) < fp.width && Math.abs(a.y - b.y) < fp.height;
}

export function findFreeSlot(
  occupied: readonly Point[],
  origin: Point = DEFAULT_ORIGIN,
  step: Point = SLOT_STEP,
  fp: Footprint = { width: CARD_WIDTH, height: CARD_MAX_HEIGHT },
): Point {
  const MAX_RINGS = 8;
  for (let ring = 0; ring <= MAX_RINGS; ring++) {
    for (let j = 0; j <= ring; j++) {
      for (let i = 0; i <= ring; i++) {
        if (i !== ring && j !== ring) continue;
        const cand: Point = {
          x: origin.x + i * step.x,
          y: origin.y + j * step.y,
        };
        if (!occupied.some((o) => overlaps(cand, o, fp))) {
          return cand;
        }
      }
    }
  }
  return origin;
}
