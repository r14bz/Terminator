/**
 * Test aturan MikroTik (5.x), alasan per hasil, dan "tidak terdefinisi".
 *   tsx scripts/verify-mikrotik-rules.mjs
 * Setiap aturan diuji dua arah: kasus salah harus terdeteksi dan topologi sehat
 * harus bersih (aturan 7: jangan menandai hal normal sebagai masalah).
 */
import assert from 'node:assert/strict';
import { validateTopology } from '../src/utils/topologyValidator.ts';
import { TOPOLOGY_TEMPLATES } from '../src/data/templates.ts';

let n = 0;
const ok = (m, c) => { n++; assert.ok(c, m); };

const base = (id, type, extra = {}) => ({ id, type, name: id, label: id, x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...extra });
const cable = (a, b, type = 'lan', extra = {}) => ({ id: `c-${a}-${b}`, type, fromNodeId: a, toNodeId: b, fromPortId: `${a}-p`, toPortId: a === 'ont' && b === 'mk' ? 'mk-e1' : b === 'pc' && a === 'mk' ? 'mk-e2' : `${b}-p`, status: 'active', lengthKm: 0.01, attenuationDb: 0.05, ...extra });

const mkConfig = (over = {}) => ({
  firewallNat: true, pppoeServer: false, dnsServer: true, totalQueues: 5,
  interfaces: [{ name: 'ether1', type: 'ether' }, { name: 'ether2', type: 'ether' }],
  addresses: [{ address: '192.168.1.2', mask: '255.255.255.0', interface: 'ether1' }, { address: '192.168.88.1', mask: '255.255.255.0', interface: 'ether2' }],
  dhcpServers: [{ interface: 'ether2', poolStart: '192.168.88.10', poolEnd: '192.168.88.200', gateway: '192.168.88.1' }],
  routes: [{ dst: '0.0.0.0/0', gateway: '192.168.1.1' }],
  natRules: [{ chain: 'srcnat', action: 'masquerade', outInterface: 'ether1' }],
  filterRules: [],
  ...over,
});

/** ISP ONT (fiber ke ODP) -> MikroTik -> PC (DHCP). */
function world({ mk = {}, ont = {}, pc = {}, mikrotik = {}, extraNodes = [], extraCables = [] } = {}) {
  const nodes = [
    base('odp', 'odp'),
    base('ont', 'ont', { ontConfig: { brand: 'Z', model: 'x', wanMode: 'pppoe', pppoeUsername: 'u', pppoePassword: 'p', lanIp: '192.168.1.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: false, ponStatus: 'O5 (Operational)', ...ont } }),
    base('mk', 'mikrotik', {
      ports: [{ id: 'mk-e1', name: 'ether1 (WAN)', medium: 'ethernet', status: 'up', connectedCableId: 'c-ont-mk' }, { id: 'mk-e2', name: 'ether2 (LAN)', medium: 'ethernet', status: 'up', connectedCableId: 'c-mk-pc' }],
      ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' }, mikrotikConfig: mkConfig(mk), ...mikrotik }),
    base('pc', 'pc', { ipConfig: { mode: 'dhcp', ip: '192.168.88.10', subnet: '255.255.255.0', gateway: '192.168.88.1', dns: '8.8.8.8' }, ...pc }),
    ...extraNodes,
  ];
  const cables = [cable('odp', 'ont', 'drop_core'), cable('ont', 'mk'), cable('mk', 'pc'), ...extraCables];
  return { nodes, cables, r: validateTopology(nodes, cables) };
}
const has = (r, ref) => r.issues.some((i) => i.ruleRef === ref);
const idHas = (r, prefix) => r.issues.some((i) => i.id.startsWith(prefix));

// ---- Kontrol: topologi sehat bersih, client internet normal ------------------------
{
  const { r } = world();
  if (process.env.DBG) console.log(r.issues.map((i) => i.id + ' | ' + i.title));
  ok('sehat: tanpa issue peringatan/kritis', r.issues.filter((i) => i.severity !== 'info').length === 0);
  ok('sehat: PC internet normal', r.resultByNode.get('pc').status === 'internet_normal');
  ok('sehat: alasan selalu terisi', [...r.resultByNode.values()].every((x) => x.reason.length > 0));
  ok('sehat: tidak ada "tidak terdefinisi" untuk MikroTik terstruktur', !r.undefinedRules.some((u) => u.includes('MikroTik')));
}

// ---- 5.1.2 DHCP server tanpa IP pada interface -------------------------------------
{
  const { r } = world({ mk: { addresses: [{ address: '192.168.1.2', mask: '255.255.255.0', interface: 'ether1' }] } });
  ok('5.1.2 DHCP server tanpa IP terdeteksi', has(r, '5.1.2'));
  const res = r.resultByNode.get('pc');
  ok('5.1.2 PC tersambung tapi tanpa IP', res.status === 'connected_no_ip' && res.layer === 'ip');
}
// ---- 5.1.3 interface VLAN tidak ada ------------------------------------------------
{
  const { r } = world({ mk: { dhcpServers: [{ interface: 'vlan20-hotspot', poolStart: '10.20.0.10', poolEnd: '10.20.0.200' }] } });
  ok('5.1.3 interface tidak ada terdeteksi', has(r, '5.1.3'));
}
// ---- 5.2.2 / 5.2.3 default route ---------------------------------------------------
{
  const { r } = world({ mk: { routes: [] } });
  ok('5.2.2 tanpa default route terdeteksi', has(r, '5.2.2'));
  const res = r.resultByNode.get('pc');
  ok('5.2.2 PC dapat IP tapi tanpa internet di lapisan route', res.status === 'ip_no_internet' && res.layer === 'route');
  ok('5.2.2 alasan menyebut default route', /default route/i.test(res.reason));
}
{
  const { r } = world({ mk: { routes: [{ dst: '0.0.0.0/0', gateway: '10.99.99.1' }] } });
  ok('5.2.3 gateway route di luar jaringan interface terdeteksi', has(r, '5.2.3'));
}
// ---- 5.3.2 / 5.3.3 NAT -------------------------------------------------------------
{
  const { r } = world({ mk: { natRules: [] } });
  ok('5.3.2 NAT tidak ada terdeteksi', has(r, '5.3.2'));
  ok('5.3.2 PC ip_no_internet lapisan nat', r.resultByNode.get('pc').layer === 'nat');
}
{
  const { r } = world({ mk: { natRules: [{ chain: 'srcnat', action: 'masquerade', outInterface: 'ether2' }] } });
  ok('5.3.3 NAT di interface salah terdeteksi', has(r, '5.3.3'));
}
// ---- 5.6.3 firewall terlalu luas / 5.6.x filter antar VLAN yang spesifik tidak dihukum
{
  const { r } = world({ mk: { filterRules: [{ chain: 'forward', action: 'drop' }] } });
  ok('5.6.3 drop semua trafik terdeteksi', has(r, '5.6.3'));
}
{
  const { r } = world({ mk: { filterRules: [{ chain: 'forward', action: 'drop', inInterface: 'ether2', outInterface: 'ether1' }] } });
  ok('5.6 aturan drop spesifik antar-interface tidak dianggap salah', !has(r, '5.6.3'));
}
// ---- 5.4 PPPoE ONT -> MikroTik ------------------------------------------------------
const pppoeMk = (over = {}) => ({
  interfaces: [{ name: 'ether1', type: 'ether' }, { name: 'ether2', type: 'ether' }, { name: 'pppoe-in', type: 'ether' }],
  pppoeServers: [{ interface: 'ether1', serviceName: 'rtrw' }],
  pppSecrets: [{ name: 'u', password: 'p', service: 'pppoe' }],
  ...over,
});
{
  const { r } = world({ ont: { pppoeTarget: 'mikrotik' }, mk: pppoeMk() });
  ok('5.4 PPPoE benar: tanpa issue', !r.issues.some((i) => ['5.4.2', '5.4.3', '5.4.4'].includes(i.ruleRef)));
}
{
  // Client RT/RW net ada di belakang ONT (WiFi ONT), ONT dial PPPoE ke MikroTik.
  const { r } = world({
    ont: { pppoeTarget: 'mikrotik', dhcpServerEnabled: true },
    mk: pppoeMk({ pppSecrets: [{ name: 'u', password: 'SALAH', service: 'pppoe' }] }),
    extraNodes: [base('pc2', 'pc', { ipConfig: { mode: 'dhcp', ip: '192.168.1.50', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' } })],
    extraCables: [cable('ont', 'pc2')],
  });
  ok('5.4.2 password PPPoE salah terdeteksi', has(r, '5.4.2'));
  const res = r.resultByNode.get('pc2');
  ok('5.4.2 client di belakang ONT: dapat IP tapi tanpa internet (lapisan service)', res.status === 'ip_no_internet' && res.layer === 'service');
}
{
  const { r } = world({ ont: { pppoeTarget: 'mikrotik' }, mk: pppoeMk({ pppoeServers: [{ interface: 'ether2', serviceName: 'x' }] }) });
  ok('5.4.3 PPPoE server di interface salah terdeteksi', has(r, '5.4.3'));
}
{
  const { r } = world({ ont: { pppoeTarget: 'mikrotik' }, mk: { interfaces: [{ name: 'ether1', type: 'ether' }, { name: 'ether2', type: 'ether' }], pppoeServers: [] } });
  ok('5.4 tanpa PPPoE server: tidak menemukan server (5.4.3)', has(r, '5.4.3'));
}
{
  // VLAN WAN 1049 terputus di switch yang tidak mengizinkannya (5.4.4).
  const sw = base('sw', 'switch_managed', { vlanConfig: { enabled: true, vlanId: 1, vlanName: 't', mode: 'trunk', allowedVlans: [10, 20] } });
  const nodes = [
    base('ont', 'ont', { ontConfig: { brand: 'Z', model: 'x', wanMode: 'pppoe', pppoeUsername: 'u', pppoePassword: 'p', pppoeTarget: 'mikrotik', vlanId: 1049, lanIp: '192.168.1.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: false } }),
    sw,
    base('mk', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '0.0.0.0', dns: '8.8.8.8' }, mikrotikConfig: mkConfig({ interfaces: [{ name: 'ether1', type: 'ether' }, { name: 'vlan1049', type: 'vlan', vlanId: 1049, parent: 'ether1' }], pppoeServers: [{ interface: 'vlan1049', serviceName: 'x' }], dhcpServers: [], addresses: [] }) }),
  ];
  const r = validateTopology(nodes, [cable('ont', 'sw'), cable('sw', 'mk')]);
  ok('5.4.4 VLAN WAN terputus di switch terdeteksi', has(r, '5.4.4'));
}

// ---- P7 / 4A.3: dua interface satu router di subnet yang sama ------------------------
{
  const { r } = world({ mk: { addresses: [{ address: '192.168.88.1', mask: '255.255.255.0', interface: 'ether1' }, { address: '192.168.88.5', mask: '255.255.255.0', interface: 'ether2' }] } });
  ok('P7 subnet interface router bertumpuk terdeteksi', has(r, 'P7'));
}
{
  const { r } = world();
  ok('P7 subnet berbeda: tidak ada issue', !has(r, 'P7'));
}

// ---- Client: gateway salah (4A.2) dan DHCP ganda (4A.9) -----------------------------
{
  const { r } = world({ pc: { ipConfig: { mode: 'static', ip: '192.168.88.50', subnet: '255.255.255.0', gateway: '192.168.88.77', dns: '8.8.8.8' } } });
  ok('4A.2 gateway client salah terdeteksi', has(r, '4A.2'));
  const res = r.resultByNode.get('pc');
  ok('4A.2 status ip_no_internet lapisan route', res.status === 'ip_no_internet' && res.layer === 'route');
}
{
  const { r } = world({ pc: { ipConfig: { mode: 'static', ip: '192.168.88.50', subnet: '255.255.255.0', gateway: '', dns: '8.8.8.8' } } });
  ok('4A.2 gateway kosong terdeteksi', idHas(r, 'no-gw-'));
}
{
  // Dua router dengan DHCP aktif tertancap pada switch yang sama (satu domain L2).
  const { r } = world({
    extraNodes: [base('sw', 'switch'), base('rt2', 'router', { ipConfig: { mode: 'static', ip: '192.168.88.2', subnet: '255.255.255.0', gateway: '', dns: '', isDhcpServerEnabled: true } })],
    extraCables: [cable('sw', 'mk'), cable('sw', 'rt2')],
  });
  ok('4A.9 DHCP ganda dalam satu domain L2 terdeteksi', has(r, '4A.9'));
}

// ---- Fisik: 1.2 LOS, 1.3 dampak ke client -----------------------------------------
{
  const { r } = world({ ont: { ponStatus: 'LOS (No Signal)' } });
  ok('1.2 ONT LOS terdeteksi', has(r, '1.2'));
  const res = r.resultByNode.get('pc');
  ok('1.3 PC dapat IP lokal tapi tanpa internet karena LOS', res.status === 'ip_no_internet' && res.layer === 'physical');
}
{
  const { r } = world({ extraCables: [] });
  const nodes = r.issues; void nodes;
  const w = world();
  w.cables[0].status = 'broken';
  const rr = validateTopology(w.nodes, w.cables);
  ok('kabel putus: issue broken- ada', idHas(rr, 'broken-'));
  ok('kabel putus: PC tanpa internet', rr.resultByNode.get('pc').status !== 'internet_normal');
}

// ---- Status: tidak tersambung ------------------------------------------------------
{
  const w = world();
  const r = validateTopology(w.nodes, w.cables.filter((c) => c.id !== 'c-mk-pc'));
  const res = r.resultByNode.get('pc');
  ok('PC tanpa kabel: not_connected dengan alasan', res.status === 'not_connected' && /kabel/i.test(res.reason));
}

// ---- undefinedRules: MikroTik tanpa konfigurasi terstruktur -> ditanyakan, bukan error
{
  const legacy = [base('mk', 'mikrotik', { ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0', gateway: '', dns: '' }, mikrotikConfig: { firewallNat: true, pppoeServer: false, dnsServer: true, totalQueues: 5 } })];
  const r = validateTopology(legacy, []);
  ok('MikroTik lama: tercatat sebagai tidak terdefinisi', r.undefinedRules.some((u) => u.includes('mk')));
  ok('MikroTik lama: tidak ada issue peringatan palsu', r.issues.filter((i) => i.severity !== 'info').length === 0);
}

// ---- Aturan 7: template bawaan adalah topologi sehat, tidak boleh ada peringatan palsu
for (const t of TOPOLOGY_TEMPLATES) {
  const r = validateTopology(t.nodes, t.cables);
  const bad = r.issues.filter((i) => i.severity !== 'info');
  ok(`template ${t.id}: tanpa peringatan/kritis (${bad.map((i) => i.id).join(', ')})`, bad.length === 0);
  const clients = t.nodes.filter((x) => ['pc', 'laptop', 'cctv', 'smartphone', 'printer', 'iot'].includes(x.type));
  ok(`template ${t.id}: semua client internet normal`, clients.every((c) => r.resultByNode.get(c.id)?.status === 'internet_normal'));
}

console.log(`mikrotik rule tests: PASS (${n} assertions)`);
