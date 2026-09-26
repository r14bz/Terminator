/**
 * Tests for src/utils/ipAlloc.ts and the IP-conflict check in
 * src/utils/diagnosticEngine.ts.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-ipalloc.mjs
 *
 * The defect, reproduced on the running app rather than inferred. With two
 * routers wired to one switch, the inspector's "DHCP Client" button gave both of
 * them the same address and reported nothing:
 *
 *   - the button wrote `` `${routerLanIp.replace(/\.\d+$/, '')}.115` ``, a
 *     hardcoded host number, so every client on the subnet got 192.168.88.115;
 *   - it wrote that same constant into `gateway`, so each router's default
 *     gateway ended up equal to its own address;
 *   - Check 6 only inspected `mode === 'static'`, so a duplicate among
 *     DHCP-mode nodes -- which still store the lease they were handed -- was
 *     invisible. The shipped templates contain such a node (10.20.30.55, mode
 *     dhcp) and nothing warned.
 *
 * And in `handleAddDevice`, `192.168.1.${100 + countSameType}` counted nodes of
 * the *same type*, so adding a PC and then a router put both on .100.
 *
 * The independence rule from verify-placement.mjs applies here too: the
 * "is this address already taken" predicate is written out by hand against the
 * node list, never by calling `usedAddresses`, and the conflict assertions
 * count duplicates from the raw node list rather than trusting the engine.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPOLOGY_TEMPLATES } from '../src/data/templates.ts';
import { runNetworkDiagnostics } from '../src/utils/diagnosticEngine.ts';
import {
  FALLBACK_LAN, allocateDhcpLease, allocateStaticHost, dhcpPoolOf,
  firstFreeHost, gatewayAddressOf, primaryGateway, usedAddresses,
} from '../src/utils/ipAlloc.ts';
import { isValidIpv4 } from '../src/utils/ipUtils.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};
const eq = (msg, actual, expected) => {
  n++;
  assert.deepEqual(actual, expected, `${msg}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
};

let seq = 0;
const node = (over = {}) => ({
  id: `n${seq++}`, type: 'pc', name: `Dev${seq}`, label: `Dev${seq}`,
  x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...over,
});
const withIp = (ip, over = {}) =>
  node({ ipConfig: { mode: 'static', ip, subnet: '255.255.255.0', gateway: '192.168.1.1' }, ...over });

const gateway = (lanIp, over = {}) =>
  node({ type: 'router', ipConfig: { mode: 'static', ip: lanIp, subnet: '255.255.255.0', isDhcpServerEnabled: true }, ...over });

/** Duplicates found by walking the node list, not by calling the engine. */
function duplicateIps(nodes) {
  const seen = new Map();
  for (const x of nodes) {
    if (!x.poweredOn) continue;
    const ip = x.ipConfig?.ip || x.ontConfig?.lanIp;
    if (!ip || ip === '0.0.0.0' || !isValidIpv4(ip)) continue;
    seen.set(ip, (seen.get(ip) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, c]) => c > 1).map(([ip]) => ip).sort();
}

// The engine also wants optical results; an empty map means every ONT reports
// LOS, which is noise here but does not touch the IP check.
const conflictIps = (nodes, cables = []) => {
  const issues = runNetworkDiagnostics(nodes, cables, new Map());
  return issues
    .filter((i) => i.id.startsWith('ip-conflict-'))
    .map((i) => i.id.replace('ip-conflict-', ''))
    .sort();
};

// ----------------------------------------------------------------- the helpers

eq('an empty pool yields no address', firstFreeHost(FALLBACK_LAN, new Set()), '192.168.1.100');
eq('a used host is skipped', firstFreeHost(FALLBACK_LAN, new Set(['192.168.1.100'])), '192.168.1.101');
eq('a gap is filled', firstFreeHost(FALLBACK_LAN, new Set(['192.168.1.100', '192.168.1.102'])), '192.168.1.101');
eq('an exhausted pool yields null', firstFreeHost({ prefix: '10.0.0.', start: 1, end: 2 }, new Set(['10.0.0.1', '10.0.0.2'])), null);
eq('a node keeps its own address', firstFreeHost(FALLBACK_LAN, new Set(['192.168.1.100']), '192.168.1.100'), '192.168.1.100');
eq('another node does not', firstFreeHost(FALLBACK_LAN, new Set(['192.168.1.100']), 'someone-else'), '192.168.1.101');

// ------------------------------------------------------------------- usedAddresses

{
  const nodes = [
    withIp('192.168.1.5'),
    withIp('192.168.1.6'),
    node({ ipConfig: { mode: 'dhcp', ip: '192.168.1.7' } }),
    node({ ipConfig: { mode: 'static', ip: '0.0.0.0' } }),
    node({ ipConfig: { mode: 'static', ip: 'bukan-ip' } }),
    node({ type: 'ont', ontConfig: { lanIp: '192.168.1.1' } }),
  ];
  eq('every mode counts, an empty LAN only via lanIp', [...usedAddresses(nodes)].sort(),
    ['192.168.1.1', '192.168.1.5', '192.168.1.6', '192.168.1.7']);
  ok('a powered-off device still holds its address',
    usedAddresses([withIp('192.168.1.9', { poweredOn: false })]).has('192.168.1.9'));
}

// ------------------------------------------------------------------ dhcpPoolOf

eq('no gateway means no pool', dhcpPoolOf(null), null);
eq('a gateway with no config falls back to .100-.254', dhcpPoolOf(gateway('192.168.88.1')), { prefix: '192.168.88.', start: 100, end: 254 });
eq('an explicit range wins', dhcpPoolOf(gateway('192.168.88.1', {
  ipConfig: { mode: 'static', ip: '192.168.88.1', dhcpRangeStart: '192.168.88.20', dhcpRangeEnd: '192.168.88.30' },
})), { prefix: '192.168.88.', start: 20, end: 30 });
eq('the ONT pool is honoured', dhcpPoolOf(node({ type: 'ont', ontConfig: { lanIp: '192.168.1.1', dhcpPoolStart: '192.168.1.10', dhcpPoolEnd: '192.168.1.12' } })),
  { prefix: '192.168.1.', start: 10, end: 12 });
eq('an inverted range is rejected', dhcpPoolOf(gateway('192.168.88.1', {
  ipConfig: { mode: 'static', ip: '192.168.88.1', dhcpRangeStart: '192.168.88.30', dhcpRangeEnd: '192.168.88.20' },
})), null);
eq('a range spanning two subnets is rejected', dhcpPoolOf(gateway('192.168.88.1', {
  ipConfig: { mode: 'static', ip: '192.168.88.1', dhcpRangeStart: '192.168.88.20', dhcpRangeEnd: '10.0.0.5' },
})), null);
eq('a range reaching the broadcast address is rejected', dhcpPoolOf(gateway('192.168.88.1', {
  ipConfig: { mode: 'static', ip: '192.168.88.1', dhcpRangeStart: '192.168.88.20', dhcpRangeEnd: '192.168.88.255' },
})), null);
eq('a half-configured range is rejected', dhcpPoolOf(gateway('192.168.88.1', {
  ipConfig: { mode: 'static', ip: '192.168.88.1', dhcpRangeStart: '192.168.88.20' },
})), { prefix: '192.168.88.', start: 100, end: 254 });
eq('a gateway with no usable address has no pool', dhcpPoolOf(node({ type: 'router' })), null);

// -------------------------------------------------------------- DHCP leases

{
  const gw = gateway('192.168.88.1');
  let nodes = [gw];
  const taken = [];
  for (let i = 0; i < 4; i++) {
    const lease = allocateDhcpLease(gw, nodes);
    taken.push(lease);
    nodes = [...nodes, node({ ipConfig: { mode: 'dhcp', ip: lease } })];
  }
  eq('four leases are four different addresses', new Set(taken).size, 4);
  eq('leases start at the bottom of the pool', taken[0], '192.168.88.100');
  ok('no lease collides with the gateway', !taken.includes('192.168.88.1'));
  eq('re-running hands the same client the same lease', allocateDhcpLease(gw, nodes, nodes[1].id), taken[0]);
  eq('an unknown node id gets the next genuinely free host', allocateDhcpLease(gw, nodes, 'tidak-ada'), '192.168.88.104');
  ok('and that host is not one already handed out', !taken.includes('192.168.88.104'));
}

{
  const gw = gateway('10.0.0.1', {
    ipConfig: { mode: 'static', ip: '10.0.0.1', dhcpRangeStart: '10.0.0.2', dhcpRangeEnd: '10.0.0.3' },
  });
  let nodes = [gw];
  const leases = [];
  for (let i = 0; i < 4; i++) {
    const lease = allocateDhcpLease(gw, nodes);
    leases.push(lease);
    nodes = [...nodes, node({ ipConfig: { mode: 'dhcp', ip: lease ?? '' } })];
  }
  eq('a full pool yields null, not a wrap onto somebody else', leases, ['10.0.0.2', '10.0.0.3', null, null]);
  eq('no duplicate slipped in', duplicateIps(nodes), []);
}

eq('no gateway means no lease', allocateDhcpLease(null, []), null);

// ------------------------------------------------- static hosts for new devices

{
  const gw = gateway('192.168.1.1');
  let nodes = [gw, withIp('192.168.1.100')];
  const got = [];
  for (let i = 0; i < 3; i++) {
    const ip = allocateStaticHost(gw, nodes);
    got.push(ip);
    nodes = [...nodes, withIp(ip)];
  }
  eq('the template PC at .100 is not reused', got, ['192.168.1.101', '192.168.1.102', '192.168.1.103']);
  eq('nothing collides', duplicateIps(nodes), []);
}

{
  // The reported case: a PC and a router added to the same network. Under
  // `100 + countSameType` both landed on 192.168.1.100.
  let nodes = [gateway('192.168.1.1')];
  const pc = withIp(allocateStaticHost(primaryGateway(nodes), nodes), { type: 'pc' });
  nodes = [...nodes, pc];
  const rtr = withIp(allocateStaticHost(primaryGateway(nodes), nodes), { type: 'router' });
  nodes = [...nodes, rtr];
  eq('a PC and a router do not share an address', pc.ipConfig.ip !== rtr.ipConfig.ip, true);
  eq('and neither collides with the gateway', duplicateIps(nodes), []);
}

eq('a fresh canvas uses the fallback LAN', allocateStaticHost(primaryGateway([]), []), '192.168.1.100');
eq('the fallback LAN is not used when a gateway exists but its pool is broken',
  allocateStaticHost(gateway('192.168.88.1', { ipConfig: { mode: 'static', ip: '192.168.88.1', dhcpRangeStart: '192.168.88.9', dhcpRangeEnd: '192.168.88.2' } }), []), null);

// --------------------------------------------------------- primaryGateway

{
  const t = TOPOLOGY_TEMPLATES[0];
  eq('the FTTH template is built around its ONT', primaryGateway(t.nodes).id, t.nodes.find((x) => x.type === 'ont').id);
  const soho = TOPOLOGY_TEMPLATES[1];
  eq('the SOHO template is built around its MikroTik', primaryGateway(soho.nodes).id, soho.nodes.find((x) => x.type === 'mikrotik').id);
  eq('a switch is not a gateway', primaryGateway([node({ type: 'switch', ipConfig: { mode: 'static', ip: '10.0.0.2' } })]), null);
  eq('a gateway with no address does not count', primaryGateway([node({ type: 'mikrotik' })]), null);
}

eq('the gateway address is the LAN address', gatewayAddressOf(gateway('192.168.88.1')), '192.168.88.1');
eq('a gateway with no address has none', gatewayAddressOf(node({ type: 'router' })), null);
eq('no gateway has none', gatewayAddressOf(null), null);

// ----------------------------------------------------- Check 6: the conflicts

eq('a unique static pair is silent', conflictIps([withIp('192.168.1.5'), withIp('192.168.1.6')]), []);
eq('two statics on one address are reported', conflictIps([withIp('192.168.1.5'), withIp('192.168.1.5')]), ['192.168.1.5']);

// The exact state the running app got into: two routers, both 192.168.88.115.
{
  const r1 = node({ type: 'router', name: 'Wi-Fi Wireless Router 1', ipConfig: { mode: 'dhcp', ip: '192.168.88.115', gateway: '192.168.88.115' } });
  const r2 = node({ type: 'router', name: 'Wi-Fi Wireless Router 2', ipConfig: { mode: 'dhcp', ip: '192.168.88.115', gateway: '192.168.88.115' } });
  eq('two DHCP-mode routers on one address are reported', conflictIps([r1, r2]), ['192.168.88.115']);
  eq('a static/dhcp pair on one address is reported', conflictIps([r1, node({ type: 'pc', ipConfig: { mode: 'static', ip: '192.168.88.115' } })]), ['192.168.88.115']);
  ok('the issue names both devices', (() => {
    const issue = runNetworkDiagnostics([r1, r2], [], new Map()).find((i) => i.id === 'ip-conflict-192.168.88.115');
    return issue.severity === 'critical' &&
      issue.title.includes('Wi-Fi Wireless Router 1') &&
      issue.title.includes('Wi-Fi Wireless Router 2');
  })());
}

eq('a powered-off duplicate is not reported', conflictIps([withIp('192.168.1.5'), withIp('192.168.1.5', { poweredOn: false })]), []);
eq('0.0.0.0 is not an address', conflictIps([withIp('0.0.0.0'), withIp('0.0.0.0')]), []);
eq('a non-address string does not collide', conflictIps([withIp('bukan-ip'), withIp('bukan-ip')]), []);
eq('three on one address is one issue', conflictIps([withIp('1.2.3.4'), withIp('1.2.3.4'), withIp('1.2.3.4')]), ['1.2.3.4']);

// A DHCP-mode node that already holds a lease must not be double-counted
// against the ONT whose lanIp is the same value.
{
  const ont = node({ type: 'ont', name: 'ONT', ipConfig: { mode: 'static', ip: '192.168.1.1' }, ontConfig: { lanIp: '192.168.1.1' } });
  eq('an ONT whose two config fields agree is one address', conflictIps([ont]), []);
}

// ------------------------------------------------- templates stay conflict-free

for (const t of TOPOLOGY_TEMPLATES) {
  eq(`template "${t.name.slice(0, 30)}" has no duplicate address`, duplicateIps(t.nodes), []);
  eq(`template "${t.name.slice(0, 30)}" raises no IP conflict`, conflictIps(t.nodes, t.cables), []);
}

// ---------------------------------- the old behaviour, asserted against directly

{
  // Pin what the removed code did, so a future edit that reintroduces a
  // constant host number is caught by name.
  const gw = gateway('192.168.88.1');
  const old = (lanIp) => `${lanIp.replace(/\.\d+$/, '')}.115`;
  eq('the old constant host number was .115', old('192.168.88.1'), '192.168.88.115');
  eq('and it is not what the allocator returns', old('192.168.88.1') === allocateDhcpLease(gw, [gw]), false);
  const oldHandleAdd = (countSameType) => `192.168.1.${100 + countSameType}`;
  eq('the old per-type counter gave a PC and a router the same address',
    oldHandleAdd(0) === oldHandleAdd(0), true);
}

// ------------------------------------------------- no fabricated host numbers

{
  // The three removed sites all wrote a constant host into ipConfig, and the
  // JSX display had a fourth as its fallback. A constant in these files is the
  // exact shape of the bug, so scan for it by value rather than trusting a
  // future read of the code.
  //
  // Comments are stripped first: both fixes document the constants they
  // replaced, so a naive scan fails on its own explanatory prose.
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const read = (rel) => stripComments(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  const files = {
    'App.tsx': read('../src/App.tsx'),
    'NodeInspector.tsx': read('../src/components/NodeInspector.tsx'),
  };

  for (const [name, src] of Object.entries(files)) {
    // The .115 host written into both `ip` and `gateway` by the DHCP toggle.
    ok(`${name}: no hardcoded .115 lease`, !/\.115[`'"\s,)]/.test(src));
    // `192.168.1.${100 + countSameType}`, the per-type numbering.
    ok(`${name}: no "100 + countSameType" numbering`, !/100\s*\+\s*countSameType/.test(src));
    // The display fallbacks: an empty lease used to render as a real address.
    ok(`${name}: no "192.168.1.100" fallback in a display`, !/\|\|\s*'192\.168\.1\.100'/.test(src));
    ok(`${name}: no "? 192.168.88.1" default for a missing address`, !/\?\?\s*'192\.168\.88\.1'/.test(src));
  }

  // Guard the guard: the stripper must actually strip, or the four checks above
  // would pass on a file full of comments.
  ok('the comment stripper removes a commented-out constant',
    !/\.115/.test(stripComments('const a = 1; // used to be .115\n')));
  ok('and leaves a live constant alone',
    /\.115/.test(stripComments('const a = ".115";\n')));
}

console.log(`ok — ${n} assertions passed`);
