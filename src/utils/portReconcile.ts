import type {
  NetworkNode,
  CableConnection,
  DevicePort,
  NodeCableType,
  NodeType,
  PortMedium,
} from '../types/network';

/**
 * Perangkat yang memancarkan Wi-Fi sebagai access point. Radio-nya satu port
 * fisik, tetapi melayani banyak klien sekaligus, jadi port itu dimodelkan
 * sebagai port bersama dengan kapasitas WIRELESS_AP_CAPACITY.
 */
export const WIRELESS_AP_TYPES: readonly NodeType[] = ['ont', 'router', 'mesh', 'access_point', 'mikrotik'];
export const WIRELESS_AP_CAPACITY = 32;

export function mediumForCable(type: NodeCableType): PortMedium {
  switch (type) {
    case 'feeder':
    case 'distribusi':
    case 'drop_core':
      return 'fiber';
    case 'lan':
      return 'ethernet';
    case 'coaxial':
      return 'coaxial';
    case 'wireless':
      return 'wireless';
  }
}

/** Semua kabel yang saat ini terpasang di port (satu atau banyak). */
export function cablesOnPort(port: DevicePort): string[] {
  if (port.connectedCableIds && port.connectedCableIds.length > 0) return port.connectedCableIds;
  return port.connectedCableId ? [port.connectedCableId] : [];
}

/** Kapasitas koneksi port. Port fisik biasa = 1. */
export function portCapacity(port: DevicePort): number {
  return Math.max(1, port.maxConnections ?? 1);
}

export function portHasFreeSlot(port: DevicePort): boolean {
  return cablesOnPort(port).length < portCapacity(port);
}

/** Pasang satu kabel ke port. Port biasa tetap hanya memakai `connectedCableId`. */
export function claimCable(port: DevicePort, cableId: string): DevicePort {
  const ids = cablesOnPort(port).includes(cableId)
    ? cablesOnPort(port)
    : [...cablesOnPort(port), cableId];
  const next: DevicePort = { ...port, connectedCableId: ids[0] };
  if (portCapacity(port) > 1) next.connectedCableIds = ids;
  return next;
}

/** Lepas kabel-kabel tertentu dari port. Mengembalikan port yang sama bila tidak tersentuh. */
export function releaseCables(port: DevicePort, cableIds: ReadonlySet<string>): DevicePort {
  const current = cablesOnPort(port);
  if (!current.some((id) => cableIds.has(id))) return port;
  const remaining = current.filter((id) => !cableIds.has(id));
  const next: DevicePort = { ...port, connectedCableId: remaining[0] };
  if (portCapacity(port) > 1 && remaining.length > 0) {
    next.connectedCableIds = remaining;
  } else {
    delete next.connectedCableIds;
  }
  return next;
}

/** Port pertama dengan medium yang cocok dan masih punya slot kosong. */
export function findFreePort(ports: readonly DevicePort[], medium: PortMedium): DevicePort | undefined {
  return ports.find((p) => p.medium === medium && portHasFreeSlot(p));
}

function isSharedWirelessPort(type: NodeType | undefined, port: { medium: PortMedium }): boolean {
  return port.medium === 'wireless' && type !== undefined && WIRELESS_AP_TYPES.includes(type);
}

export function synthesisePort(
  node: { id: string; ports: DevicePort[]; type?: NodeType },
  medium: PortMedium,
  key: string,
): DevicePort {
  const port: DevicePort = {
    id: `p-${node.id}-auto-${key}`,
    name: `${medium.toUpperCase()} Port ${node.ports.length + 1}`,
    medium,
    status: 'up',
  };
  if (isSharedWirelessPort(node.type, port)) port.maxConnections = WIRELESS_AP_CAPACITY;
  return port;
}

export function reconcilePorts(
  nodes: readonly NetworkNode[],
  cables: readonly CableConnection[],
): NetworkNode[] {
  return nodes.map((node) => {
    const touchingCables = cables.filter(
      (c) => c.fromNodeId === node.id || c.toNodeId === node.id,
    );
    const touchingIds = new Set(touchingCables.map((c) => c.id));

    const ports: DevicePort[] = (node.ports || []).map((p) => {
      let next: DevicePort = { ...p };
      // Topologi lama (template, file impor) belum punya kapasitas: isi otomatis.
      if (next.maxConnections === undefined && isSharedWirelessPort(node.type, next)) {
        next.maxConnections = WIRELESS_AP_CAPACITY;
      }
      const stale = cablesOnPort(next).filter((id) => !touchingIds.has(id));
      if (stale.length > 0) next = releaseCables(next, new Set(stale));
      return next;
    });

    const claimedBy = new Set<string>(ports.flatMap((p) => cablesOnPort(p)));

    for (const cable of touchingCables) {
      if (claimedBy.has(cable.id)) continue;
      const medium = mediumForCable(cable.type);
      const free = ports.findIndex((p) => p.medium === medium && portHasFreeSlot(p));
      if (free !== -1) {
        ports[free] = claimCable(ports[free], cable.id);
        claimedBy.add(cable.id);
      } else {
        const newPort = claimCable(
          synthesisePort({ id: node.id, ports, type: node.type }, medium, cable.id),
          cable.id,
        );
        ports.push(newPort);
        claimedBy.add(cable.id);
      }
    }

    return {
      ...node,
      ports,
    };
  });
}
