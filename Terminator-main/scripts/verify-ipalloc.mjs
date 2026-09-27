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
  FALLBACK_LAN, FALLBACK_LAN_GATEWAY, allocateDhcpLease, allocateStaticHost,
  dhcpPoolOf, firstFreeHost, gatewayAddressOf, lanDefaultsFor,
  primaryGateway, usedAddresses,
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
    // Display fallbacks. `||` and `??` both hide a missing value behind a
    // plausible address; the ?.100 one survived a scan that only knew about
    // `||`, which is why both are checked.
    ok(`${name}: no 192.168.1.100 fallback behind || or ??`,
      !/(\|\||\?\?)\s*'192\.168\.1\.100'/.test(src));
    ok(`${name}: no "? 192.168.88.1" default for a missing address`, !/\?\?\s*'192\.168\.88\.1'/.test(src));
    // The camera stream URL rendered a camera address the camera does not have.
    ok(`${name}: no 192.168.1.50 fallback in the RTSP URL`,
      !/(\|\||\?\?)\s*'192\.168\.1\.50'/.test(src));
    // handleAddDevice gave a brand-new MikroTik the constant 192.168.88.1 --
    // the address the MikroTik in the shipped SOHO template already holds, so
    // every MikroTik added there was a duplicate the moment it appeared.
    ok(`${name}: no node is created with a hardcoded 192.168.88.1`,
      !/\bip:\s*'192\.168\.88\.1'/.test(src));
    // The camera "Perbaiki Otomatis" button built an address out of a constant
    // host: `${routerLanIp.replace(/\.\d+$/, '')}.50`. Pressing it on a second
    // camera stacked it on the first.
    ok(`${name}: no address built from a constant host suffix`,
      !/`\$\{[^}]*replace\([^)]*\)\}\.\d+`/.test(src));
    // Lease and gateway must be decided together, never one from `routerLanIp`
    // while the other came from the allocator.
    ok(`${name}: no lease paired with an independent gateway lookup`,
      !/allocateDhcpLease[\s\S]{0,400}?\b(gatewayAddressOf|routerLanIp)\b/.test(src));
  }

  // Every address assigned to a node in these two files is either computed,
  // empty, or the one deliberate LAN gateway below. There is deliberately no
  // allowlist to widen: a list of acceptable constants is a rubber stamp, and
  // mutation 17 of scripts/mutate-ipalloc.sh proves it -- adding one entry
  // makes any new constant legal.
  //
  // The single exception is the ONT's `192.168.1.1`. An ONT is the gateway of
  // its own LAN on its own PON leg, so two ONTs legitimately share it on
  // different broadcast domains; the duplicate warning is what is wrong there,
  // and that needs one subnet per broadcast domain rather than a unique-looking
  // address. It is pinned to the ONT branch and to a count of one, so a second
  // constant anywhere else fails.
  {
    const ONT_LAN_GATEWAY = "'192.168.1.1'";

    for (const rel of ['../src/App.tsx', '../src/components/NodeInspector.tsx']) {
      const name = rel.split('/').pop();
      const src = stripComments(readFileSync(new URL(rel, import.meta.url), 'utf8'));

      // `\bip:` cannot match `lanIp:` or `staticIp:` -- the boundary needs a
      // non-word character before `ip`, and those prefixes end in a word char.
      const bare = [...src.matchAll(/\bip:\s*([^,\n}]+)/g)]
        .map((m) => m[1].trim())
        .filter((v) => v.startsWith("'") || v.startsWith('"'));

      for (const value of bare) {
        ok(`${name}: assigned ip ${value} is the ONT LAN gateway or computed`,
          value === ONT_LAN_GATEWAY, value);
      }

      // Nothing may name a host address inside a template literal either.
      const inTemplate = [...src.matchAll(/`[^`]*`/g)]
        .map((m) => m[0])
        .filter((t) => /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(t));
      ok(`${name}: no template literal hardcodes a full address`, inTemplate.length === 0,
        inTemplate.slice(0, 2).join(' | '));

      if (name === 'App.tsx') {
        // The literal also appears as a `gateway:` default and as the ONT's
        // `ontConfig.lanIp`. Those are route hints and configuration defaults,
        // not an address being handed to a new node, so the exception is
        // scoped by the key on the line rather than by counting occurrences.
        const lines = src.split('\n');
        const asIpKey = lines
          .map((l, i) => ({ i: i + 1, l }))
          .filter(({ l }) => new RegExp(`\\bip:\\s*${ONT_LAN_GATEWAY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(l));

        ok('App.tsx: exactly one `ip:` assignment uses the ONT gateway literal',
          asIpKey.length === 1, `${asIpKey.length} di baris ${asIpKey.map((x) => x.i).join(', ')}`);

        // Any other key may not smuggle the literal into an address field.
        const smuggled = lines
          .map((l, i) => ({ i: i + 1, l }))
          .filter(({ l }) => l.includes(ONT_LAN_GATEWAY) && !/\bip:/.test(l))
          .filter(({ l }) => !/\b(gateway|lanIp|dhcpPoolStart|dhcpPoolEnd|dhcpRangeStart|dhcpRangeEnd):/.test(l));
        ok('App.tsx: the literal never appears under another address key',
          smuggled.length === 0, smuggled.slice(0, 3).map((x) => `${x.i}:${x.l.trim()}`).join(' | '));

        const line = asIpKey[0];
        ok('App.tsx: the assignment sits in the ONT branch',
          Boolean(line) && /type === 'ont'/.test(src.slice(0, src.indexOf(line.l))),
          line ? `baris ${line.i}` : '(tidak ada)');
      }
    }
  }

  // The four checks above only mean something if the shape they look for is the
  // shape the bug had. Assert the patterns still match the removed code.
  ok('the .100 pattern still matches how the bug was written',
    /(\|\||\?\?)\s*'192\.168\.1\.100'/.test("ip: lanAddress ?? '192.168.1.100',"));
  ok('the .50 pattern still matches how the RTSP bug was written',
    /(\|\||\?\?)\s*'192\.168\.1\.50'/.test("`rtsp://${node.ipConfig?.ip || '192.168.1.50'}:554`"));
  ok('and does not match an honest empty string',
    !/(\|\||\?\?)\s*'192\.168\.1\.100'/.test("ip: lanAddress ?? '',"));
  // The same guard for the two newest patterns.
  ok('the constant-suffix pattern still matches the camera auto-fix bug',
    /`\$\{[^}]*replace\([^)]*\)\}\.\d+`/.test("ip: `${routerLanIp.replace(/\\.\\d+$/, '')}.50`,"));
  ok('the pairing pattern still matches a lease joined to an unrelated gateway',
    /allocateDhcpLease[\s\S]{0,400}?\b(gatewayAddressOf|routerLanIp)\b/.test(
      'const lease = allocateDhcpLease(gw, nodes);\nconst g = gatewayAddressOf(gw) || routerLanIp;'));
  ok('and does not match a lease paired through lanDefaultsFor',
    !/allocateDhcpLease[\s\S]{0,400}?\b(gatewayAddressOf|routerLanIp)\b/.test(
      'const lease = allocateDhcpLease(gw, nodes);\nconst d = lanDefaultsFor(gw);'));

  // Guard the guard: the stripper must actually strip, or the four checks above
  // would pass on a file full of comments.
  ok('the comment stripper removes a commented-out constant',
    !/\.115/.test(stripComments('const a = 1; // used to be .115\n')));
  ok('and leaves a live constant alone',
    /\.115/.test(stripComments('const a = ".115";\n')));
}

// ------------------------------------------- the pool must serve its own LAN

{
  // A DHCP range on a different subnet than the gateway's own address hands out
  // leases no client can reach the gateway through. Every lease is unique, so
  // the duplicate check sees nothing wrong -- the only signal is this one.
  const gw = gateway('192.168.88.1', {
    ipConfig: {
      mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0',
      isDhcpServerEnabled: true, dhcpRangeStart: '10.0.0.10', dhcpRangeEnd: '10.0.0.200',
    },
  });
  eq('a pool on another subnet is refused', dhcpPoolOf(gw), null);
  eq('and therefore no lease is handed out from it', allocateDhcpLease(gw, [gw]), null);

  const sameSubnet = gateway('192.168.88.1', {
    ipConfig: {
      mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0',
      isDhcpServerEnabled: true, dhcpRangeStart: '192.168.88.100', dhcpRangeEnd: '192.168.88.200',
    },
  });
  eq('a pool on the gateway\'s own subnet is accepted',
    dhcpPoolOf(sameSubnet), { prefix: '192.168.88.', start: 100, end: 200 });

  // The gateway's address is the pool's first host. A lease that equals it
  // would make the client its own gateway, which is the other half of the
  // original bug.
  const selfLeased = gateway('192.168.88.100', {
    ipConfig: {
      mode: 'static', ip: '192.168.88.100', subnet: '255.255.255.0',
      isDhcpServerEnabled: true, dhcpRangeStart: '192.168.88.100', dhcpRangeEnd: '192.168.88.200',
    },
  });
  const selfLease = allocateDhcpLease(selfLeased, [selfLeased]);
  ok('a lease never lands on the gateway\'s own address', selfLease !== '192.168.88.100', selfLease);
}

// ------------------------------------------- lease and gateway as one pair

{
  const three = (ip) => ip.split('.').slice(0, 3).join('.');

  // The invariant that matters: whatever lease the allocator hands out, the
  // default gateway written beside it has to be in the same subnet. Getting
  // these from two different places is what produced a client on 192.168.1.100
  // whose gateway was 192.168.88.1 -- which the app then flagged as
  // "Gateway Salah" on a card the user had just configured.
  const cases = [
    { label: 'router at 192.168.88.1', gw: gateway('192.168.88.1'), nodes: [] },
    { label: 'router at 10.20.30.1', gw: gateway('10.20.30.1'), nodes: [] },
    { label: 'router with a /16 mask', gw: node({ type: 'router', ipConfig: { mode: 'static', ip: '172.16.0.1', subnet: '255.255.0.0', isDhcpServerEnabled: true } }), nodes: [] },
    { label: 'router whose pool is already full', gw: gateway('192.168.88.1'), nodes: Array.from({ length: 155 }, (_, i) => withIp(`192.168.88.${100 + i}`)) },
    { label: 'no gateway at all', gw: null, nodes: [] },
    { label: 'no gateway, fallback pool partly taken', gw: null, nodes: [withIp('192.168.1.100'), withIp('192.168.1.101')] },
  ];

  for (const { label, gw, nodes } of cases) {
    const d = lanDefaultsFor(gw);
    eq(`${label}: the pair names a valid gateway`, isValidIpv4(d.gateway), true);
    eq(`${label}: the pair names a valid mask`, isValidIpv4(d.subnet), true);

    const lease = allocateDhcpLease(gw, nodes);
    if (lease) {
      eq(`${label}: the lease ${lease} is in the gateway's subnet`,
        three(lease), three(d.gateway));
      ok(`${label}: the lease is not the gateway itself`, lease !== d.gateway, `${lease} == ${d.gateway}`);
    }
    // With no lease there is no address to contradict, so nothing more to
    // check here: a real gateway with an exhausted pool still reports itself,
    // which is coherent, and the no-gateway case is pinned separately below.
  }

  // The gateway's own mask is kept: a /16 LAN configured on the gateway should
  // not come back as a /24 on its clients.
  const wide = node({ type: 'router', ipConfig: { mode: 'static', ip: '172.16.0.1', subnet: '255.255.0.0', isDhcpServerEnabled: true } });
  eq('a /16 gateway keeps its /16 mask', lanDefaultsFor(wide).subnet, '255.255.0.0');

  // A gateway with no usable mask falls back rather than propagating junk.
  const noMask = node({ type: 'router', ipConfig: { mode: 'static', ip: '172.20.0.1', subnet: 'bukan-mask', isDhcpServerEnabled: true } });
  eq('an unusable mask falls back to /24', lanDefaultsFor(noMask).subnet, '255.255.255.0');

  // With no gateway, both halves come from FALLBACK_LAN -- which is the whole
  // point of the pair.
  const none = lanDefaultsFor(null);
  eq('no gateway: the address is the fallback LAN gateway', none.gateway, FALLBACK_LAN_GATEWAY);
  eq('no gateway: the mask is /24', none.subnet, '255.255.255.0');
  ok('and the fallback gateway is inside the fallback pool',
    FALLBACK_LAN_GATEWAY.startsWith(FALLBACK_LAN.prefix), FALLBACK_LAN_GATEWAY);
}

console.log(`ok — ${n} assertions passed`);
