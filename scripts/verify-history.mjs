/**
 * Tests for src/utils/historyCore.ts — the undo/redo stack.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-history.mjs
 *
 * Imports the real TypeScript module via Node's native type stripping, so
 * these assertions cannot drift from the implementation.
 *
 * The regression this was extracted for: the stack lived in refs, and
 * canUndo/canRedo were computed from them during render. Writing a ref
 * schedules no render, so a counter existed purely to force one, and its value
 * was never read -- TypeScript flagged it as dead, but removing it would have
 * left the Undo button enabled after the history was already exhausted. Making
 * the stack state removed the counter entirely.
 */
import assert from 'node:assert/strict';
import {
  canRedo, canUndo, createHistory, pushSnapshot, redo, undo,
} from '../src/utils/historyCore.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

const snap = (label) => ({ nodes: [label], cables: [] });

// --- Fresh history has nothing to undo or redo ---------------------------
{
  const h = createHistory(snap('a'));
  ok('past kosong', h.past.length === 0);
  ok('future kosong', h.future.length === 0);
  ok('canUndo false', canUndo(h) === false);
  ok('canRedo false', canRedo(h) === false);
  ok('undo di stack kosong tidak apa-apa', undo(h) === h);
  ok('redo di stack kosong tidak apa-apa', redo(h) === h);
}

// --- One edit is one undo step --------------------------------------------
{
  let h = createHistory(snap('a'));
  h = pushSnapshot(h, snap('b'));
  ok('1 edit -> past berisi a', h.past.length === 1 && h.past[0].nodes[0] === 'a');
  ok('present adalah b', h.present.nodes[0] === 'b');
  ok('canUndo true', canUndo(h) === true);
  ok('canRedo masih false', canRedo(h) === false);

  h = undo(h);
  ok('undo kembali ke a', h.present.nodes[0] === 'a');
  ok('undo exhaust past', h.past.length === 0 && canUndo(h) === false);
  ok('undo mengisi future dengan b', h.future.length === 1 && h.future[0].nodes[0] === 'b');
  ok('setelah undo, canRedo true', canRedo(h) === true);

  h = redo(h);
  ok('redo kembali ke b', h.present.nodes[0] === 'b');
  ok('redo mengosongkan future', h.future.length === 0 && canRedo(h) === false);
  ok('redo mengembalikan past', h.past.length === 1 && canUndo(h) === true);
}

// --- Round trip across many steps ----------------------------------------
{
  let h = createHistory(snap('0'));
  for (let i = 1; i <= 20; i++) h = pushSnapshot(h, snap(String(i)));
  ok('21 snapshot: 20 di past', h.past.length === 20);

  for (let i = 20; i > 0; i--) {
    h = undo(h);
    ok(`undo ke-${i} menghasilkan present ${i - 1}`, h.present.nodes[0] === String(i - 1));
  }
  ok('tuntas undo', canUndo(h) === false && h.present.nodes[0] === '0');
  for (let i = 0; i < 20; i++) h = redo(h);
  ok('tuntas redo', canRedo(h) === false && h.present.nodes[0] === '20');
}

// --- Editing after an undo discards the redo branch -----------------------
{
  let h = createHistory(snap('a'));
  h = pushSnapshot(h, snap('b'));
  h = pushSnapshot(h, snap('c'));
  h = undo(h);            // present = b, future = [c]
  ok('state setelah undo', h.present.nodes[0] === 'b' && h.future.length === 1);

  h = pushSnapshot(h, snap('d'));   // cabang baru
  ok('push baru membuang future', h.future.length === 0);
  ok('canRedo mati setelah cabang baru', canRedo(h) === false);
  ok('redo jadi no-op', redo(h) === h);
  ok('present = d', h.present.nodes[0] === 'd');
  ok('undo kembali ke b, bukan c', undo(h).present.nodes[0] === 'b');
}

// --- The stack holds references, not copies -------------------------------
// Worth pinning down: a snapshot is never deep-copied, so an undo restores the
// exact object the editor had, and identity comparisons stay meaningful. The
// trade-off is that callers must not mutate a snapshot after handing it over --
// which is why every writer in App.tsx builds a fresh {nodes, cables} literal.
{
  const a = snap('a');
  let h = createHistory(a);
  const b = snap('b');
  const c = snap('c');
  h = pushSnapshot(h, b);
  h = pushSnapshot(h, c);

  ok('undo mengembalikan object yang sama, bukan salinan', undo(h).present === b);
  ok('past menyimpan object asli', h.past[0] === a && h.past[1] === b);
  const back = undo(undo(h));
  ok('undo dua kali kembali ke object awal', back.present === a);
  ok('redo mengembalikan object yang sama', redo(back).present === b);
}

// --- Pushing the same snapshot twice still records two steps --------------
{
  const a = snap('a');
  let h = createHistory(a);
  h = pushSnapshot(h, a);
  h = pushSnapshot(h, a);
  ok('dua push = dua langkah undo', h.past.length === 2);
  ok('undo tetap idempoten walau isinya sama', undo(undo(h)).present === a);
  ok('tidak ada langkah yang hilang', canUndo(undo(undo(h))) === false);
}

// --- Nodes and cables travel together -------------------------------------
{
  let h = createHistory({ nodes: ['n0'], cables: ['c0'] });
  h = pushSnapshot(h, { nodes: ['n1'], cables: ['c1'] });
  h = undo(h);
  ok('undo memulihkan cables juga', h.present.cables[0] === 'c0' && h.present.nodes[0] === 'n0');
}

console.log(`ok — ${n} assertions passed`);
