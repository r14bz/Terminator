/**
 * Reconciliation between cables and the ports they occupy.
 *
 * `DevicePort.connectedCableId` is the only record of which port a cable is
 * plugged into, and `App.handleConnectNodes` picks a free port with
 * `node.ports.find((p) => p.medium === medium && !p.connectedCableId)`. That
 * find is only correct if every cable already sitting in the topology has
 * marked the port it uses.
 *
 * It did not. All three shipped templates declare 5-6 cables and mark *zero*
 * ports, and an imported .json carries whatever the file happened to contain.
 * So the first free ethernet port was handed out again and again: on the SOHO
 * MikroTik, whose `ether1 (WAN)` and `ether2 (LAN)` already had cables, a newly
 * connected device landed on `ether1 (WAN)` instead of `ether3 (Hotspot)`.
 * Worse, `attachPort` overwrote the reference, so the template's own ISP cable
 * ended up with no port at all -- and deleting one of the new cables freed a
 * port that another cable was still using.
 *
 * Measured on the running app (SOHO template, MikroTik): 6 cables, 3 ports, 0
 * claimed. After 3 more LAN cables: 9 cables, still 3 ports, still 0 template
 * cables owning a port. With correct reconciliation the third new cable
 * synthesises a 4th port and the count reaches 5.
 *
 * So: reconcile on the way in, at every point a topology enters the app. This
 * derives the back-reference from the cables rather than hand-maintaining it
 * in the template data, which also fixes imported files for free.
 *
 * Free of React and of `Date.now()` so the test suite can drive it under plain
 * node and so it is idempotent -- a port id is derived from the cable id, never
 * from a clock, so running it twice cannot invent a second port.
 */
import type { CableConnection, DevicePort, NetworkNode, NodeCableType, PortMedium } from '../types/network';

/**
 * The physical medium a cable type needs an endpoint for.
 *
 * Shared with `handleConnectNodes` so the medium a port is *claimed* for and
 * the medium reconciliation *searches* for cannot drift apart. They used to be
 * two separate copies of this mapping inside App.tsx.
 */
export function mediumForCable(type: NodeCableType): PortMedium {
  switch (type) {
    case 'feeder':
    case 'distribusi':
    case 'drop_core':
      return 'fiber';
    case 'coaxial':
      return 'coaxial';
    case 'wireless':
      return 'wireless';
    case 'lan':
    default:
      return 'ethernet';
  }
}

/**
 * A port for a device that has run out of ones of this medium.
 *
 * `key` makes the id deterministic. `handleConnectNodes` passes a clock value
 * because it only ever needs the id to be unique within one interaction;
 * reconciliation must produce the *same* id every time or a second pass would
 * append a duplicate port.
 */
export function synthesisePort(
  node: Pick<NetworkNode, 'id' | 'ports'>,
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

/** Cables touching a node, as `[cable, peerNodeId]`. */
function endpointsOf(nodeId: string, cables: readonly CableConnection[]) {
  const out: Array<{ cable: CableConnection; peerId: string }> = [];
  for (const cable of cables) {
    if (cable.fromNodeId === nodeId) out.push({ cable, peerId: cable.toNodeId });
    else if (cable.toNodeId === nodeId) out.push({ cable, peerId: cable.fromNodeId });
  }
  return out;
}

/**
 * Mark the port each cable occupies, synthesising ports where a device has
 * none of the right medium left.
 *
 * Idempotent: a cable that already has a port referencing it is left alone, so
 * `reconcilePorts(reconcilePorts(x))` equals `reconcilePorts(x)`, and an
 * imported file that recorded its ports keeps the author's own choice.
 *
 * A cable whose far endpoint is missing from `nodes` still claims a port here.
 * The cable is physically plugged into *this* device, so leaving the port free
 * would reproduce the original defect for that one cable -- and would let a
 * later connection double-book it.
 */
export function reconcilePorts(
  nodes: readonly NetworkNode[],
  cables: readonly CableConnection[],
): NetworkNode[] {
  return nodes.map((node) => {
    const relevant = endpointsOf(node.id, cables);
    if (relevant.length === 0) return node;

    // Ports already spoken for, by cable id and by position.
    const claimedBy = new Map<string, number>();
    node.ports.forEach((port, index) => {
      if (port.connectedCableId) claimedBy.set(port.connectedCableId, index);
    });

    let ports = node.ports;
    const dirty = () => {
      if (ports === node.ports) ports = [...node.ports];
    };

    for (const { cable } of relevant) {
      if (claimedBy.has(cable.id)) continue;
      const medium = mediumForCable(cable.type);
      const free = ports.findIndex((p) => p.medium === medium && !p.connectedCableId);
      if (free >= 0) {
        dirty();
        ports[free] = { ...ports[free], connectedCableId: cable.id };
      } else {
        dirty();
        // Numbered off the *growing* list: passing the untouched `node` here
        // gave two ports synthesised in the same pass the same name.
        ports = [
          ...ports,
          { ...synthesisePort({ ...node, ports }, medium, cable.id), connectedCableId: cable.id },
        ];
      }
      claimedBy.set(cable.id, ports.length - 1);
    }

    return ports === node.ports ? node : { ...node, ports };
  });
}
