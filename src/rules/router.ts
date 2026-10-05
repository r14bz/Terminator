import type { DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import { issue, isStructuredMikrotik } from './common';

/**
 * Router umum. Aturan dokumen: 4A.6 dan 5.3.2 (NAT).
 * Untuk MikroTik terstruktur, NAT dievaluasi di rules/mikrotik.ts dari tabel
 * NAT yang sebenarnya, bukan dari saklar sederhana ini.
 */
export function validateRouterRules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];
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
