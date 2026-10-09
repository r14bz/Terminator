import type { CableConnection, NetworkNode } from '../types/network';

/**
 * Perangkat yang meneruskan Layer 2 apa adanya, jadi pencarian sumber internet boleh menembusnya.
 * OLT, ODP, ODC, splitter, dan metro sengaja tidak ada di sini: itu sisi hulu ISP, bukan jalur WAN router pelanggan.
 */
const TRANSPARENT = new Set(['switch', 'switch_managed', 'access_point', 'mesh', 'htb']);
const GATEWAYS = new Set(['router', 'mikrotik']);
const OPTICAL_CABLES = ['drop_core', 'distribusi', 'feeder'];

const isActive = (c: CableConnection) => c.status !== 'broken' && c.status !== 'mismatch';

function ontHasOpticalUplink(ont: NetworkNode, cables: readonly CableConnection[]): boolean {
  return ont.ontConfig?.ponStatus !== 'LOS (No Signal)'
    && cables.some((c) => isActive(c) && OPTICAL_CABLES.includes(c.type) && (c.fromNodeId === ont.id || c.toNodeId === ont.id));
}

/**
 * Apakah router atau MikroTik `gateway` punya jalur ke sumber internet? (aturan 4A.11 sampai 4A.13)
 *
 * Sumber yang sah, dicari lewat kabel aktif dari port mana pun:
 * - node Internet atau Sumber Internet yang menyala,
 * - ONT ISP (mode router, uplink optik normal). ONT pelanggan RT/RW yang dial PPPoE ke MikroTik
 *   adalah sisi hilir, jadi TIDAK dihitung,
 * - ONT mode bridge: ditembus ke sisi lain,
 * - router atau MikroTik lain yang punya jalur sendiri (tidak menghitung dirinya sendiri lewat putaran).
 * Pencarian hanya menembus perangkat transparan (switch, AP, mesh, HTB).
 */
export function routerHasInternetPath(
  gateway: NetworkNode,
  nodes: readonly NetworkNode[],
  cables: readonly CableConnection[],
  visited: Set<string> = new Set(),
): boolean {
  if (visited.has(gateway.id)) return false;
  visited.add(gateway.id);
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const seen = new Set<string>([gateway.id]);
  const queue: string[] = [gateway.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of cables) {
      if (!isActive(c) || (c.fromNodeId !== id && c.toNodeId !== id)) continue;
      const oid = c.fromNodeId === id ? c.toNodeId : c.fromNodeId;
      if (seen.has(oid)) continue;
      seen.add(oid);
      const o = byId.get(oid);
      if (!o || !o.poweredOn) continue;
      if (o.type === 'internet' || o.type === 'internet_source') return true;
      if (o.type === 'ont') {
        const cfg = o.ontConfig;
        if (cfg?.wanMode === 'bridge') { queue.push(oid); continue; }
        if (cfg?.pppoeTarget === 'mikrotik') continue;
        if (ontHasOpticalUplink(o, cables)) return true;
        continue;
      }
      if (GATEWAYS.has(o.type)) {
        if (routerHasInternetPath(o, nodes, cables, visited)) return true;
        continue;
      }
      if (TRANSPARENT.has(o.type)) queue.push(oid);
    }
  }
  return false;
}
