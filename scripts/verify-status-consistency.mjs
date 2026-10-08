/**
 * Konsistensi status internet antara kartu kanvas (buildInternetAccessMap) dan validator,
 * serta pemilihan server DHCP terdekat dan ONT bridge dengan DHCP aktif (aturan 2.2 dan 2.5).
 *   npm run test:consistency
 * Menyapu topologi fixture, template bawaan, dan ratusan variasi (matikan perangkat, putus kabel,
 * ubah mode ONT, ubah DHCP, matikan NAT, dan seterusnya).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateTopology } from '../src/utils/topologyValidator.ts';
import { autoAssignDhcpLeases } from '../src/utils/dhcpAuto.ts';
import { buildInternetAccessMap } from '../src/utils/internetAccessMap.ts';
import { pickDhcpServer, l2Distances } from '../src/rules/common.ts';
import { TOPOLOGY_TEMPLATES } from '../src/data/templates.ts';

const dir = import.meta.dirname;
let count = 0;
const ok = (name, cond) => { count++; assert.ok(cond, name); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const CLIENT = ['pc', 'laptop', 'smartphone', 'cctv', 'iot', 'printer', 'voip_phone'];
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'fixtures', f), 'utf8'));
const evaluate = (t) => { const nodes = autoAssignDhcpLeases(t.nodes, t.cables); return { nodes, v: validateTopology(nodes, t.cables), map: buildInternetAccessMap(nodes, t.cables) }; };

// ---- 2.2 / 2.5 pada topologi nyata: ONT 3 bridge di belakang HTB ----
{
  const fx = fixture('topologi-rtrw-bridge-htb.json');
  const setDhcp = (on) => { const t = clone(fx); const o = t.nodes.find((n) => n.name === 'ONT / ONU 3'); o.ontConfig.dhcpServerEnabled = on; o.ipConfig = { ...o.ipConfig, isDhcpServerEnabled: on }; return t; };
  const behind = ['Komputer / PC Workstation 3', 'Smartphone / Tablet 3'];
  const on = evaluate(setDhcp(true)), off = evaluate(setDhcp(false));
  for (const name of behind) {
    const a = on.nodes.find((n) => n.name === name), b = off.nodes.find((n) => n.name === name);
    ok(`2.5 DHCP ONT 3 aktif: ${name} tidak ada internet`, on.v.resultByNode.get(a.id).status === 'ip_no_internet' && on.v.resultByNode.get(a.id).ruleRef === '2.5');
    ok(`2.5 DHCP ONT 3 aktif: kartu ${name} Putus`, on.map.get(a.id).hasInternet === false);
    ok(`2.2 DHCP ONT 3 mati: ${name} internet normal`, off.v.resultByNode.get(b.id).status === 'internet_normal' && off.map.get(b.id).hasInternet === true);
  }
  // Client di LAN ONT lain tidak terpengaruh: server DHCP terdekat mereka adalah ONT-nya sendiri.
  const others = on.nodes.filter((n) => CLIENT.includes(n.type) && !behind.includes(n.name));
  ok('2.8 client di LAN ONT 1 dan ONT 2 tetap internet normal (server terdekat menang)', others.length === 8 && others.every((n) => on.v.resultByNode.get(n.id).status === 'internet_normal'));
  ok('2.5 masalah dilaporkan sebagai issue critical pada ONT 3', on.v.issues.some((i) => i.ruleRef === '2.5' && i.severity === 'critical'));
  ok('2.2 DHCP ONT 3 mati: tanpa peringatan', off.v.issues.filter((i) => i.severity !== 'info').length === 0);
}

// ---- pickDhcpServer: server terdekat menang, seri dipilih deterministik ----
{
  const base = (id, type, extra = {}) => ({ id, type, name: id, label: id, x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...extra });
  const cab = (a, b) => ({ id: `c-${a}-${b}`, type: 'lan', fromNodeId: a, toNodeId: b, fromPortId: `${a}-p`, toPortId: `${b}-p`, status: 'active', lengthKm: 0.01, attenuationDb: 0 });
  const nodes = [base('pc', 'pc'), base('near', 'ont'), base('sw', 'switch'), base('far', 'ont'), base('twin', 'ont')];
  const cables = [cab('pc', 'near'), cab('pc', 'sw'), cab('sw', 'far'), cab('sw', 'twin')];
  const dist = l2Distances('pc', nodes, cables);
  ok('4A.9 jarak L2: server langsung 1 lompatan, lewat switch 2 lompatan', dist.get('near') === 1 && dist.get('far') === 2);
  const pc = nodes[0];
  ok('4A.9 server terdekat dipilih walau ada server lain di domain yang sama', pickDhcpServer(pc, [nodes[3], nodes[1]], nodes, cables, (len) => len - 1)?.id === 'near');
  const tie = pickDhcpServer(pc, [nodes[3], nodes[4]], nodes, cables, (len) => len - 1);
  ok('4A.9 jarak seri: dipilih lewat fungsi acak yang diberikan', tie?.id === 'twin');
  ok('4A.9 tanpa kandidat: tidak ada server', pickDhcpServer(pc, [], nodes, cables, () => 0) === undefined);
}

// ---- Konsistensi kartu kanvas vs validator pada ratusan variasi topologi ----
{
  const bases = [
    ['topologi-rtrw-ont-trunk', fixture('topologi-rtrw-ont-trunk.json')],
    ['topologi-rtrw-bridge-htb', fixture('topologi-rtrw-bridge-htb.json')],
    ...TOPOLOGY_TEMPLATES.map((t) => [t.name, { nodes: t.nodes, cables: t.cables }]),
  ];
  let checked = 0; const mismatches = [];
  for (const [bname, base] of bases) {
    const variants = [['asli', () => {}]];
    for (const n of base.nodes) {
      if (['ont', 'mikrotik', 'router', 'switch', 'switch_managed', 'htb', 'olt', 'odp', 'odc', 'access_point', 'mesh'].includes(n.type)) variants.push([`matikan ${n.name}`, (t) => { t.nodes.find((x) => x.id === n.id).poweredOn = false; }]);
      if (n.type === 'ont') {
        variants.push([`toggle DHCP ${n.name}`, (t) => { const o = t.nodes.find((x) => x.id === n.id); const v = !o.ontConfig?.dhcpServerEnabled; o.ontConfig = { ...o.ontConfig, dhcpServerEnabled: v }; o.ipConfig = { ...(o.ipConfig || {}), isDhcpServerEnabled: v }; }]);
        variants.push([`${n.name} bridge`, (t) => { const o = t.nodes.find((x) => x.id === n.id); o.ontConfig = { ...o.ontConfig, wanMode: 'bridge' }; }]);
        variants.push([`${n.name} bridge + DHCP`, (t) => { const o = t.nodes.find((x) => x.id === n.id); o.ontConfig = { ...o.ontConfig, wanMode: 'bridge', dhcpServerEnabled: true }; o.ipConfig = { ...(o.ipConfig || {}), isDhcpServerEnabled: true }; }]);
        variants.push([`${n.name} LOS`, (t) => { const o = t.nodes.find((x) => x.id === n.id); o.ontConfig = { ...o.ontConfig, ponStatus: 'LOS (No Signal)' }; }]);
      }
      if (n.type === 'mikrotik') {
        variants.push([`NAT off ${n.name}`, (t) => { const o = t.nodes.find((x) => x.id === n.id); o.mikrotikConfig = { ...o.mikrotikConfig, firewallNat: false, natRules: [] }; }]);
        variants.push([`DHCP off ${n.name}`, (t) => { const o = t.nodes.find((x) => x.id === n.id); o.ipConfig = { ...(o.ipConfig || {}), isDhcpServerEnabled: false }; if (o.mikrotikConfig?.dhcpServers) o.mikrotikConfig = { ...o.mikrotikConfig, dhcpServers: [] }; }]);
      }
    }
    for (const c of base.cables) variants.push([`putus ${c.id}`, (t) => { t.cables.find((x) => x.id === c.id).status = 'broken'; }]);
    for (const [mname, fn] of variants) {
      const t = clone(base); fn(t);
      const { nodes, v, map } = evaluate(t);
      for (const n of nodes.filter((x) => CLIENT.includes(x.type))) {
        checked++;
        const normal = v.resultByNode.get(n.id)?.status === 'internet_normal';
        if (map.get(n.id).hasInternet !== normal) mismatches.push(`${bname} | ${mname} | ${n.name}`);
      }
    }
  }
  ok(`konsistensi: kartu kanvas sama dengan validator pada ${checked} pengecekan client (selisih: ${mismatches.slice(0, 3).join('; ') || 'tidak ada'})`, mismatches.length === 0 && checked > 800);
}

// ---- Panel dan komponen UI tidak boleh memakai pemeriksaan internet lama secara langsung ----
{
  const comps = path.join(dir, '../src/components');
  const offenders = fs.readdirSync(comps).filter((f) => f.endsWith('.tsx')).filter((f) => /checkInternetAccess\s*\(/.test(fs.readFileSync(path.join(comps, f), 'utf8')));
  ok(`konsistensi: komponen UI tidak memanggil checkInternetAccess langsung (${offenders.join(', ') || 'bersih'})`, offenders.length === 0);
  const insp = fs.readFileSync(path.join(comps, 'NodeInspector.tsx'), 'utf8');
  ok('konsistensi: NodeInspector memakai buildInternetAccessMap', /buildInternetAccessMap\(/.test(insp));
}
console.log(`status consistency tests: PASS (${count} assertions)`);
