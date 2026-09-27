/**
 * Benchmark: how much does the per-tick checkInternetAccess cost?
 * Throwaway measurement harness -- not part of npm test.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/bench-internet.mjs
 */
import { checkInternetAccess } from '../src/utils/ipUtils.ts';

const mkNode = (i, type, ip) => ({
  id: `n${i}`, type, name: `N${i}`, label: '', status: 'active', poweredOn: true,
  ipConfig: { mode: 'static', ip, subnet: '255.255.255.0', gateway: '192.168.88.1' },
});
const mkCable = (i, a, b) => ({
  id: `c${i}`, fromNodeId: `n${a}`, toNodeId: `n${b}`, type: 'lan',
  status: 'active', lengthKm: 0.05, medium: 'cat6',
});

/** Chain of N client PCs hanging off one MikroTik behind one ONT. */
function build(nClients) {
  const nodes = [
    { id: 'inet', type: 'internet', name: 'ISP', label: '', status: 'active', poweredOn: true },
    { id: 'ont', type: 'ont', name: 'ONT', label: '', status: 'active', poweredOn: true,
      ontConfig: { wanMode: 'router', lanIp: '192.168.88.1', lanSubnet: '255.255.255.0', dhcpServerEnabled: true } },
    { id: 'rtr', type: 'mikrotik', name: 'RTR', label: '', status: 'active', poweredOn: true,
      ipConfig: { mode: 'static', ip: '192.168.88.1', subnet: '255.255.255.0' },
      mikrotikConfig: { firewallNat: true } },
  ];
  const cables = [
    { id: 'cx', fromNodeId: 'inet', toNodeId: 'ont', type: 'feeder', status: 'active', lengthKm: 5, medium: 'fiber' },
    { id: 'cr', fromNodeId: 'ont', toNodeId: 'rtr', type: 'lan', status: 'active', lengthKm: 0.01, medium: 'cat6' },
  ];
  for (let i = 0; i < nClients; i++) {
    nodes.push(mkNode(i, 'pc', `192.168.88.${10 + i}`));
    cables.push(mkCable(i, 2, i));
  }
  return { nodes, cables };
}

const time = (label, fn, iters) => {
  fn(); // warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / iters;
  console.log(`  ${label.padEnd(46)} ${ms.toFixed(3)} ms`);
  return ms;
};

console.log('checkInternetAccess untuk semua node (yang terjadi tiap render):\n');
for (const n of [8, 20, 50, 100, 200]) {
  const { nodes, cables } = build(n);
  time(`${n} client, ${cables.length} kabel`, () => {
    for (const nd of nodes) checkInternetAccess(nd, nodes, cables);
  }, 200);
}

console.log('\nsatu tick 100ms = 2 panggilan per kabel yang ditembakkan:');
for (const n of [8, 20, 50, 100]) {
  const { nodes, cables } = build(n);
  const all = nodes;
  time(`${cables.length} kabel aktif -> ${cables.length * 2} panggilan`, () => {
    for (const c of cables) {
      const a = all.find((x) => x.id === c.fromNodeId);
      const b = all.find((x) => x.id === c.toNodeId);
      checkInternetAccess(a, all, cables);
      checkInternetAccess(b, all, cables);
    }
  }, 200);
}

console.log('\n10 tick (=1 detik animasi) pada topologi 50 client:');
{
  const { nodes, cables } = build(50);
  const ms = time('50 tick, 52 kabel -> 5200 panggilan', () => {
    for (let t = 0; t < 10; t++) {
      for (const c of cables) {
        const a = nodes.find((x) => x.id === c.fromNodeId);
        const b = nodes.find((x) => x.id === c.toNodeId);
        checkInternetAccess(a, nodes, cables);
        checkInternetAccess(b, nodes, cables);
      }
    }
  }, 20);
  console.log(`  per detik animasi: ${(ms / 10).toFixed(2)} ms CPU  (dari 1000 ms frame budget)`);
}
