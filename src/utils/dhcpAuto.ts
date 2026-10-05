import type { CableConnection, NetworkNode, NodeType } from '../types/network';
import { isSameSubnet, isValidIpv4 } from './ipUtils';
import { l2Domains, dhcpEnabled } from '../rules/common';
import {
  dhcpPoolOf,
  firstFreeHost,
  gatewayAddressOf,
  lanDefaultsFor,
  usedAddresses,
} from './ipAlloc';

/**
 * Perangkat ujung yang secara bawaan menjadi DHCP client. Gateway (ONT,
 * MikroTik), server, dan perangkat infrastruktur tetap memakai IP statis
 * karena merekalah yang dicari klien lain.
 */
export const DHCP_CLIENT_TYPES: readonly NodeType[] = [
  'pc',
  'laptop',
  'printer',
  'voip_phone',
  'cctv',
  'smartphone',
  'iot',
];

/**
 * Memberi alamat kepada setiap DHCP client, otomatis, dari server DHCP yang
 * terhubung dengannya. Dipanggil setiap kali topologi berubah.
 *
 * - Alamat yang sudah sah pada domain Layer-2 dan server terpilih dipertahankan.
 * - Jika ada beberapa DHCP server pada domain yang sama, server dipilih secara
 *   deterministik dari seed, sehingga simulasi dapat direproduksi oleh test.
 * - Mengembalikan array yang sama persis bila tidak ada yang berubah, supaya
 *   pemanggilnya bisa berhenti tanpa render ulang.
 */
export interface DhcpLeaseOptions { seed?: number; }

function seededIndex(key: string, length: number, seed = 0): number {
  if (length <= 1) return 0;
  let h = (seed | 0) ^ 0x9e3779b9;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return Math.abs(h) % length;
}

/**
 * Assign DHCP leases using the same Layer-2 domains as the topology validator.
 * If several DHCP servers are active in one domain, the selected server is
 * deterministic for a given seed, so simulations/tests can reproduce a run.
 */
export function autoAssignDhcpLeases(
  nodes: readonly NetworkNode[],
  cables: readonly CableConnection[],
  options: DhcpLeaseOptions = {},
): readonly NetworkNode[] {
  let working: NetworkNode[] = nodes.slice();
  let changed = false;
  const domains = l2Domains(working, cables);

  for (let i = 0; i < working.length; i++) {
    const node = working[i];
    if (!DHCP_CLIENT_TYPES.includes(node.type) || node.ipConfig?.mode !== 'dhcp' || !node.poweredOn) continue;

    const domain = domains.find(d => d.has(node.id));
    const candidates = domain
      ? working
          .filter(n => domain.has(n.id) && n.id !== node.id && n.poweredOn && dhcpEnabled(n))
          .sort((a, b) => a.id.localeCompare(b.id))
      : [];

    if (!candidates.length) {
      // Server DHCP sengaja dimatikan: lease dicabut. Server yang hanya sedang
      // Power Off: client mempertahankan lease terakhir sampai masa sewanya habis.
      const serverIsOff = !!domain && working.some(n => domain.has(n.id) && n.id !== node.id && !n.poweredOn && dhcpEnabled(n));
      if (serverIsOff && node.ipConfig.ip) continue;
      const next = { ...node, ipConfig: { ...node.ipConfig, mode: 'dhcp' as const, ip: '' } };
      if (next.ipConfig.ip !== node.ipConfig.ip) { working[i] = next; changed = true; }
      continue;
    }

    const gateway = candidates[seededIndex(node.id, candidates.length, options.seed)];
    const current = node.ipConfig.ip || '';
    const defaults = lanDefaultsFor(gateway);
    const others = working.filter(n => n.id !== node.id && domain?.has(n.id));
    const used = usedAddresses(others);
    const gwIp = gatewayAddressOf(gateway);
    if (gwIp) used.add(gwIp);

    const currentIsValid = current !== '' && current !== '0.0.0.0' && isValidIpv4(current) && gwIp !== null && isSameSubnet(current, gwIp, defaults.subnet) && !used.has(current);
    const pool = dhcpPoolOf(gateway);
    const ip = currentIsValid ? current : ((pool && firstFreeHost(pool, used)) || '');
    const nextConfig = { ...node.ipConfig, mode: 'dhcp' as const, ip, subnet: defaults.subnet, gateway: defaults.gateway };
    if (nextConfig.ip !== node.ipConfig.ip || nextConfig.subnet !== node.ipConfig.subnet || nextConfig.gateway !== node.ipConfig.gateway) {
      working[i] = { ...node, ipConfig: nextConfig };
      changed = true;
    }
  }
  return changed ? working : nodes;
}
