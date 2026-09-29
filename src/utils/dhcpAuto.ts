import type { CableConnection, NetworkNode, NodeType } from '../types/network';
import { findUpstreamGateway, isSameSubnet, isValidIpv4 } from './ipUtils';
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

/** Apakah gateway ini benar-benar membagikan alamat lewat DHCP. */
export function isDhcpServiceAvailable(gateway: NetworkNode): boolean {
  if (gateway.type === 'ont') {
    if (gateway.ontConfig?.wanMode === 'bridge') return false;
    if (gateway.ontConfig?.dhcpServerEnabled === false) return false;
    if (
      gateway.ontConfig?.dhcpServerEnabled === undefined &&
      gateway.ipConfig?.isDhcpServerEnabled === false
    ) {
      return false;
    }
    return true;
  }
  if (gateway.type === 'mikrotik') {
    return gateway.ipConfig?.isDhcpServerEnabled !== false;
  }
  return true;
}

/**
 * Memberi alamat kepada setiap DHCP client, otomatis, dari server DHCP yang
 * terhubung dengannya. Dipanggil setiap kali topologi berubah.
 *
 * - Alamat yang sudah sah (valid, satu subnet dengan gateway, tidak dipakai
 *   yang lain) dipertahankan, jadi lease tidak berpindah-pindah.
 * - Tidak ada gateway, atau server DHCP mati / ONT mode bridge: alamat
 *   dikosongkan (APIPA), sama seperti perangkat sungguhan.
 * - Mengembalikan array yang sama persis bila tidak ada yang berubah, supaya
 *   pemanggilnya bisa berhenti tanpa render ulang.
 */
export function autoAssignDhcpLeases(
  nodes: readonly NetworkNode[],
  cables: readonly CableConnection[],
): readonly NetworkNode[] {
  let working: NetworkNode[] = nodes.slice();
  let changed = false;

  for (let i = 0; i < working.length; i++) {
    const node = working[i];
    if (!DHCP_CLIENT_TYPES.includes(node.type)) continue;
    if (node.ipConfig?.mode !== 'dhcp') continue;
    if (!node.poweredOn) continue;

    const gateway = findUpstreamGateway(node, working, cables);
    const current = node.ipConfig.ip || '';

    let ip = '';
    let defaults: { gateway: string; subnet: string } | null = null;

    if (gateway && gateway.poweredOn && isDhcpServiceAvailable(gateway)) {
      defaults = lanDefaultsFor(gateway);
      const others = working.filter((n) => n.id !== node.id);
      const used = usedAddresses(others);
      const gwIp = gatewayAddressOf(gateway);
      if (gwIp) used.add(gwIp);

      const currentIsValid =
        current !== '' &&
        current !== '0.0.0.0' &&
        isValidIpv4(current) &&
        gwIp !== null &&
        isSameSubnet(current, gwIp, defaults.subnet) &&
        !used.has(current);

      if (currentIsValid) {
        ip = current;
      } else {
        const pool = dhcpPoolOf(gateway);
        ip = (pool && firstFreeHost(pool, used)) || '';
      }
    } else if (gateway && !gateway.poweredOn) {
      // Server sedang mati: klien mempertahankan lease terakhirnya.
      continue;
    }

    const nextConfig = {
      ...node.ipConfig,
      mode: 'dhcp' as const,
      ip,
      ...(defaults ? { subnet: defaults.subnet, gateway: defaults.gateway } : {}),
    };

    const same =
      nextConfig.ip === node.ipConfig.ip &&
      nextConfig.subnet === node.ipConfig.subnet &&
      nextConfig.gateway === node.ipConfig.gateway;
    if (same) continue;

    working[i] = { ...node, ipConfig: nextConfig };
    changed = true;
  }

  return changed ? working : nodes;
}
