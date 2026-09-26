import { NetworkNode, CableConnection } from '../types/network';

export interface OpticalCalculationResult {
  nodeId: string;
  rxPowerDbm: number;
  txPowerDbm: number;
  totalLossDb: number;
  status: 'optimal' | 'acceptable' | 'critical_los' | 'overpower' | 'disconnected';
  statusLabel: string;
  lossBreakdown: Array<{
    item: string;
    lossDb: number;
    description: string;
  }>;
}

export const SPLITTER_LOSS_MAP: Record<string, number> = {
  '1:2': 3.5,
  '1:4': 7.2,
  '1:8': 10.5,
  '1:16': 13.8,
  '1:32': 17.2,
};

/**
 * Calculates optical power (dBm) and attenuation across the PON path
 */
export function calculateOpticalPowers(
  nodes: NetworkNode[],
  cables: CableConnection[]
): Map<string, OpticalCalculationResult> {
  const resultMap = new Map<string, OpticalCalculationResult>();

  // Find all optical transmitters (OLT or active sources)
  const oltNodes = nodes.filter((n) => n.type === 'olt' && n.poweredOn);

  // Default baseline for unpowered/unconnected nodes
  for (const node of nodes) {
    if (['olt', 'odc', 'odp', 'splitter', 'ont', 'htb'].includes(node.type)) {
      resultMap.set(node.id, {
        nodeId: node.id,
        rxPowerDbm: -99,
        txPowerDbm: node.type === 'olt' ? (node.opticalConfig?.txPowerDbm ?? 3.0) : -99,
        totalLossDb: 0,
        status: 'disconnected',
        statusLabel: 'Tidak Ada Sinyal (LOS)',
        lossBreakdown: [],
      });
    }
  }

  // BFS / DFS from each OLT transmitter through optical cables
  for (const olt of oltNodes) {
    const startTx = olt.opticalConfig?.txPowerDbm ?? 3.0;
    resultMap.set(olt.id, {
      nodeId: olt.id,
      rxPowerDbm: 0,
      txPowerDbm: startTx,
      totalLossDb: 0,
      status: 'optimal',
      statusLabel: 'Transmitter Aktif (+3.0 dBm)',
      lossBreakdown: [
        { item: 'SFP GPON Class B+ TX', lossDb: 0, description: `Daya transmisi optik awal +${startTx.toFixed(1)} dBm` },
      ],
    });

    // Queue: [currentNodeId, currentPowerDbm, cumulativeLoss, breakdown]
    type QueueItem = {
      nodeId: string;
      powerDbm: number;
      cumulativeLoss: number;
      breakdown: Array<{ item: string; lossDb: number; description: string }>;
    };

    const queue: QueueItem[] = [
      {
        nodeId: olt.id,
        powerDbm: startTx,
        cumulativeLoss: 0,
        breakdown: [],
      },
    ];

    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current.nodeId);

      // Find all optical connections from current node
      const outgoingCables = cables.filter(
        (c) =>
          ['feeder', 'distribusi', 'drop_core'].includes(c.type) &&
          c.status !== 'broken' &&
          (c.fromNodeId === current.nodeId || c.toNodeId === current.nodeId)
      );

      for (const cable of outgoingCables) {
        const nextNodeId = cable.fromNodeId === current.nodeId ? cable.toNodeId : cable.fromNodeId;
        if (visited.has(nextNodeId)) continue;

        const nextNode = nodes.find((n) => n.id === nextNodeId);
        if (!nextNode) continue;

        // Calculate cable attenuation
        let cableLoss = 0;
        let cableDesc = '';
        if (cable.type === 'feeder') {
          cableLoss = (cable.lengthKm || 3.0) * 0.35 + 0.25; // Cable + adaptor
          cableDesc = `Kabel Feeder (${cable.lengthKm || 3.0} km @ 0.35 dB/km) + Adaptor`;
        } else if (cable.type === 'distribusi') {
          cableLoss = (cable.lengthKm || 1.5) * 0.35 + 0.25;
          cableDesc = `Kabel Distribusi (${cable.lengthKm || 1.5} km @ 0.35 dB/km) + Adaptor`;
        } else if (cable.type === 'drop_core') {
          cableLoss = (cable.lengthKm || 0.15) * 0.40 + 0.50; // Drop wire + 2x Fast Connector
          cableDesc = `Kabel Drop Core (${((cable.lengthKm || 0.15) * 1000).toFixed(0)}m) + Fast Connector`;
        }

        // Calculate internal device loss (splitters)
        let internalDeviceLoss = 0;
        let deviceDesc = '';
        if (nextNode.type === 'odc') {
          // ODC typically has 1:4 splitter
          internalDeviceLoss = 7.2;
          deviceDesc = 'ODC Splitter Tahap 1 (1:4) Insertion Loss';
        } else if (nextNode.type === 'odp') {
          // ODP typically has 1:8 splitter
          internalDeviceLoss = 10.5;
          deviceDesc = 'ODP Splitter Tahap 2 (1:8) Insertion Loss';
        } else if (nextNode.type === 'splitter') {
          const ratio = nextNode.opticalConfig?.splitterRatio ?? '1:8';
          internalDeviceLoss = SPLITTER_LOSS_MAP[ratio] || 10.5;
          deviceDesc = `Passive Optical Splitter (${ratio}) Insertion Loss`;
        }

        const newBreakdown = [
          ...current.breakdown,
          { item: cable.type.toUpperCase(), lossDb: cableLoss, description: cableDesc },
        ];

        if (internalDeviceLoss > 0) {
          newBreakdown.push({
            item: `${nextNode.type.toUpperCase()} LOSS`,
            lossDb: internalDeviceLoss,
            description: deviceDesc,
          });
        }

        const totalLoss = current.cumulativeLoss + cableLoss + internalDeviceLoss;
        const rxPower = startTx - totalLoss;

        let status: 'optimal' | 'acceptable' | 'critical_los' | 'overpower' | 'disconnected' = 'optimal';
        let statusLabel = 'Optimal (-18 s/d -24 dBm)';

        if (rxPower > -8.0) {
          status = 'overpower';
          statusLabel = 'Overpower (> -8 dBm, Bahaya Sensor)';
        } else if (rxPower >= -24.0) {
          status = 'optimal';
          statusLabel = 'Sinyal Bagus & Stabil (Standar Telco)';
        } else if (rxPower >= -27.0) {
          status = 'acceptable';
          statusLabel = 'Sinyal Lemah / Pas-pasan (-24 s/d -27 dBm)';
        } else {
          status = 'critical_los';
          statusLabel = 'Redaman Buruk / LOS Merah (< -27 dBm)';
        }

        resultMap.set(nextNode.id, {
          nodeId: nextNode.id,
          rxPowerDbm: Number(rxPower.toFixed(2)),
          txPowerDbm: startTx,
          totalLossDb: Number(totalLoss.toFixed(2)),
          status,
          statusLabel,
          lossBreakdown: newBreakdown,
        });

        queue.push({
          nodeId: nextNodeId,
          powerDbm: rxPower,
          cumulativeLoss: totalLoss,
          breakdown: newBreakdown,
        });
      }
    }
  }

  return resultMap;
}
