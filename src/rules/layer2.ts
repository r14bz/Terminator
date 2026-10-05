import type { DiagnosticIssue, NetworkNode } from '../types/network';
import type { RuleContext } from './types';
import { issue, isSwitch } from './common';

const vlanOf = (n: NetworkNode) => (n.vlanConfig?.enabled ? n.vlanConfig.vlanId : undefined);

function stpOn(n: NetworkNode): boolean {
  const m = n.managedSwitchConfig?.stpMode;
  return (!!m && m !== 'disabled') || n.switchConfig?.stpEnabled === true;
}

/**
 * Lapisan 2: VLAN, trunk, STP. Aturan dokumen: 3.2, 3.4, 3.5, 4.2 sampai 4.6.
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
  return out;
}
