/**
 * Tests for src/utils/portReconcile.ts — which port a cable is plugged into.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-ports.mjs
 *
 * The defect, reproduced on the running app rather than inferred: the shipped
 * templates declared 5-6 cables each and marked *zero* ports, and
 * `handleConnectNodes` picks a free port with
 * `node.ports.find((p) => p.medium === medium && !p.connectedCableId)`. With
 * nothing marked, that find returned the first ethernet port every time.
 *
 * Measured on the SOHO template's MikroTik: 6 cables, 3 ports, none claimed.
 * After three more LAN cables: 9 cables, still 3 ports. `ether1 (WAN)` and
 * `ether2 (LAN)` were already in use by the ISP and the switch, yet the new
 * devices landed on `ether1 (WAN)`, then `ether2`, then `ether3` -- and because
 * `attachPort` overwrote the reference, the template's own ISP cable ended up
 * owning no port at all.
 *
 * Two things are checked independently of the module's own helpers wherever it
 * matters:
 *   - occupancy is counted by walking cables and ports separately, not by
 *     calling a function that already agrees with the implementation;
 *   - the template expectation is pinned per *port name*, because the names in
 *     the template data ("ether1 (WAN)", "Port 3 (AP Wi-Fi)") show the author's
 *     intent and a regression would show up as a name swapping.
 */
import assert from 'node:assert/strict';
import { TOPOLOGY_TEMPLATES } from '../src/data/templates.ts';
import { mediumForCable, reconcilePorts, synthesisePort } from '../src/utils/portReconcile.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};
const eq = (msg, actual, expected) => {
  n++;
  assert.deepEqual(actual, expected, `${msg}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
};

/** Cable ids touching a node, computed from the cable list alone. */
const cablesAt = (nodeId, cables) =>
  cables.filter((c) => c.fromNodeId === nodeId || c.toNodeId === nodeId).map((c) => c.id).sort();

/** Cable ids a node's ports claim, computed from the port list alone. */
const claimedAt = (node) =>
  node.ports.filter((p) => p.connectedCableId).map((p) => p.connectedCableId).sort();

const nodeById = (nodes, id) => nodes.find((x) => x.id === id);

// ---------------------------------------------------------------- mediumForCable

eq('feeder needs fiber', mediumForCable('feeder'), 'fiber');
eq('distribusi needs fiber', mediumForCable('distribusi'), 'fiber');
eq('drop_core needs fiber', mediumForCable('drop_core'), 'fiber');
eq('lan needs ethernet', mediumForCable('lan'), 'ethernet');
eq('coaxial needs coaxial', mediumForCable('coaxial'), 'coaxial');
eq('wireless needs wireless', mediumForCable('wireless'), 'wireless');

// ---------------------------------------------------------------- synthesisePort

{
  const node = { id: 'n1', ports: [{ id: 'a', name: 'ether1', medium: 'ethernet', status: 'up' }] };
  const p = synthesisePort(node, 'ethernet', 'k1');
  ok('synthesised id derives from node + key', p.id === 'p-n1-auto-k1');
  ok('synthesised name counts existing ports', p.name === 'ETHERNET Port 2');
  eq('synthesised medium is honoured', p.medium, 'ethernet');
  ok('synthesised port starts unclaimed', p.connectedCableId === undefined);
  eq('synthesised port is deterministic', synthesisePort(node, 'ethernet', 'k1').id, p.id);
}

// ------------------------------------------- every template: cables own ports

for (const t of TOPOLOGY_TEMPLATES) {
  const before = t.nodes.flatMap((x) => x.ports).filter((p) => p.connectedCableId).length;
  eq(`template "${t.name.slice(0, 30)}" ships with zero claimed ports (precondition)`, before, 0);

  const nodes = reconcilePorts(t.nodes, t.cables);

  for (const node of nodes) {
    const touching = cablesAt(node.id, t.cables);
    const claiming = claimedAt(node);
    // No port may claim a cable that does not touch this node.
    for (const id of claiming) {
      ok(`${node.label}: claims a cable that touches it (${id})`, touching.includes(id));
    }
    // A cable cannot be claimed by two ports on the same node.
    eq(`${node.label}: no port claims the same cable twice`, claiming.length, new Set(claiming).size);
    // Every cable touching the node is accounted for.
    eq(`${node.label}: claims every cable touching it`, claiming.length, touching.length);
  }

  const totalEnds = nodes.reduce((a, x) => a + claimedAt(x).length, 0);
  eq(`template "${t.name.slice(0, 30)}": every cable end owns a port`, totalEnds, t.cables.length * 2);
}

// ---------------------------------------------------- intent pinned by name

{
  const soho = TOPOLOGY_TEMPLATES.find((t) => t.name.includes('SOHO'));
  const nodes = reconcilePorts(soho.nodes, soho.cables);
  const cable = (fromLabel, toLabel) => {
    const a = soho.nodes.find((x) => x.label.includes(fromLabel));
    const b = soho.nodes.find((x) => x.label.includes(toLabel));
    return soho.cables.find(
      (c) =>
        (c.fromNodeId === a.id && c.toNodeId === b.id) ||
        (c.fromNodeId === b.id && c.toNodeId === a.id),
    ).id;
  };

  const mk = nodes.find((x) => x.type === 'mikrotik');
  eq('MikroTik ether1 (WAN) serves the ISP cable', mk.ports.find((p) => p.name.includes('ether1')).connectedCableId, cable('Fiber Optic Media', 'Gateway & Bandwidth'));
  eq('MikroTik ether2 (LAN) serves the switch', mk.ports.find((p) => p.name.includes('ether2')).connectedCableId, cable('Gateway & Bandwidth', 'TP-Link'));
  ok('MikroTik ether3 (Hotspot) is still free', mk.ports.find((p) => p.name.includes('ether3')).connectedCableId === undefined);

  const sw = nodes.find((x) => x.type === 'switch');
  eq('switch Port 1 (Uplink) serves the MikroTik', sw.ports.find((p) => p.name.includes('Port 1')).connectedCableId, cable('Gateway & Bandwidth', 'TP-Link'));
  eq('switch Port 2 (PC 1) serves the workstation', sw.ports.find((p) => p.name.includes('Port 2')).connectedCableId, cable('TP-Link', 'Workstation'));
  eq('switch Port 3 (AP Wi-Fi) serves the AP', sw.ports.find((p) => p.name.includes('Port 3')).connectedCableId, cable('TP-Link', 'Ruijie'));
  eq('switch Port 4 (CCTV) serves the camera', sw.ports.find((p) => p.name.includes('Port 4')).connectedCableId, cable('TP-Link', 'Hikvision'));

  // The bug, stated as an invariant: with three ports and two cables already
  // on them, a new ethernet cable must not take ether1.
  const free = mk.ports.filter((p) => p.medium === 'ethernet' && !p.connectedCableId);
  eq('MikroTik has exactly one free ethernet port left', free.map((p) => p.name), ['ether3 (Hotspot)']);
}

// -------------------------------------------------------------- idempotence

for (const t of TOPOLOGY_TEMPLATES) {
  const once = reconcilePorts(t.nodes, t.cables);
  const twice = reconcilePorts(once, t.cables);
  eq(`template "${t.name.slice(0, 26)}": reconcile is idempotent`, twice, once);
  const thrice = reconcilePorts(twice, t.cables);
  eq(`template "${t.name.slice(0, 26)}": still idempotent on a third pass`, thrice, once);
}

// ------------------------------------------- respects a port the author chose

{
  const nodes = [
    { id: 'r1', type: 'router', name: 'R1', label: 'R1', x: 0, y: 0, status: 'online', poweredOn: true,
      ports: [
        { id: 'p5', name: 'LAN 5', medium: 'ethernet', status: 'up', connectedCableId: 'cA' },
        { id: 'p1', name: 'LAN 1', medium: 'ethernet', status: 'up' },
        { id: 'p2', name: 'LAN 2', medium: 'ethernet', status: 'up' },
      ] },
  ];
  const cables = [{ id: 'cA', type: 'lan', fromNodeId: 'r1', toNodeId: 'pc1', status: 'active' },
                  { id: 'cB', type: 'lan', fromNodeId: 'r1', toNodeId: 'pc2', status: 'active' }];
  const out = reconcilePorts(nodes, cables);
  eq('an author-chosen port is not moved', out[0].ports.find((p) => p.id === 'p5').connectedCableId, 'cA');
  eq('the next cable takes the first unclaimed port', out[0].ports.find((p) => p.id === 'p1').connectedCableId, 'cB');
  ok('no port invented when one was free', out[0].ports.length === 3);
}

// ------------------------------------------------ synthesise when out of ports

{
  const nodes = [
    { id: 'r1', type: 'router', name: 'R1', label: 'R1', x: 0, y: 0, status: 'online', poweredOn: true,
      ports: [{ id: 'p1', name: 'LAN 1', medium: 'ethernet', status: 'up' }] },
  ];
  const cables = [
    { id: 'cA', type: 'lan', fromNodeId: 'r1', toNodeId: 'a', status: 'active' },
    { id: 'cB', type: 'lan', fromNodeId: 'r1', toNodeId: 'b', status: 'active' },
  ];
  const out = reconcilePorts(nodes, cables);
  eq('port list grew rather than double-booking LAN 1', out[0].ports.length, 2);
  eq('LAN 1 keeps the first cable', out[0].ports[0].connectedCableId, 'cA');
  eq('the extra port carries the second cable', out[0].ports[1].connectedCableId, 'cB');
  ok('the extra port is named after the count', out[0].ports[1].name === 'ETHERNET Port 2');
}

// Two ports synthesised in one pass must not share a name.
{
  const nodes = [
    { id: 'r1', type: 'router', name: 'R1', label: 'R1', x: 0, y: 0, status: 'online', poweredOn: true,
      ports: [{ id: 'p1', name: 'LAN 1', medium: 'ethernet', status: 'up' }] },
  ];
  const cables = [
    { id: 'cA', type: 'lan', fromNodeId: 'r1', toNodeId: 'a', status: 'active' },
    { id: 'cB', type: 'lan', fromNodeId: 'r1', toNodeId: 'b', status: 'active' },
    { id: 'cC', type: 'lan', fromNodeId: 'r1', toNodeId: 'c', status: 'active' },
  ];
  const names = reconcilePorts(nodes, cables)[0].ports.map((p) => p.name);
  eq('three synthesised names are distinct', new Set(names).size, names.length);
  eq('names count up from the existing port', names, ['LAN 1', 'ETHERNET Port 2', 'ETHERNET Port 3']);
}

// ------------------------------------------------------ medium is respected

{
  const nodes = [
    { id: 'ont', type: 'ont', name: 'ONT', label: 'ONT', x: 0, y: 0, status: 'online', poweredOn: true,
      ports: [
        { id: 'f1', name: 'PON', medium: 'fiber', status: 'up' },
        { id: 'e1', name: 'LAN 1', medium: 'ethernet', status: 'up' },
      ] },
    { id: 'pc', type: 'pc', name: 'PC', label: 'PC', x: 0, y: 0, status: 'online', poweredOn: true, ports: [] },
  ];
  const cables = [
    { id: 'cDrop', type: 'drop_core', fromNodeId: 'oltX', toNodeId: 'ont', status: 'active' },
    { id: 'cLan', type: 'lan', fromNodeId: 'ont', toNodeId: 'pc', status: 'active' },
  ];
  // `oltX` is absent from `nodes`, but the drop cable is still plugged into the
  // ONT's PON port -- so that port must be claimed, not left free for a later
  // connection to double-book.
  const out = reconcilePorts(nodes, cables);
  const ont = out[0];
  eq('a cable with a missing far endpoint still claims its port', ont.ports[0].connectedCableId, 'cDrop');
  eq('the lan cable claims the ethernet port', ont.ports[1].connectedCableId, 'cLan');
  ok('a wireless cable does not take an ethernet port', (() => {
    const withWifi = reconcilePorts(nodes, [
      { id: 'cW', type: 'wireless', fromNodeId: 'ont', toNodeId: 'pc', status: 'active' },
    ]);
    const ports = withWifi[0].ports;
    return (
      ports.every((p) => p.connectedCableId === undefined || p.medium === 'wireless') &&
      ports.length === 3 &&
      ports[2].medium === 'wireless' &&
      ports[2].connectedCableId === 'cW'
    );
  })());
}

// ------------------------------- the live scenario: three cables onto MikroTik

{
  // Reproduces the measured run: SOHO MikroTik, three extra LAN cables.
  // ether1/ether2 are already taken by the template's own two cables, so the
  // first new cable takes ether3 and the next two have to synthesise ports:
  // 3 -> 3 -> 4 -> 5. Before the fix every one of them re-took ether1 and the
  // count stayed at 3.
  const soho = TOPOLOGY_TEMPLATES.find((t) => t.name.includes('SOHO'));
  const mk = soho.nodes.find((x) => x.type === 'mikrotik');
  let nodes = reconcilePorts(soho.nodes, soho.cables);
  let cables = [...soho.cables];
  const counts = [nodes.find((x) => x.id === mk.id).ports.length];

  for (let i = 0; i < 3; i++) {
    const peerId = `new${i}`;
    nodes = [...nodes, { id: peerId, type: 'pc', name: `PC${i}`, label: `PC${i}`, x: 0, y: 0,
      status: 'online', poweredOn: true, ports: [] }];
    cables = [...cables, { id: `cNew${i}`, type: 'lan', fromNodeId: mk.id, toNodeId: peerId, status: 'active' }];
    nodes = reconcilePorts(nodes, cables);
    counts.push(nodes.find((x) => x.id === mk.id).ports.length);
  }

  eq('port count after each new cable', counts, [3, 3, 4, 5]);
  const finalMk = nodes.find((x) => x.id === mk.id);
  const dupes = finalMk.ports
    .map((p) => p.connectedCableId)
    .filter((id, i, arr) => id && arr.indexOf(id) !== i);
  eq('no cable owns two ports on the MikroTik', dupes, []);
  eq('every MikroTik cable is claimed', claimedAt(finalMk).length, cablesAt(mk.id, cables).length);
}

console.log(`ok — ${n} assertions passed`);
