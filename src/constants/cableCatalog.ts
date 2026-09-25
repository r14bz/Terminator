import { CableType, PortType, DeviceType } from '../types/network';

export interface CableSpecification {
  type: CableType;
  name: string;
  shortName: string;
  description: string;
  color: string;
  strokeDashArray?: string;
  maxDistanceMeters: number;
  speedMbps: number;
  attenuationPerKmDb?: number;
  supportedPorts: PortType[];
  category: 'copper' | 'optical' | 'wireless';
}

export const CABLE_CATALOG: Record<CableType, CableSpecification> = {
  ethernet_straight: {
    type: 'ethernet_straight',
    name: 'Kabel UTP Straight-Through (Cat6 RJ45)',
    shortName: 'LAN Straight',
    description: 'Kabel tembaga standar untuk menghubungkan perangkat berbeda jenis (PC ke Switch, Switch ke Router, CCTV ke Switch PoE).',
    color: '#0284c7', // Sky blue
    maxDistanceMeters: 100,
    speedMbps: 1000,
    supportedPorts: ['ethernet_fe', 'ethernet_ge'],
    category: 'copper',
  },
  ethernet_crossover: {
    type: 'ethernet_crossover',
    name: 'Kabel UTP Crossover (RJ45)',
    shortName: 'LAN Crossover',
    description: 'Kabel silang untuk menghubungkan perangkat sejenis secara langsung (Switch ke Switch lama, PC ke PC, Router ke Router).',
    color: '#ea580c', // Orange
    strokeDashArray: '6 4',
    maxDistanceMeters: 100,
    speedMbps: 1000,
    supportedPorts: ['ethernet_fe', 'ethernet_ge'],
    category: 'copper',
  },
  fiber_single: {
    type: 'fiber_single',
    name: 'Kabel Fiber Optik Single Mode (SC/APC PON)',
    shortName: 'Fiber Optic PON',
    description: 'Kabel serat optik inti tunggal untuk jaringan GPON/FTTH (OLT ke Splitter, Splitter ke ONT). Redaman sangat rendah (~0.35 dB/km).',
    color: '#eab308', // Yellow
    maxDistanceMeters: 20000, // 20 km
    speedMbps: 2488,
    attenuationPerKmDb: 0.35,
    supportedPorts: ['pon_optical'],
    category: 'optical',
  },
  dropcore: {
    type: 'dropcore',
    name: 'Kabel Dropcore Fiber Optik 1-Core (SC/APC)',
    shortName: 'Dropcore FTTH',
    description: 'Kabel fiber optik khusus tarikan rumah pelanggan dari tiang ODP ke roset/ONT. Dilengkapi kawat baja penguat dan konektor SC/APC.',
    color: '#10b981', // Emerald green
    maxDistanceMeters: 500,
    speedMbps: 2488,
    attenuationPerKmDb: 0.35,
    supportedPorts: ['pon_optical'],
    category: 'optical',
  },
  feeder_fiber: {
    type: 'feeder_fiber',
    name: 'Kabel Feeder Fiber Optik (OLT ke ODC)',
    shortName: 'Feeder Cable',
    description: 'Kabel serat optik berkapasitas besar (24/48 core) yang menghubungkan Central Office (OLT) ke gardu pembagi ODC.',
    color: '#f59e0b', // Amber
    strokeDashArray: '8 2',
    maxDistanceMeters: 15000,
    speedMbps: 10000,
    attenuationPerKmDb: 0.35,
    supportedPorts: ['pon_optical', 'sfp_fiber'],
    category: 'optical',
  },
  dist_fiber: {
    type: 'dist_fiber',
    name: 'Kabel Distribusi Fiber Optik (ODC ke ODP)',
    shortName: 'Distribusi Fiber',
    description: 'Kabel optik distribusi dari ODC menuju kotak pembagi ODP yang dipasang di tiang-tiang area permukiman.',
    color: '#84cc16', // Lime
    strokeDashArray: '6 3',
    maxDistanceMeters: 5000,
    speedMbps: 2488,
    attenuationPerKmDb: 0.35,
    supportedPorts: ['pon_optical'],
    category: 'optical',
  },
  fiber_multi: {
    type: 'fiber_multi',
    name: 'Kabel Fiber Optik SFP Multi Mode (LC/LC)',
    shortName: 'Fiber SFP Uplink',
    description: 'Kabel duplex optik berkecepatan 10Gbps untuk koneksi backbone antar Switch Core, OLT Uplink, dan Server.',
    color: '#06b6d4', // Teal/Aqua
    strokeDashArray: '10 3',
    maxDistanceMeters: 550,
    speedMbps: 10000,
    attenuationPerKmDb: 2.5,
    supportedPorts: ['sfp_fiber'],
    category: 'optical',
  },
  coaxial: {
    type: 'coaxial',
    name: 'Kabel Koaksial (RG6 / Coax)',
    shortName: 'Coaxial',
    description: 'Kabel transmisi frekuensi radio dengan pelindung ganda untuk CCTV analog/HD-CVI atau modem kabel DOCSIS.',
    color: '#71717a', // Zinc
    maxDistanceMeters: 300,
    speedMbps: 100,
    supportedPorts: ['coaxial', 'ethernet_fe'],
    category: 'copper',
  },
  coaxial_rg6: {
    type: 'coaxial_rg6',
    name: 'Kabel Koaksial RG6 (BNC)',
    shortName: 'Coax RG6',
    description: 'Kabel koaksial tembaga 75 Ohm berpelindung.',
    color: '#71717a',
    maxDistanceMeters: 300,
    speedMbps: 100,
    supportedPorts: ['coaxial'],
    category: 'copper',
  },
  ethernet_cross: {
    type: 'ethernet_cross',
    name: 'Kabel UTP Crossover (RJ45)',
    shortName: 'LAN Cross',
    description: 'Kabel UTP Crossover silang antar host.',
    color: '#ea580c',
    strokeDashArray: '6 4',
    maxDistanceMeters: 100,
    speedMbps: 1000,
    supportedPorts: ['ethernet_fe', 'ethernet_ge'],
    category: 'copper',
  },
  serial_cable: {
    type: 'serial_cable',
    name: 'Kabel Serial V.35 / RS-232 DCE/DTE',
    shortName: 'Serial WAN',
    description: 'Kabel serial WAN inter-router.',
    color: '#0284c7',
    strokeDashArray: '8 4',
    maxDistanceMeters: 50,
    speedMbps: 2,
    supportedPorts: ['serial'],
    category: 'copper',
  },
  wireless_link: {
    type: 'wireless_link',
    name: 'Koneksi Nirkabel (Wi-Fi 802.11ax / Mesh)',
    shortName: 'Wi-Fi / Mesh Link',
    description: 'Tautan frekuensi radio nirkabel (2.4 GHz / 5 GHz) tanpa kabel fisik antara Smartphone/Laptop/IoT dengan AP, ONT, atau Mesh.',
    color: '#a855f7', // Purple
    strokeDashArray: '4 4',
    maxDistanceMeters: 50,
    speedMbps: 1200,
    supportedPorts: ['wireless'],
    category: 'wireless',
  },
};

/**
 * Checks if a cable can physically plug into both ports
 */
export function isPortCompatibleWithCable(port: PortType, cable: CableType): boolean {
  const spec = CABLE_CATALOG[cable];
  if (!spec) return false;
  return spec.supportedPorts.includes(port);
}

/**
 * Auto-select the most appropriate cable type between two ports
 */
export function getRecommendedCable(
  a: PortType | DeviceType,
  b: PortType | DeviceType,
  c?: PortType | DeviceType,
  d?: PortType | DeviceType,
): CableType {
  const allArgs = [a, b, c, d].filter(Boolean) as string[];

  // Known port types
  const portTypes = ['ethernet_fe', 'ethernet_ge', 'optical_sc', 'optical_lc', 'sfp_pon', 'sfp_fiber', 'pon_optical', 'coaxial', 'serial', 'wireless'];
  const ports = allArgs.filter((x) => portTypes.includes(x)) as PortType[];
  const devs = allArgs.filter((x) => !portTypes.includes(x)) as DeviceType[];

  const port1Type = ports[0] || 'ethernet_ge';
  const port2Type = ports[1] || 'ethernet_ge';
  const dev1Type = devs[0] || 'pc';
  const dev2Type = devs[1] || 'switch';

  // Wireless
  if (port1Type === 'wireless' || port2Type === 'wireless') {
    return 'wireless_link';
  }

  // FTTH specific: ODP to ONT uses Dropcore
  if (
    (dev1Type === 'odp' && dev2Type === 'ont') ||
    (dev2Type === 'odp' && dev1Type === 'ont')
  ) {
    return 'dropcore';
  }

  // FTTH specific: OLT to ODC uses Feeder
  if (
    (dev1Type === 'olt' && dev2Type === 'odc') ||
    (dev2Type === 'olt' && dev1Type === 'odc')
  ) {
    return 'feeder_fiber';
  }

  // FTTH specific: ODC to ODP uses Distribution cable
  if (
    (dev1Type === 'odc' && dev2Type === 'odp') ||
    (dev2Type === 'odc' && dev1Type === 'odp')
  ) {
    return 'dist_fiber';
  }

  // PON Optical (OLT, Splitter, ONT)
  if (port1Type === 'pon_optical' || port2Type === 'pon_optical' || port1Type === 'sfp_pon' || port2Type === 'sfp_pon' || port1Type === 'optical_sc' || port2Type === 'optical_sc') {
    return 'fiber_single';
  }

  // SFP Optical Uplinks
  if (port1Type === 'sfp_fiber' && port2Type === 'sfp_fiber') {
    return 'fiber_multi';
  }

  // Coaxial
  if (port1Type === 'coaxial' && port2Type === 'coaxial') {
    return 'coaxial_rg6';
  }

  // Copper Ethernet
  const isDev1Station = ['pc', 'laptop', 'server', 'printer', 'cctv', 'router', 'smart_cam', 'sensor_temp', 'iot_hub'].includes(dev1Type);
  const isDev2Station = ['pc', 'laptop', 'server', 'printer', 'cctv', 'router', 'smart_cam', 'sensor_temp', 'iot_hub'].includes(dev2Type);

  // Like devices connected together usually use crossover
  if (
    (dev1Type === 'switch' && dev2Type === 'switch') ||
    (isDev1Station && isDev2Station && dev1Type === dev2Type)
  ) {
    return 'ethernet_cross';
  }

  // Standard straight-through
  return 'ethernet_straight';
}


/**
 * Detailed Splitter Insertion Loss specification (ITU-T G.671 / G.984)
 */
export const SPLITTER_LOSS: Record<string, number> = {
  '1:2': 3.5,
  '1:4': 7.2,
  '1:8': 10.5,
  '1:16': 14.1,
  '1:32': 17.5,
};

/**
 * Calculate optical attenuation (redaman dBm) for GPON link
 */
export function calculateOpticalLinkBudget(
  txPowerDbm: number,
  fiberDistanceMeters: number,
  splitterRatio?: '1:2' | '1:4' | '1:8' | '1:16' | '1:32',
  additionalSplices: number = 2,
): {
  rxPowerDbm: number;
  totalLossDb: number;
  fiberLossDb: number;
  splitterLossDb: number;
  connectorLossDb: number;
  isWithinStandard: boolean;
  statusLabel: 'Optimal' | 'Warning' | 'LOS_Critical';
  warning?: string;
} {
  // Fiber loss: ~0.35 dB/km (G.652 standard single mode at 1490nm downlink)
  const fiberLossDb = (fiberDistanceMeters / 1000) * 0.35;
  
  // Insertion loss per standard PLC splitter
  const splitterLossDb = splitterRatio ? (SPLITTER_LOSS[splitterRatio] || 7.2) : 0;

  // SC/APC connector loss ~0.3 dB per connector pair + fusion splice ~0.05 dB
  const connectorLossDb = additionalSplices * 0.35;
  
  const totalLossDb = fiberLossDb + splitterLossDb + connectorLossDb;
  const rxPowerDbm = Number((txPowerDbm - totalLossDb).toFixed(2));

  // ITU-T G.984 GPON Class B+ & C+:
  // Normal range: -8.0 dBm to -24.0 dBm
  // Warning range: -24.1 dBm to -27.0 dBm
  // LOS (Loss of Signal / Bad): < -27.0 dBm or > -8.0 dBm
  let statusLabel: 'Optimal' | 'Warning' | 'LOS_Critical' = 'Optimal';
  let isWithinStandard = true;
  let warning: string | undefined = undefined;

  if (rxPowerDbm < -27.0) {
    statusLabel = 'LOS_Critical';
    isWithinStandard = false;
    warning = `Sinyal optik terlalu lemah (${rxPowerDbm} dBm). Standar minimum penerimaan ONT adalah -27.0 dBm. Terjadi Loss of Signal (LOS) / Redaman Tinggi!`;
  } else if (rxPowerDbm < -24.0) {
    statusLabel = 'Warning';
    isWithinStandard = true;
    warning = `Sinyal optik mendekati ambang batas sensitivitas (${rxPowerDbm} dBm). Rekomendasi teknisi Telkom/ISP: periksa sambungan ODP atau bersihkan konektor SC/APC.`;
  } else if (rxPowerDbm > -8.0) {
    statusLabel = 'LOS_Critical';
    isWithinStandard = false;
    warning = `Sinyal optik terlalu kuat (${rxPowerDbm} dBm). Dapat menyebabkan saturasi fotodioda penerima ONT.`;
  }

  return {
    rxPowerDbm,
    totalLossDb: Number(totalLossDb.toFixed(2)),
    fiberLossDb: Number(fiberLossDb.toFixed(2)),
    splitterLossDb: Number(splitterLossDb.toFixed(2)),
    connectorLossDb: Number(connectorLossDb.toFixed(2)),
    isWithinStandard,
    statusLabel,
    warning,
  };
}

/**
 * Calculates FTTH cascade loss from OLT to ONT
 */
export function calculateFTTHCascadeLoss(
  txPowerDbm: number = 3.0,
  feederMeters: number = 2000,
  odcRatio: string = '1:4',
  distMeters: number = 800,
  odpRatio: string = '1:8',
  dropcoreMeters: number = 150,
): { rxPowerDbm: number; totalLossDb: number; isAcceptable: boolean } {
  const feederLoss = (feederMeters / 1000) * 0.35 + 0.3;
  const odcLoss = SPLITTER_LOSS[odcRatio] || 7.2;
  const distLoss = (distMeters / 1000) * 0.35 + 0.3;
  const odpLoss = SPLITTER_LOSS[odpRatio] || 10.5;
  const dropLoss = (dropcoreMeters / 1000) * 0.35 + 0.3;

  const totalLoss = feederLoss + odcLoss + distLoss + odpLoss + dropLoss;
  const rxPower = txPowerDbm - totalLoss;

  return {
    rxPowerDbm: Number(rxPower.toFixed(2)),
    totalLossDb: Number(totalLoss.toFixed(2)),
    isAcceptable: rxPower >= -27.0 && rxPower <= -8.0,
  };
}

