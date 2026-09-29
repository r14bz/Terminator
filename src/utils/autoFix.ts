/**
 * Deterministic auto-repair for a subset of `DiagnosticIssue`s.
 *
 * Scope, deliberately narrow: an issue is only made fixable here when the
 * correct new value is unambiguous from the topology itself -- the same
 * reasoning `runNetworkDiagnostics` already used to write that issue's own
 * `solution` text. Anything that needs a human judgment call (which VLAN ID
 * is "right" when two access ports disagree, how to shorten a run that
 * exceeds the LAN cable limit, which splitter to remove from an
 * over-attenuated PON leg) is left for the technician; only the checks whose
 * solution is a single, derivable value get a handler below.
 *
 * Pure and React-free like the rest of `utils/`, so it can be driven from a
 * plain node test the same way `diagnosticEngine.ts` is.
 */
import type { CableConnection, DiagnosticIssue, NetworkNode } from '../types/network';
import { addressOf, findUpstreamGateway, isValidIpv4 } from './ipUtils';
import { allocateStaticHost, lanDefaultsFor, usedAddresses, firstFreeHost, dhcpPoolOf, FALLBACK_LAN } from './ipAlloc';
import { nodeSupportsMedium } from './cableCompatibility';
import { reconcilePorts } from './portReconcile';

export interface AutoFixResult {
  nodes: NetworkNode[];
  cables: CableConnection[];
  /** One short line describing what changed, shown to the technician after the fix runs. */
  summary: string;
}

/** The LAN address a gateway node answers on, the same precedence diagnosticEngine uses for `routerLanIp`. */
function routerLanIp(gateway: NetworkNode): string {
  return gateway.type === 'ont'
    ? gateway.ontConfig?.lanIp || gateway.ipConfig?.ip || '192.168.1.1'
    : gateway.ipConfig?.ip || '192.168.88.1';
}

/** The LAN subnet mask a gateway node serves, mirroring `routerSubnet` in diagnosticEngine. */
function routerSubnetOf(gateway: NetworkNode): string {
  return gateway.type === 'ont'
    ? gateway.ontConfig?.lanSubnet || gateway.ipConfig?.subnet || '255.255.255.0'
    : gateway.ipConfig?.subnet || '255.255.255.0';
}

function replaceNode(nodes: NetworkNode[], nodeId: string, patch: (n: NetworkNode) => NetworkNode): NetworkNode[] {
  return nodes.map((n) => (n.id === nodeId ? patch(n) : n));
}

/** A free static address on `gateway`'s LAN that isn't `node`'s own current one, so reassigning never "frees" an address the node still uses a moment later. */
function freeHostOn(gateway: NetworkNode | null, nodes: readonly NetworkNode[]): string | null {
  const pool = gateway ? dhcpPoolOf(gateway) : FALLBACK_LAN;
  if (!pool) return null;
  return firstFreeHost(pool, usedAddresses(nodes));
}

type FixHandler = (issue: DiagnosticIssue, nodes: NetworkNode[], cables: CableConnection[]) => AutoFixResult | null;

// Rough "who is upstream" ranking for the vlan-mismatch handler below: when
// two directly-wired Access-mode ports disagree on VLAN ID, the more
// infrastructure-like side (switch/router/gateway) is treated as authoritative
// and the client-ish side is the one that gets moved onto it. Ties (e.g. two
// plain clients) fall back to leaving `fromNode` alone and moving `toNode`,
// mirroring how the diagnostic itself is anchored on `fromNode`.
const VLAN_AUTHORITY_RANK: Partial<Record<NetworkNode['type'], number>> = {
  mikrotik: 3,
  switch_managed: 3,
  router: 3,
  switch: 2,
  olt: 2,
  ont: 2,
};

const handlers: Array<{ prefix: string; run: FixHandler }> = [
  // Check 12-A: two directly-wired Access-mode ports tagged with different
  // VLAN IDs. Bring the lower-authority side onto the other's VLAN, the same
  // move the issue's own `solution` text already recommends ("Samakan VLAN
  // ID pada kedua perangkat").
  {
    prefix: 'vlan-mismatch-',
    run: (issue, nodes, cables) => {
      if (!issue.targetCableId) return null;
      const cable = cables.find((c) => c.id === issue.targetCableId);
      if (!cable) return null;
      const fromNode = nodes.find((n) => n.id === cable.fromNodeId);
      const toNode = nodes.find((n) => n.id === cable.toNodeId);
      if (!fromNode?.vlanConfig?.enabled || !toNode?.vlanConfig?.enabled) return null;
      if (fromNode.vlanConfig.mode !== 'access' || toNode.vlanConfig.mode !== 'access') return null;
      if (fromNode.vlanConfig.vlanId === toNode.vlanConfig.vlanId) return null;

      const fromRank = VLAN_AUTHORITY_RANK[fromNode.type] ?? 0;
      const toRank = VLAN_AUTHORITY_RANK[toNode.type] ?? 0;
      // Higher rank keeps its VLAN; on a tie, `toNode` is the one that moves.
      const [authority, follower] = fromRank >= toRank ? [fromNode, toNode] : [toNode, fromNode];

      return {
        nodes: replaceNode(nodes, follower.id, (n) => ({
          ...n,
          vlanConfig: {
            ...n.vlanConfig!,
            vlanId: authority.vlanConfig!.vlanId,
            vlanName: authority.vlanConfig!.vlanName,
          },
        })),
        cables,
        summary: `${follower.name} disamakan ke VLAN ${authority.vlanConfig!.vlanId} (${authority.vlanConfig!.vlanName || 'mengikuti ' + authority.name}).`,
      };
    },
  },
  // Check 1: powered-off device.
  {
    prefix: 'power-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const target = nodes.find((n) => n.id === issue.targetNodeId);
      if (!target) return null;
      return {
        nodes: replaceNode(nodes, target.id, (n) => ({ ...n, poweredOn: true })),
        cables,
        summary: `${target.name} dinyalakan (Power On).`,
      };
    },
  },

  // Check 3: severed cable.
  {
    prefix: 'broken-',
    run: (issue, nodes, cables) => {
      if (!issue.targetCableId) return null;
      const cable = cables.find((c) => c.id === issue.targetCableId);
      if (!cable) return null;
      return {
        nodes,
        cables: cables.map((c) => (c.id === cable.id ? { ...c, status: 'active' } : c)),
        summary: `Kabel ${cable.type.toUpperCase()} disambung kembali.`,
      };
    },
  },

  // Check 5: HTB pair sharing the same Tx/Rx role.
  {
    prefix: 'htb-mismatch-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const target = nodes.find((n) => n.id === issue.targetNodeId);
      if (!target || target.type !== 'htb' || !target.htbRole) return null;
      const flipped = target.htbRole === 'A' ? 'B' : 'A';
      return {
        nodes: replaceNode(nodes, target.id, (n) => ({ ...n, htbRole: flipped })),
        cables,
        summary: `${target.name} diubah menjadi Tipe ${flipped} agar berpasangan dengan lawannya.`,
      };
    },
  },

  // Check 6: two or more powered nodes holding the same address.
  // Id is `ip-conflict-${ip}`; an IPv4 address never contains a dash, so
  // stripping the fixed prefix recovers it exactly, unlike every other id
  // below where node/cable ids can themselves contain dashes.
  {
    prefix: 'ip-conflict-',
    run: (issue, nodesIn, cables) => {
      const ip = issue.id.slice('ip-conflict-'.length);
      if (!isValidIpv4(ip)) return null;
      let nodes = nodesIn;
      const holders = nodes.filter((n) => n.poweredOn && addressOf(n) === ip);
      if (holders.length < 2) return null;

      const changed: string[] = [];
      // Keep the first holder as-is; give every other one a fresh address on
      // whatever LAN it is actually, physically attached to. An ONT's
      // address is deliberately left alone: it is the gateway of its *own*
      // PON leg, so two ONTs legitimately answering to the same LAN address
      // on two different broadcast domains is a modelling gap in this flat
      // node list, not a real duplicate -- reassigning it would just hide
      // that gap behind a unique-looking address instead of fixing anything.
      for (const holder of holders.slice(1)) {
        if (holder.type === 'ont' || !holder.ipConfig) continue;
        const upstream = findUpstreamGateway(holder, nodes, cables);
        const newIp = freeHostOn(upstream, nodes);
        if (!newIp) continue;
        const defaults = lanDefaultsFor(upstream);
        nodes = replaceNode(nodes, holder.id, (n) => ({
          ...n,
          ipConfig: { ...n.ipConfig!, ip: newIp, gateway: defaults.gateway, subnet: defaults.subnet },
        }));
        changed.push(`${holder.name} -> ${newIp}`);
      }
      if (changed.length === 0) return null;
      return { nodes, cables, summary: `Alamat baru dialokasikan: ${changed.join(', ')}.` };
    },
  },

  // Check 7: static client with an empty/zero gateway.
  {
    prefix: 'no-gw-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const target = nodes.find((n) => n.id === issue.targetNodeId);
      // This issue only ever fires when `ipConfig.mode === 'static'`, which
      // means `ipConfig` itself is already guaranteed to exist here.
      if (!target?.ipConfig) return null;
      const upstream = findUpstreamGateway(target, nodes, cables);
      const gw = upstream ? routerLanIp(upstream) : null;
      if (!gw || !isValidIpv4(gw)) return null;
      return {
        nodes: replaceNode(nodes, target.id, (n) => ({
          ...n,
          ipConfig: { ...n.ipConfig!, gateway: gw },
        })),
        cables,
        summary: `Default Gateway ${target.name} diisi dengan ${gw}.`,
      };
    },
  },

  // Check 8: host IP and its own declared gateway sit on different subnets.
  {
    prefix: 'subnet-mismatch-gw-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const target = nodes.find((n) => n.id === issue.targetNodeId);
      if (!target?.ipConfig?.ip || !isValidIpv4(target.ipConfig.ip)) return null;
      const upstream = findUpstreamGateway(target, nodes, cables);
      const gw = upstream ? routerLanIp(upstream) : null;
      const fallback = target.ipConfig.ip.replace(/\.\d+$/, '.1');
      const newGw = gw && isValidIpv4(gw) ? gw : fallback;
      return {
        nodes: replaceNode(nodes, target.id, (n) => ({
          ...n,
          ipConfig: { ...n.ipConfig!, gateway: newGw },
        })),
        cables,
        summary: `Default Gateway ${target.name} disesuaikan menjadi ${newGw}.`,
      };
    },
  },

  // Check 9-A: client's declared gateway differs from the router it is actually wired to.
  {
    prefix: 'gw-mismatch-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const target = nodes.find((n) => n.id === issue.targetNodeId);
      if (!target) return null;
      const upstream = findUpstreamGateway(target, nodes, cables);
      if (!upstream) return null;
      const gw = routerLanIp(upstream);
      return {
        nodes: replaceNode(nodes, target.id, (n) => ({
          ...n,
          ipConfig: { ...n.ipConfig!, gateway: gw },
        })),
        cables,
        summary: `Default Gateway ${target.name} disamakan dengan ${upstream.name} (${gw}).`,
      };
    },
  },

  // Check 9-B / 9-C: client IP outside the router's subnet, or colliding with the router itself.
  {
    prefix: 'ip-subnet-mismatch-',
    run: (issue, nodes, cables) => reallocateOntoUpstream(issue, nodes, cables),
  },
  {
    prefix: 'ip-collision-gw-',
    run: (issue, nodes, cables) => reallocateOntoUpstream(issue, nodes, cables),
  },

  // Check 9-D: client is set to DHCP but the upstream server is switched off.
  {
    prefix: 'dhcp-server-off-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const client = nodes.find((n) => n.id === issue.targetNodeId);
      if (!client) return null;
      const upstream = findUpstreamGateway(client, nodes, cables);
      if (!upstream) return null;
      return {
        nodes: replaceNode(nodes, upstream.id, (n) => ({
          ...n,
          ipConfig: n.ipConfig ? { ...n.ipConfig, isDhcpServerEnabled: true } : n.ipConfig,
          ontConfig: n.ontConfig ? { ...n.ontConfig, dhcpServerEnabled: true } : n.ontConfig,
        })),
        cables,
        summary: `DHCP Server pada ${upstream.name} diaktifkan.`,
      };
    },
  },

  // Check 8 (MikroTik NAT).
  {
    prefix: 'nat-off-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const target = nodes.find((n) => n.id === issue.targetNodeId);
      if (!target?.mikrotikConfig) return null;
      return {
        nodes: replaceNode(nodes, target.id, (n) => ({
          ...n,
          mikrotikConfig: { ...n.mikrotikConfig!, firewallNat: true },
        })),
        cables,
        summary: `NAT Masquerade pada ${target.name} diaktifkan.`,
      };
    },
  },

  // Check 9: two parallel LAN links between the same pair of switches.
  {
    prefix: 'loop-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const swA = nodes.find((n) => n.id === issue.targetNodeId);
      if (!swA || swA.type !== 'switch') return null;

      // Group this switch's direct LAN links by the switch on the other end,
      // and cut every parallel link back down to one.
      const byPeer = new Map<string, CableConnection[]>();
      for (const c of cables) {
        if (c.status === 'broken' || c.type !== 'lan') continue;
        if (c.fromNodeId !== swA.id && c.toNodeId !== swA.id) continue;
        const peerId = c.fromNodeId === swA.id ? c.toNodeId : c.fromNodeId;
        const peer = nodes.find((n) => n.id === peerId);
        if (peer?.type !== 'switch') continue;
        const list = byPeer.get(peerId) ?? [];
        list.push(c);
        byPeer.set(peerId, list);
      }

      const toRemove = new Set<string>();
      let peerName = '';
      for (const [peerId, links] of byPeer) {
        if (links.length > 1) {
          for (const c of links.slice(1)) toRemove.add(c.id);
          peerName = nodes.find((n) => n.id === peerId)?.name ?? peerName;
        }
      }
      if (toRemove.size === 0) return null;
      return {
        nodes,
        cables: cables.filter((c) => !toRemove.has(c.id)),
        summary: `${toRemove.size} kabel LAN paralel antara ${swA.name} dan ${peerName} dilepas untuk mencegah loop.`,
      };
    },
  },

  // Check 12-B: an access port's VLAN is not in its trunk neighbour's allowed list.
  {
    prefix: 'vlan-trunk-drop-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId || !issue.targetCableId) return null;
      const cable = cables.find((c) => c.id === issue.targetCableId);
      if (!cable) return null;
      const accessNode = nodes.find((n) => n.id === issue.targetNodeId);
      const otherId = cable.fromNodeId === issue.targetNodeId ? cable.toNodeId : cable.fromNodeId;
      const trunkNode = nodes.find((n) => n.id === otherId);
      const vlanId = accessNode?.vlanConfig?.vlanId;
      if (!trunkNode?.vlanConfig || vlanId === undefined) return null;
      const allowed = trunkNode.vlanConfig.allowedVlans ?? [];
      if (allowed.includes(vlanId)) return null;
      return {
        nodes: replaceNode(nodes, trunkNode.id, (n) => ({
          ...n,
          vlanConfig: { ...n.vlanConfig!, allowedVlans: [...allowed, vlanId].sort((a, b) => a - b) },
        })),
        cables,
        summary: `VLAN ${vlanId} ditambahkan ke daftar Allowed VLANs pada ${trunkNode.name}.`,
      };
    },
  },

  // Check 11: ONT left in Bridge mode with clients hanging off it directly.
  {
    prefix: 'ont-bridge-no-router-',
    run: (issue, nodes, cables) => fixOntBridge(issue.targetNodeId, nodes, cables),
  },
  {
    prefix: 'client-no-internet-bridge-',
    run: (issue, nodes, cables) => {
      if (!issue.targetNodeId) return null;
      const client = nodes.find((n) => n.id === issue.targetNodeId);
      if (!client) return null;
      const upstream = findUpstreamGateway(client, nodes, cables);
      return fixOntBridge(upstream?.id, nodes, cables);
    },
  },
  // Check 13: Incompatible physical medium / connector.
  {
    prefix: 'physical-mismatch-',
    run: (issue, nodes, cables) => {
      if (!issue.targetCableId) return null;
      const targetCable = cables.find((c) => c.id === issue.targetCableId);
      if (!targetCable) return null;
      const fromNode = nodes.find((n) => n.id === targetCable.fromNodeId);
      const toNode = nodes.find((n) => n.id === targetCable.toNodeId);
      if (!fromNode || !toNode) return null;

      // Both support Ethernet: convert to standard LAN Cat6
      if (nodeSupportsMedium(fromNode, 'ethernet') && nodeSupportsMedium(toNode, 'ethernet')) {
        const updatedCables = cables.map((c) =>
          c.id === targetCable.id ? { ...c, type: 'lan' as const, attenuationDb: 0.05 } : c
        );
        return {
          nodes: reconcilePorts(nodes, updatedCables),
          cables: updatedCables,
          summary: `Kabel antara ${fromNode.name} dan ${toNode.name} diganti menjadi Kabel LAN UTP (Cat6 RJ-45).`,
        };
      }

      // Both support Wireless: convert to Wi-Fi connection
      if (nodeSupportsMedium(fromNode, 'wireless') && nodeSupportsMedium(toNode, 'wireless')) {
        const updatedCables = cables.map((c) =>
          c.id === targetCable.id ? { ...c, type: 'wireless' as const, attenuationDb: 0 } : c
        );
        return {
          nodes: reconcilePorts(nodes, updatedCables),
          cables: updatedCables,
          summary: `Koneksi antara ${fromNode.name} dan ${toNode.name} dialihkan ke Koneksi Nirkabel / Wi-Fi.`,
        };
      }

      return null;
    },
  },
];

function fixOntBridge(ontId: string | undefined, nodes: NetworkNode[], cables: CableConnection[]): AutoFixResult | null {
  if (!ontId) return null;
  const ont = nodes.find((n) => n.id === ontId);
  if (!ont || ont.type !== 'ont' || !ont.ontConfig) return null;
  return {
    nodes: replaceNode(nodes, ont.id, (n) => ({
      ...n,
      ontConfig: { ...n.ontConfig!, wanMode: 'pppoe', dhcpServerEnabled: true },
    })),
    cables,
    summary: `${ont.name} dikembalikan ke Mode Router (PPPoE) dengan DHCP Server aktif.`,
  };
}

/** Shared by the two "client IP doesn't belong on this router's LAN" checks. */
function reallocateOntoUpstream(
  issue: DiagnosticIssue,
  nodes: NetworkNode[],
  cables: CableConnection[],
): AutoFixResult | null {
  if (!issue.targetNodeId) return null;
  const target = nodes.find((n) => n.id === issue.targetNodeId);
  if (!target) return null;
  const upstream = findUpstreamGateway(target, nodes, cables);
  if (!upstream) return null;
  const newIp = allocateStaticHost(upstream, nodes.filter((n) => n.id !== target.id));
  if (!newIp) return null;
  const defaults = lanDefaultsFor(upstream);
  return {
    nodes: replaceNode(nodes, target.id, (n) => ({
      ...n,
      ipConfig: { ...n.ipConfig!, ip: newIp, gateway: defaults.gateway, subnet: defaults.subnet },
    })),
    cables,
    summary: `${target.name} dipindahkan ke ${newIp} pada subnet ${routerLanIp(upstream)}/${routerSubnetOf(upstream)}.`,
  };
}

/** Whether `applyAutoFix` has a handler for this issue at all. Drives whether the UI shows a fix button. */
export function isAutoFixable(issue: DiagnosticIssue): boolean {
  return handlers.some((h) => issue.id.startsWith(h.prefix));
}

/**
 * Compute the repaired nodes/cables for one issue, or `null` if this issue
 * has no handler, or the handler could not find enough information in the
 * current topology to act (e.g. the node it targeted was since deleted).
 *
 * Callers should re-run `runNetworkDiagnostics` on the result and treat this
 * as a suggestion, not a guarantee -- fixing one issue can occasionally
 * surface a different one (e.g. reallocating an IP can, in principle, still
 * land on a subnet with its own pool exhausted elsewhere), which the next
 * diagnostic pass will report normally.
 */
export function applyAutoFix(
  issue: DiagnosticIssue,
  nodes: NetworkNode[],
  cables: CableConnection[],
): AutoFixResult | null {
  const handler = handlers.find((h) => issue.id.startsWith(h.prefix));
  if (!handler) return null;
  return handler.run(issue, nodes, cables);
}
