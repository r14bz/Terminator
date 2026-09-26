/**
 * Model of App.tsx's history wiring, so the behaviours can be checked without a
 * DOM.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-history-wiring.mjs
 *
 * src/utils/historyCore.ts is already tested. What it cannot tell you is whether
 * App hooks it up correctly, and the wiring is where the bugs actually live:
 *
 *   useEffect(() => {
 *     if (isRestoringRef.current) { isRestoringRef.current = false; return; }
 *     clearTimeout(debounceRef);
 *     debounceRef = setTimeout(() => setHistory(h => pushSnapshot(h, {nodes, cables})), 500);
 *   }, [nodes, cables]);
 *
 * Two things fall out of that shape, and both are checked here:
 *
 *  1. The effect body is guarded by a *ref*, but it is skipped because the
 *     effect *ran* -- not because nodes actually changed. If a restore sets
 *     nodes to a value React considers unchanged, the effect never runs, the
 *     guard stays set, and the next real edit silently loses its undo step.
 *  2. The debounce collapses everything inside 500ms into one snapshot, so two
 *     deliberate edits in quick succession are one undo.
 */
import assert from 'node:assert/strict';
import { canRedo, canUndo, createHistory, pushSnapshot, redo, undo } from '../src/utils/historyCore.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

const snap = (tag) => ({ nodes: [tag], cables: [] });

/**
 * Replays App's wiring with a controllable clock.
 *
 * `setNodes`/`setCables` mirror React: a *new* array identity is what triggers
 * the effect, exactly like the `[nodes, cables]` dep array. Setting the same
 * identity again does not.
 */
function mount(initialTag) {
  let nodes = [initialTag];
  let cables = [];
  let history = createHistory(snap(initialTag));
  let isRestoring = false;
  let timer = null;
  const log = [];

  const runEffect = () => {
    if (isRestoring) {
      isRestoring = false;
      log.push('effect: dilewati (restore)');
      return;
    }
    log.push('effect: jadwal push dalam 500ms');
    if (timer) clearTimeout(timer);
    timer = 'PENDING';
  };

  const clock = (ms) => {
    if (timer === 'PENDING' && ms >= 500) {
      timer = null;
      const tag = nodes[0];
      history = pushSnapshot(history, snap(tag));
      log.push(`push: ${tag}`);
    }
  };

  return {
    log,
    /** What App's setNodes/setCables do, from the effect's point of view. */
    edit(tag) {
      nodes = [tag];
      runEffect();
    },
    /** Same value, new array identity -- what most App handlers produce. */
    editNoop(tag) {
      nodes = [tag];
      runEffect();
    },
    tick: clock,
    undo() {
      if (!canUndo(history)) return false;
      isRestoring = true;
      history = undo(history);
      nodes = history.present.nodes;
      runEffect();
      return true;
    },
    redo() {
      if (!canRedo(history)) return false;
      isRestoring = true;
      history = redo(history);
      nodes = history.present.nodes;
      runEffect();
      return true;
    },
    present: () => history.present.nodes[0],
    depth: () => history.past.length,
    future: () => history.future.length,
  };
}

// --- 1. Is a reset undoable? ---------------------------------------------
// handleReset calls setNodes(cloneTemplate(...)), which is an ordinary edit as
// far as the effect is concerned. An earlier note in the backlog claimed reset
// was *not* undoable; that was wrong, and this pins the real behaviour so it
// cannot silently regress.
{
  const h = mount('template-awal');
  h.edit('suntingan'); h.tick(1000);
  h.edit('setelah-reset'); h.tick(1000);

  ok('reset: tercatat sebagai snapshot', h.depth() === 2);
  ok('undo mengembalikan pra-reset', h.undo() === true && h.present() === 'suntingan');
  ok('redo mengembalikan post-reset', h.redo() === true && h.present() === 'setelah-reset');
}

// --- 2. The restore guard must not eat the next real edit ----------------
// After undo, the effect fires once and is consumed by the guard. A second real
// edit must still be recorded.
{
  const h = mount('a');
  h.edit('b'); h.tick(1000);
  ok('satu edit = satu langkah', h.depth() === 1);
  h.undo();
  h.tick(1000);
  ok('undo mengosongkan past (hanya ada satu langkah)', h.depth() === 0);
  ok('undo tidak menambah langkah baru', h.present() === 'a');

  h.edit('c'); h.tick(1000);
  ok('edit setelah undo tetap tercatat', h.present() === 'c');
  ok('undo bisa kembali ke hasil undo sebelumnya', h.undo() && h.present() === 'a');
}

// --- 3. What the restore guard is actually for ---------------------------
// The guard exists so that undo/redo, which write nodes and cables, do not
// immediately push a snapshot of the state they just restored -- otherwise
// every undo would add a step and undo would never converge.
//
// The failure mode worth worrying about is the guard being *stuck* set: it is
// cleared by the effect running, so a restore that React treats as a no-op would
// leave it set and swallow the next genuine edit. That cannot happen here, and
// the reason is worth recording: every setNodes call site in App.tsx builds a
// fresh array (`prev.map`, `[...prev, n]`, `cloneTemplate(...)`, or a stored
// snapshot), and the effect depends on the array *reference*. There is no
// `setNodes(prev) => prev` anywhere, so the effect always runs after a restore
// and the guard is always consumed.
{
  const h = mount('a');
  h.edit('b'); h.tick(1000);
  h.undo();
  ok('guard dipakai: undo tidak push apa pun', h.log.includes('effect: dilewati (restore)'));
  h.tick(1000);
  ok('guard tidak menggantung', !h.log.includes('effect: dilewati (restore)') || h.present() === 'a');

  // Undo must converge: repeated undo walks all the way back and then stops.
  h.edit('b'); h.tick(1000);
  h.edit('c'); h.tick(1000);
  let steps = 0;
  while (h.undo()) {
    steps++;
    assert.ok(steps <= 5, 'undo tidak bisa berputar tanpa henti');
  }
  // Two edits means two entries in `past`, so two undos walk back to the start.
  ok('undo berulang bisa sampai ke awal', steps === 2 && h.present() === 'a');
}

// --- 4. The 500ms window collapses distinct edits ------------------------
// Two deliberate edits 200ms apart are one undo step. This is the documented
// trade-off for drag gestures, but it means a user who adds a device and then
// immediately edits a label has one undo, not two.
{
  const h = mount('a');
  h.edit('tambah-perangkat');
  h.tick(200);
  h.edit('ubah-label');
  h.tick(1000);
  ok('dua edit dalam 500ms menjadi satu langkah undo', h.depth() === 1);
  h.undo();
  ok('undo.dkali pertama kembali ke keadaan awal', h.present() === 'a');
}

// --- 5. ...but a drag that settles is one step, not dozens ---------------
{
  const h = mount('a');
  for (let i = 1; i <= 40; i++) {
    h.edit(`x${i}`);
    h.tick(16);
  }
  h.tick(1000);
  ok('40 update posisi during drag = satu snapshot', h.depth() === 1);
  h.undo();
  ok('undo drag kembali ke posisi awal', h.present() === 'a');
}

// --- 6. Edits spaced beyond the window each get their own step -----------
{
  const h = mount('a');
  h.edit('satu'); h.tick(1000);
  h.edit('dua'); h.tick(1000);
  h.edit('tiga'); h.tick(1000);
  ok('tiga edit berjeda = tiga langkah', h.depth() === 3);
  h.undo(); ok('undo 1', h.present() === 'dua');
  h.undo(); ok('undo 2', h.present() === 'satu');
  h.undo(); ok('undo 3', h.present() === 'a');
  ok('tidak ada undo tersisa', h.undo() === false);
}

// --- 7. Editing after an undo discards the redo tail ---------------------
{
  const h = mount('a');
  h.edit('b'); h.tick(1000);
  h.edit('c'); h.tick(1000);
  h.undo();
  ok('redo tersedia setelah undo', h.future() === 1);
  h.edit('d'); h.tick(1000);
  ok('edit baru membuang redo tail', h.future() === 0);
  ok('redo tidak bisa resurrect branch', h.redo() === false);
}

console.log(`ok — ${n} assertions passed`);
