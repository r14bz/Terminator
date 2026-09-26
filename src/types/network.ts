/**
 * Network domain types.
 *
 * NOTE: this file unifies two type schemas that coexist in the codebase.
 *  - "legacy" schema  : NetworkDevice / NetworkLink / PortConfig  (catalogs, engines, modals)
 *  - "current" schema : NetworkNode  / CableConnection / DevicePort (canvas, inspector, templates)
 * Both are exported so each consumer keeps the exact shape it was written against.
 */

/* ------------------------------------------------------------------ *
 * Device types
 * ------------------------------------------------------------------ */

export type DeviceType =
  // legacy schema
  | 'pc'
  | 'laptop'
  | 'server'
  | 'smartphone'
  | 'printer'
  | 'switch'
  | 'switch_hub'
  | 'router'
  | 'mikrotik'
  | 'olt'
  | 'ont'
  | 'splitter'
  | 'splitter_1_2'
  | 'splitter_1_8'
  | 'splitter_1_4'
  | 'odc'
  | 'odp'
  | 'cctv'
  | 'access_point'
  | 'mesh_wifi'
  | 'cloud_internet'
  | 'sensor_temp'
  | 'smart_plug'
  | 'smart_cam'
  | 'smart_lock'
  | 'iot_hub';

/**
 * Device types of the current schema (templates, deviceDefinitions, canvas).
 * Kept separate from {@link DeviceType} so every catalog stays exhaustive
 * over its own key set.
 */
export type NodeType =
  | 'internet'
  | 'metro'
  | 'olt'
  | 'odc'
  | 'odp'
  | 'splitter'
  | 'htb'
  | 'ont'
  | 'mikrotik'
  | 'switch'
  | 'router'
  | 'mesh'
  | 'pc'
  | 'cctv'
  | 'smartphone'
  | 'iot'
  | 'server';

export type DeviceCategory = 'ftth' | 'routing' | 'client_iot' | 'infrastructure';

/* ------------------------------------------------------------------ *
 * Ports & media
 * ------------------------------------------------------------------ */

export type PortType =
  | 'ethernet_fe'
  | 'ethernet_ge'
  | 'optical_sc'
  | 'optical_lc'
  | 'sfp_pon'
  | 'sfp_fiber'
  | 'pon_optical'
  | 'coaxial'
  | 'serial'
  | 'wireless';

export type PortMedium = 'fiber' | 'ethernet' | 'coaxial' | 'wireless';

export interface PortConfig {
  id: string;
  name: string;
  type: PortType;
  isUp: boolean;
  mac?: string;
  ipAssignment?: 'static' | 'dhcp' | 'none';
  ipAddress?: string;
  subnetMask?: string;
  defaultGateway?: string;
  dnsServer?: string;
  speedMbps?: number;
  // VLAN 802.1Q configuration
  portMode?: 'access' | 'trunk';
  vlanMode?: 'access' | 'trunk';
  vlanId?: number; // for access port, default 1
  allowedVlans?: number[]; // for trunk port e.g. [1, 10, 20, 30]
  trunkAllowedVlans?: number[];
  nativeVlan?: number; // for trunk port, default 1
}

export interface DevicePort {
  id: string;
  name: string;
  medium: PortMedium;
  connectedCableId?: string;
  status: 'up' | 'down';
  vlanId?: number;
  speedMbps?: number;
  ipAddress?: string;
  txPowerDbm?: number; // For OLT PON ports (+3 dBm)
}

/* ------------------------------------------------------------------ *
 * Cables
 * ------------------------------------------------------------------ */

export type CableType =
  // legacy schema
  | 'ethernet_straight'
  | 'ethernet_cross'
  | 'ethernet_crossover'
  | 'fiber_single'
  | 'fiber_multi'
  | 'dropcore'
  | 'feeder_fiber'
  | 'dist_fiber'
  | 'coaxial'
  | 'coaxial_rg6'
  | 'serial_cable'
  | 'wireless_link';

/**
 * Cable types of the current schema (templates, cableDefinitions, canvas).
 * Kept separate from {@link CableType} so every catalog stays exhaustive
 * over its own key set.
 */
export type NodeCableType =
  | 'feeder'       // Kabel Optik Feeder (OLT -> ODC)
  | 'distribusi'   // Kabel Optik Distribusi (ODC -> ODP)
  | 'drop_core'    // Kabel Optik Drop Core (ODP -> ONT)
  | 'lan'          // Kabel LAN / UTP RJ45
  | 'coaxial'      // Kabel Coaxial
  | 'wireless';    // Koneksi Nirkabel / Wi-Fi

export interface NetworkLink {
  id: string;
  fromDeviceId: string;
  fromPortId: string;
  toDeviceId: string;
  toPortId: string;
  cableType: CableType;
  lengthMeters: number;
  status: 'active' | 'down' | 'degraded';
  attenuationDb?: number;
}

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

/* ------------------------------------------------------------------ *
 * Routing / switching config
 * ------------------------------------------------------------------ */

export interface VlanEntry {
  id: number;
  name: string;
  description?: string;
}

export interface SubinterfaceConfig {
  id: string;
  name: string; // e.g. "Gi0/0.10"
  physicalPortName: string; // e.g. "GigabitEthernet0/0"
  vlanId: number;
  ipAddress: string;
  subnetMask: string;
  isUp: boolean;
}

export interface RouteEntry {
  id: string;
  network: string; // e.g. "192.168.2.0"
  netmask: string; // e.g. "255.255.255.0"
  gateway: string; // e.g. "10.0.0.2"
  interfaceName: string;
  metric: number;
  protocol?: 'STATIC' | 'OSPF' | 'BGP' | 'CONNECTED';
}

export interface OSPFNetworkArea {
  id: string;
  network: string; // e.g. "192.168.1.0"
  wildcard?: string; // e.g. "0.0.0.255"
  area: number; // e.g. 0 (Backbone)
}

export interface OSPFNeighbor {
  neighborRouterId: string;
  ipAddress?: string;
  state?: 'Down' | 'Init' | '2-Way' | 'ExStart' | 'Exchange' | 'Loading' | 'Full';
  interfaceName?: string;
  cost?: number;
}

export interface OSPFConfig {
  enabled: boolean;
  processId: number;
  routerId: string; // e.g. "1.1.1.1"
  areaId?: number;
  areas?: OSPFNetworkArea[];
  neighbors?: (string | OSPFNeighbor)[];
  cost?: number;
}

export interface BGPNeighbor {
  id?: string;
  ipAddress?: string;
  neighborIp?: string;
  remoteAs: number;
  state?: 'Idle' | 'Connect' | 'Active' | 'OpenSent' | 'OpenConfirm' | 'Established';
  status?: string;
  routesReceivedCount?: number;
}

export interface BGPConfig {
  enabled: boolean;
  asNumber: number; // e.g. 65001
  routerId: string; // e.g. "10.0.0.1"
  neighbors: BGPNeighbor[];
  advertisedNetworks: string[]; // e.g. ["192.168.10.0/24", "172.16.0.0/16"]
}

export interface DHCPServerConfig {
  enabled: boolean;
  interfaceName: string;
  network: string;
  netmask: string;
  rangeStart: string;
  rangeEnd: string;
  gateway: string;
  dns: string;
  leaseTimeHours: number;
}

export interface WirelessConfig {
  enabled: boolean;
  ssid: string;
  password?: string;
  band?: '2.4GHz' | '5GHz' | 'dual';
  channel?: number;
  security?: 'WPA2-PSK' | 'WPA3' | 'Open';
  isMeshNode?: boolean;
}

/* ------------------------------------------------------------------ *
 * Optical / media config
 * ------------------------------------------------------------------ */

export interface OpticalConfig {
  isOLT?: boolean;
  isONT?: boolean;
  isSplitter?: boolean;
  isODC?: boolean;
  isODP?: boolean;
  sfpModuleType?: string;
  txPowerDbm?: number; // e.g. +2.5 dBm
  rxSensitivityDbm?: number; // e.g. -27.0 dBm
  splitRatio?: '1:2' | '1:4' | '1:8' | '1:16' | '1:32';
  insertionLossDb?: number;
  connectorType?: 'SC/APC' | 'SC/UPC';
  calculatedRxPowerDbm?: number;
  feederLengthMeters?: number;
  distributionLengthMeters?: number;
  dropcoreLengthMeters?: number;
}

export interface CCTVConfig {
  rtspUrl: string;
  resolution: '720p' | '1080p' | '4K';
  fps: number;
  motionDetected: boolean;
  irNightVision: boolean;
  poePowered: boolean;
}

/* ------------------------------------------------------------------ *
 * IoT
 * ------------------------------------------------------------------ */

export interface IoTAutomationRule {
  id: string;
  name: string;
  trigger: 'temp_above' | 'temp_below' | 'motion_detected' | 'power_above';
  threshold: number;
  targetDeviceId: string;
  action: 'turn_on_plug' | 'turn_off_plug' | 'trigger_alarm';
  enabled: boolean;
}

export interface IoTTelemetry {
  deviceType?: 'sensor_temp' | 'smart_plug' | 'smart_cam' | 'smart_lock' | 'iot_hub';
  deviceCategory?: string;
  temperature?: number; // °C (e.g. 28.5)
  tempCelsius?: number;
  humidity?: number; // % (e.g. 65)
  humidityPercent?: number;
  plugState?: 'ON' | 'OFF';
  powerWatts?: number; // e.g. 45W
  powerWatt?: number;
  lockState?: 'LOCKED' | 'UNLOCKED';
  motionDetected?: boolean;
  batteryPercent?: number;
  telemetryIntervalSec?: number;
  mqttBrokerIp?: string;
  mqttTopic?: string;
  lastMessage?: string;
  automationRule?: {
    enabled: boolean;
    conditionType: 'temp_above' | 'motion' | 'power_above';
    thresholdValue?: number;
    targetDeviceId?: string;
    action: 'turn_on_plug' | 'turn_off_plug' | 'unlock' | 'send_alert';
  };
  automationRules?: IoTAutomationRule[];
}

export interface TrafficGeneratorStream {
  id: string;
  name: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  targetIp?: string;
  rateMbps: number; // e.g. 80 Mbps, 150 Mbps, 800 Mbps
  protocol?: 'UDP' | 'TCP' | 'VoIP' | 'Video_4K';
  trafficType?: 'udp' | 'tcp' | 'voip' | 'video';
  packetSize?: number; // bytes
  packetSizeBytes?: number;
  active?: boolean;
  isActive?: boolean;
  currentThroughputMbps?: number;
  latencyInflationMs?: number;
  packetLossPercent?: number;
}

/* ------------------------------------------------------------------ *
 * Devices
 * ------------------------------------------------------------------ */

export interface NetworkDevice {
  id: string;
  name: string;
  type: DeviceType;
  category: 'end_device' | 'switching' | 'routing' | 'optical' | 'wireless_iot' | 'iot_smart' | 'wireless' | 'iot';
  x: number;
  y: number;
  ports: PortConfig[];
  routingTable?: RouteEntry[];
  dhcpServer?: DHCPServerConfig;
  wirelessConfig?: WirelessConfig;
  opticalConfig?: OpticalConfig;
  cctvConfig?: CCTVConfig;
  iotTelemetry?: IoTTelemetry;
  // Advanced features
  vlans?: VlanEntry[];
  subinterfaces?: SubinterfaceConfig[];
  ospfConfig?: OSPFConfig;
  bgpConfig?: BGPConfig;
  trafficStreams?: TrafficGeneratorStream[];
  // Device Hardware Metrics
  cpuUsagePercent?: number;
  memoryUsagePercent?: number;
  status: 'online' | 'warning' | 'offline';
  notes?: string;
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
  notes?: string;

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
  };

  // Real OLT Hardware Config
  oltConfig?: {
    brand: string;
    model: string;
    sfpClass: 'B+ (+3dBm)' | 'C+ (+5dBm)' | 'C++ (+7dBm)';
    autoAuthOnu: boolean;
    dbaProfile: string;
    uplinkVlan: number;
  };

  // Real Switch Hub Hardware Config
  switchConfig?: {
    brand: string;
    model: string;
    isManaged: boolean;
    stpEnabled: boolean;
    vlanTrunkPort?: string;
  };

  // Real CCTV Camera Config
  cctvConfig?: {
    brand: string;
    model: string;
    resolution: '1080p Full HD' | '2K (4MP)' | '4K Ultra HD';
    rtspUrl: string;
    fps: number;
    irNightVision: boolean;
    poeActive: boolean;
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

  // Wireless Config
  wirelessConfig?: {
    ssid?: string;
    frequency?: '2.4GHz' | '5GHz' | 'Dual-Band';
    channel?: number;
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
  defaultPorts: Array<{ name: string; medium: PortMedium }>;
  color: string;
  standardOpticalLoss?: string; // dB range
}

/* ------------------------------------------------------------------ *
 * Tools & animation
 * ------------------------------------------------------------------ */

export type ActiveTool =
  // current schema
  | 'select'
  | 'move'
  | 'pan'
  | 'cable'
  | 'opm'
  | 'ping'
  // toolbar/cable-tool values
  | 'ethernet_straight'
  | 'ethernet_crossover'
  | 'fiber_single'
  | 'fiber_multi'
  | 'wireless_link'
  | 'pointer'
  | 'auto_connect'
  | 'ping_tool'
  | 'delete_tool';

export interface PacketAnimation {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number; // 0 to 1
  color: string;
}

export interface SimulationPacket {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  cableId: string;
  progress: number;            // 0.0 to 1.0
  type: 'ping' | 'data' | 'dhcp' | 'optical' | 'error';
  color: string;
}

/* ------------------------------------------------------------------ *
 * Tests & diagnostics
 * ------------------------------------------------------------------ */

export interface TestResult {
  id: string;
  timestamp: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  targetIp: string;
  success: boolean;
  packetsSent: number;
  packetsReceived: number;
  packetLoss: number;
  rttMin: number;
  rttAvg: number;
  rttMax: number;
  hops: string[];
  logs: string[];
  diagnosisMessage?: string;
}

/**
 * Diagnostic issue produced by either engine.
 * `cause`/`solution`/`category` come from the current engine (diagnosticEngine),
 * while `description`/`rootCause`/`stepsToFix`/`autoFix*` come from the legacy
 * engine (diagnosticsEngine). Fields unique to one schema are optional.
 */
export interface DiagnosticIssue {
  id: string;
  severity: 'error' | 'critical' | 'warning' | 'info';
  title: string;
  // current schema
  targetNodeId?: string;
  targetCableId?: string;
  cause?: string;              // Gejala & Penyebab
  solution?: string;           // Langkah Solusi untuk Teknisi
  category?: 'optical' | 'ip' | 'physical' | 'configuration' | 'topology';
  // legacy schema
  description?: string;
  relatedDeviceIds?: string[];
  relatedLinkIds?: string[];
  rootCause?: string;
  stepsToFix?: string[];
  autoFixAvailable?: boolean;
  autoFixAction?: string;
}

export interface TopologyData {
  name: string;
  description?: string;
  devices: NetworkDevice[];
  links: NetworkLink[];
  testResults?: TestResult[];
  activeStreams?: TrafficGeneratorStream[];
  exportedAt: string;
}
