import type { DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import { issue } from './common';
import { validateCableConnection } from '../utils/cableCompatibility';

/**
 * Lapisan 1: perangkat, kabel, dan optik.
 * Aturan dokumen: 1.2 (LOS). ID issue dipertahankan agar autoFix tetap bekerja.
 */
export function validatePhysicalRules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];

  for (const n of ctx.nodes) {
    // Perangkat dimatikan pengguna: informasi saja, bukan masalah jaringan.
    if (!n.poweredOn) {
      out.push(issue({
        id: `power-${n.id}`, severity: 'info', layer: 'physical', category: 'physical', targetNodeId: n.id,
        title: `"${n.name}" dalam keadaan mati (Power Off)`,
        cause: `${n.name} dimatikan, jadi tidak ikut dalam jaringan.`,
        solution: 'Nyalakan perangkat bila memang ingin dipakai.',
      }));
    }
    if (n.type === 'ont' && n.poweredOn && n.ontConfig?.ponStatus === 'LOS (No Signal)') {
      out.push(issue({
        id: `ont-los-${n.id}`, ruleRef: '1.2', layer: 'physical', category: 'physical', targetNodeId: n.id,
        title: `ONT "${n.name}" LOS`,
        cause: 'Status PON menunjukkan LOS: tidak ada sinyal optik, jadi ONT tidak punya uplink.',
        solution: 'Periksa jalur fiber dan uplink PON.',
      }));
    }
  }

  for (const c of ctx.cables) {
    const a = ctx.nodes.find((n) => n.id === c.fromNodeId);
    const b = ctx.nodes.find((n) => n.id === c.toNodeId);

    if (c.status === 'broken') {
      out.push(issue({
        id: `broken-${c.id}`, layer: 'physical', category: 'physical', targetCableId: c.id,
        title: 'Link fisik terputus',
        cause: `Kabel ${a?.name ?? '?'} ke ${b?.name ?? '?'} putus, jadi link tidak tersedia.`,
        solution: 'Perbaiki atau ganti kabel.',
      }));
      continue;
    }
    if (!a || !b) continue;

    const compat = validateCableConnection(a, b, c.type);
    if (!compat.allowed) {
      out.push(issue({
        id: `physical-mismatch-${c.id}`, layer: 'physical', category: 'physical', targetCableId: c.id, targetNodeId: compat.incompatibleNodeId,
        title: `Media kabel tidak cocok: ${a.name} ↔ ${b.name}`,
        cause: compat.reason, solution: compat.solutionHint,
      }));
    }

    // HTB harus berpasangan Tipe A dengan Tipe B.
    if (a.type === 'htb' && b.type === 'htb' && a.htbRole && a.htbRole === b.htbRole) {
      out.push(issue({
        id: `htb-mismatch-${c.id}`, layer: 'physical', category: 'physical', targetNodeId: b.id, targetCableId: c.id,
        title: `Pasangan HTB sama-sama Tipe ${a.htbRole}`,
        cause: `${a.name} dan ${b.name} sama-sama Tipe ${a.htbRole}. Media converter WDM harus berpasangan Tipe A dengan Tipe B.`,
        solution: 'Ubah salah satu HTB menjadi tipe lawannya.',
      }));
    }
  }
  return out;
}
