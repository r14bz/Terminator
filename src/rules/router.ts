import type { DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import { issue, isStructuredMikrotik } from './common';
import { routerHasInternetPath } from '../utils/upstreamInternet';

/**
 * Router umum. Aturan dokumen: 4A.6 dan 5.3.2 (NAT).
 * Untuk MikroTik terstruktur, NAT dievaluasi di rules/mikrotik.ts dari tabel
 * NAT yang sebenarnya, bukan dari saklar sederhana ini.
 */
export function validateRouterRules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];
  // 4A.11: router atau MikroTik yang sudah tersambung ke sesuatu tetapi tidak punya jalur ke sumber internet.
  for (const n of ctx.nodes) {
    if ((n.type !== 'router' && n.type !== 'mikrotik') || !n.poweredOn) continue;
    const wired = ctx.cables.some((c) => c.status !== 'broken' && c.status !== 'mismatch' && (c.fromNodeId === n.id || c.toNodeId === n.id));
    if (!wired || routerHasInternetPath(n, ctx.nodes, ctx.cables)) continue;
    out.push(issue({
      id: `no-uplink-${n.id}`, severity: 'warning', ruleRef: '4A.11', layer: 'route', category: 'topology', targetNodeId: n.id,
      title: `\"${n.name}\" tidak punya jalur ke sumber internet`,
      cause: `${n.name} tidak tersambung ke ONT ISP yang aktif, Sumber Internet, node Internet, atau router lain yang punya internet, jadi client di belakangnya hanya punya jaringan lokal.`,
      solution: 'Hubungkan port WAN ke ONT ISP, Sumber Internet, atau node Internet.',
    }));
  }
  for (const n of ctx.nodes) {
    if (n.type !== 'mikrotik' || !n.mikrotikConfig || isStructuredMikrotik(n)) continue;
    if (n.mikrotikConfig.firewallNat === false) {
      out.push(issue({
        id: `nat-off-${n.id}`, ruleRef: '5.3.2', layer: 'nat', category: 'configuration', targetNodeId: n.id,
        title: `NAT tidak aktif pada "${n.name}"`,
        cause: 'Tidak ada aturan NAT masquerade, jadi client dapat IP tetapi tidak ada internet.',
        solution: 'Aktifkan NAT masquerade pada interface keluar ke ONT ISP.',
      }));
    }
  }
  return out;
}
