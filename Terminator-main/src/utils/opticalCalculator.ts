import type { NetworkNode, CableConnection, NodeCableType } from '../types/network';

export interface OpticalLossItem {
  item: string;
  lossDb: number;
  description: string;
}

export interface OpticalCalculationResult {
  nodeId: string;
  rxPowerDbm: number;
  txPowerDbm: number;
  totalLossDb: number;
  status: 'optimal' | 'acceptable' | 'critical_los' | 'overpower' | 'disconnected';
  statusLabel: string;
  lossBreakdown: OpticalLossItem[];
}

export const SPLITTER_LOSS_MAP: Record<string, number> = {
  '1:2': 3.5,
  '1:4': 7.2,
  '1:8': 10.5,
  '1:16': 13.8,
  '1:32': 17.2,
};

/** Cable types that actually carry light. Anything else is not part of a PON path. */
const OPTICAL_CABLE_TYPES = new Set<NodeCableType>(['feeder', 'distribusi', 'drop_core']);

/** Loss contributed by the fibre run plus its connector pair. */
function cableAttenuation(cable: CableConnection): OpticalLossItem {
  switch (cable.type) {
    case 'feeder':
      return {
        item: 'FEEDER',
        lossDb: (cable.lengthKm ?? 3.0) * 0.35 + 0.25,
        description: `Kabel Feeder (${cable.lengthKm ?? 3.0} km @ 0.35 dB/km) + Adaptor`,
      };
    case 'distribusi':
      return {
        item: 'DISTRIBUSI',
        lossDb: (cable.lengthKm ?? 1.5) * 0.35 + 0.25,
        description: `Kabel Distribusi (${cable.lengthKm ?? 1.5} km @ 0.35 dB/km) + Adaptor`,
      };
    case 'drop_core':
      return {
        item: 'DROP CORE',
        // Drop wire is worse per km than buried plant, plus two fast connectors.
        lossDb: (cable.lengthKm ?? 0.15) * 0.4 + 0.5,
        description: `Kabel Drop Core (${((cable.lengthKm ?? 0.15) * 1000).toFixed(0)}m) + Fast Connector`,
      };
    default:
      return { item: cable.type.toUpperCase(), lossDb: 0, description: '' };
  }
}

/** Insertion loss of the passive device sitting at the far end of a cable. */
function deviceAttenuation(node: NetworkNode): OpticalLossItem | null {
  if (node.type === 'odc') {
    return { item: 'ODC LOSS', lossDb: 7.2, description: 'ODC Splitter Tahap 1 (1:4) Insertion Loss' };
  }
  if (node.type === 'odp') {
    return { item: 'ODP LOSS', lossDb: 10.5, description: 'ODP Splitter Tahap 2 (1:8) Insertion Loss' };
  }
  if (node.type === 'splitter') {
    const ratio = node.opticalConfig?.splitterRatio ?? '1:8';
    return {
      item: 'SPLITTER LOSS',
      lossDb: SPLITTER_LOSS_MAP[ratio] ?? 10.5,
      description: `Passive Optical Splitter (${ratio}) Insertion Loss`,
    };
  }
  return null;
}

/**
 * Classify received power against the ITU-T G.984 operating window.
 * Receivers go blind below roughly -27 dBm and the photodiode is damaged
 * above roughly -8 dBm, so both ends are real failure modes.
 */
function classify(rxPower: number): { status: OpticalCalculationResult['status']; statusLabel: string } {
  if (rxPower > -8.0) {
    return { status: 'overpower', statusLabel: 'Overpower (> -8 dBm, Bahaya Sensor)' };
  }
  if (rxPower >= -24.0) {
    return { status: 'optimal', statusLabel: 'Sinyal Bagus & Stabil (Standar Telco)' };
  }
  if (rxPower >= -27.0) {
    return { status: 'acceptable', statusLabel: 'Sinyal Lemah / Pas-pasan (-24 s/d -27 dBm)' };
  }
  return { status: 'critical_los', statusLabel: 'Redaman Buruk / LOS Merah (< -27 dBm)' };
}

const DISCONNECTED_LABEL = 'Tidak Ada Sinyal (LOS)';

/**
 * Calculates received optical power for every node reachable over the PON tree.
 *
 * Each powered OLT is a transmitter; the result for a node is the *best*
 * (lowest-loss) path from any of them, not whichever one happened to be
 * walked last. This is a shortest-path problem over a graph whose edge
 * weights are all non-negative, so it is solved with Dijkstra rather than a
 * plain BFS: hop count is not a proxy for loss. A 2-hop path through one 1:8
 * splitter (10.5 dB) loses more than a 3-hop path through two 1:2 splitters
 * (7.0 dB), and a BFS would have preferred the worse one.
 *
 * Every settled node is written exactly once per transmitter, and a node is
 * only re-expanded when a strictly cheaper path to it is found — so a node
 * reachable by several routes settles on its minimum and cannot be
 * overwritten by a worse route afterwards.
 */
export function calculateOpticalPowers(
  nodes: NetworkNode[],
  cables: CableConnection[]
): Map<string, OpticalCalculationResult> {
  const resultMap = new Map<string, OpticalCalculationResult>();

  // Seed every optical node as signal-less; transmitters overwrite their own.
  for (const node of nodes) {
    if (['olt', 'odc', 'odp', 'splitter', 'ont', 'htb'].includes(node.type)) {
      resultMap.set(node.id, {
        nodeId: node.id,
        rxPowerDbm: -99,
        txPowerDbm: node.type === 'olt' ? node.opticalConfig?.txPowerDbm ?? 3.0 : -99,
        totalLossDb: 0,
        status: 'disconnected',
        statusLabel: DISCONNECTED_LABEL,
        lossBreakdown: [],
      });
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Adjacency built once: cables are traversed O(E) times otherwise.
  const opticalLinks = new Map<string, Array<{ otherId: string; cable: CableConnection }>>();
  for (const cable of cables) {
    if (!OPTICAL_CABLE_TYPES.has(cable.type)) continue;
    if (cable.status === 'broken') continue;
    const push = (from: string, to: string) => {
      const list = opticalLinks.get(from);
      if (list) list.push({ otherId: to, cable });
      else opticalLinks.set(from, [{ otherId: to, cable }]);
    };
    push(cable.fromNodeId, cable.toNodeId);
    push(cable.toNodeId, cable.fromNodeId);
  }

  const oltNodes = nodes.filter((n) => n.type === 'olt' && n.poweredOn);

  // Best result seen per node, compared by received power across all OLTs.
  const best = new Map<string, { rxPower: number; result: OpticalCalculationResult }>();

  const consider = (nodeId: string, result: OpticalCalculationResult) => {
    const incumbent = best.get(nodeId);
    if (!incumbent || result.rxPowerDbm > incumbent.rxPower) {
      best.set(nodeId, { rxPower: result.rxPowerDbm, result });
    }
  };

  for (const olt of oltNodes) {
    const startTx = olt.opticalConfig?.txPowerDbm ?? 3.0;

    consider(olt.id, {
      nodeId: olt.id,
      rxPowerDbm: startTx,
      txPowerDbm: startTx,
      totalLossDb: 0,
      status: 'optimal',
      statusLabel: `Transmitter Aktif (${startTx >= 0 ? '+' : ''}${startTx.toFixed(1)} dBm)`,
      lossBreakdown: [
        { item: 'SFP GPON TX', lossDb: 0, description: `Daya transmisi optik awal ${startTx >= 0 ? '+' : ''}${startTx.toFixed(1)} dBm` },
      ],
    });

    // Dijkstra. Nodes are few, so a linear scan for the cheapest unsettled
    // node beats the bookkeeping of a binary heap.
    const dist = new Map<string, number>([[olt.id, 0]]);
    const breakdown = new Map<string, OpticalLossItem[]>([[olt.id, []]]);
    const settled = new Set<string>();

    for (;;) {
      let currentId: string | undefined;
      let currentLoss = Infinity;
      for (const [id, d] of dist) {
        if (!settled.has(id) && d < currentLoss) {
          currentLoss = d;
          currentId = id;
        }
      }
      if (currentId === undefined) break;
      settled.add(currentId);

      const currentBreakdown = breakdown.get(currentId) ?? [];
      for (const { otherId, cable } of opticalLinks.get(currentId) ?? []) {
        if (settled.has(otherId)) continue;
        const nextNode = nodeById.get(otherId);
        if (!nextNode) continue;

        const cableItem = cableAttenuation(cable);
        const deviceItem = deviceAttenuation(nextNode);
        const totalLoss = currentLoss + cableItem.lossDb + (deviceItem?.lossDb ?? 0);

        if (totalLoss >= (dist.get(otherId) ?? Infinity)) continue;

        dist.set(otherId, totalLoss);
        breakdown.set(otherId, [
          ...currentBreakdown,
          cableItem,
          ...(deviceItem ? [deviceItem] : []),
        ]);
      }
    }

    for (const [nodeId, totalLoss] of dist) {
      if (nodeId === olt.id) continue;
      const rxPower = startTx - totalLoss;
      const { status, statusLabel } = classify(rxPower);
      consider(nodeId, {
        nodeId,
        rxPowerDbm: Number(rxPower.toFixed(2)),
        txPowerDbm: startTx,
        totalLossDb: Number(totalLoss.toFixed(2)),
        status,
        statusLabel,
        lossBreakdown: breakdown.get(nodeId) ?? [],
      });
    }
  }

  for (const { result } of best.values()) {
    resultMap.set(result.nodeId, result);
  }
  return resultMap;
}
