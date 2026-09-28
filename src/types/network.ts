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

export type PortMedium = 'fiber' | 'ethernet' | 'coaxial' | 'wireless';

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
  };

  // Real Switch Hub Hardware Config
  switchConfig?: {
    brand: string;
    model: string;
    isManaged: boolean;
    stpEnabled: boolean;
    vlanTrunkPort?: string;
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
}
