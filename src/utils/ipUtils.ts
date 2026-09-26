import { NetworkNode, CableConnection } from '../types/network';

/**
 * Validates IPv4 address string (e.g. 192.168.1.1)
 */
export function isValidIpv4(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && p === String(n);
  });
}

/**
 * Convert IPv4 string to 32-bit unsigned integer
 */
export function ipToNumber(ip: string): number {
  return (
    ip
      .trim()
      .split('.')
      .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0) >>> 0
  );
}

/**
 * Checks if two IP addresses are in the same subnet given a subnet mask
 */
export function isSameSubnet(ip1: string, ip2: string, mask: string = '255.255.255.0'): boolean {
  if (!isValidIpv4(ip1) || !isValidIpv4(ip2) || !isValidIpv4(mask)) return false;
  const num1 = ipToNumber(ip1);
  const num2 = ipToNumber(ip2);
  const numMask = ipToNumber(mask);
  return (num1 & numMask) === (num2 & numMask);
}

/**
 * Trace through physical connections (LAN, Wireless) through switches, media converters, and mesh
 * to find the upstream Layer 3 Gateway / Router (e.g. ONT, MikroTik, or Router)
 */
export function findUpstreamGateway(
  startNode: NetworkNode,
  allNodes: NetworkNode[],
  allCables: CableConnection[]
): NetworkNode | null {
  const visited = new Set<string>();
  const queue: string[] = [startNode.id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentNode = allNodes.find((n) => n.id === currentId);
    if (!currentNode) continue;

    // If we reached a router/gateway (ONT, MikroTik, Router) and it's not the startNode itself
    if (
      currentId !== startNode.id &&
      ['ont', 'mikrotik', 'router'].includes(currentNode.type)
    ) {
      return currentNode;
    }

    // Find all directly connected active cables (LAN, Wireless, or HTB)
    const connectedCables = allCables.filter(
      (c) =>
        c.status !== 'broken' &&
        ['lan', 'wireless', 'coaxial'].includes(c.type) &&
        (c.fromNodeId === currentId || c.toNodeId === currentId)
    );

    for (const cable of connectedCables) {
      const neighborId = cable.fromNodeId === currentId ? cable.toNodeId : cable.fromNodeId;
      if (!visited.has(neighborId)) {
        queue.push(neighborId);
      }
    }
  }

  return null;
}

export interface InternetAccessStatus {
  hasInternet: boolean;
  reason?: string;
  gatewayNode?: NetworkNode | null;
}

/**
 * Validates whether a device has real end-to-end Layer 3 Internet access
 * accounting for ONT Bridge Mode, DHCP Server status, NAT Masquerade, and IP subnet/gateway validity.
 */
export function checkInternetAccess(
  node: NetworkNode,
  allNodes: NetworkNode[],
  allCables: CableConnection[]
): InternetAccessStatus {
  if (!node.poweredOn) {
    return { hasInternet: false, reason: 'Perangkat dalam keadaan mati (Power Off).' };
  }

  if (node.type === 'internet') {
    return { hasInternet: true };
  }

  // If node is an ONT itself
  if (node.type === 'ont') {
    if (node.ontConfig?.wanMode === 'bridge') {
      return {
        hasInternet: false,
        reason: 'ONT berada dalam Mode Bridge (Layer 2). ONT tidak melakukan dial PPPoE atau routing internet.',
      };
    }
    const hasOpticalUplink = allCables.some(
      (c) =>
        c.status !== 'broken' &&
        ['drop_core', 'distribusi', 'feeder'].includes(c.type) &&
        (c.fromNodeId === node.id || c.toNodeId === node.id)
    );
    if (!hasOpticalUplink) {
      return { hasInternet: false, reason: 'Kabel optik belum terhubung ke ODP/OLT.' };
    }
    return { hasInternet: true };
  }

  // If node is MikroTik
  if (node.type === 'mikrotik') {
    if (!node.mikrotikConfig?.firewallNat) {
      return { hasInternet: false, reason: 'Firewall NAT Masquerade pada MikroTik belum diaktifkan.' };
    }
    return { hasInternet: true };
  }

  // If node is a client (PC, CCTV, Smartphone, IoT, Server)
  const upstreamGateway = findUpstreamGateway(node, allNodes, allCables);
  if (!upstreamGateway || !upstreamGateway.poweredOn) {
    return {
      hasInternet: false,
      reason: 'Tidak terhubung ke router gateway (ONT/MikroTik) yang aktif.',
      gatewayNode: null,
    };
  }

  const routerLanIp =
    upstreamGateway.type === 'ont'
      ? upstreamGateway.ontConfig?.lanIp || upstreamGateway.ipConfig?.ip || '192.168.1.1'
      : upstreamGateway.ipConfig?.ip || '192.168.88.1';
  const routerSubnet =
    upstreamGateway.type === 'ont'
      ? upstreamGateway.ontConfig?.lanSubnet || upstreamGateway.ipConfig?.subnet || '255.255.255.0'
      : upstreamGateway.ipConfig?.subnet || '255.255.255.0';

  // 1. Check if upstream is ONT in Bridge Mode!
  if (upstreamGateway.type === 'ont') {
    if (upstreamGateway.ontConfig?.wanMode === 'bridge') {
      // Check if there is a MikroTik router connected to this ONT that acts as PPPoE dialer
      const hasSecondaryRouter = allCables.some((c) => {
        if (c.status === 'broken' || c.type !== 'lan') return false;
        const otherId = c.fromNodeId === upstreamGateway.id ? c.toNodeId : c.fromNodeId;
        const otherNode = allNodes.find((n) => n.id === otherId);
        return otherNode?.type === 'mikrotik' && otherNode.poweredOn;
      });

      if (!hasSecondaryRouter) {
        return {
          hasInternet: false,
          reason: `ONT (${upstreamGateway.name}) berada dalam Mode Bridge (Layer 2). ONT tidak melakukan routing IP atau NAT, dan DHCP dimatikan. Klien tidak bisa mengakses internet tanpa router PPPoE (seperti MikroTik)!`,
          gatewayNode: upstreamGateway,
        };
      }
    }

    // 2. Check if client is in DHCP mode, but ONT DHCP server is disabled!
    if (node.ipConfig?.mode === 'dhcp') {
      const isDhcpServerOff =
        upstreamGateway.ontConfig?.dhcpServerEnabled === false ||
        (upstreamGateway.ipConfig?.isDhcpServerEnabled === false && upstreamGateway.ontConfig?.dhcpServerEnabled === undefined);
      if (isDhcpServerOff) {
        return {
          hasInternet: false,
          reason: `DHCP Server pada ONT (${upstreamGateway.name}) dimatikan. Perangkat tidak memperoleh alamat IP (APIPA 169.254.x.x).`,
          gatewayNode: upstreamGateway,
        };
      }
    }
  }

  // 3. If upstream is MikroTik
  if (upstreamGateway.type === 'mikrotik') {
    if (!upstreamGateway.mikrotikConfig?.firewallNat) {
      return {
        hasInternet: false,
        reason: `NAT Masquerade pada MikroTik (${upstreamGateway.name}) tidak aktif. Paket LAN tidak bisa keluar ke internet.`,
        gatewayNode: upstreamGateway,
      };
    }
    if (node.ipConfig?.mode === 'dhcp' && upstreamGateway.ipConfig?.isDhcpServerEnabled === false) {
      return {
        hasInternet: false,
        reason: `DHCP Server pada MikroTik (${upstreamGateway.name}) dimatikan.`,
        gatewayNode: upstreamGateway,
      };
    }
  }

  // 4. Check client static IP & Gateway configuration
  if (node.ipConfig?.mode === 'static') {
    if (!node.ipConfig.gateway || node.ipConfig.gateway === '0.0.0.0') {
      return {
        hasInternet: false,
        reason: 'Default Gateway kosong. Perangkat tidak memiliki rute keluar menuju internet.',
        gatewayNode: upstreamGateway,
      };
    }
    if (!isSameSubnet(node.ipConfig.ip, node.ipConfig.gateway, node.ipConfig.subnet || '255.255.255.0')) {
      return {
        hasInternet: false,
        reason: `Subnet Gateway (${node.ipConfig.gateway}) tidak cocok dengan IP Host (${node.ipConfig.ip}).`,
        gatewayNode: upstreamGateway,
      };
    }
    if (node.ipConfig.gateway !== routerLanIp) {
      return {
        hasInternet: false,
        reason: `Default Gateway (${node.ipConfig.gateway}) tidak cocok dengan IP router (${routerLanIp}).`,
        gatewayNode: upstreamGateway,
      };
    }
    if (!isSameSubnet(node.ipConfig.ip, routerLanIp, routerSubnet)) {
      return {
        hasInternet: false,
        reason: `IP Host (${node.ipConfig.ip}) berada di luar subnet router (${routerLanIp} / ${routerSubnet}).`,
        gatewayNode: upstreamGateway,
      };
    }
  }

  return { hasInternet: true, gatewayNode: upstreamGateway };
}
