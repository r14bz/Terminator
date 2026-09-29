/**
 * Tes untuk DHCP otomatis (src/utils/dhcpAuto.ts) dan port Wi-Fi bersama
 * (src/utils/portReconcile.ts).
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-dhcp-auto.mjs
 *
 * Dua keluhan yang direproduksi:
 *   1. ONT/router hanya bisa menerima satu koneksi Wi-Fi, padahal satu radio
 *      melayani sampai 32 perangkat.
 *   2. Klien harus diklik "Static" lalu "DHCP" dulu sebelum IP muncul.
 */
import assert from 'node:assert/strict';
import { DEVICE_METADATA } from '../src/data/deviceDefinitions.ts';
import { autoAssignDhcpLeases, DHCP_CLIENT_TYPES } from '../src/utils/dhcpAuto.ts';
import {
  reconcilePorts,
  findFreePort,
  claimCable,
  releaseCables,
  cablesOnPort,
  portCapacity,
  WIRELESS_AP_CAPACITY,
} from '../src/utils/portReconcile.ts';

let n = 0;
const ok = (msg, cond) => { n++; assert.ok(cond, msg); };
const eq = (msg, a, b) => { n++; assert.deepEqual(a, b, `${msg}\n  actual:   ${JSON.stringify(a)}\n  expected: ${JSON.stringify(b)}`); };

const portsFor = (type, id) =>
  DEVICE_METADATA[type].defaultPorts.map((p, i) => ({
    id: `p-${id}-${i}`, name: p.name, medium: p.medium, status: 'up',
    ...(p.maxConnections ? { maxConnections: p.maxConnections } : {}),
  }));

const mkOnt = (id = 'ont', over = {}) => ({
  id, type: 'ont', name: id, label: id, brand: 'ZTE', model: 'F609', x: 0, y: 0,
  poweredOn: true, status: 'online', ports: portsFor('ont', id),
  ontConfig: { wanMode: 'pppoe', lanIp: '192.168.1.1', lanSubnet: '255.255.255.0',
    dhcpServerEnabled: true, dhcpPoolStart: '192.168.1.2', dhcpPoolEnd: '192.168.1.254', ...(over.ontConfig || {}) },
  ipConfig: { mode: 'static', ip: '192.168.1.1', subnet: '255.255.255.0', gateway: '10.10.0.1', dns: '8.8.8.8', isDhcpServerEnabled: true },
  ...over.node,
});

const mkClient = (id, type = 'pc', ipConfig = {}) => ({
  id, type, name: id, label: id, brand: '', model: '', x: 0, y: 0,
  poweredOn: true, status: 'online', ports: portsFor(type, id),
  ipConfig: { mode: 'dhcp', ip: '', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8', ...ipConfig },
});

let cid = 0;
const cable = (from, to, type = 'lan') =>
  ({ id: `c${++cid}`, type, fromNodeId: from, toNodeId: to, fromPortId: '', toPortId: '', lengthKm: 0.01, attenuationDb: 0, status: 'active' });

// ------------------------------------------------ Wi-Fi: satu radio, 32 klien

for (const t of ['ont', 'router', 'mesh', 'access_point']) {
  const wl = DEVICE_METADATA[t].defaultPorts.find((p) => p.medium === 'wireless');
  eq(`${t}: radio Wi-Fi berkapasitas ${WIRELESS_AP_CAPACITY}`, wl.maxConnections, WIRELESS_AP_CAPACITY);
}
for (const t of ['smartphone', 'pc', 'iot', 'laptop', 'ap_ptp']) {
  const wl = DEVICE_METADATA[t].defaultPorts.find((p) => p.medium === 'wireless');
  ok(`${t}: adapter klien tetap satu koneksi`, !wl.maxConnections);
}

{
  const ont = mkOnt();
  const phones = Array.from({ length: 32 }, (_, i) => mkClient(`ph${i}`, 'smartphone'));
  const cables = phones.map((p) => cable(p.id, 'ont', 'wireless'));
  const [rOnt] = reconcilePorts([ont, ...phones], cables);
  const wifiPorts = rOnt.ports.filter((p) => p.medium === 'wireless');
  eq('32 kabel Wi-Fi tidak membuat port tambahan', wifiPorts.length, 1);
  eq('semua 32 kabel tercatat di satu radio', cablesOnPort(wifiPorts[0]).length, 32);
  eq('connectedCableId menunjuk kabel pertama', wifiPorts[0].connectedCableId, cables[0].id);
  ok('radio penuh setelah 32 klien', findFreePort(rOnt.ports, 'wireless') === undefined);
  ok('LAN tetap bebas saat radio penuh', findFreePort(rOnt.ports, 'ethernet') !== undefined);

  const half = reconcilePorts([ont, ...phones.slice(0, 5)], cables.slice(0, 5))[0];
  ok('radio masih punya slot di 5/32', findFreePort(half.ports, 'wireless') !== undefined);

  // Melepas satu kabel membebaskan satu slot, sisanya tetap.
  const wp = wifiPorts[0];
  const released = releaseCables(wp, new Set([cables[3].id]));
  eq('lepas 1 dari 32 -> 31', cablesOnPort(released).length, 31);
  ok('kabel yang dilepas hilang', !cablesOnPort(released).includes(cables[3].id));
  ok('port menjadi bebas lagi', findFreePort([released], 'wireless') !== undefined);
  eq('lepas semua -> kosong', cablesOnPort(releaseCables(wp, new Set(cables.map((c) => c.id)))).length, 0);
}

{
  // Adapter klien: tetap satu koneksi.
  const ph = mkClient('ph', 'smartphone');
  const wp = ph.ports.find((p) => p.medium === 'wireless');
  eq('adapter klien berkapasitas 1', portCapacity(wp), 1);
  const used = claimCable(wp, 'x');
  ok('adapter klien penuh setelah 1 koneksi', findFreePort([used], 'wireless') === undefined);
  ok('port biasa tidak diberi connectedCableIds', used.connectedCableIds === undefined);
}

{
  // Topologi lama tanpa maxConnections diperbaiki otomatis.
  const ont = mkOnt();
  for (const p of ont.ports) delete p.maxConnections;
  const phones = [mkClient('a', 'smartphone'), mkClient('b', 'smartphone')];
  const [r] = reconcilePorts([ont, ...phones], phones.map((p) => cable(p.id, 'ont', 'wireless')));
  eq('topologi lama: 2 klien Wi-Fi di satu radio', r.ports.filter((p) => p.medium === 'wireless').length, 1);
}

// ------------------------------------------------ DHCP otomatis

ok('server tidak otomatis DHCP', !DHCP_CLIENT_TYPES.includes('server'));
ok('ONT/MikroTik tidak otomatis DHCP', !DHCP_CLIENT_TYPES.includes('ont') && !DHCP_CLIENT_TYPES.includes('mikrotik'));

{
  const ont = mkOnt();
  const pc = mkClient('pc');
  const nodes = [ont, pc];
  const out = autoAssignDhcpLeases(nodes, [cable('pc', 'ont')]);
  const got = out.find((x) => x.id === 'pc').ipConfig;
  eq('IP langsung muncul setelah kabel tersambung', got.ip, '192.168.1.2');
  eq('gateway otomatis', got.gateway, '192.168.1.1');
  eq('subnet otomatis', got.subnet, '255.255.255.0');
  eq('mode tetap dhcp', got.mode, 'dhcp');
}

{
  const before = [mkOnt(), mkClient('pc')];
  const cables = [cable('pc', 'ont')];
  const once = autoAssignDhcpLeases(before, cables);
  const twice = autoAssignDhcpLeases(once, cables);
  ok('idempoten: tidak ada perubahan kedua', twice === once);
  const noClients = [mkOnt()];
  ok('tanpa DHCP client, array yang sama dikembalikan', autoAssignDhcpLeases(noClients, []) === noClients);
}

{
  // Banyak klien: semua unik, di dalam pool.
  const ont = mkOnt();
  const clients = ['pc', 'laptop', 'printer', 'voip_phone', 'cctv', 'smartphone', 'iot'].map((t, i) => mkClient(`c${i}`, t));
  const cables = clients.map((c) => cable(c.id, 'ont'));
  const out = autoAssignDhcpLeases([ont, ...clients], cables).filter((x) => x.id !== 'ont');
  const ips = out.map((x) => x.ipConfig.ip);
  eq('semua 7 jenis klien mendapat IP', ips.every((ip) => /^192\.168\.1\.\d+$/.test(ip)), true);
  eq('tidak ada IP ganda', new Set(ips).size, ips.length);
  ok('tidak ada yang memakai alamat gateway', !ips.includes('192.168.1.1'));
}

{
  // 32 perangkat Wi-Fi pada satu ONT semuanya mendapat IP unik.
  const ont = mkOnt();
  const phones = Array.from({ length: 32 }, (_, i) => mkClient(`ph${i}`, 'smartphone'));
  const cables = phones.map((p) => cable(p.id, 'ont', 'wireless'));
  const out = autoAssignDhcpLeases([ont, ...phones], cables).filter((x) => x.type === 'smartphone');
  const ips = out.map((x) => x.ipConfig.ip);
  ok('32 klien Wi-Fi semua punya IP', ips.every(Boolean));
  eq('32 IP unik', new Set(ips).size, 32);
}

{
  // Lease sah dipertahankan.
  const ont = mkOnt();
  const pc = mkClient('pc', 'pc', { ip: '192.168.1.77' });
  const input = [ont, pc];
  const out = autoAssignDhcpLeases(input, [cable('pc', 'ont')]);
  eq('lease yang sah tidak berpindah', out[1].ipConfig.ip, '192.168.1.77');
  ok('lease sah, gateway & subnet sudah benar -> array sama', out === input);
}

{
  // IP ganda diselesaikan.
  const ont = mkOnt();
  const a = mkClient('a', 'pc', { ip: '192.168.1.50' });
  const b = mkClient('b', 'pc', { ip: '192.168.1.50' });
  const out = autoAssignDhcpLeases([ont, a, b], [cable('a', 'ont'), cable('b', 'ont')]);
  ok('IP ganda dipisahkan', out[1].ipConfig.ip !== out[2].ipConfig.ip);
}

{
  // IP statis tidak disentuh.
  const ont = mkOnt();
  const st = mkClient('st', 'pc', { mode: 'static', ip: '192.168.1.9' });
  const out = autoAssignDhcpLeases([ont, st], [cable('st', 'ont')]);
  ok('klien statis tidak diubah', out[1] === st);
}

{
  // Belum tersambung -> tanpa IP (APIPA).
  const out = autoAssignDhcpLeases([mkOnt(), mkClient('pc')], []);
  eq('tanpa kabel, IP kosong', out[1].ipConfig.ip, '');
}

{
  // Server DHCP mati atau ONT bridge -> tanpa IP.
  const off = autoAssignDhcpLeases(
    [mkOnt('ont', { ontConfig: { dhcpServerEnabled: false } }), mkClient('pc', 'pc', { ip: '192.168.1.5' })],
    [cable('pc', 'ont')],
  );
  eq('DHCP server mati -> IP kosong', off[1].ipConfig.ip, '');
  const bridge = autoAssignDhcpLeases(
    [mkOnt('ont', { ontConfig: { wanMode: 'bridge' } }), mkClient('pc')],
    [cable('pc', 'ont')],
  );
  eq('ONT bridge -> IP kosong', bridge[1].ipConfig.ip, '');
}

{
  // Server DHCP dimatikan lalu dinyalakan lagi: IP muncul lagi otomatis.
  const cables = [cable('pc', 'ont')];
  const on = autoAssignDhcpLeases([mkOnt(), mkClient('pc')], cables);
  const off = autoAssignDhcpLeases([mkOnt('ont', { ontConfig: { dhcpServerEnabled: false } }), on[1]], cables);
  const back = autoAssignDhcpLeases([mkOnt(), off[1]], cables);
  ok('IP muncul lagi setelah DHCP server dinyalakan', /^192\.168\.1\.\d+$/.test(back[1].ipConfig.ip));
}

{
  // Gateway mati: klien mempertahankan lease terakhir.
  const ont = mkOnt('ont', { node: { poweredOn: false } });
  const pc = mkClient('pc', 'pc', { ip: '192.168.1.20' });
  const out = autoAssignDhcpLeases([ont, pc], [cable('pc', 'ont')]);
  eq('gateway mati: lease dipertahankan', out[1].ipConfig.ip, '192.168.1.20');
}

console.log(`ok — ${n} assertions passed`);
