export type DeviceType =
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

export type CableType =
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

export interface PacketAnimation {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number; // 0 to 1
  color: string;
}

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

export interface DiagnosticIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  relatedDeviceIds?: string[];
  relatedLinkIds?: string[];
  rootCause: string;
  stepsToFix: string[];
  autoFixAvailable: boolean;
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
