export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 0.15;
export const FIT_VIEW_MAX_ZOOM = 1.0;
export const FIT_PADDING = 60;

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Footprint {
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  return Math.round(clamped * 100) / 100;
}

export function zoomIn(z: number): number {
  return clampZoom(Math.round((z + ZOOM_STEP) * 100) / 100);
}

export function zoomOut(z: number): number {
  return clampZoom(Math.round((z - ZOOM_STEP) * 100) / 100);
}

export function boundsOf(points: readonly Point[], fp?: Footprint): Box {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
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

  if (fp) {
    maxX += fp.width;
    maxY += fp.height;
  }

  return { minX, minY, maxX, maxY };
}

export function computeFitView(
  box: Box,
  viewport: Viewport,
  padding: number = FIT_PADDING,
): { zoom: number; pan: Point } {
  const cw = box.maxX - box.minX + padding * 2;
  const ch = box.maxY - box.minY + padding * 2;

  if (cw <= 0 || ch <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { zoom: 1, pan: { x: 0, y: 0 } };
  }

  const scaleX = viewport.width / cw;
  const scaleY = viewport.height / ch;
  const rawZoom = Math.min(scaleX, scaleY);
  const zoom = clampZoom(Math.min(FIT_VIEW_MAX_ZOOM, rawZoom));

  const panX = (viewport.width - (box.minX + box.maxX) * zoom) / 2;
  const panY = (viewport.height - (box.minY + box.maxY) * zoom) / 2;

  return {
    zoom,
    pan: { x: panX, y: panY },
  };
}
