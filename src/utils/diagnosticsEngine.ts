import { DiagnosticIssue, NetworkDevice, NetworkLink, TrafficGeneratorStream } from '../types/network';
import { areIpsInSameSubnet, getNetworkAddress, isValidIpv4 } from './ipCalculator';
import { calculateOpticalLinkBudget, isPortCompatibleWithCable } from '../constants/cableCatalog';
import { getL2BroadcastDomain, calculateDeviceOpticalPower, checkOSPFAdjacency } from './networkEngine';
import { calculateLinkCongestion } from './trafficEngine';

export interface DiagnosticsReport {
  timestamp: string;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  healthScore: number; // 0 to 100
  issues: DiagnosticIssue[];
}

/**
 * Runs complete diagnostic rules on topology including OSPF, BGP, VLAN, FTTH, IoT, and Congestion
 */
export function runDiagnostics(
  devices: NetworkDevice[],
  links: NetworkLink[],
  activeStreams: TrafficGeneratorStream[] = [],
): DiagnosticsReport {
  const issues: DiagnosticIssue[] = [];

  // 1. IP Conflict check
  const ipMap = new Map<string, { deviceId: string; deviceName: string; portName: string }[]>();

  for (const device of devices) {
    for (const port of device.ports) {
      if (port.isUp && port.ipAddress && isValidIpv4(port.ipAddress)) {
        const list = ipMap.get(port.ipAddress) || [];
        list.push({ deviceId: device.id, deviceName: device.name, portName: port.name });
        ipMap.set(port.ipAddress, list);
      }
    }
  }

  ipMap.forEach((holders, ip) => {
    if (holders.length > 1) {
      const names = holders.map((h) => `${h.deviceName} (${h.portName})`).join(' dan ');
      issues.push({
        id: `conflict_${ip.replace(/\./g, '_')}`,
        severity: 'error',
        title: `Konflik Alamat IP Ganda: ${ip}`,
        description: `Alamat IP ${ip} digunakan bersamaan oleh lebih dari satu perangkat: ${names}.`,
        relatedDeviceIds: holders.map((h) => h.deviceId),
        rootCause: 'Terjadi duplikasi alamat IP statik pada jaringan lokal yang sama sehingga menyebabkan tabrakan ARP dan kehilangan paket.',
        stepsToFix: [
          `Buka konfigurasi salah satu perangkat (${holders[1].deviceName}).`,
          `Ganti alamat IP ${ip} menjadi IP lain yang belum terpakai di subnet yang sama.`,
          'Atau ubah metode pengalamatan menjadi DHCP jika tersedia DHCP Server.',
        ],
        autoFixAvailable: true,
        autoFixAction: `fix_conflict_${ip}`,
      });
    }
  });

  // 2. Administrative Down Ports & Cable Compatibility on active links
  for (const link of links) {
    const fromDev = devices.find((d) => d.id === link.fromDeviceId);
    const toDev = devices.find((d) => d.id === link.toDeviceId);
    if (!fromDev || !toDev) continue;

    const fromPort = fromDev.ports.find((p) => p.id === link.fromPortId);
    const toPort = toDev.ports.find((p) => p.id === link.toPortId);

    if (fromPort && !fromPort.isUp) {
      issues.push({
        id: `down_port_${fromDev.id}_${fromPort.id}`,
        severity: 'error',
        title: `Port Administratively Down: ${fromDev.name} [${fromPort.name}]`,
        description: `Kabel terhubung ke ${fromDev.name} pada port ${fromPort.name}, namun status port dalam kondisi mati (DOWN).`,
        relatedDeviceIds: [fromDev.id],
        relatedLinkIds: [link.id],
        rootCause: 'Antarmuka perangkat dimatikan secara administratif (shutdown).',
        stepsToFix: [
          `Klik perangkat ${fromDev.name} untuk membuka panel konfigurasi.`,
          `Cari port ${fromPort.name} dan aktifkan sakelar status port (UP/No Shutdown).`,
        ],
        autoFixAvailable: true,
        autoFixAction: `turn_on_port_${fromDev.id}_${fromPort.id}`,
      });
    }

    if (toPort && !toPort.isUp) {
      issues.push({
        id: `down_port_${toDev.id}_${toPort.id}`,
        severity: 'error',
        title: `Port Administratively Down: ${toDev.name} [${toPort.name}]`,
        description: `Kabel terhubung ke ${toDev.name} pada port ${toPort.name}, namun status port dalam kondisi mati (DOWN).`,
        relatedDeviceIds: [toDev.id],
        relatedLinkIds: [link.id],
        rootCause: 'Antarmuka perangkat dimatikan secara administratif (shutdown).',
        stepsToFix: [
          `Klik perangkat ${toDev.name} untuk membuka panel konfigurasi.`,
          `Cari port ${toPort.name} dan aktifkan sakelar status port (UP/No Shutdown).`,
        ],
        autoFixAvailable: true,
        autoFixAction: `turn_on_port_${toDev.id}_${toPort.id}`,
      });
    }

    // Cable & Port Compatibility check
    if (fromPort && !isPortCompatibleWithCable(fromPort.type, link.cableType)) {
      issues.push({
        id: `cable_incomp_${link.id}_from`,
        severity: 'error',
        title: `Tipe Kabel Tidak Sesuai: ${fromDev.name}`,
        description: `Kabel bertipe "${link.cableType}" dicolokkan ke port fisik "${fromPort.name}" (${fromPort.type}) yang tidak kompatibel.`,
        relatedDeviceIds: [fromDev.id, toDev.id],
        relatedLinkIds: [link.id],
        rootCause: 'Kabel fisik tidak cocok dengan tipe soket/transceiver port.',
        stepsToFix: [
          'Hapus koneksi kabel yang salah ini.',
          'Gunakan jenis kabel yang sesuai (misal: UTP untuk Ethernet RJ45, Dropcore/Fiber untuk port PON/SFP optik).',
        ],
        autoFixAvailable: false,
      });
    }

    // VLAN Mismatch on Switch ports
    if (fromDev.type === 'switch' && toDev.type === 'switch') {
      if (fromPort && toPort) {
        if (fromPort.vlanMode === 'access' && toPort.vlanMode === 'access' && fromPort.vlanId !== toPort.vlanId) {
          issues.push({
            id: `vlan_mismatch_${link.id}`,
            severity: 'error',
            title: `VLAN ID Mismatch Antar Switch: ${fromDev.name} <-> ${toDev.name}`,
            description: `Port ${fromPort.name} berada pada VLAN ${fromPort.vlanId || 1} sementara port lawannya ${toPort.name} pada VLAN ${toPort.vlanId || 1}. Lalu lintas akan terisolasi!`,
            relatedDeviceIds: [fromDev.id, toDev.id],
            relatedLinkIds: [link.id],
            rootCause: 'Inter-switch link diatur sebagai access port dengan VLAN ID berbeda, atau belum diatur sebagai 802.1Q Trunk.',
            stepsToFix: [
              `Ubah mode port ${fromPort.name} dan ${toPort.name} menjadi "Trunk".`,
              'Atau samakan VLAN ID Access pada kedua ujung port.',
            ],
            autoFixAvailable: true,
            autoFixAction: `set_trunk_${link.id}`,
          });
        }
      }
    }
  }

  // 3. FTTH Optical Network Checks (Cascaded Loss & Power Budget)
  const ontDevices = devices.filter((d) => d.type === 'ont' || d.type === 'odp');
  for (const ont of ontDevices) {
    const power = calculateDeviceOpticalPower(ont.id, devices, links);
    if (power.rxPowerDbm < -27.0 && power.rxPowerDbm > -90) {
      issues.push({
        id: `ftth_loss_${ont.id}`,
        severity: 'error',
        title: `Redaman Optik Melebihi Batas (Optical Loss): ${ont.name} (${power.rxPowerDbm} dBm)`,
        description: `Daya optik Rx yang diterima ${ont.name} adalah ${power.rxPowerDbm} dBm (di bawah batas toleransi -27.0 dBm). Jalur: ${power.pathDescription}`,
        relatedDeviceIds: [ont.id],
        rootCause: 'Terlalu banyak splitter cascading (cth: 1:8 bertingkat), jarak kabel fiber dropcore terlalu panjang, atau SFP OLT menggunakan daya Tx terlalu rendah.',
        stepsToFix: [
          'Gunakan splitter berasio lebih kecil (misal ubah 1:8 ke 1:4 pada ODC/ODP).',
          'Tingkatkan daya pancar modul SFP OLT dari Class B+ (+2.5 dBm) ke Class C+ (+5.0 dBm).',
          'Perpendek jarak bentangan kabel fiber distribution/dropcore.',
        ],
        autoFixAvailable: true,
        autoFixAction: `boost_sfp_olt_${ont.id}`,
      });
    } else if (power.rxPowerDbm > -8.0 && power.rxPowerDbm < 10) {
      issues.push({
        id: `ftth_overpower_${ont.id}`,
        severity: 'warning',
        title: `Sinyal Optik Terlalu Kuat (Optical Overload): ${ont.name} (${power.rxPowerDbm} dBm)`,
        description: `Sinyal laser optik sebesar ${power.rxPowerDbm} dBm melebihi batas -8 dBm dan dapat merusak sensor fotodioda receiver ONT.`,
        relatedDeviceIds: [ont.id],
        rootCause: 'ONT terhubung langsung ke OLT tanpa splitter atau attenuator optik.',
        stepsToFix: [
          'Pasang Optical Attenuator (5dB / 10dB) atau splitter 1:4 / 1:8 sebelum masuk ke port PON ONT.',
        ],
        autoFixAvailable: false,
      });
    }
  }

  // 4. OSPF Routing Protocol Verification
  const ospfRouters = devices.filter((d) => (d.type === 'router' || d.type === 'mikrotik') && d.ospfConfig?.enabled);
  for (let i = 0; i < ospfRouters.length; i++) {
    for (let j = i + 1; j < ospfRouters.length; j++) {
      const rA = ospfRouters[i];
      const rB = ospfRouters[j];

      // Check if they are physically linked
      const link = links.find(
        (l) => (l.fromDeviceId === rA.id && l.toDeviceId === rB.id) || (l.fromDeviceId === rB.id && l.toDeviceId === rA.id),
      );

      if (link) {
        const portA = rA.ports.find((p) => p.id === (link.fromDeviceId === rA.id ? link.fromPortId : link.toPortId))!;
        const portB = rB.ports.find((p) => p.id === (link.fromDeviceId === rB.id ? link.fromPortId : link.toPortId))!;

        const ospfResult = checkOSPFAdjacency(rA, rB, portA, portB);
        if (!ospfResult.isAdjacent && ospfResult.reason) {
          issues.push({
            id: `ospf_error_${rA.id}_${rB.id}`,
            severity: 'error',
            title: `Kegagalan OSPF Adjacency: ${rA.name} <-> ${rB.name}`,
            description: ospfResult.reason,
            relatedDeviceIds: [rA.id, rB.id],
            relatedLinkIds: [link.id],
            rootCause: 'Konfigurasi OSPF tidak konsisten antar tetangga router (Area ID atau Router-ID).',
            stepsToFix: [
              `Buka tab Routing OSPF pada ${rA.name} dan ${rB.name}.`,
              'Pastikan kedua router berada pada OSPF Area yang sama (misal Area 0 - Backbone).',
              'Pastikan Router-ID bersifat unik (misal 1.1.1.1 dan 2.2.2.2).',
            ],
            autoFixAvailable: true,
            autoFixAction: `sync_ospf_${rA.id}_${rB.id}`,
          });
        }
      }
    }
  }

  // 5. BGP Autonomous System Diagnostics
  const bgpRouters = devices.filter((d) => (d.type === 'router' || d.type === 'mikrotik') && d.bgpConfig?.enabled);
  for (const r of bgpRouters) {
    if (!r.bgpConfig?.asNumber) {
      issues.push({
        id: `bgp_missing_as_${r.id}`,
        severity: 'error',
        title: `Nomor AS BGP Kosong: ${r.name}`,
        description: `BGP diaktifkan pada ${r.name} namun belum ditentukan Autonomous System (AS Number).`,
        relatedDeviceIds: [r.id],
        rootCause: 'BGP membutuhkan nomor AS yang valid (misal 65001).',
        stepsToFix: [`Buka tab BGP pada ${r.name} dan isi nomor AS.`],
        autoFixAvailable: false,
      });
    }
  }

  // 6. Traffic Saturation / Link Congestion Check
  if (activeStreams.length > 0) {
    const linkMetrics = calculateLinkCongestion(devices, links, activeStreams);
    for (const metric of linkMetrics) {
      if (metric.status === 'congested' || metric.status === 'critical') {
        const link = links.find((l) => l.id === metric.linkId);
        const fromDev = devices.find((d) => d.id === link?.fromDeviceId);
        const toDev = devices.find((d) => d.id === link?.toDeviceId);

        issues.push({
          id: `congestion_${metric.linkId}`,
          severity: metric.status === 'critical' ? 'error' : 'warning',
          title: `Overload Link Jaringan (${metric.loadPercent}%): ${fromDev?.name || 'Dev'} <-> ${toDev?.name || 'Dev'}`,
          description: `Beban data saat ini ${metric.currentLoadMbps} Mbps melebihi batas aman link (${metric.capacityMbps} Mbps). Terjadi packet loss ${metric.packetLossPercent}% dan lonjakan latency +${metric.additionalLatencyMs}ms.`,
          relatedDeviceIds: [fromDev?.id || '', toDev?.id || ''].filter(Boolean),
          relatedLinkIds: [metric.linkId],
          rootCause: 'Traffic Generator atau beban streaming/transfer data melampaui bandwidth kapasitas antarmuka kabel.',
          stepsToFix: [
            'Upgrade jenis kabel dari Fast Ethernet (100 Mbps) ke Gigabit Ethernet (1000 Mbps) atau Fiber Optic (10 Gbps).',
            'Kurangi volume generator traffic melalui tab Traffic Generator.',
            'Terapkan Quality of Service (QoS) atau load balancing rute cadangan.',
          ],
          autoFixAvailable: true,
          autoFixAction: `upgrade_link_cable_${metric.linkId}`,
        });
      }
    }
  }

  // 7. IoT Automation Validation
  const iotSensors = devices.filter((d) => d.iotTelemetry && d.iotTelemetry.automationRules);
  for (const sensor of iotSensors) {
    for (const rule of sensor.iotTelemetry!.automationRules || []) {
      const target = devices.find((d) => d.id === rule.targetDeviceId);
      if (!target) {
        issues.push({
          id: `iot_target_missing_${sensor.id}_${rule.id}`,
          severity: 'warning',
          title: `Target Otomasi IoT Tidak Ditemukan: ${sensor.name}`,
          description: `Aturan otomasi "${rule.name}" pada ${sensor.name} mengarah ke target device ID yang tidak ada di kanvas.`,
          relatedDeviceIds: [sensor.id],
          rootCause: 'Perangkat target smart plug/saklar telah dihapus dari topologi.',
          stepsToFix: [
            `Buka tab "IoT Telemetri" pada ${sensor.name}.`,
            'Pilih perangkat target saklar/kamera yang masih aktif di jaringan.',
          ],
          autoFixAvailable: false,
        });
      } else if (target.status === 'offline') {
        issues.push({
          id: `iot_target_offline_${sensor.id}_${rule.id}`,
          severity: 'warning',
          title: `Target Otomasi IoT Sedang Offline: ${target.name}`,
          description: `Perangkat ${target.name} dimatikan sehingga tidak dapat menerima trigger otomatis dari sensor ${sensor.name}.`,
          relatedDeviceIds: [sensor.id, target.id],
          rootCause: 'Perangkat target dalam kondisi Offline.',
          stepsToFix: [`Ubah status ${target.name} menjadi Online.`],
          autoFixAvailable: true,
          autoFixAction: `online_device_${target.id}`,
        });
      }
    }
  }

  // 8. Check Default Gateway for End Devices
  const endDevices = devices.filter((d) => ['pc', 'laptop', 'server', 'printer'].includes(d.type));
  for (const dev of endDevices) {
    const activePort = dev.ports.find((p) => p.isUp && p.ipAddress);
    if (activePort) {
      const reachableNodes = Array.from(getL2BroadcastDomain(dev.id, devices, links));
      const reachableRouters = devices.filter(
        (d) => (d.type === 'router' || d.type === 'mikrotik') && reachableNodes.includes(d.id),
      );

      if (reachableRouters.length > 0 && !activePort.defaultGateway) {
        const router = reachableRouters[0];
        const rPort = router.ports.find(
          (p) => p.isUp && p.ipAddress && areIpsInSameSubnet(p.ipAddress, activePort.ipAddress!, activePort.subnetMask || '255.255.255.0'),
        );

        issues.push({
          id: `missing_gw_${dev.id}`,
          severity: 'warning',
          title: `Default Gateway Belum Diisi: ${dev.name}`,
          description: `Perangkat ${dev.name} terhubung ke router ${router.name}, tetapi kolom Default Gateway masih kosong. Perangkat tidak dapat mengakses subnet luar atau internet.`,
          relatedDeviceIds: [dev.id, router.id],
          rootCause: 'Default Gateway tidak diatur pada kartu antarmuka jaringan.',
          stepsToFix: [
            `Buka konfigurasi ${dev.name}.`,
            `Isi kolom Default Gateway dengan IP router: ${rPort?.ipAddress || '192.168.1.1'}.`,
          ],
          autoFixAvailable: !!rPort,
          autoFixAction: `set_gateway_${dev.id}_${rPort?.ipAddress}`,
        });
      }
    }
  }

  // 9. Check Unconnected Devices
  for (const dev of devices) {
    const isConnected = links.some((l) => l.fromDeviceId === dev.id || l.toDeviceId === dev.id);
    if (!isConnected) {
      issues.push({
        id: `unconnected_${dev.id}`,
        severity: 'info',
        title: `Perangkat Belum Terhubung: ${dev.name}`,
        description: `Perangkat ${dev.name} (${dev.type}) ditaruh di kanvas namun belum memiliki kabel yang tersambung ke perangkat manapun.`,
        relatedDeviceIds: [dev.id],
        rootCause: 'Belum ada kabel LAN atau serat optik yang dipasang.',
        stepsToFix: [
          'Pilih jenis kabel yang sesuai dari bilah alat di atas.',
          `Klik pada ${dev.name} lalu klik ke Switch atau Router tujuan untuk menyambungkan.`,
          'Atau gunakan tombol "Auto-Koneksi".',
        ],
        autoFixAvailable: false,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  let healthScore = 100 - errorCount * 25 - warningCount * 10 - infoCount * 3;
  if (healthScore < 0) healthScore = 0;
  if (devices.length === 0) healthScore = 100;

  return {
    timestamp: new Date().toLocaleTimeString('id-ID'),
    totalIssues: issues.length,
    errorCount,
    warningCount,
    infoCount,
    healthScore,
    issues,
  };
}

/**
 * Executes automatic resolution for an issue
 */
export function applyAutoFix(
  action: string,
  devices: NetworkDevice[],
  links: NetworkLink[],
): { updatedDevices: NetworkDevice[]; updatedLinks: NetworkLink[]; message: string } {
  let updatedDevices = JSON.parse(JSON.stringify(devices)) as NetworkDevice[];
  let updatedLinks = JSON.parse(JSON.stringify(links)) as NetworkLink[];
  let message = 'Perbaikan berhasil diterapkan.';

  // Fix conflict
  if (action.startsWith('fix_conflict_')) {
    const ip = action.replace('fix_conflict_', '');
    let count = 0;
    for (const dev of updatedDevices) {
      for (const port of dev.ports) {
        if (port.ipAddress === ip) {
          count++;
          if (count > 1) {
            const parts = ip.split('.');
            const lastOctet = parseInt(parts[3], 10);
            const newLastOctet = lastOctet + 11;
            port.ipAddress = `${parts[0]}.${parts[1]}.${parts[2]}.${newLastOctet}`;
            message = `Alamat IP pada ${dev.name} berhasil diubah otomatis menjadi ${port.ipAddress} untuk mengatasi tabrakan IP.`;
            break;
          }
        }
      }
    }
  }

  // Turn on port
  if (action.startsWith('turn_on_port_')) {
    const parts = action.split('_');
    const devId = parts[3];
    const portId = parts.slice(4).join('_');
    const dev = updatedDevices.find((d) => d.id === devId);
    if (dev) {
      const port = dev.ports.find((p) => p.id === portId);
      if (port) {
        port.isUp = true;
        message = `Port ${port.name} pada ${dev.name} berhasil diaktifkan (UP).`;
      }
    }
  }

  // Set gateway
  if (action.startsWith('set_gateway_')) {
    const parts = action.split('_');
    const devId = parts[2];
    const gwIp = parts[3];
    const dev = updatedDevices.find((d) => d.id === devId);
    if (dev) {
      for (const p of dev.ports) {
        if (p.isUp && p.ipAddress) {
          p.defaultGateway = gwIp;
          message = `Default Gateway pada ${dev.name} berhasil disetel ke ${gwIp}.`;
        }
      }
    }
  }

  // Set trunk on link
  if (action.startsWith('set_trunk_')) {
    const linkId = action.replace('set_trunk_', '');
    const link = updatedLinks.find((l) => l.id === linkId);
    if (link) {
      const devA = updatedDevices.find((d) => d.id === link.fromDeviceId);
      const devB = updatedDevices.find((d) => d.id === link.toDeviceId);
      const portA = devA?.ports.find((p) => p.id === link.fromPortId);
      const portB = devB?.ports.find((p) => p.id === link.toPortId);
      if (portA) {
        portA.vlanMode = 'trunk';
        portA.trunkAllowedVlans = [1, 10, 20, 30, 100];
      }
      if (portB) {
        portB.vlanMode = 'trunk';
        portB.trunkAllowedVlans = [1, 10, 20, 30, 100];
      }
      message = `Port pada kedua switch telah diubah menjadi Trunk (802.1Q) mengizinkan VLAN 1, 10, 20, 30, 100.`;
    }
  }

  // Boost SFP OLT
  if (action.startsWith('boost_sfp_olt_')) {
    const ontId = action.replace('boost_sfp_olt_', '');
    const olt = updatedDevices.find((d) => d.type === 'olt');
    if (olt && olt.opticalConfig) {
      olt.opticalConfig.txPowerDbm = +5.0; // SFP Class C+
      message = `Modul SFP pada OLT berhasil dinaikkan ke Class C+ (+5.0 dBm) untuk menembus redaman splitter FTTH.`;
    }
  }

  // Sync OSPF Area
  if (action.startsWith('sync_ospf_')) {
    const [rAId, rBId] = action.replace('sync_ospf_', '').split('_');
    const rA = updatedDevices.find((d) => d.id === rAId);
    const rB = updatedDevices.find((d) => d.id === rBId);
    if (rA && rB && rA.ospfConfig && rB.ospfConfig) {
      rB.ospfConfig.areaId = rA.ospfConfig.areaId;
      if (rA.ospfConfig.routerId === rB.ospfConfig.routerId) {
        rB.ospfConfig.routerId = '2.2.2.2';
      }
      message = `Area OSPF berhasil disamakan ke Area ${rA.ospfConfig.areaId} dan Router-ID unik telah ditetapkan.`;
    }
  }

  // Upgrade link cable
  if (action.startsWith('upgrade_link_cable_')) {
    const linkId = action.replace('upgrade_link_cable_', '');
    const link = updatedLinks.find((l) => l.id === linkId);
    if (link) {
      link.cableType = 'ethernet_straight';
      message = `Kabel berhasil di-upgrade ke Gigabit Ethernet (1000 Mbps) untuk mengatasi bottleneck kongesti!`;
    }
  }

  // Online device
  if (action.startsWith('online_device_')) {
    const devId = action.replace('online_device_', '');
    const dev = updatedDevices.find((d) => d.id === devId);
    if (dev) {
      dev.status = 'online';
      message = `Perangkat ${dev.name} berhasil dinyalakan (Online).`;
    }
  }

  return { updatedDevices, updatedLinks, message };
}
