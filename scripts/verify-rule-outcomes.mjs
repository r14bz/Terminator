/**
 * Test hasil normal dan hasil gabungan untuk aturan dokumen yang sebelumnya tidak punya test.
 *   npm run test:rule-outcomes
 * Nama setiap pengecekan memuat ID aturan di docs/aturan-validator-simulator.md.
 */
import assert from 'node:assert/strict';
import { validateTopology } from '../src/utils/topologyValidator.ts';
import { interVlanBlocked } from '../src/rules/mikrotik.ts';

let count = 0;
const ok = (name, cond) => { count++; assert.ok(cond, name); };
const base = (id, type, extra = {}) => ({ id, type, name: id, label: id, x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...extra });
const cab = (a, b, type = 'lan', id) => ({ id: id ?? `c-${a}-${b}-${type}`, type, fromNodeId: a, toNodeId: b, fromPortId: `${a}-p`, toPortId: `${b}-p`, status: 'active', lengthKm: 0.01, attenuationDb: 0.05 });
const has = (r, ref) => r.issues.some((i) => i.ruleRef === ref);
const bad = (r) => r.issues.filter((i) => i.severity !== 'info');
const st = (r, id) => r.resultByNode.get(id).status;

const ontCfg = (extra = {}) => ({ brand: 'Z', model: 'x', wanMode: 'pppoe', pppoeUsername: 'u', pppoePassword: 'p', lanIp: '192.168.1.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: false, ponStatus: 'O5 (Operational)', ...extra });
const mkConfig = (over = {}) => ({
  firewallNat: true, pppoeServer: false, dnsServer: true, totalQueues: 0,
  interfaces: [{ name: 'ether1', type: 'ether' }, { name: 'ether2', type: 'ether' }],
  addresses: [{ address: '192.168.1.2', mask: '255.255.255.0', interface: 'ether1' }, { address: '192.168.88.1', mask: '255.255.255.0', interface: 'ether2' }],
  dhcpServers: [{ interface: 'ether2', poolStart: '192.168.88.10', poolEnd: '192.168.88.200', gateway: '192.168.88.1' }],
  routes: [{ dst: '0.0.0.0/0', gateway: '192.168.1.1' }],
  natRules: [{ chain: 'srcnat', action: 'masquerade', outInterface: 'ether1' }],
  filterRules: [], ...over,
});
const mk = (over = {}, extra = {}) => base('mk', 'mikrotik', {
  ports: [{ id: 'mk-e1', name: 'ether1 (WAN)', medium: 'ethernet', status: 'up', connectedCableId: 'c-ont-mk' }, { id: 'mk-e2', name: 'ether2 (LAN)', medium: 'ethernet', status: 'up', connectedCableId: 'c-mk-pc' }],
  ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' }, mikrotikConfig: mkConfig(over), ...extra,
});
const pc = (id = 'pc', ip = '192.168.88.10', extra = {}) => base(id, 'pc', { ipConfig: { mode: 'dhcp', ip, subnet: '255.255.255.0', gateway: ip ? ip.replace(/\.\d+$/, '.1') : '', dns: '8.8.8.8' }, ...extra });
const ispChain = () => [base('odp', 'odp'), base('ont', 'ont', { ontConfig: ontCfg() })];
const cables = () => [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk', 'lan', 'c-ont-mk'), cab('mk', 'pc', 'lan', 'c-mk-pc')];

// ---- 1.1 optik normal, 1.4 fiber ke satu ONT putus hanya memengaruhi ONT itu ----
{
  const r = validateTopology([...ispChain(), mk(), pc()], cables());
  ok('1.1 optik normal: tanpa LOS', !has(r, '1.2') && st(r, 'pc') === 'internet_normal');
  const two = [base('odp', 'odp'), base('ontA', 'ont', { ontConfig: ontCfg() }), base('ontB', 'ont', { ontConfig: ontCfg() })];
  const broken = { ...cab('odp', 'ontB', 'drop_core'), status: 'broken' };
  const r2 = validateTopology(two, [cab('odp', 'ontA', 'drop_core'), broken]);
  ok('1.4 hanya ONT dengan fiber putus yang bermasalah', r2.resultByNode.get('ontB').status === 'not_connected' && r2.resultByNode.get('ontA').status === 'internet_normal');
}
// ---- 2.2 / 2.3 / 2.4 ONT dan DHCP ----
{
  const bridgeNoOptic = (dhcp) => base('ontA', 'ont', { ontConfig: ontCfg({ wanMode: 'bridge', dhcpServerEnabled: dhcp, ponStatus: 'LOS (No Signal)' }) });
  const online = base('ontB', 'ont', { ontConfig: ontCfg({ dhcpServerEnabled: true }) });
  const c = [cab('ontA', 'ontB'), cab('ontA', 'pc')];
  const r2 = validateTopology([bridgeNoOptic(true), online, pc('pc', '192.168.1.100')], c);
  ok('2.2 bridge tanpa optik dengan DHCP aktif: DHCP ganda dan 2.5', has(r2, '4A.9') && has(r2, '2.5'));
  ok('2.2 client tidak internet normal', st(r2, 'pc') !== 'internet_normal');
  const rogue = base('rogue', 'router', { ipConfig: { mode: 'static', ip: '192.168.1.50', subnet: '255.255.255.0', gateway: '0.0.0.0', dns: '', isDhcpServerEnabled: true } });
  const r3 = validateTopology([rogue, online, pc('pc', '192.168.1.100')], [cab('rogue', 'ontB'), cab('ontB', 'pc')]);
  ok('2.3 router kedua dengan DHCP aktif di jaringan yang sama: DHCP ganda', has(r3, '4A.9'));
  const r4 = validateTopology([base('odp', 'odp'), base('ont', 'ont', { ontConfig: ontCfg({ dhcpServerEnabled: true }) }), pc('pc', '192.168.1.100')], [cab('odp', 'ont', 'drop_core'), cab('ont', 'pc')]);
  ok('2.4 ONT mode PPPoE dengan DHCP aktif itu normal', bad(r4).length === 0 && st(r4, 'pc') === 'internet_normal');
}
// ---- 3.1 / 4.1 VLAN sama, 3.3 / 3.7 routing antar-VLAN, 3.4 trunk antar-switch, 4.2 / 4.3 ----
{
  const vl = (id, vlanId) => pc(id, '', { vlanConfig: { enabled: true, vlanId, vlanName: `v${vlanId}`, mode: 'access' } });
  const same = validateTopology([vl('a', 10), vl('b', 10)], [cab('a', 'b')]);
  ok('3.1 dua perangkat di VLAN yang sama: tanpa masalah VLAN', !has(same, '3.2') && !has(same, '3.5'));
  ok('4.1 dua port access di VLAN 10: tanpa masalah VLAN', !has(same, '3.2') && !has(same, '3.5'));
  const diff = validateTopology([vl('a', 10), vl('b', 20)], [cab('a', 'b')]);
  ok('4.2 port access VLAN 10 dan 20 tanpa router: tidak bisa berkomunikasi', has(diff, '3.2'));

  const sw = (vc) => base('sw', 'switch_managed', { vlanConfig: vc, managedSwitchConfig: { managementIp: '10.0.0.2', managementSubnet: '255.255.255.0', managementGateway: '10.0.0.1', stpMode: 'rstp', igmpSnooping: false, lacpTrunkEnabled: false, portMirroring: false, poeBudgetWatts: 0, poeUsageWatts: 0, loopProtect: true } });
  const v20mk = mk({
    interfaces: [{ name: 'ether1', type: 'ether' }, { name: 'ether2', type: 'ether' }, { name: 'vlan20', type: 'vlan', vlanId: 20, parent: 'ether2' }],
    addresses: [{ address: '192.168.1.2', mask: '255.255.255.0', interface: 'ether1' }, { address: '192.168.20.1', mask: '255.255.255.0', interface: 'vlan20' }],
    dhcpServers: [{ interface: 'vlan20', poolStart: '192.168.20.10', poolEnd: '192.168.20.200', gateway: '192.168.20.1' }],
  });
  const p20 = base('pc', 'pc', { ipConfig: { mode: 'dhcp', ip: '192.168.20.10', subnet: '255.255.255.0', gateway: '192.168.20.1', dns: '8.8.8.8' }, vlanConfig: { enabled: true, vlanId: 20, vlanName: 'v20', mode: 'access' } });
  const trunkOk = { enabled: true, vlanId: 1, vlanName: 't', mode: 'trunk', allowedVlans: [10, 20] };
  const rOk = validateTopology([...ispChain(), v20mk, sw(trunkOk), p20], [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk', 'lan', 'c-ont-mk'), cab('mk', 'sw'), cab('sw', 'pc')]);
  ok('3.3 VLAN 20 lewat trunk ke MikroTik: client internet normal', st(rOk, 'pc') === 'internet_normal');
  ok('3.4 trunk mengizinkan VLAN 20: tanpa masalah trunk', !has(rOk, '3.5'));
  ok('3.7 router dengan interface VLAN pada port trunk: routing jalan', bad(rOk).length === 0);
  const trunkNo = { ...trunkOk, allowedVlans: [10] };
  const rNo = validateTopology([...ispChain(), v20mk, sw(trunkNo), p20], [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk', 'lan', 'c-ont-mk'), cab('mk', 'sw'), cab('sw', 'pc')]);
  ok('4.3 trunk tidak mengizinkan VLAN 20: VLAN tidak sampai ke MikroTik', has(rNo, '3.5') && st(rNo, 'pc') === 'not_connected');
}
// ---- 3.6 DHCP di VLAN lain tanpa relay, 2.1 ONT bridge tanpa optik ke ONT online ----
{
  const client = base('pc', 'pc', { ipConfig: { mode: 'dhcp', ip: '', subnet: '255.255.255.0', gateway: '', dns: '' }, vlanConfig: { enabled: true, vlanId: 10, vlanName: 'v10', mode: 'access' } });
  const server = base('rt', 'router', { ipConfig: { mode: 'static', ip: '192.168.20.1', subnet: '255.255.255.0', gateway: '', dns: '', isDhcpServerEnabled: true }, vlanConfig: { enabled: true, vlanId: 20, vlanName: 'v20', mode: 'access' } });
  const r = validateTopology([client, server], [cab('rt', 'pc')]);
  ok('3.6 client VLAN 10, DHCP server VLAN 20 tanpa relay: tidak dapat IP', has(r, '3.6') && st(r, 'pc') !== 'internet_normal');
  const bridged = base('a', 'ont', { ontConfig: { brand: 'Z', model: 'x', wanMode: 'bridge', dhcpServerEnabled: false, ponStatus: 'LOS (No Signal)' } });
  const online = base('b', 'ont', { ontConfig: ontCfg({ dhcpServerEnabled: true }) });
  const c21 = validateTopology([base('odp', 'odp'), bridged, online, pc('pc', '192.168.1.100')], [cab('odp', 'b', 'drop_core'), cab('a', 'b'), cab('a', 'pc')]);
  ok('2.1 bridge tanpa optik, DHCP mati: tanpa 2.5 dan tanpa DHCP ganda', !has(c21, '2.5') && !has(c21, '4A.9'));
  ok('2.1 client dapat internet dari ONT yang online', st(c21, 'pc') === 'internet_normal');
}
// ---- 4A.4 IP bentrok, 4A.10 NAT berlapis ----
{
  const p = pc('pc', '192.168.88.1', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '' } });
  const r = validateTopology([mk(), p], [cab('mk', 'pc', 'lan', 'c-mk-pc')]);
  ok('4A.4 client memakai IP yang sama dengan gateway router: IP bentrok', has(r, 'P3'));
  const n = validateTopology([...ispChain(), mk(), pc()], cables());
  ok('4A.10 NAT berlapis (ONT router dan MikroTik): internet tetap jalan', st(n, 'pc') === 'internet_normal');
}
// ---- 2.4 / 4A.10 DHCP ONT ISP + DHCP MikroTik: beda segmen, bukan DHCP ganda ----
{
  const ontDhcp = () => base('ont', 'ont', { ontConfig: ontCfg({ dhcpServerEnabled: true }) });
  const normal = validateTopology([base('odp', 'odp'), ontDhcp(), mk(), pc()], cables());
  ok('2.4 ONT ISP DHCP aktif ke port WAN MikroTik: bukan DHCP ganda', !has(normal, '4A.9'));
  ok('4A.10 ONT ISP dan MikroTik sama-sama DHCP aktif: client internet normal', st(normal, 'pc') === 'internet_normal');
  // Tetap terdeteksi bila DHCP kedua berada di sisi LAN yang sama dengan MikroTik (lewat switch).
  const rogue = base('rogue', 'router', { ipConfig: { mode: 'static', ip: '192.168.88.50', subnet: '255.255.255.0', gateway: '0.0.0.0', dns: '', isDhcpServerEnabled: true } });
  const sw = base('sw', 'switch');
  const lanCables = [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk', 'lan', 'c-ont-mk'), { ...cab('mk', 'sw', 'lan', 'c-mk-sw'), fromPortId: 'mk-e2' }, cab('sw', 'pc'), cab('sw', 'rogue')];
  const dup = validateTopology([base('odp', 'odp'), ontDhcp(), mk(), sw, pc(), rogue], lanCables);
  ok('4A.9 DHCP kedua di sisi LAN MikroTik tetap terdeteksi', has(dup, '4A.9'));
  const single = validateTopology([base('odp', 'odp'), ontDhcp(), mk(), sw, pc()], lanCables.slice(0, 4));
  ok('4A.9 tanpa DHCP kedua di LAN: tidak ada peringatan', !has(single, '4A.9'));
}
// ---- 5.1.1 / 5.2.1 / 5.3.1 MikroTik sehat, 5.4.1 / 5.4.5 PPPoE ----
{
  const r = validateTopology([...ispChain(), mk(), pc()], cables());
  ok('5.1.1 interface punya IP dan DHCP: client dapat IP', bad(r).length === 0 && st(r, 'pc') !== 'connected_no_ip');
  ok('5.2.1 default route dan NAT benar: internet jalan', st(r, 'pc') === 'internet_normal');
  ok('5.3.1 masquerade di interface keluar: internet jalan', !has(r, '5.3.2') && !has(r, '5.3.3'));
  const pppoeMk = { pppSecrets: [{ name: 'u', password: 'p', service: 'pppoe' }], pppoeServers: [{ interface: 'ether1', serviceName: 'x' }] };
  const rtrw = (over = {}) => validateTopology(
    [base('odp', 'odp'), base('ont', 'ont', { ontConfig: ontCfg({ pppoeTarget: 'mikrotik', dhcpServerEnabled: true }) }), mk({ ...pppoeMk, ...over }), pc('pc', '192.168.1.100')],
    [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk', 'lan', 'c-ont-mk'), cab('ont', 'pc')]);
  const good = rtrw();
  ok('5.4.1 PPPoE benar: tanpa masalah PPPoE', !['5.4.2', '5.4.3', '5.4.4'].some((x) => has(good, x)));
  const noNat = rtrw({ natRules: [] });
  ok('5.4.5 PPPoE tersambung tapi NAT belum benar: ONT online, client tidak ada internet', has(noNat, '5.3.2') && st(noNat, 'pc') === 'ip_no_internet');
}
// ---- 5.2.4 / 5.6.1 / 5.6.2 firewall antar-VLAN ----
{
  const vlans = [{ name: 'ether1', type: 'ether' }, { name: 'vlan10', type: 'vlan', vlanId: 10, parent: 'ether2' }, { name: 'vlan20', type: 'vlan', vlanId: 20, parent: 'ether2' }];
  const none = { interfaces: vlans, filterRules: [] };
  const blocked = { interfaces: vlans, filterRules: [{ chain: 'forward', action: 'drop', inInterface: 'vlan10', outInterface: 'vlan20' }] };
  ok('5.2.4 tanpa firewall: VLAN 10 dan 20 tembus lewat MikroTik', interVlanBlocked(none, 10, 20) === false);
  ok('5.6.1 aturan drop VLAN 10 ke 20: terblokir', interVlanBlocked(blocked, 10, 20) === true);
  ok('5.6.2 aturan blok dihapus: tembus kembali', interVlanBlocked(none, 20, 10) === false);
}
console.log(`rule outcome tests: PASS (${count} assertions)`);
