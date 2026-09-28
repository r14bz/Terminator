import type { NetworkNode } from '../types/network';
import { isValidIpv4 } from './ipUtils';

export interface AddressPool {
  prefix: string;
  start: number;
  end: number;
}

export const FALLBACK_LAN: AddressPool = {
  prefix: '192.168.1.',
  start: 100,
  end: 254,
};

export const FALLBACK_LAN_GATEWAY = '192.168.1.1';

export function dhcpPoolOf(gateway: NetworkNode | null | undefined): AddressPool | null {
  if (!gateway) return null;
  const lanIp = gateway.ipConfig?.ip || gateway.ontConfig?.lanIp;
  if (!lanIp || !isValidIpv4(lanIp) || lanIp === '0.0.0.0') return null;

  const lanParts = lanIp.split('.');
  const defaultPrefix = `${lanParts[0]}.${lanParts[1]}.${lanParts[2]}.`;

  const isOnt = gateway.type === 'ont';
  const rangeStart = isOnt ? gateway.ontConfig?.dhcpPoolStart : gateway.ipConfig?.dhcpRangeStart;
  const rangeEnd = isOnt ? gateway.ontConfig?.dhcpPoolEnd : gateway.ipConfig?.dhcpRangeEnd;

  if (rangeStart && rangeEnd) {
    if (!isValidIpv4(rangeStart) || !isValidIpv4(rangeEnd)) return null;
    const startParts = rangeStart.split('.');
    const endParts = rangeEnd.split('.');
    const startPrefix = `${startParts[0]}.${startParts[1]}.${startParts[2]}.`;
    const endPrefix = `${endParts[0]}.${endParts[1]}.${endParts[2]}.`;

    if (startPrefix !== endPrefix || startPrefix !== defaultPrefix) {
      return null;
    }

    const start = parseInt(startParts[3], 10);
    const end = parseInt(endParts[3], 10);
    if (start >= 1 && end <= 254 && start <= end) {
      return { prefix: startPrefix, start, end };
    }
    return null;
  }

  return { prefix: defaultPrefix, start: 100, end: 254 };
}

export function firstFreeHost(
  pool: AddressPool,
  used: ReadonlySet<string>,
  keep?: string,
): string | null {
  for (let host = pool.start; host <= pool.end; host++) {
    const candidate = `${pool.prefix}${host}`;
    if (used.has(candidate) && candidate !== keep) continue;
    return candidate;
  }
  return null;
}

export function usedAddresses(nodes: readonly NetworkNode[]): Set<string> {
  const used = new Set<string>();
  for (const node of nodes) {
    const ip = node.ipConfig?.ip || node.ontConfig?.lanIp;
    if (ip && ip !== '0.0.0.0' && isValidIpv4(ip)) {
      used.add(ip);
    }
  }
  return used;
}

export function gatewayAddressOf(node: NetworkNode | null | undefined): string | null {
  if (!node) return null;
  const ip = node.ipConfig?.ip || node.ontConfig?.lanIp;
  if (ip && ip !== '0.0.0.0' && isValidIpv4(ip)) {
    return ip;
  }
  return null;
}

export function allocateDhcpLease(
  gateway: NetworkNode | null | undefined,
  nodes: readonly NetworkNode[],
  forNodeId?: string,
): string | null {
  if (!gateway) return null;
  const pool = dhcpPoolOf(gateway);
  if (!pool) return null;

  const target = forNodeId ? nodes.find((n) => n.id === forNodeId) : undefined;
  const keep = target ? (target.ipConfig?.ip || target.ontConfig?.lanIp) : undefined;

  const used = usedAddresses(nodes);
  const gwIp = gatewayAddressOf(gateway);
  if (gwIp) used.add(gwIp);

  return firstFreeHost(pool, used, keep);
}

export function allocateStaticHost(
  gateway: NetworkNode | null | undefined,
  nodes: readonly NetworkNode[],
): string | null {
  const pool = gateway ? dhcpPoolOf(gateway) : FALLBACK_LAN;
  if (!pool) return null;

  const used = usedAddresses(nodes);
  if (gateway) {
    const gwIp = gatewayAddressOf(gateway);
    if (gwIp) used.add(gwIp);
  }

  return firstFreeHost(pool, used);
}

export function primaryGateway(nodes: readonly NetworkNode[]): NetworkNode | null {
  for (const node of nodes) {
    if (
      (node.type === 'ont' || node.type === 'mikrotik' || node.type === 'router') &&
      gatewayAddressOf(node) !== null
    ) {
      return node;
    }
  }
  return null;
}

export function lanDefaultsFor(
  gateway: NetworkNode | null | undefined,
): { gateway: string; subnet: string } {
  if (!gateway) {
    return { gateway: FALLBACK_LAN_GATEWAY, subnet: '255.255.255.0' };
  }
  const gwAddress = gatewayAddressOf(gateway) ?? FALLBACK_LAN_GATEWAY;
  let subnet = gateway.ipConfig?.subnet;
  if (!subnet || !isValidIpv4(subnet)) {
    subnet = '255.255.255.0';
  }
  return { gateway: gwAddress, subnet };
}
