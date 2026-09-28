/**
 * Tests for src/utils/nodePlacement.ts — device drop placement.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-placement.mjs
 *
 * Imports the real TypeScript module via Node's native type stripping.
 *
 * Two regressions are covered here.
 *
 * The first: placement was `200 + (n % 5) * 60` / `160 + (n % 4) * 40`. The 60px
 * step is narrower than the 132px card, so every node covered the one before
 * it, and the modulo repeated with period lcm(5, 4) = 20 -- meaning node 21
 * was placed on the exact coordinates of node 1.
 *
 * The second is subtler and is why the collision predicate below is written out
 * by hand instead of importing `overlaps`. The first version of this file
 * asserted with `const collides = (a, b) => overlaps(a, b)` -- the module's own
 * function. That makes the test agree with the implementation by construction:
 * when `overlaps` was wrong, both were wrong together and 425 assertions passed
 * anyway. The real defect was that `overlaps` used a 120px height while cards
 * actually render up to 188px tall, so nodes 120px apart were accepted while
 * their cards visibly intersected. Measuring the running app is what exposed
 * it, not reading the code.
 */
import assert from 'node:assert/strict';
import {
  CARD_MAX_HEIGHT, CARD_WIDTH, DEFAULT_ORIGIN, SLOT_STEP,
  findFreeSlot, overlaps,
} from '../src/utils/nodePlacement.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

/**
 * Collision predicate written from scratch, against the card size that was
 * *measured in the running app* rather than read from the module. ODC measured
 * 117px, ONT with badges measured 188px. Deliberately does not call `overlaps`.
 */
const REAL_CARD_W = 132;
const REAL_CARD_H = 188;
const collides = (a, b) =>
  Math.abs(a.x - b.x) < REAL_CARD_W && Math.abs(a.y - b.y) < REAL_CARD_H;

/** Menambah `count` node satu per satu, persis seperti handleAddDevice. */
function place(occupied, count) {
  const all = [...occupied];
  for (let i = 0; i < count; i++) all.push(findFreeSlot(all));
  return all;
}

// --- The constants clear a card that is actually as tall as it gets -------
{
  ok('lebar kartu 132px', CARD_WIDTH === 132);
  ok('grid 200x200', SLOT_STEP.x === 200 && SLOT_STEP.y === 200);
  ok('tinggi kartu 200px menutup 188px terukur', CARD_MAX_HEIGHT === 200);
  ok('grid step >= footprint di kedua sumbu', SLOT_STEP.x >= CARD_WIDTH && SLOT_STEP.y >= CARD_MAX_HEIGHT);
  ok('langkah vertikal cukup untuk kartu terukur', SLOT_STEP.y >= REAL_CARD_H);
}

// --- overlap() truth table -------------------------------------------------
{
  const p = (x, y) => ({ x, y });
  ok('sama titik -> true', overlaps(p(0, 0), p(0, 0)));
  ok('sebarang 132px -> true', overlaps(p(0, 0), p(131, 0)));
  ok('tepat 132px -> false', overlaps(p(0, 0), p(132, 0)) === false);
  ok('sebarang 200px vertikal -> true', overlaps(p(0, 0), p(0, 199)));
  ok('tepat 200px vertikal -> false', overlaps(p(0, 0), p(0, 200)) === false);
  ok('jauh di kedua sumbu -> false', overlaps(p(0, 0), p(900, 900)) === false);
}

// --- First slot is the origin when it is empty -----------------------------
{
  const slot = findFreeSlot([]);
  ok('kanvas kosong -> origin', slot.x === DEFAULT_ORIGIN.x && slot.y === DEFAULT_ORIGIN.y);
}

// --- Placement stays on the canvas, and never collides ---------------------
// The FTTH template is the real starting point: origin (200,160) sits inside
// its row at y=180, so the first rings are full. Measured in the browser, the
// old unrestricted spiral answered that by placing the fourth device at
// (-200, -80) and letting it collide with the fifth.
const FTTH = [
  { x: 80, y: 180 }, { x: 280, y: 180 }, { x: 480, y: 180 },
  { x: 680, y: 180 }, { x: 880, y: 180 }, { x: 1080, y: 180 },
];
{
  const placed = place(FTTH, 5);
  ok('lima node ditambahkan', placed.length === FTTH.length + 5);

  const fresh = placed.slice(FTTH.length);
  for (const s of fresh) {
    ok(`tidak negatif: (${s.x},${s.y})`, s.x >= 0 && s.y >= 0);
  }

  let clashes = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (collides(placed[i], placed[j])) clashes++;
    }
  }
  ok('tidak ada yang bertumpuk pada tinggi kartu terukur', clashes === 0, `${clashes} pasangan`);

  const coords = new Set(placed.map((s) => `${s.x},${s.y}`));
  ok('tidak ada slot yang dipakai dua kali', coords.size === placed.length);
}

// --- Off-grid neighbours are what actually pin the collision height --------
// Asserting `CARD_MAX_HEIGHT === 200` only pins a literal; change the constant
// and the literal assertion together and it says nothing. What genuinely
// constrains the height is a node that is NOT on the 200px lattice, because
// lattice slots are 200px apart and therefore can never collide with each other
// however the height is set. Template nodes are hand-placed, so that case is
// real: one 150px away is rejected only when the threshold exceeds 150.
{
  const offGrid = [{ x: 0, y: 150 }];
  const slot = findFreeSlot(offGrid, { x: 0, y: 0 }, SLOT_STEP);
  ok('node off-grid 150px dari origin ditolak', !collides(slot, offGrid[0]), `slot (${slot.x},${slot.y})`);
  ok('slot dari node off-grid bukan origin itu sendiri', slot.x !== 0 || slot.y !== 0);

  // The shipped SOHO template stacks three nodes 120px apart, which is the exact
  // geometry that made those cards intersect. Documented rather than
  // discriminating: it passes at either threshold.
  const soho = [{ x: 800, y: 80 }, { x: 800, y: 200 }, { x: 800, y: 320 }];
  const s = findFreeSlot(soho);
  ok('topologi SOHO: slot baru tidak menimpa node mana pun', soho.every((o) => !collides(s, o)), `slot (${s.x},${s.y})`);
}

// --- Long run: 60 devices, no collisions, no negatives ---------------------
{
  const placed = place([], 60);
  let clashes = 0;
  let negative = 0;
  for (let i = 0; i < placed.length; i++) {
    if (placed[i].x < 0 || placed[i].y < 0) negative++;
    for (let j = i + 1; j < placed.length; j++) {
      if (collides(placed[i], placed[j])) clashes++;
    }
  }
  ok('60 node: nol tumpang tindih', clashes === 0, `${clashes} pasangan`);
  ok('60 node: nol koordinat negatif', negative === 0, `${negative} node`);
}

// --- A dense, messy topology still yields legal slots ----------------------
{
  const messy = [];
  for (let x = 0; x < 2000; x += 200) for (let y = 0; y < 2000; y += 200) messy.push({ x, y });
  const placed = place(messy, 3);
  for (const s of placed.slice(messy.length)) {
    ok(`topologi padat -> slot legal (${s.x},${s.y})`, s.x >= 0 && s.y >= 0);
  }
}

// --- The exact failure from the old modulo formula, as an assertion --------
{
  // Reproduces the old code and shows it collides, so the regression is real
  // rather than folklore.
  const old = [];
  for (let i = 0; i < 25; i++) {
    old.push({ x: 200 + (i % 5) * 60, y: 160 + (i % 4) * 40 });
  }
  let clashes = 0;
  for (let i = 0; i < old.length; i++) {
    for (let j = i + 1; j < old.length; j++) if (collides(old[i], old[j])) clashes++;
  }
  ok('rumus lama benar-benar bertumpuk (alasan ada regression)', clashes > 0, `${clashes} pasangan`);

  const fresh = place([], 25);
  let newClashes = 0;
  for (let i = 0; i < fresh.length; i++) {
    for (let j = i + 1; j < fresh.length; j++) if (collides(fresh[i], fresh[j])) newClashes++;
  }
  ok('25 node dengan cara baru: nol tumpang tindih', newClashes === 0, `${newClashes} pasangan`);
}

// --- Deterministic ---------------------------------------------------------
{
  const a = place(FTTH, 4).map((s) => `${s.x},${s.y}`).join('|');
  const b = place(FTTH, 4).map((s) => `${s.x},${s.y}`).join('|');
  ok('penempatan deterministik', a === b);
}

// --- Respects a custom grid ------------------------------------------------
{
  const origin = { x: 0, y: 0 };
  const step = { x: 400, y: 400 };
  const s1 = findFreeSlot([], origin, step);
  ok('origin khusus dihormati', s1.x === 0 && s1.y === 0);
  const s2 = findFreeSlot([{ x: 0, y: 0 }], origin, step);
  ok('langkah khusus dihormati', s2.x === 400 && s2.y === 0);
  const s3 = findFreeSlot([{ x: 0, y: 0 }, { x: 400, y: 0 }], origin, step);
  ok('langkah khusus: baris berikutnya', s3.x === 0 && s3.y === 400);
}

// --- Saturated topology falls back to the origin, documented --------------
{
  // 8x8 of lattice slots blocks every candidate in the first 8 rings, so the
  // search runs out. It must still return a point rather than throw, because
  // the editor cannot refuse to place a device.
  const solid = [];
  for (let i = -1; i <= 8; i++) for (let j = -1; j <= 8; j++) {
    solid.push({ x: DEFAULT_ORIGIN.x + i * 200, y: DEFAULT_ORIGIN.y + j * 200 });
  }
  const s = findFreeSlot(solid);
  ok('topologi jenuh tetap mengembalikan titik', Number.isFinite(s.x) && Number.isFinite(s.y));
}

console.log(`ok — ${n} assertions passed`);
