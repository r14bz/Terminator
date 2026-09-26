/**
 * Tests for src/utils/nodePlacement.ts — device drop placement.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-placement.mjs
 *
 * Imports the real TypeScript module via Node's native type stripping.
 *
 * The regression: placement was `200 + (n % 5) * 60` / `160 + (n % 4) * 40`.
 * The 60px step is narrower than the 132px card, so every node covered the one
 * before it, and the modulo repeated with period lcm(5, 4) = 20 -- meaning node
 * 21 was placed on the exact coordinates of node 1.
 */
import assert from 'node:assert/strict';
import {
  CARD_MIN_HEIGHT, CARD_WIDTH, DEFAULT_ORIGIN, SLOT_STEP,
  findFreeSlot, overlaps,
} from '../src/utils/nodePlacement.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

const collides = (a, b) => overlaps(a, b);

// --- The constants match the shipped template grid ------------------------
{
  ok('lebar kartu 132px', CARD_WIDTH === 132);
  ok('grid 200x120 = pitch template', SLOT_STEP.x === 200 && SLOT_STEP.y === 120);
  ok('grid step >= footprint di kedua sumbu', SLOT_STEP.x >= CARD_WIDTH && SLOT_STEP.y >= CARD_MIN_HEIGHT);
}

// --- overlap() truth table -------------------------------------------------
{
  // A card is 132 wide and at least 120 tall, so clearance has to clear BOTH
  // axes before two positions count as separate.
  ok('sama titik = bertabrakan', collides({ x: 0, y: 0 }, { x: 0, y: 0 }));
  ok('100px horizontal saja masih bertabrakan (100 < 132)', collides({ x: 0, y: 0 }, { x: 100, y: 0 }));
  ok('100px vertikal saja masih bertabrakan (100 < 120)', collides({ x: 0, y: 0 }, { x: 0, y: 100 }));
  ok('140px horizontal = aman', !collides({ x: 0, y: 0 }, { x: 140, y: 0 }));
  ok('130px vertikal = aman', !collides({ x: 0, y: 0 }, { x: 0, y: 130 }));
  ok('1px di dalam tepi = bertabrakan', collides({ x: 0, y: 0 }, { x: 131, y: 119 }));
  ok('tepat di tepi = tidak bertabrakan', !collides({ x: 0, y: 0 }, { x: 132, y: 0 }));
  ok('simetris', collides({ x: 500, y: 500 }, { x: 631, y: 619 }) === collides({ x: 631, y: 619 }, { x: 500, y: 500 }));
}

// --- First slot is the origin when it is empty -----------------------------
{
  const slot = findFreeSlot([]);
  ok('kanvas kosong -> origin', slot.x === DEFAULT_ORIGIN.x && slot.y === DEFAULT_ORIGIN.y);
}

// --- Never collides, and never repeats, for a long run ---------------------
{
  const placed = [];
  for (let i = 0; i < 200; i++) {
    const slot = findFreeSlot(placed);
    // The two properties that were both broken before.
    ok(`node ${i + 1}: tidak bertabrakan dengan node sebelumnya`, placed.every((p) => !collides(slot, p)));
    ok(`node ${i + 1}: koordinat belum terpakai`, !placed.some((p) => p.x === slot.x && p.y === slot.y));
    placed.push(slot);
  }
}

// --- The exact failure from the old formula, stated as an assertion -------
{
  // Old: x = 200 + (n % 5) * 60, y = 160 + (n % 4) * 40. Node 21 (index 20)
  // repeats node 1 (index 0) exactly, and index 4 already overlaps index 0
  // because 60px < the 132px card.
  const oldSlot = (i) => ({ x: 200 + (i % 5) * 60, y: 160 + (i % 4) * 40 });
  ok('BUG lama: node 21 menimpa node 1 persis',
    oldSlot(20).x === oldSlot(0).x && oldSlot(20).y === oldSlot(0).y);
  // Within a row the step is 60px against a 132px card, so neighbours cover
  // each other. Row 1 is y=160 and row 2 is y=200, only 40px down, so the wrap
  // covers the row above as well.
  ok('BUG lama: node 2 menutupi node 1', collides(oldSlot(0), oldSlot(1)));
  ok('BUG lama: node 3 menutupi node 1', collides(oldSlot(0), oldSlot(2)));
  ok('BUG lama: node 6 (baris berikutnya) menutupi node 1', collides(oldSlot(0), oldSlot(5)));
  ok('BUG lama: 5 node pertama saling menimpa',
    [0, 1, 2, 3, 4].some((i) => [0, 1, 2, 3, 4].some((j) => j > i && collides(oldSlot(i), oldSlot(j)))));
}

// --- Handles a topology whose nodes are off-grid ---------------------------
// The shipped templates use 80/280/480/... , not multiples of the 200px pitch
// from 200, so a slot can land between existing rows.
{
  const template = [
    { x: 80, y: 180 }, { x: 280, y: 180 }, { x: 480, y: 180 },
    { x: 680, y: 180 }, { x: 880, y: 180 }, { x: 1080, y: 180 },
  ];
  const slot = findFreeSlot(template);
  ok('off-grid: slot tetap bebas', template.every((p) => !collides(slot, p)));
}

// --- Survives input that is already full of overlaps ----------------------
{
  // Stacked nodes: findFreeSlot must not loop forever or throw.
  const stacked = Array.from({ length: 30 }, () => ({ x: 100, y: 100 }));
  const slot = findFreeSlot(stacked);
  ok('input bertumpuk -> tetap dapat slot', typeof slot.x === 'number' && Number.isFinite(slot.x));
}

// --- Deterministic ---------------------------------------------------------
{
  const occupied = [{ x: 200, y: 160 }, { x: 400, y: 160 }];
  const a = findFreeSlot(occupied);
  const b = findFreeSlot(occupied);
  ok('penempatan deterministik', a.x === b.x && a.y === b.y);
}

// --- Respects a custom grid -----------------------------------------------
{
  const slot = findFreeSlot([], { x: 0, y: 0 }, { x: 500, y: 400 });
  ok('origin kustom dihormati', slot.x === 0 && slot.y === 0);

  // The spiral walks outward from the origin, so the first free slot is
  // whichever lattice point is nearest in ring order -- not necessarily +pitch.
  const crowded = [{ x: 0, y: 0 }];
  const spread = findFreeSlot(crowded, { x: 0, y: 0 }, { x: 500, y: 400 });
  ok('slot kustom selalu titik kisi', spread.x % 500 === 0 && spread.y % 400 === 0);
  ok('slot kustom bukan origin yang dipakai', !(spread.x === 0 && spread.y === 0));
  ok('slot kustom bebas', !collides(spread, crowded[0]));
  ok('slot kustom hanya satu langkah dari origin',
    Math.abs(spread.x) === 500 && Math.abs(spread.y) === 400);
}

console.log(`ok — ${n} assertions passed`);
