/**
 * Zoom rules for the canvas, in one place.
 *
 * The clamp used to be written out five times and the five copies disagreed:
 *
 *   Canvas fitView   [0.5, 2.0]   (and the 2.0 half is dead -- the line above
 *                                 already caps the fit at 1.4)
 *   Canvas wheel     [0.4, 2.5]
 *   Canvas pinch     [0.4, 2.5]
 *   App zoom-in btn  max 2.0, no minimum
 *   App zoom-out btn min 0.5, no maximum
 *
 * Because the toolbar buttons and the gestures had different ranges, they
 * disagreed at the edges rather than just being sloppy. A pinch could take the
 * view to 2.5; pressing the zoom-in button then computed min(2.0, 2.65) = 2.0
 * and made the view *smaller*. Symmetrically, pinching to 0.4 and pressing
 * zoom-out computed max(0.5, 0.25) = 0.5 and made the view *bigger*. The
 * button you press always did the opposite of what its label says.
 */

/** Below this the 132px cards are unreadable, so fitting gets priority. */
export const ZOOM_MIN = 0.4;

/** Generous top end: users inspect single ports and label text. */
export const ZOOM_MAX = 2.5;

/** Toolbar buttons move in fixed steps; gestures scale by a factor. */
export const ZOOM_STEP = 0.15;

/**
 * fitView never zooms *in* past this. A two-node topology blown up to 250%
 * looks broken, and padding already keeps a small topology framed.
 */
export const FIT_VIEW_MAX_ZOOM = 1.4;

export const FIT_PADDING = 120;

/**
 * Clamp to the supported range and round to 2dp.
 *
 * A non-finite input would poison the zoom forever (`NaN` survives Math.min
 * and Math.max, and `scale(NaN)` blanks the canvas), so it resets to 1.
 */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(zoom.toFixed(2))));
}

/** Toolbar zoom-in. A no-op at ZOOM_MAX, never a jump in the other direction. */
export function zoomIn(zoom: number): number {
  return clampZoom(zoom + ZOOM_STEP);
}

/** Toolbar zoom-out. A no-op at ZOOM_MIN. */
export function zoomOut(zoom: number): number {
  return clampZoom(zoom - ZOOM_STEP);
}

export interface Point {
  x: number;
  y: number;
}

export interface Footprint {
  width: number;
  height: number;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Bounding box of the drawn content.
 *
 * `x`/`y` on a node is its top-left corner, so the bottom-right corner of the
 * rightmost and lowest cards hangs outside a naive min/max of the coordinates
 * by the full card size. fitView is documented as keeping the topology on
 * screen, and without the footprint it never quite did.
 */
export function boundsOf(points: readonly Point[], footprint?: Footprint): Box {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (footprint) {
    maxX += footprint.width;
    maxY += footprint.height;
  }
  return { minX, minY, maxX, maxY };
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Scale and pan that bring `box` fully inside `viewport`.
 *
 * Pure, so the arithmetic that used to be inline in a useCallback can be
 * checked directly instead of by looking at the canvas.
 */
export function computeFitView(
  box: Box,
  viewport: Viewport,
  padding: number = FIT_PADDING,
): { zoom: number; pan: Point } {
  const contentWidth = box.maxX - box.minX + padding * 2;
  const contentHeight = box.maxY - box.minY + padding * 2;
  // Rounded *down*, unlike clampZoom's round-to-nearest. Rounding to nearest can
  // land half a percent above the scale that exactly fits -- 1.0496 becomes 1.05,
  // which is 0.6px wider than a 1440px viewport -- and that is enough to push the
  // rightmost card off-screen, the one thing fitView exists to prevent. Losing up
  // to 1% of the scale costs nothing visually.
  const scale = Math.min(viewport.width / contentWidth, viewport.height / contentHeight, FIT_VIEW_MAX_ZOOM);
  const zoom = clampZoom(Math.floor(scale * 100) / 100);
  return {
    zoom,
    pan: {
      x: (viewport.width - contentWidth * zoom) / 2 - box.minX * zoom + padding * zoom,
      y: (viewport.height - contentHeight * zoom) / 2 - box.minY * zoom + padding * zoom,
    },
  };
}
