import type {
  NetworkNode,
  CableConnection,
  DevicePort,
  NodeCableType,
  PortMedium,
} from '../types/network';

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

export function synthesisePort(
  node: { id: string; ports: DevicePort[] },
  medium: PortMedium,
  key: string,
): DevicePort {
  return {
    id: `p-${node.id}-auto-${key}`,
    name: `${medium.toUpperCase()} Port ${node.ports.length + 1}`,
    medium,
    status: 'up',
  };
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
      if (p.connectedCableId && !touchingIds.has(p.connectedCableId)) {
        return { ...p, connectedCableId: undefined };
      }
      return { ...p };
    });

    const claimedBy = new Set<string>(
      ports
        .map((p) => p.connectedCableId)
        .filter((id): id is string => Boolean(id)),
    );

    for (const cable of touchingCables) {
      if (claimedBy.has(cable.id)) continue;
      const medium = mediumForCable(cable.type);
      const free = ports.findIndex((p) => p.medium === medium && !p.connectedCableId);
      if (free !== -1) {
        ports[free] = { ...ports[free], connectedCableId: cable.id };
        claimedBy.add(cable.id);
      } else {
        const newPort: DevicePort = { ...synthesisePort({ ...node, ports }, medium, cable.id), connectedCableId: cable.id };
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
