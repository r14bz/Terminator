import type { DiagnosticIssue, NetworkNode } from '../types/network';
import type { RuleContext } from './types';
import { activeCable, dhcpEnabled, issue } from './common';

const MESH_PATH = new Set(['mesh', 'switch', 'switch_managed', 'access_point']);

/**
 * Mesh. Aturan dokumen: 4C.2 (satelit tidak terhubung ke node utama) dan
 * 4C.8 (DHCP hanya di node utama).
 * 4C.6 dan 4C.7 belum dievaluasi: mode router/AP dan sistem mesh belum dimodelkan (lihat PENDING_RULES).
 */
export function validateWirelessRules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];
  const byId = new Map(ctx.nodes.map((n) => [n.id, n]));

  const reachesRoot = (start: NetworkNode): boolean => {
    const seen = new Set<string>([start.id]);
    const q = [start.id];
    while (q.length) {
      const id = q.shift()!;
      for (const c of ctx.cables) {
        if (!activeCable(c) || !['lan', 'wireless'].includes(c.type)) continue;
        if (c.fromNodeId !== id && c.toNodeId !== id) continue;
        const oid = c.fromNodeId === id ? c.toNodeId : c.fromNodeId;
        if (seen.has(oid)) continue;
        seen.add(oid);
        const o = byId.get(oid);
        if (!o || !o.poweredOn) continue;
        if (o.type === 'mesh' && o.meshConfig?.role === 'root') return true;
        if (MESH_PATH.has(o.type)) q.push(oid);
      }
    }
    return false;
  };

  for (const n of ctx.nodes.filter((x) => x.type === 'mesh' && x.poweredOn && x.meshConfig?.role === 'satellite')) {
    if (!reachesRoot(n)) {
      out.push(issue({
        id: `mesh-sat-unreachable-${n.id}`, ruleRef: '4C.2', layer: 'physical', category: 'topology', targetNodeId: n.id,
        title: `Satelit mesh \"${n.name}\" tidak terhubung ke node utama`,
        cause: `${n.name} berperan sebagai satelit, tetapi tidak ada jalur (kabel atau backhaul nirkabel) yang sampai ke node utama mesh, jadi satelit terputus dan tidak membentuk jaringan.`,
        solution: 'Hubungkan satelit ke node utama atau satelit lain yang sudah tersambung, lewat kabel atau jangkauan backhaul nirkabel.',
      }));
    }
    if (dhcpEnabled(n)) {
      out.push(issue({
        id: `mesh-sat-dhcp-${n.id}`, severity: 'warning', ruleRef: '4C.8', layer: 'ip', category: 'ip', targetNodeId: n.id,
        title: `DHCP aktif pada satelit mesh \"${n.name}\"`,
        cause: `DHCP seharusnya hanya dijalankan node utama mesh. DHCP di satelit ${n.name} membuat client bisa mendapat IP dari server yang salah.`,
        solution: 'Matikan DHCP pada satelit mesh.',
      }));
    }
  }
  return out;
}
