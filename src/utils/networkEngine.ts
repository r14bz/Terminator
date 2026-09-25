import { NetworkDevice, NetworkLink, PortConfig, TestResult, TrafficGeneratorStream, OSPFConfig, BGPConfig } from '../types/network';
import { areIpsInSameSubnet, getNetworkAddress, isValidIpv4 } from './ipCalculator';
import { calculateOpticalLinkBudget, calculateFTTHCascadeLoss } from '../constants/cableCatalog';
import { calculateLinkCongestion, LinkCongestionMetrics } from './trafficEngine';

export interface SimulationHop {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  inPortName?: string;
  outPortName?: string;
  ip?: string;
  rttMs: number;
  vlanId?: number;
}

export interface SimulationResult {
  success: boolean;
  sourceDevice: NetworkDevice;
  targetDevice?: NetworkDevice;
  targetIp: string;
  hops: SimulationHop[];
  pathDeviceIds: string[];
  pathCoordinates: { x: number; y: number }[];
  errorMessage?: string;
  errorDetail?: string;
  solutionSteps?: string[];
  roundTripTimeMs: number;
  packetsSent: number;
  packetsReceived: number;
  packetLossPercent: number;
  logs: string[];
  protocolUsed?: 'Direct' | 'Static' | 'OSPF' | 'BGP' | 'FTTH_PON' | 'IoT_M2M';
  congestedLinksEncountered?: string[];
}

/**
 * Calculates FTTH Optical Power Received at a device (ONT, ODP, etc.) traversing upstream towards OLT
 */
export function calculateDeviceOpticalPower(
  deviceId: string,
  devices: NetworkDevice[],
  links: NetworkLink[],
): { rxPowerDbm: number; totalLossDb: number; isWithinMargin: boolean; pathDescription: string } {
  const currentDev = devices.find((d) => d.id === deviceId);
  if (!currentDev) {
    return { rxPowerDbm: -99, totalLossDb: 99, isWithinMargin: false, pathDescription: 'Perangkat tidak ditemukan' };
  }

  // If device is OLT itself
  if (currentDev.type === 'olt') {
    const tx = currentDev.opticalConfig?.txPowerDbm ?? +3.0;
    return { rxPowerDbm: tx, totalLossDb: 0, isWithinMargin: true, pathDescription: `OLT Port Tx: +${tx} dBm` };
  }

  // Trace upstream backwards from ONT / ODP / ODC / Splitter towards OLT
  const visited = new Set<string>();
  let pathDevs: NetworkDevice[] = [currentDev];
  let pathLinks: NetworkLink[] = [];
  let curr = currentDev;
  let oltFound: NetworkDevice | null = null;

  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    if (curr.type === 'olt') {
      oltFound = curr;
      break;
    }

    // Find upstream link (connected to input port or simply connected to upstream optical node)
    const connectedLinks = links.filter((l) => l.status !== 'down' && (l.fromDeviceId === curr.id || l.toDeviceId === curr.id));
    let nextDev: NetworkDevice | null = null;
    let chosenLink: NetworkLink | null = null;

    for (const l of connectedLinks) {
      const neighborId = l.fromDeviceId === curr.id ? l.toDeviceId : l.fromDeviceId;
      if (visited.has(neighborId)) continue;
      const neighbor = devices.find((d) => d.id === neighborId);
      if (!neighbor) continue;

      // Prefer optical nodes towards OLT: olt > odc > splitter > odp > ont
      const opticalTypes = ['olt', 'odc', 'splitter', 'splitter_1_8', 'splitter_1_4', 'splitter_1_2', 'odp'];
      if (opticalTypes.includes(neighbor.type)) {
        nextDev = neighbor;
        chosenLink = l;
        break;
      }
    }

    if (nextDev && chosenLink) {
      pathDevs.unshift(nextDev);
      pathLinks.unshift(chosenLink);
      curr = nextDev;
    } else {
      break;
    }
  }

  if (!oltFound) {
    return {
      rxPowerDbm: -40,
      totalLossDb: 40,
      isWithinMargin: false,
      pathDescription: 'Tidak terhubung ke OLT',
    };
  }

  // Calculate cascade loss
  const txPower = oltFound.opticalConfig?.txPowerDbm ?? +3.0;
  let totalLoss = 0;
  const descriptions: string[] = [`OLT (+${txPower} dBm)`];

  for (let i = 0; i < pathDevs.length; i++) {
    const dev = pathDevs[i];
    // Splitter loss
    if (dev.opticalConfig?.splitRatio) {
      const ratio = dev.opticalConfig.splitRatio;
      let splitLoss = 7.2;
      if (ratio === '1:2') splitLoss = 3.5;
      else if (ratio === '1:4') splitLoss = 7.2;
      else if (ratio === '1:8') splitLoss = 10.5;
      else if (ratio === '1:16') splitLoss = 13.8;
      totalLoss += splitLoss;
      descriptions.push(`${dev.name} (${ratio} split -${splitLoss}dB)`);
    } else if (dev.type === 'odc') {
      const splitLoss = 7.2; // 1:4 primary
      totalLoss += splitLoss;
      descriptions.push(`${dev.name} (ODC 1:4 -${splitLoss}dB)`);
    } else if (dev.type === 'odp') {
      const splitLoss = 10.5; // 1:8 secondary
      totalLoss += splitLoss;
      descriptions.push(`${dev.name} (ODP 1:8 -${splitLoss}dB)`);
    }
  }

  // Fiber distance loss
  for (const l of pathLinks) {
    const fiberLoss = (l.lengthMeters / 1000) * 0.35 + 0.3; // 0.35 dB/km + connector loss
    totalLoss += fiberLoss;
  }

  const rx = Number((txPower - totalLoss).toFixed(2));
  const minRx = currentDev.opticalConfig?.rxSensitivityDbm ?? -27.0;
  const isWithin = rx >= minRx && rx <= -8.0;

  return {
    rxPowerDbm: rx,
    totalLossDb: Number(totalLoss.toFixed(2)),
    isWithinMargin: isWithin,
    pathDescription: descriptions.join(' -> '),
  };
}

/**
 * Checks OSPF neighbor relationships between two adjacent routers
 */
export function checkOSPFAdjacency(
  routerA: NetworkDevice,
  routerB: NetworkDevice,
  portA: PortConfig,
  portB: PortConfig,
): { isAdjacent: boolean; reason?: string } {
  if (!routerA.ospfConfig?.enabled || !routerB.ospfConfig?.enabled) {
    return { isAdjacent: false, reason: 'OSPF tidak aktif pada salah satu router' };
  }

  // Must share the same OSPF Area ID
  if (routerA.ospfConfig.areaId !== routerB.ospfConfig.areaId) {
    return {
      isAdjacent: false,
      reason: `Area ID Mismatch: ${routerA.name} Area ${routerA.ospfConfig.areaId} vs ${routerB.name} Area ${routerB.ospfConfig.areaId}`,
    };
  }

  // Router ID must not conflict
  if (routerA.ospfConfig.routerId === routerB.ospfConfig.routerId) {
    return {
      isAdjacent: false,
      reason: `Router-ID Duplikat: Kedua router menggunakan ${routerA.ospfConfig.routerId}`,
    };
  }

  // Subnet and Hello/Dead timer consistency
  if (portA.ipAddress && portB.ipAddress && portA.subnetMask) {
    if (!areIpsInSameSubnet(portA.ipAddress, portB.ipAddress, portA.subnetMask)) {
      return { isAdjacent: false, reason: 'Subnet antarmuka inter-router tidak cocok' };
    }
  }

  return { isAdjacent: true };
}

/**
 * Checks BGP Peering relationship between two routers
 */
export function checkBGPPeering(
  routerA: NetworkDevice,
  routerB: NetworkDevice,
): { isEstablished: boolean; peeringType?: 'eBGP' | 'iBGP'; reason?: string } {
  if (!routerA.bgpConfig?.enabled || !routerB.bgpConfig?.enabled) {
    return { isEstablished: false, reason: 'BGP tidak diaktifkan pada kedua router' };
  }

  const bgpA = routerA.bgpConfig;
  const bgpB = routerB.bgpConfig;

  // Check if routerA has neighbor configured pointing to routerB's IP
  const peerOnA = bgpA.neighbors.find((n) =>
    routerB.ports.some((p) => p.ipAddress === n.neighborIp) && n.remoteAs === bgpB.asNumber,
  );

  const peerOnB = bgpB.neighbors.find((n) =>
    routerA.ports.some((p) => p.ipAddress === n.neighborIp) && n.remoteAs === bgpA.asNumber,
  );

  if (peerOnA && peerOnB) {
    const isEbgp = bgpA.asNumber !== bgpB.asNumber;
    return {
      isEstablished: true,
      peeringType: isEbgp ? 'eBGP' : 'iBGP',
    };
  }

  return {
    isEstablished: false,
    reason: `BGP Peering belum lengkap (Neighbor IP / AS Number mismatch antara AS ${bgpA.asNumber} dan AS ${bgpB.asNumber})`,
  };
}

/**
 * Builds physical adjacency list with VLAN and optical checks
 */
export function getActiveDeviceNeighbors(
  deviceId: string,
  devices: NetworkDevice[],
  links: NetworkLink[],
  currentVlanId: number = 1,
): { neighbor: NetworkDevice; link: NetworkLink; myPort: PortConfig; neighborPort: PortConfig; transmittedVlan: number }[] {
  const currentDev = devices.find((d) => d.id === deviceId);
  if (!currentDev) return [];

  const results: { neighbor: NetworkDevice; link: NetworkLink; myPort: PortConfig; neighborPort: PortConfig; transmittedVlan: number }[] = [];

  for (const link of links) {
    if (link.status === 'down') continue;

    let targetDevId = '';
    let myPortId = '';
    let neighborPortId = '';

    if (link.fromDeviceId === deviceId) {
      targetDevId = link.toDeviceId;
      myPortId = link.fromPortId;
      neighborPortId = link.toPortId;
    } else if (link.toDeviceId === deviceId) {
      targetDevId = link.fromDeviceId;
      myPortId = link.toPortId;
      neighborPortId = link.fromPortId;
    } else {
      continue;
    }

    const neighbor = devices.find((d) => d.id === targetDevId);
    if (!neighbor || neighbor.status === 'offline') continue;

    const myPort = currentDev.ports.find((p) => p.id === myPortId);
    const neighborPort = neighbor.ports.find((p) => p.id === neighborPortId);

    if (!myPort || !neighborPort) continue;
    if (!myPort.isUp || !neighborPort.isUp) continue;

    // Optical link check
    const isFiber = ['fiber_single', 'fiber_multi', 'dropcore', 'feeder_fiber', 'dist_fiber'].includes(link.cableType);
    if (isFiber) {
      // Calculate rx power at downstream
      const opticalPower = calculateDeviceOpticalPower(neighbor.id, devices, links);
      if (opticalPower.rxPowerDbm < -29.0 && ['ont', 'odp', 'odc'].includes(neighbor.type)) {
        // Redaman terlalu tinggi, sinyal drop!
        continue;
      }
    }

    // VLAN Tagging & Port Mode Check (Access / Trunk / Hybrid)
    let outboundVlan = currentVlanId;

    if (currentDev.type === 'switch') {
      if (myPort.vlanMode === 'access') {
        outboundVlan = myPort.vlanId || 1;
      } else if (myPort.vlanMode === 'trunk') {
        const allowed = myPort.trunkAllowedVlans || [1];
        if (!allowed.includes(currentVlanId)) {
          // VLAN not allowed on trunk
          continue;
        }
        outboundVlan = currentVlanId;
      }
    }

    // Ingress check on neighbor if switch
    if (neighbor.type === 'switch') {
      if (neighborPort.vlanMode === 'access') {
        const neighborAccessVlan = neighborPort.vlanId || 1;
        if (outboundVlan !== neighborAccessVlan) {
          // VLAN mismatch on access port!
          continue;
        }
      } else if (neighborPort.vlanMode === 'trunk') {
        const allowed = neighborPort.trunkAllowedVlans || [1];
        if (!allowed.includes(outboundVlan)) {
          continue;
        }
      }
    }

    results.push({ neighbor, link, myPort, neighborPort, transmittedVlan: outboundVlan });
  }

  return results;
}

/**
 * Find L2 Broadcast Domain (all nodes reachable through switches/hubs/splitters without passing a router)
 */
export function getL2BroadcastDomain(
  startDeviceId: string,
  devices: NetworkDevice[],
  links: NetworkLink[],
): Set<string> {
  const visited = new Set<string>([startDeviceId]);
  const queue = [startDeviceId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentDev = devices.find((d) => d.id === currentId);
    if (!currentDev) continue;

    // L3 Boundary: Routers, MikroTik, Cloud
    const isL3Boundary = (currentDev.type === 'router' || currentDev.type === 'mikrotik' || currentDev.type === 'cloud_internet') && currentId !== startDeviceId;
    if (isL3Boundary) {
      continue;
    }

    const neighbors = getActiveDeviceNeighbors(currentId, devices, links);
    for (const { neighbor } of neighbors) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        const isBridge = [
          'switch',
          'switch_hub',
          'splitter',
          'splitter_1_2',
          'splitter_1_4',
          'splitter_1_8',
          'odc',
          'odp',
          'access_point',
          'ont',
          'iot_hub',
        ].includes(neighbor.type);

        if (isBridge) {
          queue.push(neighbor.id);
        }
      }
    }
  }

  return visited;
}

/**
 * Finds device and port holding the target IP
 */
export function findDeviceByIp(
  targetIp: string,
  devices: NetworkDevice[],
): { device: NetworkDevice; port: PortConfig } | null {
  for (const device of devices) {
    for (const port of device.ports) {
      if (port.ipAddress === targetIp && port.isUp) {
        return { device, port };
      }
    }
  }
  return null;
}

/**
 * Executes a simulated Ping from source device to target IP or target device with Congestion, OSPF, BGP, and VLAN support
 */
export function simulatePing(
  sourceDeviceId: string,
  targetDestination: string, // IP or deviceId
  devices: NetworkDevice[],
  links: NetworkLink[],
  activeStreams: TrafficGeneratorStream[] = [],
): SimulationResult {
  const logs: string[] = [];
  const timestamp = new Date().toLocaleTimeString('id-ID');

  const sourceDev = devices.find((d) => d.id === sourceDeviceId);
  if (!sourceDev) {
    return {
      success: false,
      sourceDevice: {} as NetworkDevice,
      targetIp: targetDestination,
      hops: [],
      pathDeviceIds: [],
      pathCoordinates: [],
      errorMessage: 'Perangkat pengirim (Source) tidak ditemukan.',
      roundTripTimeMs: 0,
      packetsSent: 4,
      packetsReceived: 0,
      packetLossPercent: 100,
      logs: [`[${timestamp}] ERROR: Perangkat pengirim tidak valid.`],
    };
  }

  // Get active source IP port
  const sourcePort = sourceDev.ports.find((p) => p.isUp && p.ipAddress);
  if (!sourcePort || !sourcePort.ipAddress || !sourcePort.subnetMask) {
    logs.push(`[${timestamp}] PING: Gagal memulai ping dari ${sourceDev.name}.`);
    logs.push(`[${timestamp}] ERROR: Port tidak memiliki konfigurasi IP Address atau status antarmuka DOWN.`);
    return {
      success: false,
      sourceDevice: sourceDev,
      targetIp: targetDestination,
      hops: [{ deviceId: sourceDev.id, deviceName: sourceDev.name, deviceType: sourceDev.type, rttMs: 0 }],
      pathDeviceIds: [sourceDev.id],
      pathCoordinates: [{ x: sourceDev.x, y: sourceDev.y }],
      errorMessage: `Port pada ${sourceDev.name} belum memiliki IP Address atau berstatus Administratively DOWN.`,
      errorDetail: 'Perangkat pengirim tidak dapat membentuk paket ICMP tanpa IP Address dan Subnet Mask yang aktif.',
      solutionSteps: [
        `Buka konfigurasi perangkat ${sourceDev.name}.`,
        'Pilih tab "Port & IP Address".',
        'Pastikan tombol Port Status dalam kondisi "Aktif (UP)".',
        'Isi IP Address (contoh: 192.168.1.10) dan Subnet Mask (contoh: 255.255.255.0) atau aktifkan DHCP Client.',
      ],
      roundTripTimeMs: 0,
      packetsSent: 4,
      packetsReceived: 0,
      packetLossPercent: 100,
      logs,
    };
  }

  // Determine target device & IP
  let targetDev: NetworkDevice | undefined;
  let targetPort: PortConfig | undefined;
  let targetIp = targetDestination;

  if (isValidIpv4(targetDestination)) {
    const found = findDeviceByIp(targetDestination, devices);
    if (found) {
      targetDev = found.device;
      targetPort = found.port;
    }
  } else {
    targetDev = devices.find((d) => d.id === targetDestination);
    if (targetDev) {
      targetPort = targetDev.ports.find((p) => p.ipAddress);
      if (targetPort && targetPort.ipAddress) {
        targetIp = targetPort.ipAddress;
      }
    }
  }

  logs.push(`[${timestamp}] Memulai PING dari ${sourceDev.name} (${sourcePort.ipAddress}) ke ${targetIp} dengan 32 byte data:`);

  // Target device offline check
  if (targetDev && targetDev.status === 'offline') {
    logs.push(`[${timestamp}] Request timed out. (Perangkat tujuan ${targetDev.name} dalam status Offline).`);
    return {
      success: false,
      sourceDevice: sourceDev,
      targetDevice: targetDev,
      targetIp,
      hops: [{ deviceId: sourceDev.id, deviceName: sourceDev.name, deviceType: sourceDev.type, rttMs: 0 }],
      pathDeviceIds: [sourceDev.id],
      pathCoordinates: [{ x: sourceDev.x, y: sourceDev.y }],
      errorMessage: `Perangkat tujuan ${targetDev.name} berstatus Offline.`,
      errorDetail: 'Perangkat tujuan dimatikan sehingga tidak dapat merespon ICMP Echo Request.',
      solutionSteps: [`Ubah status ${targetDev.name} menjadi Online di panel konfigurasi.`],
      roundTripTimeMs: 0,
      packetsSent: 4,
      packetsReceived: 0,
      packetLossPercent: 100,
      logs,
    };
  }

  // Calculate current congestion metrics across all links
  const congestionMetrics = calculateLinkCongestion(devices, links, activeStreams);
  const congestionMap = new Map<string, LinkCongestionMetrics>(
    congestionMetrics.map((m) => [m.linkId, m]),
  );

  // Check if IP is in same subnet
  const isLocalSubnet = areIpsInSameSubnet(sourcePort.ipAddress, targetIp, sourcePort.subnetMask);
  let protocolUsed: SimulationResult['protocolUsed'] = isLocalSubnet ? 'Direct' : 'Static';

  // BFS Pathfinding with Routing Decision Support (Static, OSPF, BGP, FTTH)
  const visited = new Set<string>();
  const parentMap = new Map<string, { dev: NetworkDevice; viaLink: NetworkLink; inPort: PortConfig; outPort: PortConfig; vlan: number }>();
  const queue: { dev: NetworkDevice; currentIp: string; currentVlan: number }[] = [
    { dev: sourceDev, currentIp: sourcePort.ipAddress, currentVlan: sourcePort.vlanId || 1 },
  ];
  visited.add(sourceDev.id);

  let targetFound = false;

  while (queue.length > 0) {
    const { dev: current, currentVlan } = queue.shift()!;

    if (targetDev && current.id === targetDev.id) {
      targetFound = true;
      break;
    }

    // Check if current device has the target IP on any port
    const matchPort = current.ports.find((p) => p.ipAddress === targetIp);
    if (matchPort) {
      targetDev = current;
      targetPort = matchPort;
      targetFound = true;
      break;
    }

    const neighbors = getActiveDeviceNeighbors(current.id, devices, links, currentVlan);

    for (const { neighbor, link, myPort, neighborPort, transmittedVlan } of neighbors) {
      if (visited.has(neighbor.id)) continue;

      // Routing rule logic:
      if (['router', 'mikrotik'].includes(current.type) && current.id !== sourceDev.id) {
        // 1. Direct Connected Route
        const hasDirectRoute = neighbor.ports.some(
          (p) => p.ipAddress && p.subnetMask && areIpsInSameSubnet(p.ipAddress, targetIp, p.subnetMask),
        );

        // 2. Static Route
        const hasStaticRoute = current.routingTable?.some(
          (r) => r.network === '0.0.0.0' || areIpsInSameSubnet(r.network, targetIp, r.netmask),
        );

        // 3. Dynamic OSPF Route
        let hasOspfRoute = false;
        if (current.ospfConfig?.enabled && neighbor.ospfConfig?.enabled) {
          const ospfAdj = checkOSPFAdjacency(current, neighbor, myPort, neighborPort);
          if (ospfAdj.isAdjacent) {
            hasOspfRoute = true;
            protocolUsed = 'OSPF';
          }
        }

        // 4. Dynamic BGP Route
        let hasBgpRoute = false;
        if (current.bgpConfig?.enabled && neighbor.bgpConfig?.enabled) {
          const bgpPeer = checkBGPPeering(current, neighbor);
          if (bgpPeer.isEstablished) {
            hasBgpRoute = true;
            protocolUsed = 'BGP';
          }
        }

        if (!hasDirectRoute && !hasStaticRoute && !hasOspfRoute && !hasBgpRoute) {
          continue; // No route to destination through this interface
        }
      }

      visited.add(neighbor.id);
      parentMap.set(neighbor.id, {
        dev: current,
        viaLink: link,
        inPort: myPort,
        outPort: neighborPort,
        vlan: transmittedVlan,
      });
      queue.push({ dev: neighbor, currentIp: neighborPort.ipAddress || '', currentVlan: transmittedVlan });
    }
  }

  // If path found
  if (targetFound && targetDev) {
    // Reconstruct path
    const pathDeviceIds: string[] = [];
    const hops: SimulationHop[] = [];
    const congestedLinksEncountered: string[] = [];
    let currId = targetDev.id;
    let accumulatedRtt = 1.5;
    let extraCongestionLatency = 0;
    let maxPacketLossRate = 0;

    while (currId) {
      pathDeviceIds.unshift(currId);
      const parentInfo = parentMap.get(currId);
      if (!parentInfo) break;

      // Check congestion on the link
      const metric = congestionMap.get(parentInfo.viaLink.id);
      if (metric) {
        extraCongestionLatency += metric.additionalLatencyMs;
        if (metric.packetLossPercent > maxPacketLossRate) {
          maxPacketLossRate = metric.packetLossPercent;
        }
        if (metric.status === 'congested' || metric.status === 'critical') {
          congestedLinksEncountered.push(parentInfo.viaLink.id);
        }
      }

      currId = parentInfo.dev.id;
    }

    const pathCoordinates = pathDeviceIds.map((id) => {
      const d = devices.find((dev) => dev.id === id)!;
      return { x: d.x, y: d.y };
    });

    for (let i = 0; i < pathDeviceIds.length; i++) {
      const dev = devices.find((d) => d.id === pathDeviceIds[i])!;
      const hopInfo = parentMap.get(dev.id);
      const hopRtt = Number((accumulatedRtt + i * 2.2 + extraCongestionLatency * (i / Math.max(1, pathDeviceIds.length))).toFixed(1));
      hops.push({
        deviceId: dev.id,
        deviceName: dev.name,
        deviceType: dev.type,
        rttMs: hopRtt,
        vlanId: hopInfo?.vlan || 1,
      });
    }

    const totalRtt = Number((hops[hops.length - 1]?.rttMs + extraCongestionLatency).toFixed(1));

    // Verify L3 Subnet / Gateway logic if devices are not on same subnet
    if (!isLocalSubnet) {
      const hasRouterInPath = pathDeviceIds.some((id) => {
        const d = devices.find((dev) => dev.id === id);
        return d && (d.type === 'router' || d.type === 'mikrotik' || d.type === 'cloud_internet');
      });

      if (!hasRouterInPath) {
        logs.push(`[${timestamp}] Destination host unreachable.`);
        logs.push(`[${timestamp}] ALASAN: Subnet berbeda (${sourcePort.ipAddress} & ${targetIp}) tanpa Router sebagai perantara.`);
        return {
          success: false,
          sourceDevice: sourceDev,
          targetDevice: targetDev,
          targetIp,
          hops,
          pathDeviceIds,
          pathCoordinates,
          errorMessage: 'Destination Host Unreachable (Subnet Mismatch tanpa Router).',
          errorDetail: `Perangkat ${sourceDev.name} (${sourcePort.ipAddress}) dan ${targetDev.name} (${targetIp}) berada pada segmen network berbeda dan terhubung via Switch Layer 2 tanpa Router / Default Gateway.`,
          solutionSteps: [
            `Ubah IP salah satu perangkat agar berada dalam subnet yang sama (${getNetworkAddress(sourcePort.ipAddress, sourcePort.subnetMask)}), ATAU`,
            'Pasang Router atau MikroTik untuk menghubungkan kedua subnet tersebut dan atur Default Gateway pada masing-masing PC.',
          ],
          roundTripTimeMs: 0,
          packetsSent: 4,
          packetsReceived: 0,
          packetLossPercent: 100,
          logs,
        };
      }

      // Check if source device configured default gateway
      if (!sourcePort.defaultGateway) {
        logs.push(`[${timestamp}] Request timed out.`);
        logs.push(`[${timestamp}] ALASAN: Default Gateway belum diisi pada ${sourceDev.name} untuk rute ke luar subnet.`);
        return {
          success: false,
          sourceDevice: sourceDev,
          targetDevice: targetDev,
          targetIp,
          hops: hops.slice(0, 1),
          pathDeviceIds: [sourceDev.id],
          pathCoordinates: [{ x: sourceDev.x, y: sourceDev.y }],
          errorMessage: 'Default Gateway Belum Dikonfigurasi.',
          errorDetail: `Karena target ${targetIp} berada di luar subnet lokal, ${sourceDev.name} membutuhkan alamat Default Gateway untuk meneruskan paket ke Router.`,
          solutionSteps: [
            `Buka konfigurasi ${sourceDev.name}.`,
            'Masukkan alamat IP antarmuka router terdekat pada kolom "Default Gateway" (misal: 192.168.1.1).',
          ],
          roundTripTimeMs: 0,
          packetsSent: 4,
          packetsReceived: 0,
          packetLossPercent: 100,
          logs,
        };
      }
    }

    // Packet Loss due to congestion
    const packetLossPercent = Math.min(100, Math.round(maxPacketLossRate));
    const receivedPackets = Math.max(0, 4 - Math.round((packetLossPercent / 100) * 4));

    if (congestedLinksEncountered.length > 0) {
      logs.push(`[${timestamp}] PERINGATAN: Terjadi kongesti pada ${congestedLinksEncountered.length} link jalur paket (Traffic Saturation)! Latency membengkak +${extraCongestionLatency.toFixed(1)}ms`);
    }

    if (protocolUsed === 'OSPF') {
      logs.push(`[${timestamp}] [OSPF Area ${sourceDev.ospfConfig?.areaId || 0}] Paket diteruskan melalui OSPF Dijkstra Shortest Path Tree.`);
    } else if (protocolUsed === 'BGP') {
      logs.push(`[${timestamp}] [BGP AS ${sourceDev.bgpConfig?.asNumber || 65001}] Rute diperoleh melalui BGP Path Attribute.`);
    }

    for (let seq = 1; seq <= 4; seq++) {
      if (seq > receivedPackets) {
        logs.push(`[${timestamp}] Request timed out. (Paket ${seq} di-drop akibat link buffer overflow)`);
      } else {
        const pingTime = (totalRtt + (Math.random() * 2 - 1)).toFixed(1);
        logs.push(`[${timestamp}] Balasan dari ${targetIp}: bytes=32 waktu=${pingTime}ms TTL=64 ${protocolUsed ? `(${protocolUsed})` : ''}`);
      }
    }

    logs.push(`--- Statistik Ping untuk ${targetIp} ---`);
    logs.push(`Paket: Terkirim = 4, Diterima = ${receivedPackets}, Hilang = ${4 - receivedPackets} (${packetLossPercent}% loss)`);
    logs.push(`Perkiraan waktu putaran bolak-balik: Rata-rata = ${totalRtt}ms`);

    return {
      success: receivedPackets > 0,
      sourceDevice: sourceDev,
      targetDevice: targetDev,
      targetIp,
      hops,
      pathDeviceIds,
      pathCoordinates,
      roundTripTimeMs: totalRtt,
      packetsSent: 4,
      packetsReceived: receivedPackets,
      packetLossPercent,
      logs,
      protocolUsed,
      congestedLinksEncountered,
    };
  }

  // Not found in graph
  logs.push(`[${timestamp}] Request timed out.`);
  logs.push(`[${timestamp}] Request timed out.`);
  logs.push(`[${timestamp}] Request timed out.`);
  logs.push(`[${timestamp}] Request timed out.`);
  logs.push(`--- Statistik Ping untuk ${targetIp} ---`);
  logs.push(`Paket: Terkirim = 4, Diterima = 0, Hilang = 4 (100% loss)`);

  const steps = [
    'Pastikan kabel sudah terhubung antara perangkat atau switch perantara.',
    'Periksa apakah semua port yang dilewati dalam kondisi UP (hijau).',
    'Jika menggunakan serat optik FTTH (OLT/Splitter/ODC/ODP/ONT), periksa redaman fiber tidak melebihi batas -27 dBm.',
    'Jika menggunakan VLAN, pastikan port trunk memperbolehkan VLAN ID yang sesuai (802.1Q).',
    'Jika menggunakan OSPF/BGP, pastikan status neighbor OSPF berstatus Full dan BGP Peering Established.',
  ];

  return {
    success: false,
    sourceDevice: sourceDev,
    targetDevice: targetDev,
    targetIp,
    hops: [{ deviceId: sourceDev.id, deviceName: sourceDev.name, deviceType: sourceDev.type, rttMs: 0 }],
    pathDeviceIds: [sourceDev.id],
    pathCoordinates: [{ x: sourceDev.x, y: sourceDev.y }],
    errorMessage: `Tujuan ${targetIp} tidak dapat dijangkau dari ${sourceDev.name}.`,
    errorDetail: 'Tidak ditemukan jalur fisik/logika kabel yang menghubungkan kedua perangkat sesuai protokol.',
    solutionSteps: steps,
    roundTripTimeMs: 0,
    packetsSent: 4,
    packetsReceived: 0,
    packetLossPercent: 100,
    logs,
  };
}

/**
 * Traceroute simulation with hop inspection
 */
export function simulateTraceroute(
  sourceDeviceId: string,
  targetDestination: string,
  devices: NetworkDevice[],
  links: NetworkLink[],
  activeStreams: TrafficGeneratorStream[] = [],
): SimulationResult {
  const result = simulatePing(sourceDeviceId, targetDestination, devices, links, activeStreams);
  const traceLogs: string[] = [];
  const timestamp = new Date().toLocaleTimeString('id-ID');

  traceLogs.push(`[${timestamp}] Melacak rute ke ${result.targetIp} melalui maksimal 30 hop:`);

  if (result.success && result.hops.length > 0) {
    let hopNum = 1;
    for (const hop of result.hops) {
      const ms1 = (hop.rttMs * 0.9).toFixed(1);
      const ms2 = (hop.rttMs * 1.0).toFixed(1);
      const ms3 = (hop.rttMs * 1.1).toFixed(1);
      const vlanTag = hop.vlanId && hop.vlanId > 1 ? ` [VLAN ${hop.vlanId}]` : '';
      traceLogs.push(`  ${hopNum.toString().padStart(2, ' ')}   ${ms1} ms   ${ms2} ms   ${ms3} ms   ${hop.deviceName} [${hop.deviceId}]${vlanTag}`);
      hopNum++;
    }
    traceLogs.push(`[${timestamp}] Pelacakan rute (Traceroute) selesai dengan sukses.`);
  } else {
    traceLogs.push(`  1   *        *        *     Request timed out.`);
    traceLogs.push(`  2   *        *        *     Request timed out.`);
    traceLogs.push(`[${timestamp}] Pelacakan rute gagal menjangkau tujuan.`);
  }

  result.logs = traceLogs;
  return result;
}

/**
 * Auto-assign DHCP IP addresses to client devices in the same L2 domain as an active DHCP Server
 */
export function runDHCPSimulation(
  devices: NetworkDevice[],
  links: NetworkLink[],
): { updatedDevices: NetworkDevice[]; assignedCount: number; logs: string[] } {
  const logs: string[] = [];
  let assignedCount = 0;
  const updatedDevices = JSON.parse(JSON.stringify(devices)) as NetworkDevice[];

  const dhcpServers = updatedDevices.filter((d) => d.dhcpServer && d.dhcpServer.enabled);

  for (const server of dhcpServers) {
    const config = server.dhcpServer!;
    const reachableDeviceIds = getL2BroadcastDomain(server.id, updatedDevices, links);

    let nextIpOffset = 10;
    const basePrefix = config.rangeStart.substring(0, config.rangeStart.lastIndexOf('.'));

    for (const dev of updatedDevices) {
      if (dev.id === server.id) continue;
      if (!reachableDeviceIds.has(dev.id)) continue;

      for (const port of dev.ports) {
        if (port.ipAssignment === 'dhcp') {
          const newIp = `${basePrefix}.${nextIpOffset}`;
          nextIpOffset++;
          port.ipAddress = newIp;
          port.subnetMask = config.netmask;
          port.defaultGateway = config.gateway;
          port.dnsServer = config.dns;
          assignedCount++;
          logs.push(`[DHCP DORA] ${dev.name} (${port.name}) berhasil mendapatkan IP ${newIp} dari DHCP Server ${server.name}`);
        }
      }
    }
  }

  return { updatedDevices, assignedCount, logs };
}

/**
 * Evaluates IoT Automation rules across the network
 */
export function evaluateIoTAutomations(
  devices: NetworkDevice[],
): { updatedDevices: NetworkDevice[]; logs: string[] } {
  const logs: string[] = [];
  const updatedDevices = JSON.parse(JSON.stringify(devices)) as NetworkDevice[];
  const timestamp = new Date().toLocaleTimeString('id-ID');

  for (const dev of updatedDevices) {
    if (!dev.iotTelemetry || !dev.iotTelemetry.automationRules) continue;

    for (const rule of dev.iotTelemetry.automationRules) {
      if (!rule.enabled) continue;

      let triggered = false;
      if (rule.trigger === 'temp_above' && dev.iotTelemetry.tempCelsius !== undefined) {
        if (dev.iotTelemetry.tempCelsius > rule.threshold) triggered = true;
      } else if (rule.trigger === 'temp_below' && dev.iotTelemetry.tempCelsius !== undefined) {
        if (dev.iotTelemetry.tempCelsius < rule.threshold) triggered = true;
      } else if (rule.trigger === 'motion_detected' && dev.iotTelemetry.motionDetected) {
        triggered = true;
      }

      if (triggered) {
        const targetDev = updatedDevices.find((d) => d.id === rule.targetDeviceId);
        if (targetDev && targetDev.iotTelemetry) {
          if (rule.action === 'turn_on_plug' && targetDev.type === 'smart_plug') {
            targetDev.iotTelemetry.plugState = 'ON';
            logs.push(`[${timestamp}] [IoT Rule] ${dev.name} men-trigger Saklar ${targetDev.name} -> Hidup (ON).`);
          } else if (rule.action === 'turn_off_plug' && targetDev.type === 'smart_plug') {
            targetDev.iotTelemetry.plugState = 'OFF';
            logs.push(`[${timestamp}] [IoT Rule] ${dev.name} men-trigger Saklar ${targetDev.name} -> Mati (OFF).`);
          } else if (rule.action === 'trigger_alarm') {
            logs.push(`[${timestamp}] [IoT Alarm] ALARM berbunyi dari sensor ${dev.name}! Nilai sensor melebihi ambang batas ${rule.threshold}`);
          }
        }
      }
    }
  }

  return { updatedDevices, logs };
}
