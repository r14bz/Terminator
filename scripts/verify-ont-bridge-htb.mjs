/**
 * Verification for topology:
 *   MikroTik -> LAN -> HTB A -> (fiber) -> HTB B -> LAN -> ONT (mode bridge) -> PC
 *
 * Run via:
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-ont-bridge-htb.mjs
 */
import assert from 'node:assert/strict';
import { checkInternetAccess, findUpstreamGateway, findRouterConnectedToBridge } from '../src/utils/ipUtils.ts';
import { runNetworkDiagnostics } from '../src/utils/diagnosticEngine.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};
const eq = (msg, a, b) => {
  n++;
  assert.deepEqual(a, b, msg);
};

const node = (id, type, name, extra = {}) => ({
  id,
  type,
  name,
  label: name,
  poweredOn: true,
  status: 'online',
  x: 0,
  y: 0,
  ports: [],
  ...extra,
});

const cable = (a, b, type = 'lan', extra = {}) => ({
  id: `c-${a}-${b}`,
  fromNodeId: a,
  toNodeId: b,
  type,
  status: 'active',
  lengthKm: 0.01,
  attenuationDb: 0.05,
  ...extra,
});

function buildTopology() {
  const inet = node('inet', 'internet', 'ISP Gateway');
  const mk = node('mk', 'mikrotik', 'MikroTik RB750Gr3', {
    ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0' },
    mikrotikConfig: { firewallNat: true },
  });
  const htbA = node('htbA', 'htb', 'HTB Converter A', { htbRole: 'A' });
  const htbB = node('htbB', 'htb', 'HTB Converter B', { htbRole: 'B' });
  const ont = node('ont', 'ont', 'ONT ZTE F609', {
    ontConfig: { wanMode: 'bridge', dhcpServerEnabled: false },
  });
  const pc = node('pc', 'pc', 'Client PC', {
    ipConfig: { mode: 'static', ip: '192.168.88.15', subnet: '255.255.255.0', gateway: '192.168.88.1' },
  });

  const cables = [
    cable('inet', 'mk', 'lan'),
    cable('mk', 'htbA', 'lan'),
    cable('htbA', 'htbB', 'drop_core'),
    cable('htbB', 'ont', 'lan'),
    cable('ont', 'pc', 'lan'),
  ];

  return { nodes: [inet, mk, htbA, htbB, ont, pc], cables };
}

// -------------------------------------------------------------------------
// 1. Router Discovery Across HTB Pair
// -------------------------------------------------------------------------
{
  const t = buildTopology();
  const ontNode = t.nodes.find((x) => x.id === 'ont');
  const pcNode = t.nodes.find((x) => x.id === 'pc');

  const router = findRouterConnectedToBridge(ontNode, t.nodes, t.cables);
  ok('findRouterConnectedToBridge finds MikroTik across HTB pair', router?.id === 'mk');

  const upstream = findUpstreamGateway(pcNode, t.nodes, t.cables);
  ok('findUpstreamGateway for PC resolves to MikroTik across bridged ONT & HTBs', upstream?.id === 'mk');
}

// -------------------------------------------------------------------------
// 2. Internet Reachability
// -------------------------------------------------------------------------
{
  const t = buildTopology();
  const pcNode = t.nodes.find((x) => x.id === 'pc');
  const ontNode = t.nodes.find((x) => x.id === 'ont');

  const pcStatus = checkInternetAccess(pcNode, t.nodes, t.cables);
  ok('PC has internet through MikroTik via HTB & ONT bridge', pcStatus.hasInternet === true);
  eq('PC gateway is MikroTik', pcStatus.gatewayNode?.id, 'mk');

  const ontStatus = checkInternetAccess(ontNode, t.nodes, t.cables);
  ok('ONT bridge itself has internet access from MikroTik LAN', ontStatus.hasInternet === true);
  eq('ONT gateway is MikroTik', ontStatus.gatewayNode?.id, 'mk');
}

// -------------------------------------------------------------------------
// 3. Diagnostics: No False Alarms (LOS / Bridge without router)
// -------------------------------------------------------------------------
{
  const t = buildTopology();
  const issues = runNetworkDiagnostics(t.nodes, t.cables, new Map());

  const losIssue = issues.find((i) => i.id.startsWith('ont-los-'));
  ok('No false alarm ONT LOS when ONT is connected via LAN bridge', !losIssue);

  const bridgeIssue = issues.find((i) => i.id.startsWith('ont-bridge-no-router-'));
  ok('No false alarm ONT bridge no router when MikroTik is present via HTB', !bridgeIssue);

  const clientBridgeIssue = issues.find((i) => i.id.startsWith('client-no-internet-bridge-'));
  ok('No false alarm client bridge issue when MikroTik is present via HTB', !clientBridgeIssue);
}

// -------------------------------------------------------------------------
// 4. Failure Scenarios (MikroTik off or Cable Broken)
// -------------------------------------------------------------------------
{
  const t = buildTopology();
  // Turn off MikroTik
  t.nodes.find((x) => x.id === 'mk').poweredOn = false;
  const pcNode = t.nodes.find((x) => x.id === 'pc');
  const s = checkInternetAccess(pcNode, t.nodes, t.cables);
  ok('PC has no internet when MikroTik is powered off', s.hasInternet === false);
}

{
  const t = buildTopology();
  // Break fiber cable between HTB A and HTB B
  t.cables.find((c) => c.type === 'drop_core').status = 'broken';
  const pcNode = t.nodes.find((x) => x.id === 'pc');
  const s = checkInternetAccess(pcNode, t.nodes, t.cables);
  ok('PC has no internet when fiber link between HTBs is severed', s.hasInternet === false);
}

// -------------------------------------------------------------------------
// 6. Bridge ONT -> HTB -> LAN ONT router (rule 2.1)
// -------------------------------------------------------------------------
{
  const inet = node('inet2', 'internet', 'ISP Gateway');
  const onlineOnt = node('ont1', 'ont', 'ONT 1 Online', {
    ontConfig: {
      wanMode: 'pppoe',
      lanIp: '192.168.1.1',
      lanSubnet: '255.255.255.0',
      dhcpServerEnabled: true,
      dhcpPoolStart: '192.168.1.2',
      dhcpPoolEnd: '192.168.1.254',
    },
    ipConfig: { mode: 'static', ip: '192.168.1.1', subnet: '255.255.255.0', gateway: '10.10.0.1' },
  });
  const bridgeOnt = node('ont3', 'ont', 'ONT 3 Bridge', {
    ontConfig: {
      wanMode: 'bridge',
      lanIp: '192.168.1.1',
      lanSubnet: '255.255.255.0',
      dhcpServerEnabled: false,
    },
    ipConfig: { mode: 'static', ip: '192.168.1.1', subnet: '255.255.255.0', gateway: '10.10.0.1' },
  });
  const htbA = node('ha', 'htb', 'HTB A', { htbRole: 'A' });
  const htbB = node('hb', 'htb', 'HTB B', { htbRole: 'B' });
  const pc = node('pc2', 'pc', 'Client Behind ONT 3', {
    ipConfig: { mode: 'dhcp', ip: '', subnet: '255.255.255.0', gateway: '', dns: '8.8.8.8' },
  });
  const cables = [
    cable('inet2', 'ont1', 'feeder'),
    cable('ont1', 'ha', 'lan'),
    cable('ha', 'hb', 'drop_core'),
    cable('hb', 'ont3', 'lan'),
    cable('ont3', 'pc2', 'lan'),
  ];
  const nodes = [inet, onlineOnt, htbA, htbB, bridgeOnt, pc];

  const found = findRouterConnectedToBridge(bridgeOnt, nodes, cables);
  ok('rule 2.1: bridge ONT menemukan ONT router online melewati HTB', found?.id === 'ont1');

  const before = checkInternetAccess(pc, nodes, cables);
  ok('rule 2.1: client di belakang bridge ONT dapat internet dari ONT online', before.hasInternet === true);
  eq('rule 2.1: gateway client adalah ONT online', before.gatewayNode?.id, 'ont1');

  const { autoAssignDhcpLeases } = await import('../src/utils/dhcpAuto.ts');
  const leased = autoAssignDhcpLeases(nodes, cables, { seed: 7 });
  const leasedPc = leased.find((x) => x.id === 'pc2');
  ok('rule 2.1: DHCP ONT online menjangkau client melewati HTB', leasedPc?.ipConfig?.ip === '192.168.1.2');
  eq('rule 2.1: DHCP memberi gateway ONT online', leasedPc?.ipConfig?.gateway, '192.168.1.1');
}

console.log(`ok — ${n} ONT bridge over HTB assertions passed`);
