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
import { readFileSync } from 'node:fs';
import { canRedo, canUndo, createHistory, isSameSnapshot, pushSnapshot, redo, undo } from '../src/utils/historyCore.ts';

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
  // One clone, shared: App seeds nodes, cables and the initial history snapshot
  // from a single cloneTemplate() call, so the live state and `present` start
  // out reference-equal. That identity is what the no-op guard relies on.
  const initial = snap(initialTag);
  let nodes = initial.nodes;
  let cables = initial.cables;
  let history = createHistory(initial);
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
      // Memanggil fungsi yang sama dengan yang dipanggil App, bukan
      // menulis ulang ceknya di sini. Kalau guard-nya ditulis ulang di
      // test, test ini akan setuju dengan model apa pun yang dimodelkan --
      // persis jebakan yang bikin test placement dulu buta.
      if (isSameSnapshot(history, { nodes, cables })) {
        log.push('push: dilewati (tidak ada perubahan)');
        return;
      }
      history = pushSnapshot(history, { nodes, cables });
      log.push('push: ' + nodes[0]);
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
    /** Efek mount. StrictMode menjalankannya dua kali di dev. */
    mountRun() {
      runEffect();
    },
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

// --- 5. Mount must not record a step ---------------------------------------
// This one was found by driving the running app, not by reading the code: 500ms
// after every page load the pristine template was pushed into the history, so
// undo lit up with an empty past. Clicking it restored the identical topology
// and still reported "Perubahan diurungkan."
//
// The guard is a reference check, so it only works because nodes, cables and
// the initial snapshot come from one shared clone. Both halves are pinned here:
// a mount that records nothing, and a real edit straight after that still
// records.
{
  const h = mount('template');
  ok('mount: riwayat masih kosong', h.depth() === 0);
  h.mountRun();
  h.tick(1000);
  ok('mount tidak mencatat langkah', h.depth() === 0);
  ok('mount: undo tidak tersedia', h.undo() === false);

  // StrictMode invokes mount effects twice in development. If the guard had
  // been written as a plain "skip the first run" flag, the second run would
  // schedule the push and the bug would survive in dev while appearing fixed in
  // production. Reference equality is immune to that.
  const d = mount('template');
  d.mountRun();
  d.mountRun();
  d.tick(1000);
  ok('StrictMode: mount ganda tidak mencatat langkah', d.depth() === 0);

  d.edit('perubahan-pertama'); d.tick(1000);
  ok('edit setelah mount tetap tercatat', d.depth() === 1 && d.present() === 'perubahan-pertama');
  d.edit('perubahan-kedua'); d.tick(1000);
  ok('edit kedua tercatat terpisah', d.depth() === 2);

  ok('undo tersedia setelah edit nyata', d.undo() === true && d.present() === 'perubahan-pertama');
  ok('kembali ke template lewat undo', d.undo() === true && d.present() === 'template');
  ok('tidak ada langkah lebih', d.depth() === 0 && d.undo() === false);
}

// --- 6. A no-op update must not become a step ----------------------------
// Handlers that map over the array produce a new identity even when the
// contents are unchanged. The guard is deliberately identity-based, not a deep
// compare, so this documents the chosen line rather than asserting it away.
{
  const h = mount('a');
  h.edit('b'); h.tick(1000);
  h.editNoop('b'); h.tick(1000);
  ok('update dengan isi sama tapi identitas baru tetap jadi langkah', h.depth() === 2);
}

// --- 7. The shared-clone invariant in App.tsx -----------------------------
// Everything above is a model, so it cannot see App.tsx at all: if the component
// went back to seeding nodes, cables and the history from three separate
// cloneTemplate() calls, isSameSnapshot would be false at mount and the phantom
// step would come back, with every unit test still green. Only driving the
// running app catches that.
//
// So the coupling is pinned at the source instead. This is a call-count
// invariant with an exact expected value, not a "is this identifier used"
// guess: one seeding clone. A second one reintroduces the bug.
{
  const src = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  // Precisely one *seeding* clone. Not "one clone" overall: handleReset clones
  // the template again on purpose, because a reset must produce a new array
  // identity to count as an undo step. Asserting a bare call count got that
  // wrong on the first attempt.
  const seedClones = src.match(/useState\(\(\) => cloneTemplate/g) ?? [];
  ok('App.tsx: tepat satu clone untuk seed keadaan awal', seedClones.length === 1, `ditemukan ${seedClones.length}`);

  ok('App.tsx: keadaan awal dipakai bersama oleh nodes, cables dan history',
    /useState<NetworkNode\[\]>\(initial\.nodes\)/.test(src) &&
    /useState<CableConnection\[\]>\(initial\.cables\)/.test(src) &&
    /createHistory\(\{ nodes: initial\.nodes, cables: initial\.cables \}\)/.test(src));

  // A reset is a genuine edit, so it must not be routed through the memo.
  ok('App.tsx: handleReset tetap membuat clone baru', /const fresh = cloneTemplate\(TOPOLOGY_TEMPLATES\[0\]\)/.test(src));

  ok('App.tsx: pushSnapshot dijaga isSameSnapshot',
    /isSameSnapshot\(h, \{ nodes, cables \}\) \? h : pushSnapshot\(h, \{ nodes, cables \}\)/.test(src));
}

console.log(`ok — ${n} assertions passed`);
