/**
 * Test jalur uplink router dan MikroTik (aturan 4A.11 sampai 4A.13 di docs/aturan-validator-simulator.md).
 *   npm run test:uplink-rules
 * Router atau MikroTik hanya dianggap punya internet bila ada jalur ke sumber internet:
 * node Internet, Sumber Internet, ONT ISP yang aktif, atau router lain yang punya jalur sendiri.
 */
import assert from 'node:assert/strict';
import { validateTopology } from '../src/utils/topologyValidator.ts';
import { autoAssignDhcpLeases } from '../src/utils/dhcpAuto.ts';
import { buildInternetAccessMap } from '../src/utils/internetAccessMap.ts';
import { INTERNET_SOURCE_IP_CONFIG as SRC } from '../src/data/internetSource.ts';

let count = 0;
const ok = (name, cond) => { count++; assert.ok(cond, name); };
const base = (id, type, extra = {}) => ({ id, type, name: id, label: id, x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...extra });
const cab = (a, b, type = 'lan', status = 'active') => ({ id: `c-${a}-${b}`, type, fromNodeId: a, toNodeId: b, fromPortId: `${a}-p`, toPortId: `${b}-p`, status, lengthKm: 0.01, attenuationDb: 0.05 });
const pc = (id = 'pc') => base(id, 'pc', { ipConfig: { mode: 'dhcp', ip: '', subnet: '255.255.255.0', gateway: '', dns: '8.8.8.8' } });
const lan = (third, id) => ({ mode: 'static', ip: `192.168.${third}.1`, subnet: '255.255.255.0', gateway: '', dns: '8.8.8.8', isDhcpServerEnabled: true, dhcpRangeStart: `192.168.${third}.10`, dhcpRangeEnd: `192.168.${third}.200` });
const mk = (id = 'mk', third = 88) => base(id, 'mikrotik', { ipConfig: lan(third), mikrotikConfig: { firewallNat: true, pppoeServer: false, dnsServer: true, totalQueues: 5 } });
const rt = (id = 'rt', third = 77) => base(id, 'router', { ipConfig: lan(third) });
const source = (id = 'src', extra = {}) => base(id, 'internet_source', { ipConfig: { ...SRC }, ...extra });
const ontCfg = (e = {}) => ({ brand: 'Z', model: 'x', wanMode: 'pppoe', pppoeUsername: 'u', pppoePassword: 'p', lanIp: '192.168.1.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: true, ponStatus: 'O5 (Operational)', ...e });
const ispOnt = (id = 'ont', e = {}) => base(id, 'ont', { ontConfig: ontCfg(e) });
const run = (nodes, cables) => { const a = autoAssignDhcpLeases(nodes, cables); return { a, r: validateTopology(a, cables), m: buildInternetAccessMap(a, cables) }; };
const st = (res, id) => res.r.resultByNode.get(id).status;
const ref = (res, id) => res.r.resultByNode.get(id).ruleRef;
const uplinkIssues = (res) => res.r.issues.filter((i) => i.ruleRef === '4A.11');
const bad = (res) => res.r.issues.filter((i) => i.severity !== 'info');

// ---- 4A.11 MikroTik atau router tanpa jalur ke sumber internet ----
{
  const a = run([mk(), pc()], [cab('mk', 'pc')]);
  ok('4A.11 MikroTik tanpa uplink: client tidak ada internet', st(a, 'pc') === 'ip_no_internet' && ref(a, 'pc') === '4A.11');
  ok('4A.11 MikroTik tanpa uplink: kartu client Putus', a.m.get('pc').hasInternet === false);
  ok('4A.11 MikroTik tanpa uplink: kartu MikroTik sendiri Putus', a.m.get('mk').hasInternet === false);
  ok('4A.11 MikroTik tanpa uplink: peringatan pada MikroTik', uplinkIssues(a).some((i) => i.targetNodeId === 'mk' && i.severity === 'warning'));
  const b = run([rt(), pc()], [cab('rt', 'pc')]);
  ok('4A.11 router umum tanpa uplink: client tidak ada internet', st(b, 'pc') === 'ip_no_internet' && ref(b, 'pc') === '4A.11');
  const alone = run([mk()], []);
  ok('4A.11 MikroTik yang belum disambung ke apa pun: tidak ada peringatan uplink', uplinkIssues(alone).length === 0);
  const los = run([base('odp', 'odp'), ispOnt('ont', { ponStatus: 'LOS (No Signal)' }), mk(), pc()], [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk'), cab('mk', 'pc')]);
  ok('4A.11 ONT ISP LOS di hulu MikroTik: tidak ada internet', st(los, 'pc') === 'ip_no_internet' && los.m.get('pc').hasInternet === false);
  ok('1.3 alasan LOS yang lebih spesifik tetap menang', ref(los, 'pc') === '1.3');
}
// ---- 4A.12 jalur yang sah ----
{
  const viaOnt = run([base('odp', 'odp'), ispOnt(), mk(), pc()], [cab('odp', 'ont', 'drop_core'), cab('ont', 'mk'), cab('mk', 'pc')]);
  ok('4A.12 MikroTik di belakang ONT ISP yang aktif: internet normal', st(viaOnt, 'pc') === 'internet_normal');
  ok('4A.12 MikroTik di belakang ONT ISP: tanpa peringatan uplink', uplinkIssues(viaOnt).length === 0);
  const viaSrc = run([source(), mk(), pc()], [cab('src', 'mk'), cab('mk', 'pc')]);
  ok('4A.12 MikroTik di belakang Sumber Internet: internet normal', st(viaSrc, 'pc') === 'internet_normal' && viaSrc.m.get('mk').hasInternet === true);
  const viaNet = run([base('net', 'internet'), mk(), pc()], [cab('net', 'mk'), cab('mk', 'pc')]);
  ok('4A.12 MikroTik di belakang node Internet: internet normal', st(viaNet, 'pc') === 'internet_normal');
  const viaSw = run([source(), base('sw', 'switch'), mk(), pc()], [cab('src', 'sw'), cab('sw', 'mk'), cab('mk', 'pc')]);
  ok('4A.12 uplink lewat switch ke Sumber Internet: internet normal', st(viaSw, 'pc') === 'internet_normal');
  const rtSrc = run([source(), rt(), pc()], [cab('src', 'rt'), cab('rt', 'pc')]);
  ok('4A.12 router umum di belakang Sumber Internet: internet normal', st(rtSrc, 'pc') === 'internet_normal' && uplinkIssues(rtSrc).length === 0);
  const bridged = run([source(), base('ont', 'ont', { ontConfig: ontCfg({ wanMode: 'bridge', dhcpServerEnabled: false, ponStatus: 'LOS (No Signal)' }) }), mk(), pc()], [cab('src', 'ont'), cab('ont', 'mk'), cab('mk', 'pc')]);
  ok('4A.12 uplink lewat ONT bridge ke Sumber Internet: internet normal', st(bridged, 'pc') === 'internet_normal');
}
// ---- 4A.13 yang tidak dihitung sebagai sumber ----
{
  const downstream = base('rtrw', 'ont', { ontConfig: ontCfg({ pppoeTarget: 'mikrotik', dhcpServerEnabled: false }) });
  const a = run([base('odp', 'odp'), downstream, mk(), pc()], [cab('odp', 'rtrw', 'drop_core'), cab('rtrw', 'mk'), cab('mk', 'pc')]);
  ok('4A.13 ONT pelanggan RT/RW (dial PPPoE ke MikroTik) bukan sumber internet bagi MikroTik', st(a, 'pc') === 'ip_no_internet' && ref(a, 'pc') === '4A.11');
  const off = run([source('src', { poweredOn: false }), mk(), pc()], [cab('src', 'mk'), cab('mk', 'pc')]);
  ok('4A.13 Sumber Internet mati: MikroTik di belakangnya tidak punya jalur', st(off, 'pc') !== 'internet_normal' && off.m.get('mk').hasInternet === false);
  const broken = run([source(), mk(), pc()], [cab('src', 'mk', 'lan', 'broken'), cab('mk', 'pc')]);
  ok('4A.13 kabel ke Sumber Internet putus: tidak ada jalur', st(broken, 'pc') !== 'internet_normal');
}
// ---- 4A.13 MikroTik bertingkat dan putaran ----
{
  const chain = [cab('src', 'mkA'), cab('mkA', 'mkB'), cab('mkB', 'pc')];
  const a = run([source(), mk('mkA', 88), mk('mkB', 99), pc()], chain);
  ok('4A.13 MikroTik B di belakang MikroTik A yang punya Sumber Internet: internet normal', st(a, 'pc') === 'internet_normal' && a.m.get('mkB').hasInternet === true);
  const cut = run([mk('mkA', 88), mk('mkB', 99), pc()], chain.slice(1));
  ok('4A.13 tanpa sumber, dua MikroTik saling tersambung tidak saling menjadi sumber (tidak menggantung)', st(cut, 'pc') === 'ip_no_internet' && cut.m.get('mkA').hasInternet === false && cut.m.get('mkB').hasInternet === false);
  ok('4A.13 topologi bertingkat yang sehat tanpa peringatan', bad(a).filter((i) => i.ruleRef === '4A.11').length === 0);
}
console.log(`uplink rule tests: PASS (${count} assertions)`);
