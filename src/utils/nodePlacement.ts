/**
 * Where to put a newly added device so it does not land on top of an existing
 * one.
 *
 * The editor used to place nodes at `200 + (n % 5) * 60` / `160 + (n % 4) * 40`.
 * Two things were wrong with that: 60px of horizontal step is less than the
 * 132px card, so every node covered its neighbour, and the modulo wrapped with
 * period lcm(5, 4) = 20, so node 21 landed on the exact coordinates of node 1.
 *
 * Then the first version of the spiral search below was still wrong in two ways,
 * both found by measuring the running app rather than by reading the code:
 *
 *   1. It spiralled in all four directions, so with a congested origin it
 *      wrapped around to *negative* coordinates. Adding five devices put the
 *      fourth at (-200, -80) -- off the canvas, where the user cannot see it.
 *   2. It treated CARD_MIN_HEIGHT = 120 as the collision height. Cards really
 *      render 117px to 188px tall, so two nodes 120px apart vertically were
 *      accepted as non-overlapping while their cards visibly intersected by up
 *      to 68px. The shipped SOHO template has exactly that collision.
 *
 * So the vertical pitch is now 200px, matching the horizontal pitch the
 * templates already use, and only the first quadrant is searched.
 */

/** Card width is fixed by the `w-[132px]` class in Canvas.tsx. */
export const CARD_WIDTH = 132;

/**
 * Worst-case rendered card height, measured in the running app: 117px for an
 * ODC, 188px for an ONT with alert badges stacked above the name. Rounded up to
 * the 200px pitch so there is clearance to spare -- content-driven height means
 * a card can grow, and a placement that only just clears today's tallest card
 * is one label change away from overlapping again.
 */
export const CARD_MAX_HEIGHT = 200;

/**
 * Grid pitch. The templates lay nodes out on a 200px row, and 200px also clears
 * CARD_MAX_HEIGHT, so a square lattice keeps both axes honest.
 */
export const SLOT_STEP: Point = { x: 200, y: 200 };

export const DEFAULT_ORIGIN: Point = { x: 200, y: 160 };

export interface Point {
  x: number;
  y: number;
}

export interface Footprint {
  width: number;
  height: number;
}

/** Axis-aligned overlap: two cards collide when they are close on both axes. */
export function overlaps(
  a: Point,
  b: Point,
  fp: Footprint = { width: CARD_WIDTH, height: CARD_MAX_HEIGHT },
): boolean {
  return Math.abs(a.x - b.x) < fp.width && Math.abs(a.y - b.y) < fp.height;
}

/**
 * First slot on the grid, spiralling outward from `origin` into the first
 * quadrant only, that collides with nothing in `occupied`.
 *
 * The first quadrant is the whole point of the quadrant restriction: `origin`
 * sits at (200, 160) while the FTTH template occupies a row at y=180, so the
 * first few rings are full. An unrestricted spiral responds by going up and to
 * the left, off the canvas.
 *
 * Deterministic: the same topology always yields the same placement, which
 * matters because this feeds the undo stack -- a slot that jumped around would
 * make undo look like it moved a device. Ring r in the first quadrant holds
 * (r+1)^2 - r^2 = 2r+1 slots, so searching `occupied.length` rings is far more
 * than the (sqrt(n)) actually needed.
 */
export function findFreeSlot(
  occupied: readonly Point[],
  origin: Point = DEFAULT_ORIGIN,
  step: Point = SLOT_STEP,
  fp: Footprint = { width: CARD_WIDTH, height: CARD_MAX_HEIGHT },
): Point {
  // More rings than needed is harmless; too few would silently fall through.
  //
  // `j` (the vertical offset) is the outer loop so a ring is walked row by row:
  // rightwards first, then downwards. Iterating the other way fills a column
  // before moving to the next, which puts devices in an order nobody expects
  // to read on a canvas.
  for (let ring = 0; ring <= occupied.length; ring++) {
    for (let j = 0; j <= ring; j++) {
      for (let i = 0; i <= ring; i++) {
        if (Math.max(i, j) !== ring) continue;
        const candidate: Point = { x: origin.x + i * step.x, y: origin.y + j * step.y };
        if (!occupied.some((other) => overlaps(candidate, other, fp))) {
          return candidate;
        }
      }
    }
  }
  // Every lattice slot around `origin` is taken. Returning `origin` overlaps, but
  // the editor has to put the device somewhere, and this is the documented
  // last resort rather than an assertion that would blank the canvas.
  return origin;
}
