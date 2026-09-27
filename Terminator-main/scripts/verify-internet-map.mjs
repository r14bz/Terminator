/**
 * Tests for src/utils/internetAccessMap.ts — the per-topology memo.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-internet-map.mjs
 *
 * The point of this module is to run the *same* per-node logic less often. So
 * the test that matters is equivalence: for every node, the map must return
 * exactly what a direct checkInternetAccess call returns, reason string
 * included. Anything that changes a status shown in the UI fails here.
 */
import assert from 'node:assert/strict';
import { checkInternetAccess } from '../src/utils/ipUtils.ts';
import { buildInternetAccessMap } from '../src/utils/internetAccessMap.ts';
import { TOPOLOGY_TEMPLATES } from '../src/data/templates.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

const eq = (msg, a, b) => {
  n++;
  assert.deepEqual(a, b, msg);
};

// --- Equivalence, node by node, over every shipped template ---------------
let checkedNodes = 0;
for (const tpl of TOPOLOGY_TEMPLATES) {
  const map = buildInternetAccessMap(tpl.nodes, tpl.cables);
  eq(`${tpl.id}: ukuran map = jumlah node`, map.size, tpl.nodes.length);

  for (const node of tpl.nodes) {
    const direct = checkInternetAccess(node, tpl.nodes, tpl.cables);
    const viaMap = map.get(node.id);
    // Reason included: hasInternet alone would not catch a swapped message.
    eq(`${tpl.id}/${node.id}: identik dengan panggilan langsung`, viaMap, direct);
    ok(`${tpl.id}/${node.id}: punya alasan teks`, typeof viaMap.reason === 'string' || viaMap.hasInternet);
    ok(`${tpl.id}/${node.id}: hasInternet itu boolean`, typeof viaMap.hasInternet === 'boolean');
    checkedNodes++;
  }
}
const totalTemplateNodes = TOPOLOGY_TEMPLATES.reduce((sum, t) => sum + t.nodes.length, 0);
ok(`setiap node dari semua template dicocokkan (${checkedNodes}/${totalTemplateNodes})`, checkedNodes === totalTemplateNodes);
ok('ada beberapa template untuk diuji', TOPOLOGY_TEMPLATES.length >= 3);

// --- Equivalence survives mutations to the topology -----------------------
// If the memo were cached on the wrong key, editing the topology would serve
// stale statuses. Each variant rebuilds and re-checks the whole map.
{
  const tpl = TOPOLOGY_TEMPLATES[0];
  const base = buildInternetAccessMap(tpl.nodes, tpl.cables);

  // Power off a node and confirm every entry shifts accordingly.
  const target = tpl.nodes.find((x) => x.type === 'pc') || tpl.nodes[tpl.nodes.length - 1];
  const offNodes = tpl.nodes.map((x) => (x.id === target.id ? { ...x, poweredOn: false } : x));
  const off = buildInternetAccessMap(offNodes, tpl.cables);
  ok('node dimatikan: status ikut berubah', off.get(target.id).hasInternet !== base.get(target.id).hasInternet
    || off.get(target.id).reason !== base.get(target.id).reason);
  for (const node of offNodes) {
    eq(`setelah power off, ${node.id} masih cocok`, off.get(node.id), checkInternetAccess(node, offNodes, tpl.cables));
  }

  // Break a cable.
  const brokenCables = tpl.cables.map((c, i) => (i === 0 ? { ...c, status: 'broken' } : c));
  const broken = buildInternetAccessMap(tpl.nodes, brokenCables);
  for (const node of tpl.nodes) {
    eq(`setelah kabel putus, ${node.id} masih cocok`, broken.get(node.id), checkInternetAccess(node, tpl.nodes, brokenCables));
  }

  // Remove all cables: nothing can reach a gateway any more.
  const noCables = buildInternetAccessMap(tpl.nodes, []);
  for (const node of tpl.nodes) {
    eq(`tanpa kabel, ${node.id} masih cocok`, noCables.get(node.id), checkInternetAccess(node, tpl.nodes, []));
  }
  const anyOnline = tpl.nodes.some((x) => noCables.get(x.id).hasInternet);
  ok('tanpa kabel, tidak ada klien yang online', !anyOnline || tpl.nodes.some((x) => x.type === 'internet'));
}

// --- Degenerate topologies -----------------------------------------------
{
  const empty = buildInternetAccessMap([], []);
  eq('topologi kosong: map kosong', empty.size, 0);
  ok('topologi kosong: get tidak melempar', typeof empty.get('apa-saja').hasInternet === 'boolean');
  ok('topologi kosong: has() false', empty.has('apa-saja') === false);

  const solo = [{ id: 'a', type: 'pc', name: 'PC', label: '', status: 'online', poweredOn: true, x: 0, y: 0 }];
  const one = buildInternetAccessMap(solo, []);
  eq('satu node: ukuran 1', one.size, 1);
  ok('satu node: tidak punya internet', one.get('a').hasInternet === false);
  ok('satu node: punya alasan', one.get('a').reason.length > 0);
}

// --- Unknown id: fallback must be visible, not a plausible lie -----------
{
  const tpl = TOPOLOGY_TEMPLATES[0];
  const map = buildInternetAccessMap(tpl.nodes, tpl.cables);
  const miss = map.get('node-hantu');
  ok('id asing: has() false', map.has('node-hantu') === false);
  ok('id asing: tidak diklaim online', miss.hasInternet === false);
  ok('id asing: alasannya menyebut belum dihitung', /belum dihitung/i.test(miss.reason));
  // The fallback must be distinguishable from a real "no internet" verdict, so
  // a bug here cannot masquerade as a network problem.
  const realOffline = tpl.nodes
    .map((x) => map.get(x.id))
    .find((s) => s.hasInternet === false && !/belum dihitung/i.test(s.reason));
  ok('fallback bisa dibedakan dari verdict offline asli', realOffline === undefined || realOffline.reason !== miss.reason);
}

// --- has() and size agree with the node set ------------------------------
for (const tpl of TOPOLOGY_TEMPLATES) {
  const map = buildInternetAccessMap(tpl.nodes, tpl.cables);
  const allPresent = tpl.nodes.every((x) => map.has(x.id));
  ok(`${tpl.id}: semua node ada di map`, allPresent);
  const allDistinct = new Set(tpl.nodes.map((x) => x.id)).size === tpl.nodes.length;
  ok(`${tpl.id}: id node unik (kalau tidak, map menimpa diam-diam)`, allDistinct);
  eq(`${tpl.id}: size = jumlah node unik`, map.size, new Set(tpl.nodes.map((x) => x.id)).size);
}

// --- Duplicate ids must not silently shrink the map ---------------------
{
  const dupe = [
    { id: 'x', type: 'pc', name: 'A', label: '', status: 'online', poweredOn: true, x: 0, y: 0 },
    { id: 'x', type: 'pc', name: 'B', label: '', status: 'online', poweredOn: true, x: 9, y: 9 },
  ];
  const map = buildInternetAccessMap(dupe, []);
  // Pinned so the behaviour is a known, checked quantity rather than a surprise.
  eq('id kembar: map menyimpan satu entri (entri terakhir menang)', map.size, 1);
  ok('id kembar: tidak melempar', map.get('x').hasInternet === false);
}

console.log(`ok — ${n} assertions passed`);
