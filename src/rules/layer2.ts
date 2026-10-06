import type { DiagnosticIssue, NetworkNode } from '../types/network';
import type { RuleContext } from './types';
import { activeCable, isClient, issue, isSwitch } from './common';

const vlanOf = (n: NetworkNode) => (n.vlanConfig?.enabled ? n.vlanConfig.vlanId : undefined);

function stpOn(n: NetworkNode): boolean {
  const m = n.managedSwitchConfig?.stpMode;
  return (!!m && m !== 'disabled') || n.switchConfig?.stpEnabled === true;
}

/**
 * Lapisan 2: VLAN, trunk, STP. Aturan dokumen: 3.2, 3.4, 3.5, 4.2 sampai 4.6,
 * 4.4 (client di port trunk), 4B.10 (SSID AP bertag VLAN) dan 4B.12 (loop AP).
 */
export function validateLayer2Rules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];

  for (const c of ctx.cables) {
    if (c.status === 'broken' || !['lan', 'wireless'].includes(c.type)) continue;
    const a = ctx.nodes.find((n) => n.id === c.fromNodeId);
    const b = ctx.nodes.find((n) => n.id === c.toNodeId);
    if (!a || !b) continue;
    const va = vlanOf(a), vb = vlanOf(b);
    if (va === undefined || vb === undefined) continue;
    const ma = a.vlanConfig!.mode, mb = b.vlanConfig!.mode;

    if (ma === 'access' && mb === 'access' && va !== vb) {
      out.push(issue({
        id: `vlan-mismatch-${c.id}`, ruleRef: '3.2', layer: 'layer2', category: 'topology', targetCableId: c.id, targetNodeId: a.id,
        title: `VLAN access tidak cocok pada link ${a.name} ↔ ${b.name}`,
        cause: `${a.name} ada di VLAN ${va} dan ${b.name} di VLAN ${vb}. Perangkat di VLAN berbeda tidak bisa berkomunikasi tanpa router.`,
        solution: 'Samakan VLAN access, atau gunakan router untuk komunikasi antar-VLAN.',
      }));
    }

    // Port access di satu sisi, trunk di sisi lain: VLAN access harus diizinkan trunk.
    const pairs: Array<[NetworkNode, number, NetworkNode]> = [];
    if (ma === 'access' && mb === 'trunk') pairs.push([a, va, b]);
    if (mb === 'access' && ma === 'trunk') pairs.push([b, vb, a]);
    for (const [access, vlan, trunk] of pairs) {
      if ((trunk.vlanConfig!.allowedVlans ?? []).includes(vlan)) continue;
      out.push(issue({
        id: `vlan-trunk-drop-${c.id}`, ruleRef: '3.5', layer: 'layer2', category: 'topology', targetCableId: c.id, targetNodeId: access.id,
        title: `VLAN ${vlan} tidak diizinkan pada trunk ${trunk.name}`,
        cause: `Trunk ${trunk.name} tidak mengizinkan VLAN ${vlan}, jadi VLAN itu terputus di titik ini.`,
        solution: `Tambahkan VLAN ${vlan} ke daftar allowed VLAN trunk.`,
      }));
    }
  }

  // 4.5 / 4.6: dua kabel antar-switch yang sama tanpa STP.
  const sw = ctx.nodes.filter(isSwitch);
  for (let i = 0; i < sw.length; i++) {
    for (let j = i + 1; j < sw.length; j++) {
      const a = sw[i], b = sw[j];
      const links = ctx.cables.filter((c) => c.type === 'lan' && c.status !== 'broken'
        && ((c.fromNodeId === a.id && c.toNodeId === b.id) || (c.fromNodeId === b.id && c.toNodeId === a.id)));
      const lacp = a.managedSwitchConfig?.lacpTrunkEnabled || b.managedSwitchConfig?.lacpTrunkEnabled;
      if (links.length > 1 && !stpOn(a) && !stpOn(b) && !lacp) {
        out.push(issue({
          id: `loop-${a.id}-${b.id}`, ruleRef: '4.5', layer: 'layer2', category: 'topology', targetNodeId: a.id,
          title: `Loop Layer 2 antara ${a.name} dan ${b.name}`,
          cause: `Ada ${links.length} kabel antara ${a.name} dan ${b.name} tanpa STP atau LACP. Broadcast akan berputar terus (broadcast storm) dan jaringan lumpuh.`,
          solution: 'Aktifkan STP atau LACP, atau lepas kabel paralel.',
        }));
      }
    }
  }
  // 4.4: client dicolok ke port trunk. Client tidak mengerti tag VLAN.
  for (const n of ctx.nodes.filter((x) => isClient(x) && x.poweredOn)) {
    const v = n.vlanConfig;
    if (!v?.enabled || v.mode !== 'trunk') continue;
    if (!ctx.cables.some((c) => activeCable(c) && (c.fromNodeId === n.id || c.toNodeId === n.id))) continue;
    out.push(issue({
      id: `client-on-trunk-${n.id}`, ruleRef: '4.4', layer: 'layer2', category: 'topology', targetNodeId: n.id,
      title: `\"${n.name}\" dicolok ke port trunk`,
      cause: `${n.name} tidak mengerti tag VLAN, jadi tidak tersambung ke VLAN bertag di port trunk.`,
      solution: 'Ubah port tersebut menjadi access untuk VLAN yang diinginkan.',
    }));
  }

  // 4B.10: SSID access point dipetakan ke VLAN, tetapi port uplink-nya access atau tidak mengizinkan VLAN itu.
  for (const ap of ctx.nodes.filter((x) => x.type === 'access_point' && x.poweredOn && x.accessPointConfig?.vlanTagged && x.accessPointConfig.vlanId !== undefined)) {
    const vlan = ap.accessPointConfig!.vlanId!;
    for (const c of ctx.cables) {
      if (c.type !== 'lan' || !activeCable(c) || (c.fromNodeId !== ap.id && c.toNodeId !== ap.id)) continue;
      const other = ctx.nodes.find((x) => x.id === (c.fromNodeId === ap.id ? c.toNodeId : c.fromNodeId));
      const v = other?.vlanConfig;
      if (!other || !other.poweredOn || !v?.enabled) continue;
      const blocked = v.mode === 'access' || !(v.allowedVlans ?? []).includes(vlan);
      if (!blocked) continue;
      out.push(issue({
        id: `ap-vlan-blocked-${ap.id}-${c.id}`, ruleRef: '4B.10', layer: 'layer2', category: 'topology', targetNodeId: ap.id, targetCableId: c.id,
        title: `VLAN ${vlan} SSID \"${ap.name}\" tidak lolos di ${other.name}`,
        cause: `SSID ${ap.name} dipetakan ke VLAN ${vlan}, tetapi port ${other.name} berupa ${v.mode === 'access' ? 'access' : 'trunk yang tidak mengizinkan VLAN itu'}. Client tersambung ke WiFi tetapi tidak mendapat IP.`,
        solution: `Jadikan port ${other.name} trunk dan izinkan VLAN ${vlan}.`,
      }));
    }
  }

  // 4B.12 dan loop yang lebih dari dua perangkat: kabel LAN antar switch/AP/mesh yang membentuk lingkaran tanpa STP atau LACP.
  // Pasangan switch dengan kabel paralel sudah ditangani aturan 4.5 di atas.
  const loopable = ctx.nodes.filter((n) => n.poweredOn && (isSwitch(n) || n.type === 'access_point' || n.type === 'mesh'));
  const ids = new Set(loopable.map((n) => n.id));
  const parent = new Map<string, string>(loopable.map((n) => [n.id, n.id]));
  const find = (x: string): string => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; } return x; };
  const cycleEdges: string[] = [];
  for (const c of ctx.cables) {
    if (c.type !== 'lan' || !activeCable(c) || !ids.has(c.fromNodeId) || !ids.has(c.toNodeId)) continue;
    const ra = find(c.fromNodeId), rb = find(c.toNodeId);
    if (ra === rb) cycleEdges.push(c.fromNodeId); else parent.set(ra, rb);
  }
  const cyclicRoots = new Set(cycleEdges.map(find));
  for (const root of cyclicRoots) {
    const members = loopable.filter((n) => find(n.id) === root);
    if (members.length === 2 && members.every(isSwitch)) continue;
    const protectedByStp = members.some((n) => isSwitch(n) && (stpOn(n) || n.managedSwitchConfig?.lacpTrunkEnabled));
    if (protectedByStp) continue;
    const names = members.map((n) => n.name).join(', ');
    out.push(issue({
      id: `l2cycle-${members.map((n) => n.id).sort().join('-')}`,
      ruleRef: members.some((n) => !isSwitch(n)) ? '4B.12' : '4.5', layer: 'layer2', category: 'topology', targetNodeId: members[0].id,
      title: `Loop Layer 2 antara ${names}`,
      cause: `Kabel LAN antara ${names} membentuk lingkaran tanpa STP atau LACP. Broadcast akan berputar terus (broadcast storm) dan jaringan lumpuh.`,
      solution: 'Lepas salah satu kabel yang membentuk lingkaran, atau aktifkan STP pada switch di dalam lingkaran itu.',
    }));
  }
  return out;
}
