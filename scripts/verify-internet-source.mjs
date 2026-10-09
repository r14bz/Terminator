/**
 * Test node "Sumber Internet" (aturan 8.x di docs/aturan-validator-simulator.md).
 *   npm run test:internet-source
 * Node ini sudah punya IP gateway LAN dan DHCP server aktif, dan selalu punya internet
 * selama menyala, sehingga topologi tidak perlu dimulai dari Metro, OLT, ODP, dan ONT.
 */
import assert from 'node:assert/strict';
import { validateTopology } from '../src/utils/topologyValidator.ts';
import { autoAssignDhcpLeases } from '../src/utils/dhcpAuto.ts';
import { buildInternetAccessMap } from '../src/utils/internetAccessMap.ts';
import { findNodeByAddress } from '../src/utils/ipUtils.ts';
import { DEVICE_METADATA } from '../src/data/deviceDefinitions.ts';
import { INTERNET_SOURCE_IP_CONFIG as DEF } from '../src/data/internetSource.ts';

let count = 0;
const ok = (name, cond) => { count++; assert.ok(cond, name); };
const base = (id, type, extra = {}) => ({ id, type, name: id, label: id, x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...extra });
const cab = (a, b, type = 'lan') => ({ id: `c-${a}-${b}`, type, fromNodeId: a, toNodeId: b, fromPortId: `${a}-p`, toPortId: `${b}-p`, status: 'active', lengthKm: 0.01, attenuationDb: 0 });
// Konfigurasi bawaan yang sama dengan saat node ditambahkan dari palet (src/data/internetSource.ts).
const source = (id = 'src', extra = {}) => base(id, 'internet_source', { ipConfig: { ...DEF }, ...extra });
const pc = (id = 'pc', extra = {}) => base(id, 'pc', { ipConfig: { mode: 'dhcp', ip: '', subnet: '255.255.255.0', gateway: '', dns: '8.8.8.8' }, ...extra });
const mikrotik = (extra = {}) => base('mk', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8', isDhcpServerEnabled: true, dhcpRangeStart: '192.168.88.10', dhcpRangeEnd: '192.168.88.200' }, mikrotikConfig: { firewallNat: true, pppoeServer: false, dnsServer: true, totalQueues: 5 }, ...extra });
const run = (nodes, cables) => { const a = autoAssignDhcpLeases(nodes, cables); return { a, r: validateTopology(a, cables), m: buildInternetAccessMap(a, cables) }; };
const st = (res, id) => res.r.resultByNode.get(id).status;
const has = (res, ref) => res.r.issues.some((i) => i.ruleRef === ref);
const bad = (res) => res.r.issues.filter((i) => i.severity !== 'info');

// ---- 8.0 terdaftar di palet perangkat ----
{
  const d = DEVICE_METADATA.internet_source;
  ok('8.0 Sumber Internet terdaftar di palet kategori Infrastruktur', !!d && d.category === 'infrastructure' && d.name === 'Sumber Internet');
  ok('8.0 punya port LAN ethernet', d.defaultPorts.length >= 2 && d.defaultPorts.every((p) => p.medium === 'ethernet'));
  ok('8.0 bawaan: IP gateway terisi, DHCP aktif, pool dan DNS terisi', DEF.mode === 'static' && !!DEF.ip && DEF.isDhcpServerEnabled === true && !!DEF.dhcpRangeStart && !!DEF.dhcpRangeEnd && !!DEF.dns);
}
// ---- 8.1 langsung ke client: dapat IP dari DHCP dan internet normal ----
{
  const res = run([source(), pc()], [cab('src', 'pc')]);
  const ip = res.a.find((n) => n.id === 'pc').ipConfig.ip;
  ok('8.1 client langsung ke Sumber Internet dapat IP dari pool DHCP-nya', ip.startsWith('192.168.1.') && ip !== '192.168.1.1');
  ok('8.1 client internet normal', st(res, 'pc') === 'internet_normal');
  ok('8.1 kartu client Online', res.m.get('pc').hasInternet === true);
  ok('8.1 topologi sehat tanpa peringatan', bad(res).length === 0);
  ok('8.1 Sumber Internet sendiri Online', res.m.get('src').hasInternet === true);
}
// ---- 8.2 lewat switch: banyak client, IP unik ----
{
  const res = run([source(), base('sw', 'switch'), pc('a'), pc('b')], [cab('src', 'sw'), cab('sw', 'a'), cab('sw', 'b')]);
  const ips = ['a', 'b'].map((id) => res.a.find((n) => n.id === id).ipConfig.ip);
  ok('8.2 dua client lewat switch sama-sama internet normal', st(res, 'a') === 'internet_normal' && st(res, 'b') === 'internet_normal');
  ok('8.2 IP kedua client unik', ips[0] !== ips[1] && ips.every(Boolean));
  ok('8.2 tanpa peringatan', bad(res).length === 0);
}
// ---- 8.3 ke port WAN MikroTik: client di belakang MikroTik dapat internet ----
{
  const res = run([source(), mikrotik(), pc()], [cab('src', 'mk'), cab('mk', 'pc')]);
  ok('8.3 client di belakang MikroTik yang tersambung ke Sumber Internet: internet normal', st(res, 'pc') === 'internet_normal');
  const noNat = run([source(), mikrotik({ mikrotikConfig: { firewallNat: false, pppoeServer: false, dnsServer: true, totalQueues: 5 } }), pc()], [cab('src', 'mk'), cab('mk', 'pc')]);
  ok('8.3 NAT MikroTik mati: client tidak ada internet (5.3.2)', st(noNat, 'pc') === 'ip_no_internet' && has(noNat, '5.3.2'));
}
// ---- 8.4 dimatikan ----
{
  const res = run([source('src', { poweredOn: false }), pc()], [cab('src', 'pc')]);
  ok('8.4 Sumber Internet mati: client tidak internet normal', st(res, 'pc') !== 'internet_normal');
  ok('8.4 Sumber Internet mati: kartu client Putus', res.m.get('pc').hasInternet === false);
  ok('8.4 Sumber Internet mati: kartu sumber Putus', res.m.get('src').hasInternet === false);
}
// ---- 8.5 DHCP dimatikan ----
{
  const off = source('src', { ipConfig: { ...DEF, isDhcpServerEnabled: false } });
  const res = run([off, pc()], [cab('src', 'pc')]);
  ok('8.5 DHCP Sumber Internet mati: client DHCP tidak dapat IP', st(res, 'pc') === 'connected_no_ip' && res.m.get('pc').hasInternet === false);
}
// ---- 8.6 client IP statis ----
{
  const staticPc = (gw) => pc('pc', { ipConfig: { mode: 'static', ip: '192.168.1.50', subnet: '255.255.255.0', gateway: gw, dns: '8.8.8.8' } });
  ok('8.6 IP statis dengan gateway benar: internet normal', st(run([source(), staticPc('192.168.1.1')], [cab('src', 'pc')]), 'pc') === 'internet_normal');
  const wrong = run([source(), staticPc('192.168.1.99')], [cab('src', 'pc')]);
  ok('8.6 IP statis dengan gateway salah: tidak ada internet', st(wrong, 'pc') !== 'internet_normal' && wrong.m.get('pc').hasInternet === false);
}
// ---- 8.7 ONT bridge di belakang Sumber Internet (perluasan aturan 2.1) ----
{
  const ont = base('ont', 'ont', { ontConfig: { brand: 'Z', model: 'x', wanMode: 'bridge', dhcpServerEnabled: false, ponStatus: 'LOS (No Signal)' }, ipConfig: { mode: 'static', ip: '192.168.1.1', subnet: '255.255.255.0', gateway: '', dns: '8.8.8.8', isDhcpServerEnabled: false } });
  const res = run([source(), ont, pc()], [cab('src', 'ont'), cab('ont', 'pc')]);
  ok('8.7 client di belakang ONT bridge yang tersambung ke Sumber Internet: internet normal', st(res, 'pc') === 'internet_normal');
  ok('8.7 ONT bridge dengan IP bawaan sama bukan IP bentrok (2.7)', !has(res, 'P3'));
}
// ---- 8.8 dua Sumber Internet dengan DHCP aktif di jaringan yang sama ----
{
  const res = run([source('s1'), source('s2'), base('sw', 'switch'), pc()], [cab('s1', 'sw'), cab('s2', 'sw'), cab('sw', 'pc')]);
  ok('8.8 dua DHCP aktif di jaringan yang sama: DHCP ganda terdeteksi (4A.9)', has(res, '4A.9'));
  ok('8.8 client tetap mendapat IP dan internet dari salah satunya', st(res, 'pc') === 'internet_normal');
}
// ---- 8.9 ping ke luar ----
{
  const nodes = [source(), pc()];
  ok('8.9 ping 8.8.8.8 menuju Sumber Internet bila tidak ada node Internet', findNodeByAddress(nodes, '8.8.8.8')?.id === 'src');
  ok('8.9 ping ke IP gateway Sumber Internet menuju dirinya', findNodeByAddress(nodes, DEF.ip)?.id === 'src');
}
console.log(`internet source tests: PASS (${count} assertions)`);
