/**
 * Behavioural tests for checkInternetAccess in src/utils/ipUtils.ts.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-internet-access.mjs
 *
 * Why this exists separately from verify-internet-map.mjs: that suite is an
 * equivalence test -- the memo must return exactly what a direct call returns.
 * It is therefore blind to a bug *inside* checkInternetAccess, because both
 * sides change together. Mutation testing confirmed exactly that: flipping
 * "ONT in bridge mode" to report online, ignoring broken cables, and reporting a
 * MikroTik without NAT as online all passed the equivalence suite, because the
 * shipped templates are all configured healthy and never reach those branches.
 *
 * This suite drives the failure branches directly, so it is the one that has to
 * catch those.
 */
import assert from 'node:assert/strict';
import { checkInternetAccess, findUpstreamGateway } from '../src/utils/ipUtils.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};
const eq = (msg, a, b) => {
  n++;
  assert.deepEqual(a, b, msg);
};

// ---- fixtures ------------------------------------------------------------
// Minimal objects: checkInternetAccess only reads a handful of fields, and
// writing them out here keeps each case readable.
const node = (id, type, extra = {}) => ({
  id, type, name: id, label: '', x: 0, y: 0, status: 'online', poweredOn: true, ...extra,
});
const cable = (a, b, extra = {}) => ({
  id: `c-${a}-${b}`, fromNodeId: a, toNodeId: b, type: 'lan',
  status: 'active', lengthKm: 0.01, medium: 'cat6', ...extra,
});

const ONT_ROUTER = {
  wanMode: 'router', lanIp: '192.168.88.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: true,
};
const RTR_NAT = { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0' };
const RTR_CFG = { firewallNat: true };

/** internet -> ONT -> MikroTik -> client, all healthy. */
function healthy() {
  return {
    nodes: [
      node('inet', 'internet'),
      node('ont', 'ont', { ontConfig: { ...ONT_ROUTER } }),
      node('rtr', 'mikrotik', { ipConfig: { ...RTR_NAT }, mikrotikConfig: { ...RTR_CFG } }),
      node('pc', 'pc', {
        ipConfig: { mode: 'static', ip: '192.168.88.10', subnet: '255.255.255.0', gateway: '192.168.88.1' },
      }),
    ],
    cables: [cable('inet', 'ont', { type: 'feeder', medium: 'fiber' }), cable('ont', 'rtr'), cable('rtr', 'pc')],
  };
}

const statusOf = (t, id) => checkInternetAccess(t.nodes.find((x) => x.id === id), t.nodes, t.cables);

// ---- The healthy baseline ------------------------------------------------
{
  const t = healthy();
  ok('jalur sehat: PC online', statusOf(t, 'pc').hasInternet === true);
  ok('jalur sehat: MikroTik online', statusOf(t, 'rtr').hasInternet === true);
  ok('jalur sehat: ONT online', statusOf(t, 'ont').hasInternet === true);
  ok('jalur sehat: internet online', statusOf(t, 'inet').hasInternet === true);
  ok('jalur sehat: PC melaporkan gateway', statusOf(t, 'pc').gatewayNode?.id === 'rtr');
}

// ---- Power ---------------------------------------------------------------
{
  const t = healthy();
  t.nodes[3].poweredOn = false;
  const s = statusOf(t, 'pc');
  ok('PC mati: tidak online', s.hasInternet === false);
  ok('PC mati: alasannya menyebut mati', /mati|power off/i.test(s.reason));
}

// ---- Node type early returns ---------------------------------------------
{
  const t = healthy();
  const s = statusOf(t, 'inet');
  ok('node internet: selalu online', s.hasInternet === true);

  // The power check runs before the type check, so switching the ISP cloud off
  // takes the whole topology offline. Defensible -- the cloud node is drawn as
  // a device with a power switch, and a simulator that ignores the switch is
  // more surprising than one that respects it. Pinned because the ordering is
  // the only thing that makes this true.
  t.nodes[0].poweredOn = false;
  ok('node internet mati ikut offline', statusOf(t, 'inet').hasInternet === false);
  ok('node internet mati: alasannya menyebut mati', /mati|power off/i.test(statusOf(t, 'inet').reason));
}

// ---- ONT in bridge mode --------------------------------------------------
{
  const t = healthy();
  t.nodes[1].ontConfig.wanMode = 'bridge';
  const s = statusOf(t, 'ont');
  ok('ONT bridge: tidak online', s.hasInternet === false);
  ok('ONT bridge: alasannya menyebut bridge', /bridge/i.test(s.reason));

  // A bridge-mode ONT with no PPPoE router behind it cannot route. The test
  // needs a topology that genuinely has no MikroTik -- reusing `healthy()` here
  // would keep the dialer in place and assert nothing.
  const noDialer = {
    nodes: [
      node('inet', 'internet'),
      node('ont', 'ont', { ontConfig: { ...ONT_ROUTER, wanMode: 'bridge' } }),
      node('sw', 'switch'),
      node('pc', 'pc', { ipConfig: { mode: 'dhcp' } }),
    ],
    cables: [
      cable('inet', 'ont', { type: 'feeder', medium: 'fiber' }),
      cable('ont', 'sw'), cable('sw', 'pc'),
    ],
  };
  const s2 = statusOf(noDialer, 'pc');
  ok('ONT bridge tanpa router PPPoE: klien tidak online', s2.hasInternet === false);
  ok('ONT bridge tanpa router PPPoE: alasannya menyebut router', /mikrotik|pppoe/i.test(s2.reason));
  ok('ONT bridge tanpa router PPPoE: gateway-nya tetap ONT', s2.gatewayNode?.id === 'ont');

  // Same bridge ONT, but a MikroTik is dialed up behind it -- then the client
  // can route, which is the whole point of the secondary-router check.
  const withDialer = healthy();
  withDialer.nodes[1].ontConfig.wanMode = 'bridge';
  withDialer.nodes[3].ipConfig.mode = 'dhcp';
  ok('ONT bridge dengan MikroTik dialer: klien bisa online', statusOf(withDialer, 'pc').hasInternet === true);

  // A MikroTik that is present but switched off is not a dialer. The client
  // must NOT be wired to that MikroTik, or the earlier "gateway not powered on"
  // check answers first and this test passes for the wrong reason -- which is
  // exactly what happened the first time round.
  const deadDialer = {
    nodes: [
      node('inet', 'internet'),
      node('ont', 'ont', { ontConfig: { ...ONT_ROUTER, wanMode: 'bridge' } }),
      node('sw', 'switch'),
      node('pc', 'pc', { ipConfig: { mode: 'dhcp' } }),
      node('rtr', 'mikrotik', { poweredOn: false, ipConfig: { ...RTR_NAT }, mikrotikConfig: { ...RTR_CFG } }),
    ],
    cables: [
      cable('inet', 'ont', { type: 'feeder', medium: 'fiber' }),
      cable('ont', 'sw'), cable('sw', 'pc'), cable('ont', 'rtr'),
    ],
  };
  const ds = statusOf(deadDialer, 'pc');
  ok('ONT bridge dengan MikroTik mati: klien tidak online', ds.hasInternet === false);
  ok('MikroTik mati: alasan menyebut bridge/router, bukan "gateway mati"',
    /bridge|pppoe/i.test(ds.reason) && !/yang aktif/i.test(ds.reason));
  ok('MikroTik mati: gateway-nya ONT yang menyala', ds.gatewayNode?.id === 'ont');

  // Same topology, MikroTik switched on: now it is a valid dialer.
  deadDialer.nodes[4].poweredOn = true;
  ok('MikroTik hidup di belakang ONT bridge: klien bisa online',
    statusOf(deadDialer, 'pc').hasInternet === true);
}

// ---- ONT with no optical uplink -----------------------------------------
{
  const t = healthy();
  t.cables[0].status = 'broken';
  const s = statusOf(t, 'ont');
  ok('ONT tanpa uplink optik: tidak online', s.hasInternet === false);
  ok('ONT tanpa uplink optik: alasannya menyebut kabel', /kabel optik/i.test(s.reason));

  // Removing the cable entirely must give the same verdict as breaking it.
  const t2 = healthy();
  t2.cables.shift();
  ok('ONT tanpa kabel sama sekali: tidak online', statusOf(t2, 'ont').hasInternet === false);
}

// ---- MikroTik NAT --------------------------------------------------------
{
  const t = healthy();
  t.nodes[2].mikrotikConfig.firewallNat = false;
  const s = statusOf(t, 'rtr');
  ok('MikroTik tanpa NAT: tidak online', s.hasInternet === false);
  ok('MikroTik tanpa NAT: alasannya menyebut NAT', /nat/i.test(s.reason));

  const c = statusOf(t, 'pc');
  ok('MikroTik tanpa NAT: klien ikut tidak online', c.hasInternet === false);
}

// ---- Client with no gateway ---------------------------------------------
{
  const t = healthy();
  t.cables = t.cables.filter((c) => !(c.fromNodeId === 'rtr' && c.toNodeId === 'pc'));
  const s = statusOf(t, 'pc');
  ok('PC terisolasi: tidak online', s.hasInternet === false);
  ok('PC terisolasi: alasannya menyebut gateway', /gateway/i.test(s.reason));

  // Gateway reached only through a broken cable is still no gateway.
  const t2 = healthy();
  t2.cables[2].status = 'broken';
  ok('PC lewat kabel putus: tidak online', statusOf(t2, 'pc').hasInternet === false);

  // Wireless and coaxial count as client links, so they carry the client too.
  for (const medium of ['wireless', 'coaxial']) {
    const t3 = healthy();
    t3.cables[2] = { ...t3.cables[2], type: medium, medium };
    ok(`link ${medium} tetap_find_gateway`, statusOf(t3, 'pc').hasInternet === true);
  }
}

// ---- Client static IP configuration -------------------------------------
{
  const base = () => {
    const t = healthy();
    t.nodes[3].ipConfig.mode = 'static';
    return t;
  };

  // Reasons are asserted, not just the verdict. Without that, skipping the
  // empty-gateway check is invisible: the next check (gateway not in the host
  // subnet) still rejects 0.0.0.0 and still reports "no internet", just with a
  // different and much less useful message.
  const empty = base();
  empty.nodes[3].ipConfig.gateway = '';
  const es = statusOf(empty, 'pc');
  ok('gateway kosong: tidak online', es.hasInternet === false);
  ok('gateway kosong: alasannya menyebut default gateway', /default gateway/i.test(es.reason));

  const zero = base();
  zero.nodes[3].ipConfig.gateway = '0.0.0.0';
  const zs = statusOf(zero, 'pc');
  ok('gateway 0.0.0.0: tidak online', zs.hasInternet === false);
  ok('gateway 0.0.0.0: alasannya menyebut default gateway', /default gateway/i.test(zs.reason));
  eq('gateway kosong dan 0.0.0.0 menjelaskan hal sama', zs.reason, es.reason);

  const wrongSubnet = base();
  wrongSubnet.nodes[3].ipConfig.gateway = '10.0.0.1';
  wrongSubnet.nodes[3].ipConfig.ip = '192.168.88.10';
  wrongSubnet.nodes[3].ipConfig.subnet = '255.255.255.0';
  const ws = statusOf(wrongSubnet, 'pc');
  ok('gateway di subnet lain: tidak online', ws.hasInternet === false);
  ok('gateway di subnet lain: alasannya menyebut subnet', /subnet/i.test(ws.reason));

  const wrongRouter = base();
  wrongRouter.nodes[3].ipConfig.gateway = '192.168.88.254';
  const wr = statusOf(wrongRouter, 'pc');
  ok('gateway bukan IP router: tidak online', wr.hasInternet === false);
  ok('gateway bukan IP router: alasannya menyebut router', /router/i.test(wr.reason));

  const ok1 = base();
  ok('gateway benar: online', statusOf(ok1, 'pc').hasInternet === true);
}

// ---- DHCP ----------------------------------------------------------------
// Two different DHCP servers, in two different branches. Hanging the client off
// the MikroTik only exercises the MikroTik branch; the ONT branch needs a
// client wired straight to a router-mode ONT.
{
  const t = healthy();
  t.nodes[3].ipConfig.mode = 'dhcp';
  t.nodes[2].ipConfig.isDhcpServerEnabled = false;
  const s = statusOf(t, 'pc');
  ok('DHCP dimatikan di MikroTik: tidak online', s.hasInternet === false);
  ok('DHCP dimatikan di MikroTik: alasannya menyebut MikroTik', /mikrotik/i.test(s.reason));

  const okT = healthy();
  okT.nodes[3].ipConfig.mode = 'dhcp';
  ok('DHCP aktif: online', statusOf(okT, 'pc').hasInternet === true);

  // Client wired directly to the ONT, in router mode -- the ONT is the gateway,
  // so the ONT DHCP branch is the one that runs.
  const direct = () => ({
    nodes: [
      node('inet', 'internet'),
      node('ont', 'ont', { ontConfig: { ...ONT_ROUTER } }),
      node('pc', 'pc', { ipConfig: { mode: 'dhcp' } }),
    ],
    cables: [
      cable('inet', 'ont', { type: 'feeder', medium: 'fiber' }),
      cable('ont', 'pc'),
    ],
  });

  const off = direct();
  off.nodes[1].ontConfig.dhcpServerEnabled = false;
  const os = statusOf(off, 'pc');
  ok('DHCP dimatikan di ONT: tidak online', os.hasInternet === false);
  ok('DHCP dimatikan di ONT: alasannya menyebut ONT', /ont/i.test(os.reason));
  ok('DHCP dimatikan di ONT: alasan bukan soal MikroTik', !/mikrotik/i.test(os.reason));

  const on = direct();
  ok('DHCP aktif di ONT: online', statusOf(on, 'pc').hasInternet === true);

  // DHCP with no lease cannot do the static-IP checks, so a bogus static
  // gateway must not leak through when the mode is dhcp.
  const dhcpWithGarbage = direct();
  dhcpWithGarbage.nodes[2].ipConfig.gateway = '10.9.9.9';
  ok('mode dhcp: gateway static diabaikan', statusOf(dhcpWithGarbage, 'pc').hasInternet === true);
  // Gateway reachable but switched off. Distinct from the client being off, and
  // from the dead-dialer case above: here the client's own gateway is the dead
  // one, so this is the check that has to fire.
  const deadGateway = healthy();
  deadGateway.nodes[2].poweredOn = false;
  const dg = statusOf(deadGateway, 'pc');
  ok('gateway mati: klien tidak online', dg.hasInternet === false);
  ok('gateway mati: alasannya menyebut gateway yang aktif', /yang aktif/i.test(dg.reason));
  ok('gateway mati: gatewayNode dilaporkan null', dg.gatewayNode === null);
}

// ---- findUpstreamGateway contract ---------------------------------------
{
  const t = healthy();
  const pc = t.nodes.find((x) => x.id === 'pc');
  const gw = findUpstreamGateway(pc, t.nodes, t.cables);
  ok('gateway PC = MikroTik', gw?.id === 'rtr');

  // BFS, so the *nearest* gateway wins, not the first in the cable list. Both
  // the ONT and the second MikroTik are one hop from `rtr`; the search returns
  // whichever it reaches first, and cable order decides that tie.
  const twoRouters = healthy();
  twoRouters.nodes.push(node('rtr2', 'mikrotik', { ipConfig: { ...RTR_NAT }, mikrotikConfig: { ...RTR_CFG } }));
  twoRouters.cables.push(cable('rtr', 'rtr2'));
  const near = findUpstreamGateway(twoRouters.nodes.find((x) => x.id === 'rtr'), twoRouters.nodes, twoRouters.cables);
  ok('dari MikroTik, gateway terdekat (ONT) yang dipilih', near?.id === 'ont');

  // Self-exclusion: a gateway is not its own gateway. With the ONT disconnected
  // there is exactly one candidate left, and it must not be the start node.
  const solo = {
    nodes: [
      node('rtr', 'mikrotik', { ipConfig: { ...RTR_NAT }, mikrotikConfig: { ...RTR_CFG } }),
      node('rtr2', 'mikrotik', { ipConfig: { ...RTR_NAT }, mikrotikConfig: { ...RTR_CFG } }),
    ],
    cables: [cable('rtr', 'rtr2')],
  };
  const other = findUpstreamGateway(solo.nodes[0], solo.nodes, solo.cables);
  ok('MikroTik mencari MikroTik lain, bukan dirinya', other?.id === 'rtr2');
  ok('gateway yang dikembalikan bukan startNode', other?.id !== 'rtr');

  const isolatedGateway = findUpstreamGateway(solo.nodes[0], [solo.nodes[0]], []);
  ok('gateway tanpa tetangga lain -> null', isolatedGateway === null);

  const ont = findUpstreamGateway(twoRouters.nodes.find((x) => x.id === 'ont'), twoRouters.nodes, twoRouters.cables);
  ok('ONT mencari MikroTik di hilirnya', ont?.id === 'rtr');

  ok('node tanpa koneksi -> null', findUpstreamGateway(pc, [pc], []) === null);
  ok('id tak dikenal -> null', findUpstreamGateway(node('a', 'pc'), [], []) === null);
}

// ---- Cycles must terminate ----------------------------------------------
// The BFS marks nodes visited, so a loop back into the start node is safe. A
// missing visited check would hang this file rather than fail it.
{
  const loop = {
    nodes: [node('a', 'pc'), node('b', 'switch'), node('c', 'router'), node('r', 'mikrotik', {
      ipConfig: { ...RTR_NAT }, mikrotikConfig: { ...RTR_CFG },
    })],
    cables: [cable('a', 'b'), cable('b', 'c'), cable('c', 'a'), cable('c', 'r')],
  };
  // 'r' sits behind the loop, so returning it would mean the search kept going
  // past a nearer gateway; 'c' is one hop away and is type 'router', which the
  // search accepts.
  ok('siklus tidak menggantung, dan berhenti di gateway terdekat',
    findUpstreamGateway(loop.nodes[0], loop.nodes, loop.cables)?.id === 'c');

  // Asymmetry worth pinning: the search treats a plain `router` as a gateway,
  // but checkInternetAccess has no branch for that type, so a client behind one
  // gets no NAT or DHCP validation at all. Not a bug to fix here -- just the
  // current contract, so nobody changes it by accident.
  const s = statusOf(loop, 'a');
  ok('klien di belakang router biasa: dianggap online tanpa validasi NAT', s.hasInternet === true);
  ok('klien di belakang router biasa: gateway-nya router itu', s.gatewayNode?.id === 'c');
  ok('klien di belakang router biasa: tidak ada alasan yang dikembalikan', s.reason === undefined);
}

console.log(`ok — ${n} assertions passed`);
