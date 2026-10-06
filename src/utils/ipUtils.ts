import type { NetworkNode, CableConnection } from '../types/network';

/**
 * Single source of truth for IPv4 validation.
 *
 * This used to be duplicated in `ipCalculator.ts` with a laxer rule that
 * accepted leading zeros ("010.1.1.1"), so the same address could validate in
 * one feature and fail in another. The strict rule below is now canonical:
 * every octet must be a bare decimal integer with no padding, sign, exponent
 * or whitespace, which is what RFC 3986 dec-octet and every real parser expect.
 *
 * Defensive against non-string input on purpose: topology JSON is imported
 * through an `any`-typed handler, so `ip: 12345` must return false rather than
 * throw on `.trim()`.
 */
export function isValidIpv4(ip: unknown): ip is string {
  if (typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (p.length === 0 || p.length > 3) return false;
    if (!/^\d+$/.test(p)) return false; // rejects '+1', '1e2', ' 1', '-0'
    // Reject leading zeros outright: "010" must never silently mean 10, since
    // that ambiguity is exactly what made the old duplicate disagree.
    if (p.length > 1 && p[0] === '0') return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

/**
 * Convert IPv4 string to 32-bit unsigned integer.
 * Returns 0 for anything `isValidIpv4` rejects, so callers never propagate NaN.
 */
export function ipToNumber(ip: string): number {
  if (!isValidIpv4(ip)) return 0;
  return ip
    .trim()
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0) >>> 0;
}

/**
 * Number of leading 1 bits in a dotted-quad mask. Only meaningful for
 * contiguous masks; returns 0 for a non-contiguous mask such as 255.0.255.0
 * rather than silently reporting a wrong prefix length.
 */
export function maskToPrefixLength(mask: string): number {
  if (!isValidIpv4(mask)) return 0;
  const int = ipToNumber(mask);
  // A contiguous mask leaves host bits of the form 2^k - 1, which is exactly
  // the numbers z where (z & (z + 1)) === 0. A mask like 255.0.255.0 has
  // z = 0x00FF00FF and fails this, so it is rejected instead of masquerading
  // as the /8 its leading 1-bits would suggest.
  const hostBits = ~int >>> 0;
  if ((hostBits & (hostBits + 1)) !== 0) return 0;
  let bits = 0;
  for (let i = 31; i >= 0; i--) {
    if ((int & (1 << i)) !== 0) bits++;
  }
  return bits;
}

/**
 * Checks if two IP addresses are in the same subnet given a subnet mask.
 *
 * `&` coerces to int32, but both operands wrap identically so the low 32 bits
 * — the only ones that matter — compare correctly even for 192.x addresses.
 */
export function isSameSubnet(ip1: string, ip2: string, mask: string = '255.255.255.0'): boolean {
  if (!isValidIpv4(ip1) || !isValidIpv4(ip2) || !isValidIpv4(mask)) return false;
  const num1 = ipToNumber(ip1);
  const num2 = ipToNumber(ip2);
  const numMask = ipToNumber(mask);
  return (num1 & numMask) === (num2 & numMask);
}

/**
 * Trace through every physical link -- LAN, Wireless, Coaxial, and the fiber
 * legs (feeder/distribusi/drop_core) -- through switches, splitters (ODC/ODP),
 * and media converters (HTB) to find the upstream Layer 3 Gateway / Router
 * (e.g. ONT, MikroTik, or Router).
 *
 * The medium filter used to stop at `['lan', 'wireless', 'coaxial']`, which
 * excludes every fiber cable type. That is correct for the link *into* a
 * router/ONT (BFS already returns as soon as it reaches one, without needing
 * to look at its far side), but wrong for anything upstream of it: an HTB
 * media-converter pair is a pure Layer 1 device connected to its partner by a
 * `drop_core` fiber cable, so a client sitting behind
 * switch -> HTB-B -> (fiber) -> HTB-A -> router had its BFS die at HTB-B --
 * the very next hop was the one type of cable this function refused to cross.
 * `findUpstreamGateway` returned null for a client that was, physically,
 * completely wired up, and every IP/gateway/subnet check downstream of it
 * (Check 9 in diagnosticEngine, and `checkInternetAccess` below) silently
 * skipped that client instead of validating its configuration -- so a wrong
 * IP behind an HTB link never got flagged, and a correct one was reported as
 * having no route out. This reproduces on the shipped "RT/RW-Net Media
 * Converter (HTB)" template itself, not just a hand-built topology.
 *
 * No other node type in this app performs Layer 3 routing, so every non
 * router/ONT/MikroTik node (switch, HTB, ODC, ODP, OLT, splitter, or a leaf
 * client) is correctly transparent to this walk regardless of which medium
 * connects it to its neighbour.
 */
/**
 * Searches for a powered-on router (MikroTik or Router) connected to an ONT in bridge mode,
 * traversing through Layer 1 / Layer 2 devices (HTB media converters, Ethernet switches).
 */
export function findRouterConnectedToBridge(
  ontNode: NetworkNode,
  allNodes: readonly NetworkNode[],
  allCables: readonly CableConnection[]
): NetworkNode | null {
  const visited = new Set<string>();
  const queue: string[] = [ontNode.id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentNode = allNodes.find((n) => n.id === currentId);
    if (!currentNode) continue;

    if (currentId !== ontNode.id) {
      if (['mikrotik', 'router'].includes(currentNode.type)) {
        if (currentNode.poweredOn) {
          return currentNode;
        }
      }
      // Aturan 2.1: ONT lain yang online (mode router/PPPoE, sinyal optik normal) di belakang
      // bridge menjadi gateway Layer 3 yang sebenarnya, jadi client mendapat internet darinya.
      if (
        currentNode.type === 'ont' &&
        currentNode.poweredOn &&
        currentNode.ontConfig?.wanMode !== 'bridge' &&
        !(currentNode.ontConfig?.ponStatus ?? '').toUpperCase().startsWith('LOS')
      ) {
        return currentNode;
      }
      // Only traverse through Layer 1 / Layer 2 transparent bridge devices
      if (!['switch', 'switch_managed', 'ap_ptp', 'htb'].includes(currentNode.type)) {
        continue;
      }
    }

    const connectedCables = allCables.filter(
      (c) =>
        c.status !== 'broken' &&
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

export function findUpstreamGateway(
  startNode: NetworkNode,
  allNodes: readonly NetworkNode[],
  allCables: readonly CableConnection[]
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
      // If we reached an ONT in bridge mode, and a powered-on router exists behind it,
      // the true Layer 3 gateway for this host is that router!
      if (currentNode.type === 'ont' && currentNode.ontConfig?.wanMode === 'bridge') {
        const secondary = findRouterConnectedToBridge(currentNode, allNodes, allCables);
        if (secondary && secondary.poweredOn) {
          return secondary;
        }
      }
      return currentNode;
    }

    // Find all directly connected, non-broken cables of any physical medium.
    const connectedCables = allCables.filter(
      (c) =>
        c.status !== 'broken' &&
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
  allNodes: readonly NetworkNode[],
  allCables: readonly CableConnection[]
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
      const connectedRouter = findRouterConnectedToBridge(node, allNodes, allCables);
      const hasDirectFiberUplink = allCables.some(
        (c) =>
          c.status !== 'broken' &&
          ['drop_core', 'distribusi', 'feeder'].includes(c.type) &&
          (c.fromNodeId === node.id || c.toNodeId === node.id)
      );

      // If the ONT is deployed on the LAN side of a router (e.g. via HTB or LAN without direct ISP fiber),
      // and connected to an active router that has internet:
      if (!hasDirectFiberUplink && connectedRouter && connectedRouter.poweredOn) {
        const routerAccess = checkInternetAccess(connectedRouter, allNodes, allCables);
        if (routerAccess.hasInternet) {
          return {
            hasInternet: true,
            gatewayNode: connectedRouter,
          };
        }
      }

      return {
        hasInternet: false,
        reason: 'ONT berada dalam Mode Bridge (Layer 2). ONT tidak melakukan dial PPPoE atau routing internet.',
        gatewayNode: connectedRouter || null,
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

  const activeGateway =
    upstreamGateway.type === 'ont' && upstreamGateway.ontConfig?.wanMode === 'bridge'
      ? findRouterConnectedToBridge(upstreamGateway, allNodes, allCables) || upstreamGateway
      : upstreamGateway;

  const routerLanIp =
    activeGateway.type === 'ont'
      ? activeGateway.ontConfig?.lanIp || activeGateway.ipConfig?.ip || '192.168.1.1'
      : activeGateway.ipConfig?.ip || '192.168.88.1';
  const routerSubnet =
    activeGateway.type === 'ont'
      ? activeGateway.ontConfig?.lanSubnet || activeGateway.ipConfig?.subnet || '255.255.255.0'
      : activeGateway.ipConfig?.subnet || '255.255.255.0';

  // 1. Check if upstream is ONT in Bridge Mode!
  if (upstreamGateway.type === 'ont') {
    if (upstreamGateway.ontConfig?.wanMode === 'bridge') {
      // Check if there is a MikroTik router connected to this ONT that acts as PPPoE dialer
      const secondaryRouter = findRouterConnectedToBridge(upstreamGateway, allNodes, allCables);
      const hasSecondaryRouter = Boolean(secondaryRouter && secondaryRouter.poweredOn);

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
  if (activeGateway.type === 'mikrotik') {
    if (!activeGateway.mikrotikConfig?.firewallNat) {
      return {
        hasInternet: false,
        reason: `NAT Masquerade pada MikroTik (${activeGateway.name}) tidak aktif. Paket LAN tidak bisa keluar ke internet.`,
        gatewayNode: activeGateway,
      };
    }
    if (node.ipConfig?.mode === 'dhcp' && activeGateway.ipConfig?.isDhcpServerEnabled === false) {
      return {
        hasInternet: false,
        reason: `DHCP Server pada MikroTik (${activeGateway.name}) dimatikan.`,
        gatewayNode: activeGateway,
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

/**
 * The single address a node is reachable at, in preference order: the routed
 * interface address, then the ONT's LAN address. TerminalModal matches incoming
 * pings against this and the canvas ping tool fills it in, so both sides have
 * to agree -- hence one function instead of two inline `||` chains.
 */
export function addressOf(node: {
  ipConfig?: { ip?: string };
  ontConfig?: { lanIp?: string };
}): string | undefined {
  return node.ipConfig?.ip || node.ontConfig?.lanIp;
}

/**
 * Resolve a pinged address back to the node that owns it.
 *
 * Uses the same {@link addressOf} the ping tool fills its pre-filled command
 * from, so the two can never disagree about what a node's address is. The
 * 8.8.8.8 fallback stands in for the internet node, which owns no address of
 * its own but is what a technician means by pinging "the outside".
 */
export function findNodeByAddress<
  T extends { id: string; type: string; ipConfig?: { ip?: string }; ontConfig?: { lanIp?: string } },
>(nodes: readonly T[], ip: string): T | undefined {
  const owner = nodes.find((n) => addressOf(n) === ip);
  if (owner) return owner;
  if (ip === '8.8.8.8' || ip === '1.1.1.1') {
    return nodes.find((n) => n.type === 'internet');
  }
  return undefined;
}
