/**
 * Where to put a newly added device so it does not land on top of an existing
 * one.
 *
 * The editor used to place nodes at `200 + (n % 5) * 60` / `160 + (n % 4) * 40`.
 * Two things were wrong with that: 60px of horizontal step is less than the
 * 132px card, so every node covered its neighbour, and the modulo wrapped with
 * period lcm(5, 4) = 20, so node 21 landed on the exact coordinates of node 1.
 *
 * The grid below is not invented -- it is the spacing the shipped templates
 * already use (200px across, 120px down), so new devices join the existing
 * layout instead of inventing a second, contradictory one.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Footprint {
  width: number;
  height: number;
}

/** Card width is fixed by the `w-[132px]` class in Canvas.tsx. */
export const CARD_WIDTH = 132;

/**
 * Card height is content-driven -- alert badges stack on top of the name and
 * label -- so this is a floor, not an exact measurement. 120px is the vertical
 * pitch the templates use, and is enough for the common case; a card that grows
 * past it can still visually touch the row below, but never the one beside it,
 * because the horizontal pitch is wider.
 */
export const CARD_MIN_HEIGHT = 120;

/** Grid pitch, taken from the shipped templates. */
export const SLOT_STEP: Point = { x: 200, y: 120 };

export const DEFAULT_ORIGIN: Point = { x: 200, y: 160 };

/** Axis-aligned overlap: two cards collide when they are close on both axes. */
export function overlaps(a: Point, b: Point, fp: Footprint = { width: CARD_WIDTH, height: CARD_MIN_HEIGHT }): boolean {
  return Math.abs(a.x - b.x) < fp.width && Math.abs(a.y - b.y) < fp.height;
}

/**
 * First slot on the grid, spiralling outward from `origin`, that collides with
 * nothing in `occupied`.
 *
 * Deterministic: the same topology always yields the same placement, which
 * matters because this feeds the undo stack -- a slot that jumped around would
 * make undo look like it moved a device. Ring r has 8r slots, so the search
 * terminates after far fewer rings than there are nodes.
 */
export function findFreeSlot(
  occupied: readonly Point[],
  origin: Point = DEFAULT_ORIGIN,
  step: Point = SLOT_STEP,
  fp: Footprint = { width: CARD_WIDTH, height: CARD_MIN_HEIGHT },
): Point {
  // More rings than needed is harmless; too few would silently fall through.
  for (let ring = 0; ring <= occupied.length; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const candidate: Point = { x: origin.x + i * step.x, y: origin.y + j * step.y };
        if (!occupied.some((other) => overlaps(candidate, other, fp))) {
          return candidate;
        }
      }
    }
  }
  /* c8 ignore next */
  return origin;
}
