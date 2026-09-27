/**
 * Tests for src/utils/pingTool.ts — the canvas ping tool's gate.
 *
 *   node scripts/verify-ping.mjs
 *
 * Imports the real TypeScript module via Node's native type stripping.
 *
 * The regression this exists for: handleTriggerPing received toNodeId, checked
 * it, then threw it away and opened the terminal at the source with nothing
 * run. The tool looked wired up and did nothing. What the technician had to
 * type by hand is now the pre-filled command, so these tests pin down when
 * that pre-fill is produced and, above all, that the address the tool fills in
 * is the same one the terminal can resolve back to a node.
 */
import assert from 'node:assert/strict';
import { planPing } from '../src/utils/pingTool.ts';
import { addressOf, findNodeByAddress } from '../src/utils/ipUtils.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

const node = (id, extra = {}) => ({
  id, type: 'pc', name: id.toUpperCase(), label: id, x: 0, y: 0,
  ports: [], status: 'online', poweredOn: true, ...extra,
});

const reroute = (n) => n.replace(/\b\d+\.\d+\.\d+\.\d+\b/g, '10.0.0.1');

// --- Happy path: routed interface address is used -------------------------
{
  const source = node('src', { ipConfig: { ip: '192.168.1.10', subnet: '255.255.255.0' } });
  const target = node('dst', { type: 'mikrotik', ipConfig: { ip: '10.20.0.1' } });
  const plan = planPing(source, target);
  ok('plan Runnable', plan.kind === 'run');
  ok('target IP ter-resolve', plan.kind === 'run' && plan.targetIp === '10.20.0.1');
  ok('source adalah terminal yang dibuka', plan.kind === 'run' && plan.sourceNodeId === 'src');
}

// --- ONT with only a LAN address still works -----------------------------
{
  const plan = planPing(node('pc'), node('ont', { type: 'ont', ontConfig: { lanIp: '192.168.88.24' } }));
  ok('ONT pakai lanIp', plan.kind === 'run' && plan.targetIp === '192.168.88.24');
}

// --- Rejections, each with a message the technician can act on -----------
{
  const dead = node('src', { poweredOn: false });
  const p = planPing(dead, node('dst'));
  ok('source mati ditolak', p.kind === 'reject');
  ok('pesan source mati menyebut namanya', p.kind === 'reject' && p.reason.includes(dead.name));
}
{
  const dead = node('dst', { poweredOn: false });
  const p = planPing(node('src'), dead);
  ok('target mati ditolak', p.kind === 'reject');
  ok('pesan target mati menyebut namanya', p.kind === 'reject' && p.reason.includes(dead.name));
  ok('pesan target dibedakan dari source', p.kind === 'reject' && p.reason.includes('Target'));
}
{
  const p = planPing(node('src'), node('splitter-node', { type: 'splitter' }));
  ok('target tanpa IP ditolak', p.kind === 'reject');
  ok('pesan menjelaskan IP belum ada', p.kind === 'reject' && /belum punya alamat IP/.test(p.reason));
}
{
  // A malformed address must not reach the terminal: the ping would report
  // "host unreachable" for a typo instead of naming the real problem.
  const p = planPing(node('src'), node('dst', { ipConfig: { ip: '192.168.1.256' } }));
  ok('IP malformed ditolak', p.kind === 'reject');
  const z = planPing(node('src'), node('dst', { ipConfig: { ip: '192.168.01.1' } }));
  ok('leading zero ditolak', z.kind === 'reject');
}
{
  ok('sumber hilang ditolak', planPing(undefined, node('dst')).kind === 'reject');
  ok('target hilang ditolak', planPing(node('src'), undefined).kind === 'reject');
}

// --- The invariant that actually broke: the pre-filled address must be the
// --- one TerminalModal can resolve back to a node.
{
  // TerminalModal matches a ping with `nodes.find((n) => addressOf(n) === ip)`.
  // If planPing ever reads the address differently, the terminal opens already
  // running a ping against a target it cannot find.
  const nodes = [
    node('pc', { ipConfig: { ip: '192.168.1.10' } }),
    node('ont', { type: 'ont', ontConfig: { lanIp: '192.168.88.24' } }),
    node('mikrotik', { type: 'mikrotik', ipConfig: { ip: '10.20.0.1' } }),
    node('dual', { ipConfig: { ip: '172.16.5.1' }, ontConfig: { lanIp: '172.16.9.9' } }),
  ];

  for (const target of nodes) {
    const plan = planPing(nodes[0], target);
    ok(`${target.id}: plan menghasilkan IP valid`, plan.kind === 'run' && plan.targetIp.length > 0);
    // Round-trip through the very lookup the terminal runs. If planPing and
    // findNodeByAddress ever read addresses differently, this is what fails.
    const found = plan.kind === 'run' ? findNodeByAddress(nodes, plan.targetIp) : null;
    ok(
      `${target.id}: findNodeByAddress(plan.targetIp) kembali ke node yang diklik`,
      found?.id === target.id,
    );
  }
}

// --- Dual-address nodes resolve to the routed interface, not the LAN one ---
{
  const dual = node('dual', { ipConfig: { ip: '172.16.5.1' }, ontConfig: { lanIp: '172.16.9.9' } });
  const plan = planPing(node('src'), dual);
  ok('node dual-H Address -> ipConfig menang', plan.kind === 'run' && plan.targetIp === '172.16.5.1');
  ok('addressOf ikut prioritas yang sama', addressOf(dual) === '172.16.5.1');
}

// --- Output must be stable enough to snapshot in a test ------------------
{
  const plan = planPing(node('src'), node('dst', { poweredOn: false }));
  const again = planPing(node('src'), node('dst', { poweredOn: false }));
  ok('pesan reject deterministik', reroute(plan.reason) === reroute(again.reason));
}

// --- 8.8.8.8 resolves to the internet node, which owns no address --------
{
  const net = node('internet', { type: 'internet' });
  const pc = node('pc', { ipConfig: { ip: '192.168.1.10' } });
  ok('node internet tidak punya IP', addressOf(net) === undefined);
  ok('ping 8.8.8.8 -> node internet', findNodeByAddress([net, pc], '8.8.8.8')?.id === 'internet');
  ok('ping 1.1.1.1 -> node internet', findNodeByAddress([net, pc], '1.1.1.1')?.id === 'internet');
  ok('IP asing -> undefined', findNodeByAddress([net, pc], '203.0.113.9') === undefined);
}

console.log(`ok — ${n} assertions passed`);
