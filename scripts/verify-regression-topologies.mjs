/**
 * Test regresi dari topologi nyata yang dilaporkan pengguna (scripts/fixtures).
 *   npm run test:regression
 * Topologi: ONT 1 (PPPoE, VLAN 10 trunk, DHCP aktif) dengan client LAN dan WiFi, serta
 * ONT 3 (bridge, DHCP mati) yang tersambung ke ONT 1 lewat dua HTB converter.
 * Nama pengecekan memuat ID aturan di docs/aturan-validator-simulator.md.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateTopology } from '../src/utils/topologyValidator.ts';
import { autoAssignDhcpLeases } from '../src/utils/dhcpAuto.ts';

let count = 0;
const ok = (name, cond) => { count++; assert.ok(cond, name); };
const fx = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/topologi-rtrw-ont-trunk.json'), 'utf8'));
const run = (nodes, cables) => { const assigned = autoAssignDhcpLeases(nodes, cables); return { assigned, r: validateTopology(assigned, cables) }; };
const byName = (assigned, r, name) => { const n = assigned.find((x) => x.name === name); return { n, x: r.resultByNode.get(n.id) }; };

const { assigned, r } = run(fx.nodes, fx.cables);
const clients = assigned.filter((n) => ['pc', 'laptop', 'smartphone', 'cctv'].includes(n.type));
ok('fixture berisi 9 client', clients.length === 9);

// 2.6: VLAN pada ONT tidak memutus client LAN tanpa tag dari DHCP ONT.
for (const name of ['Komputer / PC Workstation 2', 'CCTV IP Camera 1']) {
  const { n, x } = byName(assigned, r, name);
  ok(`2.6 ${name} (kabel LAN ke ONT 1) dapat lease`, !!n.ipConfig.ip && n.ipConfig.ip.startsWith('192.168.1.'));
  ok(`2.6 ${name} internet normal`, x.status === 'internet_normal');
}
// 2.1: client di belakang ONT bridge (lewat dua HTB) dapat IP dan internet dari ONT 1.
{
  const { n, x } = byName(assigned, r, 'Komputer / PC Workstation 3');
  ok('2.1 client di belakang ONT bridge + HTB dapat lease dari ONT 1', !!n.ipConfig.ip && n.ipConfig.ip.startsWith('192.168.1.'));
  ok('2.1 client di belakang ONT bridge + HTB internet normal', x.status === 'internet_normal');
}
// 2.7: ONT bridge dengan IP bawaan yang sama (192.168.1.1) bukan IP bentrok.
ok('2.7 ONT bridge tidak memicu IP bentrok', !r.issues.some((i) => i.ruleRef === 'P3'));
ok('topologi sehat: tanpa peringatan atau error', r.issues.filter((i) => i.severity !== 'info').length === 0);
ok('semua client internet normal', clients.every((c) => r.resultByNode.get(c.id).status === 'internet_normal'));
// Tidak ada dua client dengan IP sama dalam satu LAN ONT yang sama.
{
  const lan1 = ['Komputer / PC Workstation 2', 'CCTV IP Camera 1', 'Komputer / PC Workstation 3', 'Smartphone / Tablet 2', 'Laptop Portable 1'];
  const ips = lan1.map((nm) => byName(assigned, r, nm).n.ipConfig.ip);
  ok('P3 client di LAN ONT 1 mendapat IP unik', new Set(ips).size === ips.length);
}
// 2.5/2.2 tetap menangkap kesalahan nyata: DHCP ONT bridge dinyalakan.
{
  const nodes = JSON.parse(JSON.stringify(fx.nodes));
  const ont3 = nodes.find((n) => n.name === 'ONT / ONU 3');
  ont3.ontConfig.dhcpServerEnabled = true; ont3.ipConfig.isDhcpServerEnabled = true;
  const bad = run(nodes, fx.cables).r;
  ok('2.5 DHCP ONT bridge dinyalakan tetap terdeteksi', bad.issues.some((i) => i.ruleRef === '2.5'));
}
// 3.x tetap berlaku: VLAN pada switch/PC biasa masih memisahkan domain.
{
  const nodes = JSON.parse(JSON.stringify(fx.nodes));
  const pc = nodes.find((n) => n.name === 'Komputer / PC Workstation 2');
  pc.vlanConfig = { enabled: true, vlanId: 99, vlanName: 'x', mode: 'access' };
  // PC ber-VLAN 99 (access) ke ONT ber-VLAN 10 trunk yang tidak mengizinkan 99: terpisah.
  const res = run(nodes, fx.cables);
  ok('3.5 client VLAN 99 ke ONT trunk yang tidak mengizinkan VLAN 99: tidak dapat internet normal', res.r.resultByNode.get(pc.id).status !== 'internet_normal');
}
console.log(`regression topology tests: PASS (${count} assertions)`);
