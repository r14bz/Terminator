import type { DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import { dhcpEnabled, issue, l2Domains } from './common';

/** DHCP ganda dalam satu domain Layer 2 (aturan 2.3, 4A.9, 4B.4): client mendapat IP acak. */
export function validateDhcpRules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];
  for (const d of l2Domains(ctx.nodes, ctx.cables)) {
    const servers = ctx.nodes.filter((n) => d.has(n.id) && n.poweredOn && dhcpEnabled(n));
    if (servers.length > 1) {
      out.push(issue({
        id: `dhcp-duplicate-${[...d].sort().join('-')}`, severity: 'warning', ruleRef: '4A.9', layer: 'ip', category: 'ip',
        title: 'DHCP ganda pada satu domain Layer 2',
        cause: `Ada ${servers.length} DHCP server aktif dalam jaringan Layer 2 yang sama: ${servers.map((x) => x.name).join(', ')}. Client mendapat IP secara acak dari salah satunya, dan kehilangan internet bila server itu tidak punya jalur keluar.`,
        solution: 'Pastikan hanya DHCP server yang memang dimaksud berada di domain Layer 2 tersebut.',
      }));
    }
  }
  return out;
}
