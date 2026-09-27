/**
 * Behavioural tests for src/utils/autoFix.ts.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-autofix.mjs
 *
 * Each case builds a small topology that trips exactly one diagnosticEngine
 * check, runs `applyAutoFix` on the resulting issue, and re-runs
 * `runNetworkDiagnostics` on the patched topology to confirm the specific
 * issue is actually gone -- not just that some field changed to a
 * plausible-looking value.
 */
import assert from 'node:assert/strict';
import { runNetworkDiagnostics } from '../src/utils/diagnosticEngine.ts';
import { applyAutoFix, isAutoFixable } from '../src/utils/autoFix.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

const node = (id, type, extra = {}) => ({
  id, type, name: id, label: '', x: 0, y: 0, status: 'online', poweredOn: true, ports: [], ...extra,
});
const cable = (a, b, extra = {}) => ({
  id: `c-${a}-${b}`, fromNodeId: a, toNodeId: b, type: 'lan',
  status: 'active', lengthKm: 0.01, attenuationDb: 0.02, ...extra,
});

const noOpt = new Map();
const issuesOf = (nodes, cables) => runNetworkDiagnostics(nodes, cables, noOpt);
const findIssue = (nodes, cables, prefix) => issuesOf(nodes, cables).find((i) => i.id.startsWith(prefix));

// ---- power-off -------------------------------------------------------------
{
  const nodes = [node('pc', 'pc', { poweredOn: false, ipConfig: { mode: 'static', ip: '192.168.1.10', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' } })];
  const cables = [];
  const issue = findIssue(nodes, cables, 'power-');
  ok('power-off: issue terdeteksi', !!issue);
  ok('power-off: dapat di-autofix', isAutoFixable(issue));
  const fix = applyAutoFix(issue, nodes, cables);
  ok('power-off: node dinyalakan', fix.nodes[0].poweredOn === true);
  ok('power-off: issue hilang setelah fix', !findIssue(fix.nodes, fix.cables, 'power-'));
}

// ---- broken cable -----------------------------------------------------------
{
  const nodes = [node('a', 'pc'), node('b', 'switch')];
  const cables = [cable('a', 'b', { status: 'broken' })];
  const issue = findIssue(nodes, cables, 'broken-');
  ok('broken: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('broken: kabel aktif kembali', fix.cables[0].status === 'active');
  ok('broken: issue hilang', !findIssue(fix.nodes, fix.cables, 'broken-'));
}

// ---- HTB role mismatch -------------------------------------------------------
{
  const nodes = [
    node('htbA', 'htb', { htbRole: 'A' }),
    node('htbB', 'htb', { htbRole: 'A' }),
  ];
  const cables = [cable('htbA', 'htbB', { type: 'drop_core', medium: 'fiber' })];
  const issue = findIssue(nodes, cables, 'htb-mismatch-');
  ok('htb-mismatch: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('htb-mismatch: issue hilang setelah fix', !findIssue(fix.nodes, fix.cables, 'htb-mismatch-'));
}

// ---- IP conflict --------------------------------------------------------------
{
  const nodes = [
    node('rtr', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.1.1', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8', isDhcpServerEnabled: true }, mikrotikConfig: { firewallNat: true } }),
    node('pc1', 'pc', { ipConfig: { mode: 'static', ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' } }),
    node('pc2', 'pc', { ipConfig: { mode: 'static', ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' } }),
  ];
  const cables = [cable('rtr', 'pc1'), cable('rtr', 'pc2')];
  const issue = findIssue(nodes, cables, 'ip-conflict-');
  ok('ip-conflict: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('ip-conflict: issue hilang setelah fix', !findIssue(fix.nodes, fix.cables, 'ip-conflict-'));
  const ips = fix.nodes.filter((x) => x.type === 'pc').map((x) => x.ipConfig.ip);
  ok('ip-conflict: kedua PC kini punya IP berbeda', new Set(ips).size === 2);
}

// ---- missing gateway ------------------------------------------------------
{
  const nodes = [
    node('rtr', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8' }, mikrotikConfig: { firewallNat: true } }),
    node('pc', 'pc', { ipConfig: { mode: 'static', ip: '192.168.88.10', subnet: '255.255.255.0', gateway: '0.0.0.0', dns: '8.8.8.8' } }),
  ];
  const cables = [cable('rtr', 'pc')];
  const issue = findIssue(nodes, cables, 'no-gw-');
  ok('no-gw: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('no-gw: gateway terisi otomatis', fix.nodes.find((x) => x.id === 'pc').ipConfig.gateway === '192.168.88.1');
  ok('no-gw: issue hilang', !findIssue(fix.nodes, fix.cables, 'no-gw-'));
}

// ---- gateway mismatch with the router actually wired to --------------------
{
  const nodes = [
    node('rtr', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8' }, mikrotikConfig: { firewallNat: true } }),
    node('pc', 'pc', { ipConfig: { mode: 'static', ip: '192.168.88.10', subnet: '255.255.255.0', gateway: '10.10.10.1', dns: '8.8.8.8' } }),
  ];
  const cables = [cable('rtr', 'pc')];
  const issue = findIssue(nodes, cables, 'gw-mismatch-');
  ok('gw-mismatch: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('gw-mismatch: gateway disamakan dengan router', fix.nodes.find((x) => x.id === 'pc').ipConfig.gateway === '192.168.88.1');
  ok('gw-mismatch: issue hilang', !findIssue(fix.nodes, fix.cables, 'gw-mismatch-'));
}

// ---- client IP outside the router's subnet ---------------------------------
{
  const nodes = [
    node('rtr', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8' }, mikrotikConfig: { firewallNat: true } }),
    node('pc', 'pc', { ipConfig: { mode: 'static', ip: '10.0.0.55', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8' } }),
  ];
  const cables = [cable('rtr', 'pc')];
  const issue = findIssue(nodes, cables, 'ip-subnet-mismatch-');
  ok('ip-subnet-mismatch: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  const pc = fix.nodes.find((x) => x.id === 'pc');
  ok('ip-subnet-mismatch: IP baru berada di subnet router', pc.ipConfig.ip.startsWith('192.168.88.'));
  ok('ip-subnet-mismatch: issue hilang', !findIssue(fix.nodes, fix.cables, 'ip-subnet-mismatch-'));
}

// ---- DHCP server off on the actual upstream --------------------------------
{
  const nodes = [
    node('rtr', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8', isDhcpServerEnabled: false }, mikrotikConfig: { firewallNat: true } }),
    node('pc', 'pc', { ipConfig: { mode: 'dhcp', ip: '192.168.88.10', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8' } }),
  ];
  const cables = [cable('rtr', 'pc')];
  const issue = findIssue(nodes, cables, 'dhcp-server-off-');
  ok('dhcp-server-off: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('dhcp-server-off: DHCP diaktifkan pada router', fix.nodes.find((x) => x.id === 'rtr').ipConfig.isDhcpServerEnabled === true);
  ok('dhcp-server-off: issue hilang', !findIssue(fix.nodes, fix.cables, 'dhcp-server-off-'));
}

// ---- MikroTik NAT off -------------------------------------------------------
{
  const nodes = [node('rtr', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8' }, mikrotikConfig: { firewallNat: false } })];
  const cables = [];
  const issue = findIssue(nodes, cables, 'nat-off-');
  ok('nat-off: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('nat-off: NAT diaktifkan', fix.nodes[0].mikrotikConfig.firewallNat === true);
  ok('nat-off: issue hilang', !findIssue(fix.nodes, fix.cables, 'nat-off-'));
}

// ---- switching loop between two switches -----------------------------------
{
  const nodes = [node('sa', 'switch'), node('sb', 'switch')];
  const cables = [cable('sa', 'sb', { id: 'c1' }), cable('sa', 'sb', { id: 'c2' })];
  const issue = findIssue(nodes, cables, 'loop-');
  ok('loop: issue terdeteksi', !!issue);
  ok('loop: targetNodeId terisi', !!issue.targetNodeId);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('loop: satu kabel paralel dilepas', fix.cables.length === 1);
  ok('loop: issue hilang', !findIssue(fix.nodes, fix.cables, 'loop-'));
}

// ---- VLAN trunk drop --------------------------------------------------------
{
  const nodes = [
    node('access', 'pc', { vlanConfig: { enabled: true, vlanId: 30, vlanName: 'v30', mode: 'access' } }),
    node('trunk', 'switch', { vlanConfig: { enabled: true, vlanId: 1, vlanName: 'v1', mode: 'trunk', allowedVlans: [10, 20] } }),
  ];
  const cables = [cable('access', 'trunk')];
  const issue = findIssue(nodes, cables, 'vlan-trunk-drop-');
  ok('vlan-trunk-drop: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  const trunk = fix.nodes.find((x) => x.id === 'trunk');
  ok('vlan-trunk-drop: VLAN 30 ditambahkan ke allowedVlans', trunk.vlanConfig.allowedVlans.includes(30));
  ok('vlan-trunk-drop: issue hilang', !findIssue(fix.nodes, fix.cables, 'vlan-trunk-drop-'));
}

// ---- ONT bridge mode with a direct client, no PPPoE router -----------------
{
  const nodes = [
    node('ont', 'ont', { ontConfig: { wanMode: 'bridge', lanIp: '192.168.1.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: false } }),
    node('pc', 'pc', { ipConfig: { mode: 'dhcp', ip: '192.168.1.10', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' } }),
  ];
  const cables = [cable('ont', 'pc')];
  const issue = findIssue(nodes, cables, 'ont-bridge-no-router-');
  ok('ont-bridge: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  const ont = fix.nodes.find((x) => x.id === 'ont');
  ok('ont-bridge: WAN mode dikembalikan ke pppoe', ont.ontConfig.wanMode === 'pppoe');
  ok('ont-bridge: DHCP server diaktifkan', ont.ontConfig.dhcpServerEnabled === true);
  ok('ont-bridge: issue hilang', !findIssue(fix.nodes, fix.cables, 'ont-bridge-no-router-'));
  ok('ont-bridge: issue klien turut hilang', !findIssue(fix.nodes, fix.cables, 'client-no-internet-bridge-'));
}

// ---- fixing the client's copy of the bridge issue works from that side too --
{
  const nodes = [
    node('ont', 'ont', { ontConfig: { wanMode: 'bridge', lanIp: '192.168.1.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: false } }),
    node('pc', 'pc', { ipConfig: { mode: 'dhcp', ip: '192.168.1.10', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' } }),
  ];
  const cables = [cable('ont', 'pc')];
  const issue = findIssue(nodes, cables, 'client-no-internet-bridge-');
  ok('client-no-internet-bridge: issue terdeteksi', !!issue);
  const fix = applyAutoFix(issue, nodes, cables);
  ok('client-no-internet-bridge: ONT diperbaiki lewat sisi klien', fix.nodes.find((x) => x.id === 'ont').ontConfig.wanMode === 'pppoe');
}

// ---- issues without a handler are reported as not fixable ------------------
{
  const nodes = [node('a', 'pc')];
  const cables = [];
  const issue = findIssue(nodes, cables, 'isolated-');
  ok('isolated: issue terdeteksi', !!issue);
  ok('isolated: dilaporkan tidak bisa auto-fix', !isAutoFixable(issue));
  ok('isolated: applyAutoFix mengembalikan null', applyAutoFix(issue, nodes, cables) === null);
}

// ---- deleted target: handler must not throw, just decline -----------------
{
  const fakeIssue = { id: 'power-ghost', severity: 'critical', title: 't', targetNodeId: 'ghost' };
  ok('node hilang: tidak melempar exception', applyAutoFix(fakeIssue, [], []) === null);
}

console.log(`ok — ${n} assertions passed`);
