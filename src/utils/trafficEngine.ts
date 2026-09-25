import { NetworkDevice, NetworkLink, TrafficGeneratorStream } from '../types/network';
import { CABLE_CATALOG } from '../constants/cableCatalog';

export interface LinkCongestionMetrics {
  linkId: string;
  currentLoadMbps: number;
  capacityMbps: number;
  utilizationPercent: number; // 0 - 200+%
  loadPercent: number;
  nominalLatencyMs: number;
  actualLatencyMs: number;
  additionalLatencyMs: number;
  packetLossPercent: number; // 0 - 95%
  isCongested: boolean;
  status: 'normal' | 'congested' | 'critical';
  statusColor: string; // Hex color for canvas rendering
  glowIntensity: number; // 0 to 1
  streamCount: number;
}

/**
 * Finds shortest active path between source and target devices
 */
export function findShortestPath(
  sourceId: string,
  targetId: string,
  devices: NetworkDevice[],
  links: NetworkLink[],
): string[] {
  if (sourceId === targetId) return [];

  const visited = new Set<string>();
  const parentMap = new Map<string, { devId: string; linkId: string }>();
  const queue: string[] = [sourceId];
  visited.add(sourceId);

  let found = false;

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === targetId) {
      found = true;
      break;
    }

    // Look for connected links
    for (const link of links) {
      if (link.status === 'down') continue;

      let nextDevId: string | null = null;
      if (link.fromDeviceId === currentId) {
        nextDevId = link.toDeviceId;
      } else if (link.toDeviceId === currentId) {
        nextDevId = link.fromDeviceId;
      }

      if (nextDevId && !visited.has(nextDevId)) {
        const nextDev = devices.find((d) => d.id === nextDevId);
        if (nextDev && nextDev.status !== 'offline') {
          visited.add(nextDevId);
          parentMap.set(nextDevId, { devId: currentId, linkId: link.id });
          queue.push(nextDevId);
        }
      }
    }
  }

  if (!found) return [];

  const traversedLinkIds: string[] = [];
  let curr = targetId;
  while (curr !== sourceId) {
    const info = parentMap.get(curr);
    if (!info) break;
    traversedLinkIds.unshift(info.linkId);
    curr = info.devId;
  }

  return traversedLinkIds;
}

/**
 * Calculates congestion metrics for all links
 */
export function calculateLinkCongestion(
  devices: NetworkDevice[],
  links: NetworkLink[],
  streams: TrafficGeneratorStream[] = [],
): LinkCongestionMetrics[] {
  const result: LinkCongestionMetrics[] = [];

  // Initialize links
  for (const link of links) {
    const cableSpec = CABLE_CATALOG[link.cableType];
    const devA = devices.find((d) => d.id === link.fromDeviceId);
    const devB = devices.find((d) => d.id === link.toDeviceId);
    const portA = devA?.ports.find((p) => p.id === link.fromPortId);
    const portB = devB?.ports.find((p) => p.id === link.toPortId);

    let linkCapacity = cableSpec ? cableSpec.speedMbps : 1000;
    if (portA && portA.speedMbps) linkCapacity = Math.min(linkCapacity, portA.speedMbps);
    if (portB && portB.speedMbps) linkCapacity = Math.min(linkCapacity, portB.speedMbps);

    const baseLatency = link.cableType.includes('wireless') ? 8.0 : link.cableType.includes('fiber') ? 1.5 : 2.0;

    result.push({
      linkId: link.id,
      currentLoadMbps: 0,
      capacityMbps: linkCapacity,
      utilizationPercent: 0,
      loadPercent: 0,
      nominalLatencyMs: baseLatency,
      actualLatencyMs: baseLatency,
      additionalLatencyMs: 0,
      packetLossPercent: 0,
      isCongested: false,
      status: 'normal',
      statusColor: cableSpec?.color || '#3b82f6',
      glowIntensity: 0,
      streamCount: 0,
    });
  }

  const metricMap = new Map<string, LinkCongestionMetrics>(result.map((m) => [m.linkId, m]));

  // Route active streams
  for (const stream of streams) {
    const isStreamActive = stream.active ?? stream.isActive ?? true;
    if (!isStreamActive || stream.rateMbps <= 0) continue;

    const pathLinkIds = findShortestPath(stream.sourceDeviceId, stream.targetDeviceId, devices, links);
    for (const linkId of pathLinkIds) {
      const metric = metricMap.get(linkId);
      if (metric) {
        metric.currentLoadMbps += stream.rateMbps;
        metric.streamCount += 1;
      }
    }
  }

  // Calculate congestion status and degradation
  for (const metric of result) {
    const utilization = Number(((metric.currentLoadMbps / metric.capacityMbps) * 100).toFixed(1));
    metric.utilizationPercent = utilization;
    metric.loadPercent = Math.min(999, Math.round(utilization));

    if (utilization >= 100) {
      metric.isCongested = true;
      metric.status = 'critical';
      const overloadRatio = metric.currentLoadMbps / metric.capacityMbps;
      metric.additionalLatencyMs = Number((metric.nominalLatencyMs * Math.pow(overloadRatio, 2) * 12).toFixed(1));
      metric.actualLatencyMs = Number((metric.nominalLatencyMs + metric.additionalLatencyMs).toFixed(1));

      const droppedRate = metric.currentLoadMbps - metric.capacityMbps;
      metric.packetLossPercent = Math.min(95, Math.max(5, Math.round((droppedRate / metric.currentLoadMbps) * 100)));
      metric.statusColor = '#ef4444';
      metric.glowIntensity = 1.0;
    } else if (utilization >= 80) {
      metric.isCongested = true;
      metric.status = 'congested';
      metric.additionalLatencyMs = Number((metric.nominalLatencyMs * 3.5).toFixed(1));
      metric.actualLatencyMs = Number((metric.nominalLatencyMs + metric.additionalLatencyMs).toFixed(1));
      metric.packetLossPercent = 0;
      metric.statusColor = '#f59e0b';
      metric.glowIntensity = 0.6;
    } else if (utilization >= 30) {
      metric.isCongested = false;
      metric.status = 'normal';
      metric.additionalLatencyMs = Number((metric.nominalLatencyMs * 0.4).toFixed(1));
      metric.actualLatencyMs = Number((metric.nominalLatencyMs + metric.additionalLatencyMs).toFixed(1));
      metric.packetLossPercent = 0;
      metric.statusColor = '#10b981';
      metric.glowIntensity = 0.2;
    } else {
      metric.isCongested = false;
      metric.status = 'normal';
      metric.additionalLatencyMs = 0;
      metric.actualLatencyMs = metric.nominalLatencyMs;
      metric.packetLossPercent = 0;
      metric.glowIntensity = 0;
    }
  }

  return result;
}

/**
 * Legacy wrapper for complete network traffic calculation
 */
export function calculateNetworkTraffic(
  devices: NetworkDevice[],
  links: NetworkLink[],
  streams: TrafficGeneratorStream[],
) {
  const metrics = calculateLinkCongestion(devices, links, streams);
  const metricMap = new Map<string, LinkCongestionMetrics>(metrics.map((m) => [m.linkId, m]));
  const congestedCount = metrics.filter((m) => m.status === 'congested' || m.status === 'critical').length;
  const totalLoss = metrics.reduce((acc, m) => acc + m.packetLossPercent, 0);

  return {
    linkMetrics: metricMap,
    updatedLinks: links,
    totalThroughputMbps: streams.reduce((acc, s) => acc + ((s.active ?? s.isActive) ? s.rateMbps : 0), 0),
    congestedLinkCount: congestedCount,
    averagePacketLoss: links.length > 0 ? Number((totalLoss / links.length).toFixed(1)) : 0,
  };
}
