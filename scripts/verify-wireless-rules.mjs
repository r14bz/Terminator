/**
 * Test aturan access point (4B), mesh (4C), client di port trunk (4.4), dan loop (4.5, 4B.12).
 *   npm run test:wireless-rules
 * Nama setiap pengecekan memuat ID aturan di docs/aturan-validator-simulator.md.
 * Setiap aturan diuji dua arah: kasus salah terdeteksi, topologi sehat bersih.
 */
import assert from 'node:assert/strict';
import { validateTopology } from '../src/utils/topologyValidator.ts';

let count = 0;
const ok = (name, cond) => { count++; assert.ok(cond, name); };
const base = (id, type, extra = {}) => ({ id, type, name: id, label: id, x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...extra });
const cab = (a, b, type = 'lan') => ({ id: `c-${a}-${b}-${type}`, type, fromNodeId: a, toNodeId: b, fromPortId: `${a}-p`, toPortId: `${b}-p`, status: 'active', lengthKm: 0.01, attenuationDb: 0.05 });
const has = (r, ref) => r.issues.some((i) => i.ruleRef === ref);
const bad = (r) => r.issues.filter((i) => i.severity !== 'info');
const st = (r, id) => r.resultByNode.get(id).status;

const mkConfig = () => ({
  firewallNat: true, pppoeServer: false, dnsServer: true, totalQueues: 0,
  interfaces: [{ name: 'ether1', type: 'ether' }, { name: 'ether2', type: 'ether' }],
  addresses: [{ address: '192.168.1.2', mask: '255.255.255.0', interface: 'ether1' }, { address: '192.168.88.1', mask: '255.255.255.0', interface: 'ether2' }],
  dhcpServers: [{ interface: 'ether2', poolStart: '192.168.88.10', poolEnd: '192.168.88.200', gateway: '192.168.88.1' }],
  routes: [{ dst: '0.0.0.0/0', gateway: '192.168.1.1' }],
  natRules: [{ chain: 'srcnat', action: 'masquerade', outInterface: 'ether1' }],
  filterRules: [],
});
const isp = () => [
  base('odp', 'odp'),
  base('ont', 'ont', { ontConfig: { brand: 'Z', model: 'x', wanMode: 'pppoe', pppoeUsername: 'u', pppoePassword: 'p', lanIp: '192.168.1.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: false, ponStatus: 'O5 (Operational)' } }),
];
const mikrotik = () => base('mk', 'mikrotik', {
  ports: [{ id: 'mk-p', name: 'ether', medium: 'ethernet', status: 'up' }],
  ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' }, mikrotikConfig: mkConfig(),
});
const pc = (ip = '192.168.88.10') => base('pc', 'pc', { ipConfig: { mode: 'dhcp', ip, subnet: '255.255.255.0', gateway: ip ? '192.168.88.1' : '', dns: '8.8.8.8' } });
const apNode = (extra = {}) => base('ap', 'access_point', { ipConfig: { mode: 'static', ip: '192.168.88.2', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '', isDhcpServerEnabled: false }, ...extra });
const mesh = (id, role, extra = {}) => base(id, 'mesh', { meshConfig: { role, backhaulType: 'ethernet', fastRoaming: true, ssid: 'm', bandSteering: true, rssiThresholdDbm: -70, channel24G: 1, channel5G: 36 }, ...extra });
const chain = [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk')];

// ---- 4B.1 AP bridge, DHCP AP mati, DHCP router aktif: sehat ----
{
  const nodes = [...isp(), mikrotik(), apNode(), pc()];
  const r = validateTopology(nodes, [...chain, cab('mk', 'ap'), cab('ap', 'pc', 'wireless')]);
  ok('4B.1 AP sehat: tanpa peringatan', bad(r).length === 0);
  ok('4B.1 client WiFi internet normal', st(r, 'pc') === 'internet_normal');
}
// ---- 4B.2 AP tanpa uplink, DHCP AP mati ----
{
  const r = validateTopology([apNode(), pc('')], [cab('ap', 'pc', 'wireless')]);
  ok('4B.2 tersambung tapi tidak dapat IP', st(r, 'pc') === 'connected_no_ip');
}
// ---- 4B.3 AP tanpa uplink, DHCP AP aktif ----
{
  const r = validateTopology([apNode({ ipConfig: { mode: 'static', ip: '192.168.88.2', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '', isDhcpServerEnabled: true, dhcpRangeStart: '192.168.88.50', dhcpRangeEnd: '192.168.88.80' } }), pc('192.168.88.50')], [cab('ap', 'pc', 'wireless')]);
  ok('4B.3 dapat IP dari AP, tidak ada internet', st(r, 'pc') === 'ip_no_internet');
}
// ---- 4B.4 DHCP AP aktif dan DHCP router aktif ----
{
  const dhcpAp = apNode({ ipConfig: { mode: 'static', ip: '192.168.88.2', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '', isDhcpServerEnabled: true } });
  const r = validateTopology([...isp(), mikrotik(), dhcpAp, pc()], [...chain, cab('mk', 'ap'), cab('ap', 'pc', 'wireless')]);
  ok('4B.4 DHCP ganda terdeteksi', has(r, '4A.9'));
}
// ---- 4B.9 / 4B.10 SSID bertag VLAN 20 ----
{
  const sw = (vlanConfig) => base('sw', 'switch_managed', { vlanConfig, managedSwitchConfig: { managementIp: '10.0.0.2', managementSubnet: '255.255.255.0', managementGateway: '10.0.0.1', stpMode: 'rstp', igmpSnooping: false, lacpTrunkEnabled: false, portMirroring: false, poeBudgetWatts: 0, poeUsageWatts: 0, loopProtect: true } });
  const tagged = apNode({ accessPointConfig: { ssid24: 'a', ssid5: 'a5', channel24: 1, channel5: 36, poePowered: false, vlanTagged: true, vlanId: 20, txPowerDbm: 20, guestPortalEnabled: false } });
  const run = (vc) => validateTopology([sw(vc), tagged, pc('')], [cab('sw', 'ap'), cab('ap', 'pc', 'wireless')]);
  const trunkOk = run({ enabled: true, vlanId: 1, vlanName: 't', mode: 'trunk', allowedVlans: [10, 20] });
  ok('4B.9 trunk mengizinkan VLAN 20: tidak ada 4B.10', !has(trunkOk, '4B.10'));
  const trunkNo = run({ enabled: true, vlanId: 1, vlanName: 't', mode: 'trunk', allowedVlans: [10] });
  ok('4B.10 trunk tidak mengizinkan VLAN 20 terdeteksi', has(trunkNo, '4B.10'));
  ok('4B.10 client WiFi tersambung tapi tanpa IP', st(trunkNo, 'pc') === 'connected_no_ip' && trunkNo.resultByNode.get('pc').ruleRef === '4B.10');
  const access = run({ enabled: true, vlanId: 20, vlanName: 'a', mode: 'access' });
  ok('4B.10 port access ke AP bertag terdeteksi', has(access, '4B.10'));
}
// ---- 4B.12 loop kabel antar AP tanpa STP ----
{
  const a = apNode(), b = base('ap2', 'access_point', { ipConfig: { mode: 'static', ip: '192.168.88.3', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '', isDhcpServerEnabled: false } });
  const loop = validateTopology([a, b], [cab('ap', 'ap2'), { ...cab('ap', 'ap2'), id: 'c-second' }]);
  ok('4B.12 dua kabel antar AP terdeteksi sebagai loop', has(loop, '4B.12'));
  const chainOnly = validateTopology([a, b], [cab('ap', 'ap2')]);
  ok('4B.12 satu kabel antar AP bukan loop', !has(chainOnly, '4B.12'));
  // 4.5 untuk lingkaran tiga switch (lebih dari dua perangkat), dan 4.6/4.7 bila STP aktif
  const mgd = (id, stp) => base(id, 'switch_managed', { managedSwitchConfig: { managementIp: '10.0.0.2', managementSubnet: '255.255.255.0', managementGateway: '10.0.0.1', stpMode: stp, igmpSnooping: false, lacpTrunkEnabled: false, portMirroring: false, poeBudgetWatts: 0, poeUsageWatts: 0, loopProtect: false } });
  const ring = [cab('s1', 's2'), cab('s2', 's3'), cab('s3', 's1')];
  ok('4.5 lingkaran tiga switch tanpa STP terdeteksi', has(validateTopology([mgd('s1', 'disabled'), mgd('s2', 'disabled'), mgd('s3', 'disabled')], ring), '4.5'));
  ok('4.7 lingkaran tiga switch dengan STP tidak ada loop', !validateTopology([mgd('s1', 'rstp'), mgd('s2', 'rstp'), mgd('s3', 'rstp')], ring).issues.some((i) => i.id.startsWith('l2cycle-')));
}
// ---- 4.4 client di port trunk ----
{
  const trunkPc = { ...pc(''), vlanConfig: { enabled: true, vlanId: 10, vlanName: 'v', mode: 'trunk', allowedVlans: [10, 20] } };
  const r = validateTopology([mikrotik(), trunkPc], [cab('mk', 'pc')]);
  ok('4.4 client di port trunk terdeteksi', has(r, '4.4'));
  ok('4.4 client tidak tersambung ke VLAN bertag', st(r, 'pc') === 'not_connected');
  const accessPc = { ...pc(''), vlanConfig: { enabled: true, vlanId: 10, vlanName: 'v', mode: 'access' } };
  ok('4.4 port access: tidak ada 4.4', !has(validateTopology([mikrotik(), accessPc], [cab('mk', 'pc')]), '4.4'));
}
// ---- 4C.1 mesh sehat ----
const meshWorld = (over = {}) => {
  const nodes = [...isp(), mikrotik(), mesh('root', 'root', over.root), mesh('sat', 'satellite', over.sat), pc()];
  const cables = [...chain, cab('mk', 'root'), cab('root', 'sat', 'wireless'), cab('sat', 'pc', 'wireless')];
  return validateTopology(nodes, over.cables ?? cables);
};
{
  const r = meshWorld();
  ok('4C.1 mesh sehat: tanpa peringatan', bad(r).length === 0);
  ok('4C.1 client di satelit internet normal', st(r, 'pc') === 'internet_normal');
}
// ---- 4C.2 satelit tidak terhubung ke node utama ----
{
  const r = validateTopology([...isp(), mikrotik(), mesh('root', 'root'), mesh('sat', 'satellite'), pc('')], [...chain, cab('mk', 'root'), cab('sat', 'pc', 'wireless')]);
  ok('4C.2 satelit terputus terdeteksi', has(r, '4C.2'));
  ok('4C.2 client di satelit tidak dapat IP', st(r, 'pc') === 'connected_no_ip');
}
// ---- 4C.5 node utama tanpa uplink ----
{
  const root = mesh('root', 'root', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '', dns: '', isDhcpServerEnabled: true, dhcpRangeStart: '192.168.88.10', dhcpRangeEnd: '192.168.88.50' } });
  const r = validateTopology([root, pc('192.168.88.10')], [cab('root', 'pc', 'wireless')]);
  ok('4C.5 client tersambung ke mesh tapi tidak ada internet', st(r, 'pc') === 'ip_no_internet');
}
// ---- 4C.8 DHCP hanya di node utama ----
{
  const dhcpSat = { ipConfig: { mode: 'static', ip: '192.168.88.5', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '', isDhcpServerEnabled: true } };
  const r = meshWorld({ sat: dhcpSat });
  ok('4C.8 DHCP aktif di satelit terdeteksi', has(r, '4C.8'));
  ok('4C.8 satelit tanpa DHCP: tidak ada 4C.8', !has(meshWorld(), '4C.8'));
}
console.log(`wireless rule tests: PASS (${count} assertions)`);
