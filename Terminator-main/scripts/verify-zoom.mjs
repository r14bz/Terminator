/**
 * Tests for src/utils/zoom.ts — canvas zoom and fit-to-view.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-zoom.mjs
 *
 * The regression: the clamp was written out five times with three different
 * ranges, so the toolbar buttons and the pinch/wheel gestures disagreed at the
 * edges. Pressing zoom-in while pinch-zoomed to 2.5 computed min(2.0, 2.65) =
 * 2.0 and shrank the view; pressing zoom-out at 0.4 computed max(0.5, 0.25) =
 * 0.5 and grew it. Both buttons did the opposite of their label.
 */
import assert from 'node:assert/strict';
import {
  FIT_PADDING, FIT_VIEW_MAX_ZOOM, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP,
  boundsOf, clampZoom, computeFitView, zoomIn, zoomOut,
} from '../src/utils/zoom.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

// --- Range ----------------------------------------------------------------
{
  ok('batas bawah 0.4', ZOOM_MIN === 0.4);
  ok('batas atas 2.5', ZOOM_MAX === 2.5);
  ok('rentang terukur', ZOOM_MAX > ZOOM_MIN);
  ok('langkah tombol 0.15', ZOOM_STEP === 0.15);
  ok('langkah tidak melewati batas atas', ZOOM_STEP < ZOOM_MAX);
}

// --- clampZoom -----------------------------------------------------------
{
  ok('di dalam rentang -> tidak berubah', clampZoom(1) === 1);
  ok('1.234 -> 1.23 (2dp)', clampZoom(1.234) === 1.23);
  ok('di bawah batas -> dikejar ke batas', clampZoom(0.01) === ZOOM_MIN);
  ok('di atas batas -> dikejar ke batas', clampZoom(99) === ZOOM_MAX);
  ok('tepat di batas bawah tetap', clampZoom(ZOOM_MIN) === ZOOM_MIN);
  ok('tepat di batas atas tetap', clampZoom(ZOOM_MAX) === ZOOM_MAX);
  ok('di bawah batas bawah', clampZoom(-5) === ZOOM_MIN);

  // The reason clampZoom guards its input: Math.min/max pass NaN straight
  // through, and scale(NaN) blanks the canvas with no way back.
  ok('NaN -> 1 (bukan NaN)', clampZoom(Number.NaN) === 1);
  // Infinity is non-finite too, so it resets with NaN rather than pinning to a
  // bound. Only a finite number can be meaningfully clamped, and 1 is the one
  // value the user always sees as "normal".
  ok('Infinity -> 1 (bukan batas atas)', clampZoom(Number.POSITIVE_INFINITY) === 1);
  ok('-Infinity -> 1', clampZoom(Number.NEGATIVE_INFINITY) === 1);
}

// --- The two reported jumps, stated as assertions -----------------------
{
  // Gesture reached 2.5; the zoom-in button used to compute min(2.0, 2.65) = 2.0.
  ok('dari 2.5, tombol + tidak mengecilkan', zoomIn(2.5) >= 2.5);
  ok('dari 2.5, tombol + tidak mengubah apa pun', zoomIn(2.5) === 2.5);
  ok('tombol + di batas atas = no-op', zoomIn(ZOOM_MAX) === ZOOM_MAX);

  // Gesture reached 0.4; the zoom-out button used to compute max(0.5, 0.25) = 0.5.
  ok('dari 0.4, tombol - tidak memperbesar', zoomOut(0.4) <= 0.4);
  ok('dari 0.4, tombol - tidak mengubah apa pun', zoomOut(0.4) === 0.4);
  ok('tombol - di batas bawah = no-op', zoomOut(ZOOM_MIN) === ZOOM_MIN);
}

// --- Buttons move monotonically inside the range -------------------------
{
  ok('tombol + selalu memperbesar', zoomIn(1) > 1);
  ok('tombol - selalu memperkecil', zoomOut(1) < 1);
  ok('+ lalu - kembali ke titik awal', zoomOut(zoomIn(1)) === 1);
  ok('- lalu + kembali ke titik awal', zoomIn(zoomOut(1)) === 1);
  ok('hasil + selalu di dalam rentang', zoomIn(ZOOM_MAX - 0.01) <= ZOOM_MAX);
  ok('hasil - selalu di dalam rentang', zoomOut(ZOOM_MIN + 0.01) >= ZOOM_MIN);
  ok('hasil + dibulatkan 2dp', Number.isInteger(zoomIn(0.7) * 100));
}

// --- Walking the whole range stays inside it ----------------------------
{
  let z = ZOOM_MIN;
  let inside = true;
  for (let i = 0; i < 40; i++) {
    z = zoomIn(z);
    if (z < ZOOM_MIN || z > ZOOM_MAX) inside = false;
  }
  ok('40 kali tombol + tidak keluar dari rentang', inside);
  ok('40 kali tombol + mentok di batas atas', z === ZOOM_MAX);

  let w = ZOOM_MAX;
  inside = true;
  for (let i = 0; i < 40; i++) {
    w = zoomOut(w);
    if (w < ZOOM_MIN || w > ZOOM_MAX) inside = false;
  }
  ok('40 kali tombol - tidak keluar dari rentang', inside);
  ok('40 kali tombol - mentok di batas bawah', w === ZOOM_MIN);
}

// --- boundsOf ------------------------------------------------------------
{
  const box = boundsOf([{ x: 100, y: 50 }, { x: 400, y: 200 }]);
  ok('minX benar', box.minX === 100);
  ok('minY benar', box.minY === 50);
  ok('maxX = koordinat terbesar', box.maxX === 400);
  ok('maxY = koordinat terbesar', box.maxY === 200);

  // x/y is the top-left corner, so the far corner has to be added or fitView
  // crops the rightmost and lowest cards.
  const withFp = boundsOf([{ x: 100, y: 50 }], { width: 132, height: 120 });
  ok('footprint: maxX + lebar kartu', withFp.maxX === 100 + 132);
  ok('footprint: maxY + tinggi kartu', withFp.maxY === 50 + 120);
  ok('footprint: minX tidak bergerak', withFp.minX === 100);
  ok('footprint: minY tidak bergerak', withFp.minY === 50);

  ok('kanvas kosong -> box nol', JSON.stringify(boundsOf([])) === JSON.stringify({ minX: 0, minY: 0, maxX: 0, maxY: 0 }));
  ok('satu titik -> box sepadan', boundsOf([{ x: 7, y: 9 }]).maxX === 7);
  ok('koordinat negatif tertangani', boundsOf([{ x: -50, y: -20 }, { x: 10, y: 5 }]).minX === -50);
}

// --- computeFitView: either it fits, or it is at the floor ---------------
// The honest invariant: clamping at ZOOM_MIN means a topology too wide for the
// viewport will NOT fit, and that is the floor, not a bug in the arithmetic.
const fitsOrAtFloor = (box, viewport, padding = FIT_PADDING) => {
  const { zoom, pan } = computeFitView(box, viewport, padding);
  const cw = box.maxX - box.minX + padding * 2;
  const ch = box.maxY - box.minY + padding * 2;
  const fits = cw * zoom <= viewport.width + 0.5 && ch * zoom <= viewport.height + 0.5;
  return { fits, atFloor: zoom === ZOOM_MIN, zoom, pan };
};

{
  // Desktop, standard FTTH template (6 nodes 200px apart, 132px cards).
  const box = boundsOf(
    [{ x: 80, y: 180 }, { x: 280, y: 180 }, { x: 480, y: 180 },
     { x: 680, y: 180 }, { x: 880, y: 180 }, { x: 1080, y: 180 }],
    { width: 132, height: 120 },
  );
  const desktop = fitsOrAtFloor(box, { width: 1440, height: 900 });
  ok('desktop: topologi muat', desktop.fits);
  ok('desktop: zoom di bawah cap', desktop.zoom <= FIT_VIEW_MAX_ZOOM);
  ok('desktop: zoom di atas batas bawah', desktop.zoom >= ZOOM_MIN);

  // Phone: the 1272px-wide template cannot fit in 360px at any readable zoom.
  const phone = fitsOrAtFloor(box, { width: 360, height: 740 });
  ok('ponsel: entah muat atau mentok di batas bawah', phone.fits || phone.atFloor);
  ok('ponsel: tidak keluar dari rentang', phone.zoom >= ZOOM_MIN && phone.zoom <= ZOOM_MAX);
}

// --- Single node, and the cap ------------------------------------------
{
  const box = boundsOf([{ x: 0, y: 0 }], { width: 132, height: 120 });
  const { zoom } = computeFitView(box, { width: 4000, height: 3000 });
  ok('topologi kecil tidak di blown up', zoom <= FIT_VIEW_MAX_ZOOM);
  ok('topologi kecil == cap', zoom === FIT_VIEW_MAX_ZOOM);
}

// --- Centering -----------------------------------------------------------
{
  const box = boundsOf([{ x: 0, y: 0 }, { x: 1000, y: 0 }], { width: 132, height: 120 });
  const viewport = { width: 2000, height: 800 };
  const { zoom, pan } = computeFitView(box, viewport);
  const cw = box.maxX - box.minX + FIT_PADDING * 2;
  const left = pan.x + box.minX * zoom - FIT_PADDING * zoom;
  const right = pan.x + box.maxX * zoom + FIT_PADDING * zoom;
  ok('centering: tepi kiri sejajar', Math.abs(left - (viewport.width - cw * zoom) / 2) < 0.01);
  ok('centering: tepi kanan sejajar', Math.abs(right - (viewport.width + cw * zoom) / 2) < 0.01);
  ok('centering: lebar benar', Math.abs(right - left - cw * zoom) < 0.01);
}

// --- Zoom is always a legal, finite value --------------------------------
{
  const viewports = [
    { width: 320, height: 480 }, { width: 768, height: 1024 },
    { width: 1440, height: 900 }, { width: 3840, height: 2160 },
  ];
  const boxes = [
    boundsOf([{ x: 0, y: 0 }], { width: 132, height: 120 }),
    boundsOf([{ x: 0, y: 0 }, { x: 1140, y: 320 }], { width: 132, height: 120 }),
    boundsOf([{ x: -500, y: -500 }, { x: 2000, y: 2000 }], { width: 132, height: 120 }),
  ];
  for (const v of viewports) {
    for (const b of boxes) {
      const { zoom, pan } = computeFitView(b, v);
      ok(`zoom sah untuk ${v.width}x${v.height}`, Number.isFinite(zoom) && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX);
      ok(`pan finite untuk ${v.width}x${v.height}`, Number.isFinite(pan.x) && Number.isFinite(pan.y));
    }
  }
}

console.log(`ok — ${n} assertions passed`);
