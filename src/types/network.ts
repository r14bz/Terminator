/**
 * Network domain types.
 *
 * Single schema, shaped around what the canvas actually renders:
 * NetworkNode / CableConnection / DevicePort. The parallel NetworkDevice
 * schema that once co-existed here (with its OSPF/BGP/traffic types) was
 * orphaned by the merge in c899f16 and removed in c29938a.
 */

/**
 * Every device kind the canvas can hold. DEVICE_METADATA is exhaustive over
 * this union, so adding a member here forces a catalog entry to be written.
 * DEVICE_BRANDS is intentionally only a Partial of it.
 */
export type NodeType =
  | 'internet'
  | 'internet_source'
  | 'metro'
  | 'olt'
  | 'odc'
  | 'odp'
  | 'splitter'
  | 'htb'
  | 'ont'
  | 'mikrotik'
  | 'switch'
  | 'switch_managed'
  | 'router'
  | 'ap_ptp'
  | 'mesh'
  | 'access_point'
  | 'firewall'
  | 'nas'
  | 'pc'
  | 'laptop'
  | 'printer'
  | 'voip_phone'
  | 'cctv'
  | 'smartphone'
  | 'iot'
  | 'server';

export type DeviceCategory = 'ftth' | 'routing' | 'client_iot' | 'infrastructure';

export type PortMedium = 'fiber' | 'ethernet' | 'coaxial' | 'wireless';

export interface DevicePort {
  id: string;
  name: string;
  medium: PortMedium;
  /** Kabel pertama yang terpasang di port ini (kompatibel dengan kode lama). */
  connectedCableId?: string;
  /**
   * Semua kabel yang terpasang. Hanya dipakai port bersama (radio Wi-Fi AP)
   * yang `maxConnections`-nya lebih dari 1. Port biasa cukup memakai
   * `connectedCableId`.
   */
  connectedCableIds?: string[];
  /** Jumlah koneksi maksimum. Kosong = 1 (port fisik biasa). Radio Wi-Fi AP = 32. */
  maxConnections?: number;
  status: 'up' | 'down';
  vlanId?: number;
  speedMbps?: number;
  ipAddress?: string;
  txPowerDbm?: number; // For OLT PON ports (+3 dBm)
}

export type NodeCableType =
  | 'feeder'       // Kabel Optik Feeder (OLT -> ODC)
  | 'distribusi'   // Kabel Optik Distribusi (ODC -> ODP)
  | 'drop_core'    // Kabel Optik Drop Core (ODP -> ONT)
  | 'lan'          // Kabel LAN / UTP RJ45
  | 'coaxial'      // Kabel Coaxial
  | 'wireless';    // Koneksi Nirkabel / Wi-Fi

export interface CableConnection {
  id: string;
  type: NodeCableType;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  lengthKm: number;            // Length in km (for fiber attenuation) or meters for LAN
  attenuationDb: number;       // Calculated attenuation
  status: 'active' | 'broken' | 'high_attenuation' | 'mismatch';
  signalLossReason?: string;
}

export interface NetworkNode {
  id: string;
  type: NodeType;
  name: string;
  label: string;
  brand?: string;              // Merk perangkat: ZTE, Huawei, MikroTik, Cisco, TP-Link, dll.
  model?: string;              // Tipe model: F609, HG8245H, RB750Gr3, dll.
  x: number;
  y: number;
  ports: DevicePort[];
  status: 'online' | 'warning' | 'error' | 'offline';
  poweredOn: boolean;

  // Real ONT Hardware Config
  ontConfig?: {
    brand: string;
    model: string;
    wanMode: 'pppoe' | 'dhcp' | 'static' | 'bridge';
    pppoeUsername?: string;
    pppoePassword?: string;
    vlanId?: number;
    staticWanIp?: string;
    staticWanSubnet?: string;
    staticWanGateway?: string;
    staticWanDns?: string;
    lanIp?: string;
    lanSubnet?: string;
    dhcpServerEnabled?: boolean;
    dhcpPoolStart?: string;
    dhcpPoolEnd?: string;
    wifiSsid?: string;
    wifiPassword?: string;
    ponStatus?: 'O5 (Operational)' | 'O1 (Init)' | 'O3 (Serial Number Mismatch)' | 'LOS (No Signal)';
    adminIp?: string;
    /**
     * Ke mana ONT ini memanggil PPPoE. 'bras' = ISP, 'mikrotik' = ONT RT/RW net
     * yang dial ke MikroTik milik sendiri. Kosong = tidak terdefinisi, aturan
     * PPPoE 5.4 tidak dievaluasi untuk ONT ini.
     */
    pppoeTarget?: 'bras' | 'mikrotik';
  };

  // Real Switch Hub Hardware Config
  switchConfig?: {
    brand: string;
    model: string;
    isManaged: boolean;
    stpEnabled: boolean;
    vlanTrunkPort?: string;
  };

  // Manageable Switch Hardware Config
  managedSwitchConfig?: {
    managementIp: string;
    managementSubnet: string;
    managementGateway: string;
    stpMode: 'rstp' | 'stp' | 'mstp' | 'disabled';
    igmpSnooping: boolean;
    lacpTrunkEnabled: boolean;
    portMirroring: boolean;
    mirrorSourcePort?: string;
    mirrorTargetPort?: string;
    poeBudgetWatts: number;
    poeUsageWatts: number;
    loopProtect: boolean;
  };

  // Point to Point / Wireless Bridge Config
  ptpConfig?: {
    mode: 'ap_ptp' | 'station_ptp' | 'ap_ptmp';
    frequencyMhz: number;       // e.g. 5180 - 5825 MHz, or 60000 MHz
    channelWidthMhz: 20 | 40 | 80 | 160;
    distanceKm: number;
    txPowerDbm: number;         // e.g. 23 dBm
    antennaGainDbi: number;     // e.g. 23 dBi
    ssid: string;
    securityKey?: string;
    signalRssiDbm?: number;     // e.g. -58 dBm
    linkQualityPercent?: number;// e.g. 99%
  };

  // Mesh Wi-Fi Config
  meshConfig?: {
    role: 'root' | 'satellite';
    backhaulType: 'ethernet' | 'wireless_5ghz';
    fastRoaming: boolean;       // 802.11k/v/r
    ssid: string;
    wifiKey?: string;
    bandSteering: boolean;      // 2.4G & 5G smart connect
    rssiThresholdDbm: number;   // Roaming handover threshold (e.g. -70 dBm)
    channel24G: number;
    channel5G: number;
    hopCount?: number;
  };

  // Standalone Enterprise Access Point Config
  accessPointConfig?: {
    ssid24: string;
    ssid5: string;
    wifiKey?: string;
    channel24: number;
    channel5: number;
    poePowered: boolean;
    vlanTagged: boolean;
    vlanId?: number;
    txPowerDbm: number;
    guestPortalEnabled: boolean;
  };

  // Hardware Firewall / Security Gateway Config
  firewallConfig?: {
    natEnabled: boolean;
    ipsEnabled: boolean;
    vpnServer: boolean;
    wanFailover: boolean;
    blockedPorts: number[];
    bandwidthShaping: boolean;
  };

  // Network Attached Storage / NVR Server Config
  nasConfig?: {
    raidLevel: 'RAID 0' | 'RAID 1' | 'RAID 5' | 'RAID 6' | 'SHR';
    capacityTb: number;
    usedStorageTb: number;
    nfsSmbEnabled: boolean;
    nvrRecording: boolean;
    lacpBonding: boolean;
  };

  // IP Phone / VoIP SIP Terminal Config
  voipConfig?: {
    sipExtension: string;
    sipServerIp: string;
    codec: 'G.711u' | 'G.711a' | 'G.729' | 'Opus';
    voiceVlanId: number;
    status: 'registered' | 'unregistered' | 'calling';
  };

  // IP & Networking Config
  ipConfig?: {
    mode: 'static' | 'dhcp';
    ip: string;
    subnet: string;
    gateway: string;
    dns: string;
    isDhcpServerEnabled?: boolean;
    dhcpRangeStart?: string;
    dhcpRangeEnd?: string;
    dhcpLeaseCount?: number;
  };

  // Optical Config & State
  opticalConfig?: {
    txPowerDbm?: number;        // e.g. +3.0 dBm for OLT SFP
    rxPowerDbm?: number;        // Calculated live Rx power at ONT / ODP / ODC
    splitterRatio?: '1:2' | '1:4' | '1:8' | '1:16' | '1:32';
    attenuationDb?: number;     // Insertion loss
    connectorType?: 'SC/UPC' | 'SC/APC';
    fiberCoreCount?: number;
  };

  // IEEE 802.1Q VLAN Tagging Config
  vlanConfig?: {
    enabled: boolean;
    vlanId: number;                  // 1 - 4094 (e.g. 10, 20, 100, 1049)
    vlanName: string;                // e.g. "VLAN 10 - Manajemen", "VLAN 20 - Hotspot", "VLAN 100 - CCTV"
    mode: 'access' | 'trunk' | 'hybrid';
    allowedVlans?: number[];         // For trunk mode (e.g. [10, 20, 50, 100])
    priorityCos?: number;            // IEEE 802.1p CoS (0 - 7)
    nativeVlan?: number;             // PVID (default: 1)
  };

  // Specific state for special devices
  htbRole?: 'A' | 'B';          // For HTB Media Converter (TX/RX 1310/1550nm)
  mikrotikConfig?: {
    firewallNat: boolean;
    pppoeServer: boolean;
    dnsServer: boolean;
    totalQueues: number;
    bandwidthLimitMbps?: number;
    routerOsVersion?: string;

    /**
     * Konfigurasi terstruktur mengikuti menu RouterOS. Semua opsional: node lama
     * tanpa field ini tetap valid, dan aturan 5.1 sampai 5.6 ditandai
     * "tidak terdefinisi" untuk node tersebut (bukan error).
     */
    /** Interfaces: port ether dan interface VLAN. */
    interfaces?: Array<{ name: string; type: 'ether' | 'vlan'; vlanId?: number; parent?: string }>;
    /** IP > Addresses. */
    addresses?: Array<{ address: string; mask: string; interface: string }>;
    /** IP > DHCP Server. */
    dhcpServers?: Array<{ interface: string; poolStart: string; poolEnd: string; gateway?: string; dns?: string }>;
    /** IP > Routes. dst '0.0.0.0/0' = default route. */
    routes?: Array<{ dst: string; gateway: string }>;
    /** Interface keluar ke ONT ISP. Dipakai bila belum ada default route. */
    uplinkInterface?: string;
    /** IP > Firewall > NAT. */
    natRules?: Array<{ chain: 'srcnat'; action: 'masquerade'; outInterface: string }>;
    /** IP > Firewall > Filter Rules. */
    filterRules?: Array<{
      chain: 'forward';
      action: 'drop' | 'accept';
      srcAddress?: string;
      dstAddress?: string;
      inInterface?: string;
      outInterface?: string;
    }>;
    /** PPP > Secrets dan PPPoE Servers. */
    pppSecrets?: Array<{ name: string; password: string; profile?: string; service: 'pppoe' }>;
    pppoeServers?: Array<{ interface: string; serviceName: string; defaultProfile?: string }>;
    /** IP > Hotspot. */
    hotspots?: Array<{ interface: string; pool?: string; profile?: string; users: Array<{ username: string; password: string }> }>;
  };
}

export interface DeviceMetadata {
  type: NodeType;
  name: string;
  category: DeviceCategory;
  shortDesc: string;
  fullDescription: string;
  technicianRole: string;       // Fungsi nyata di lapangan
  technicianTips: string[];     // Tips & Trik Teknisi
  defaultPorts: Array<{ name: string; medium: PortMedium; maxConnections?: number }>;
  color: string;
  standardOpticalLoss?: string; // dB range
}

export type ActiveTool = 'select' | 'move' | 'pan' | 'cable' | 'opm' | 'ping';

export interface SimulationPacket {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  cableId: string;
  progress: number;            // 0.0 to 1.0
  type: 'ping' | 'data' | 'dhcp' | 'optical' | 'error';
  color: string;
}

export interface DiagnosticIssue {
  id: string;
  severity: 'error' | 'critical' | 'warning' | 'info';
  title: string;
  /** Node the issue is anchored to; Canvas tints this node's card. */
  targetNodeId?: string;
  /** Cable the issue is anchored to, when the fault is on the link itself. */
  targetCableId?: string;
  cause?: string;              // Gejala & Penyebab
  solution?: string;           // Langkah Solusi untuk Teknisi
  category?: 'optical' | 'ip' | 'physical' | 'configuration' | 'topology';
  /** Nomor baris aturan di aturan-validator-simulator.md (mis. '5.3.2', 'P6'). */
  ruleRef?: string;
  /** Lapisan tempat kegagalan terjadi, mengikuti urutan pengecekan bawah ke atas. */
  layer?: 'physical' | 'layer2' | 'ip' | 'route' | 'nat' | 'service';
}
