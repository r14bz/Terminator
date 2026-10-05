import type { DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import { dhcpEnabled, issue } from './common';

/** ONT. Aturan dokumen: 2.5 (bridge + DHCP ONT aktif) dan kredensial PPPoE. */
export function validateOntRules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];
  for (const n of ctx.nodes.filter((x) => x.type === 'ont' && x.poweredOn)) {
    const cfg = n.ontConfig;
    if (cfg?.wanMode === 'bridge' && dhcpEnabled(n)) {
      out.push(issue({
        id: `ont-bridge-dhcp-${n.id}`, ruleRef: '2.5', layer: 'ip', category: 'configuration', targetNodeId: n.id,
        title: 'DHCP ONT aktif pada WAN bridge',
        cause: `ONT ${n.name} memakai bridge tetapi DHCP ONT masih aktif, jadi client mengambil IP dari ONT dan melewati MikroTik (termasuk voucher).`,
        solution: 'Matikan DHCP ONT untuk SSID atau port yang memakai WAN bridge.',
      }));
    }
    if (cfg?.wanMode === 'pppoe' && !cfg.pppoeUsername) {
      out.push(issue({
        id: `ont-pppoe-credentials-${n.id}`, layer: 'service', category: 'configuration', targetNodeId: n.id,
        title: 'PPPoE ONT belum memiliki username',
        cause: 'Mode PPPoE dipilih tetapi username belum diisi, jadi sesi PPPoE tidak bisa tersambung.',
        solution: 'Isi kredensial PPPoE yang benar.',
      }));
    }
  }
  return out;
}
