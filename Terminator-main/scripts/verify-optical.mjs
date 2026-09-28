/**
 * Tests for src/utils/opticalCalculator.ts — the received-power solver.
 *
 *   node scripts/verify-optical.mjs
 *
 * Imports the real TypeScript module via Node's native type stripping, so
 * these assertions cannot drift from the implementation.
 *
 * The scenario below is the regression this file was rewritten for: a node
 * reachable by two optical routes where the *longer* route loses less power.
 * A plain BFS ranks by hop count and therefore reports the worse path.
 */
import assert from 'node:assert/strict';
import { calculateOpticalPowers, SPLITTER_LOSS_MAP } from '../src/utils/opticalCalculator.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

const node = (id, type, extra = {}) => ({
  id, type, name: id, label: id, x: 0, y: 0,
  ports: [], status: 'online', poweredOn: true, ...extra,
});
const fiber = (id, from, to, lengthKm) => ({
  id, type: 'feeder', fromNodeId: from, fromPortId: 'a', toNodeId: to, toPortId: 'b',
  lengthKm, attenuationDb: 0, status: 'active',
});
const splitter = (ratio) => ({ splitterRatio: ratio });

// --- Scenario: more hops, less loss ---------------------------------------
//
// The regression this rewrite exists for. A node reachable by two optical
// routes where the LONGER route loses LESS power:
//
//   route A (2 hops): OLT -> splitter 1:8 (10.5 dB) -> ONT
//   route B (3 hops): OLT -> splitter 1:2 ( 3.5 dB) -> splitter 1:2 ( 3.5 dB) -> ONT
//
// Ranking by hop count picks A and reports 11.07 dB. The physically correct
// answer is B at 7.86 dB, so a plain BFS overstates attenuation by ~3.2 dB —
// enough to push a real ONT across the -27 dBm LOS threshold.
//
// Note this needs `splitter` nodes, not `odp`: an ODP is a hardcoded 10.5 dB
// and cannot express the cheap side of the trade-off.
const nodes = [
  node('olt', 'olt', { opticalConfig: { txPowerDbm: 3.0 } }),
  node('s1', 'splitter', { opticalConfig: splitter('1:8') }),
  node('s2', 'splitter', { opticalConfig: splitter('1:2') }),
  node('s3', 'splitter', { opticalConfig: splitter('1:2') }),
  node('ont', 'ont'),
];
const CABLE = (id, from, to) => fiber(id, from, to, 0.1); // 0.1 km -> 0.285 dB
const cables = [
  CABLE('c1', 'olt', 's1'), CABLE('c2', 's1', 'ont'),   // route A, 2 hops
  CABLE('c3', 'olt', 's2'), CABLE('c4', 's2', 's3'), CABLE('c5', 's3', 'ont'), // route B, 3 hops
];

// The two candidate budgets, so the assertion states which one must win.
const routeA = 0.285 + 10.5 + 0.285;                      // 11.07 dB, fewer hops
const routeB = 0.285 + 3.5 + 0.285 + 3.5 + 0.285;        //  7.855 dB, more hops
ok('skenario benar-benar asimetrik (A 2 hop > B 3 hop)', routeA > routeB);

const res = calculateOpticalPowers(nodes, cables);
const ont = res.get('ont');
ok('ONT_rx_terhitung', ont !== undefined);
// Results are rounded to 2 decimals for display, so compare at that precision.
const near = (a, b) => Math.abs(Number(a.toFixed(2)) - Number(b.toFixed(2))) < 0.011;
ok(
  `ONT_rx_ambil rute 3-hop yang lebih murah (${ont.totalLossDb} dB)`,
  near(ont.totalLossDb, routeB)
);
ok('bukan rute 2-hop yang lebih mahal', !near(ont.totalLossDb, routeA));
ok('rx = tx - loss', near(ont.rxPowerDbm, 3.0 - ont.totalLossDb));
ok('breakdown hanya memuat loss rute terpilih', !ont.lossBreakdown.some((i) => i.lossDb === 10.5));
ok('txPowerDbm dicatat', ont.txPowerDbm === 3.0);

// --- Multi-hop cascade reaches LOS ---------------------------------------
{
  // OLT +3 dBm through a 1:32 (17.2 dB) and a 1:16 (13.8 dB) = well past -27.
  const c = [
    node('olt', 'olt', { opticalConfig: { txPowerDbm: 3.0 } }),
    node('s1', 'splitter', { opticalConfig: splitter('1:32') }),
    node('s2', 'splitter', { opticalConfig: splitter('1:16') }),
    node('ont', 'ont'),
  ];
  const k = [
    fiber('k1', 'olt', 's1', 0.5),
    fiber('k2', 's1', 's2', 0.5),
    fiber('k3', 's2', 'ont', 0.1),
  ];
  const r = calculateOpticalPowers(c, k).get('ont');
  ok('cascade besar -> critical_los', r.status === 'critical_los');
  ok('label LOS sesuai', r.statusLabel.includes('LOS'));
}

// --- Directly attached ONT overloads the receiver ------------------------
{
  const c = [node('olt', 'olt', { opticalConfig: { txPowerDbm: 3.0 } }), node('ont', 'ont')];
  const r = calculateOpticalPowers(c, [fiber('d1', 'olt', 'ont', 0.01)]).get('ont');
  ok('OLT->ONT langsung -> overpower', r.status === 'overpower');
}

// --- Broken cable severs the path ----------------------------------------
{
  const base = [
    node('olt', 'olt', { opticalConfig: { txPowerDbm: 3.0 } }),
    node('odp', 'odp'),
    node('ont', 'ont'),
  ];
  const intact = [
    fiber('b1', 'olt', 'odp', 0.5),
    fiber('b2', 'odp', 'ont', 0.05),
  ];
  ok('jalur utuh -> optimal', calculateOpticalPowers(base, intact).get('ont').status === 'optimal');

  const cut = [{ ...intact[0], status: 'broken' }, intact[1]];
  ok('kabel putus -> disconnected/LOS', calculateOpticalPowers(base, cut).get('ont').status === 'disconnected');
}

// --- No transmitter means no signal --------------------------------------
{
  const c = [node('olt', 'olt', { opticalConfig: { txPowerDbm: 3.0 }, poweredOn: false }), node('ont', 'ont')];
  const r = calculateOpticalPowers(c, [fiber('p1', 'olt', 'ont', 0.05)]).get('ont');
  ok('OLT padam -> disconnected', r.status === 'disconnected');
  ok('rx -99 dBm', r.rxPowerDbm === -99);
}

// --- Cycle must terminate and not hang ------------------------------------
{
  // OLT <-> ODP <-> ODP2 <-> OLT forms a loop through the fibre plant.
  const c = [
    node('olt', 'olt', { opticalConfig: { txPowerDbm: 3.0 } }),
    node('a', 'odp'), node('b', 'odp'),
  ];
  const k = [fiber('y1', 'olt', 'a', 0.2), fiber('y2', 'a', 'b', 0.2), fiber('y3', 'b', 'olt', 0.2)];
  const r = calculateOpticalPowers(c, k);
  ok('cycle tidak menggantung', r.get('a') !== undefined && r.get('b') !== undefined);
  ok('cycle: loss tetap masuk akal', r.get('a').totalLossDb > 0);
}

// --- Non-optical media must be ignored ------------------------------------
{
  const c = [node('olt', 'olt', { opticalConfig: { txPowerDbm: 3.0 } }), node('ont', 'ont')];
  const r = calculateOpticalPowers(c, [
    { id: 'l1', type: 'lan', fromNodeId: 'olt', fromPortId: 'a', toNodeId: 'ont', toPortId: 'b', lengthKm: 0.01, attenuationDb: 0, status: 'active' },
  ]).get('ont');
  ok('kabel LAN bukan jalur optik', r.status === 'disconnected');
}

// --- Two OLTs: the better-fed node wins -----------------------------------
{
  const c = [
    node('olt-weak', 'olt', { opticalConfig: { txPowerDbm: 0.0 } }),
    node('olt-strong', 'olt', { opticalConfig: { txPowerDbm: 6.0 } }),
    node('odp', 'odp'),
    node('ont', 'ont'),
  ];
  const k = [
    fiber('w1', 'olt-weak', 'odp', 0.2),
    fiber('w2', 'olt-strong', 'odp', 0.2),
    fiber('w3', 'odp', 'ont', 0.05),
  ];
  const r = calculateOpticalPowers(c, k).get('ont');
  ok(`ODP memilih Tx terkuat (dari ${r.txPowerDbm} dBm)`, r.txPowerDbm === 6.0);
}

// --- A powered OLT's own label reflects its real Tx power -----------------
{
  const c = [node('olt', 'olt', { opticalConfig: { txPowerDbm: 5.0 } })];
  const r = calculateOpticalPowers(c, []).get('olt');
  ok('label OLT tidak hardcode +3.0 dBm', r.statusLabel.includes('5.0'));
  ok('OLT bukan powerless', r.status !== 'disconnected');
}

// --- Splitter ratio table is honoured -------------------------------------
ok('1:2 = 3.5 dB', SPLITTER_LOSS_MAP['1:2'] === 3.5);
ok('1:8 = 10.5 dB', SPLITTER_LOSS_MAP['1:8'] === 10.5);
ok('1:32 = 17.2 dB', SPLITTER_LOSS_MAP['1:32'] === 17.2);

console.log(`ok — ${n} assertions passed`);
