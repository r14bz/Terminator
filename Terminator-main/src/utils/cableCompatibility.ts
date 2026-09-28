import type { NetworkNode, NodeCableType, PortMedium } from '../types/network';
import { CABLE_METADATA } from '../data/cableDefinitions';
import { DEVICE_METADATA } from '../data/deviceDefinitions';
import { mediumForCable } from './portReconcile';

export interface CableCompatibilityResult {
  allowed: boolean;
  reason?: string;
  solutionHint?: string;
  incompatibleNodeId?: string;
}

/**
 * Checks if a network node physically has hardware support for a given port medium.
 */
export function nodeSupportsMedium(node: NetworkNode, medium: PortMedium): boolean {
  // 1. Explicit port configured on this node
  if (node.ports && node.ports.some((p) => p.medium === medium)) {
    return true;
  }

  // 2. Default hardware specifications from device metadata
  const meta = DEVICE_METADATA[node.type];
  if (meta?.defaultPorts?.some((p) => p.medium === medium)) {
    return true;
  }

  // 3. Model-specific hardware capability inspection (for models with SFP, Wi-Fi, etc.)
  const modelStr = `${node.model || ''} ${node.label || ''} ${node.name || ''}`.toLowerCase();

  if (medium === 'fiber') {
    // SFP, SFP+, PON, Optic modules on routers or switches
    if (
      modelStr.includes('sfp') ||
      modelStr.includes('fiberbox') ||
      modelStr.includes('optical') ||
      modelStr.includes('pon') ||
      modelStr.includes('10ge') ||
      modelStr.includes('10g') ||
      modelStr.includes('c320') ||
      modelStr.includes('ma5608')
    ) {
      return true;
    }
    // Nodes that are strictly copper/wireless unless explicitly having SFP:
    if (['mikrotik', 'switch', 'router', 'pc', 'cctv', 'smartphone', 'iot', 'mesh'].includes(node.type)) {
      return false;
    }
  }

  if (medium === 'wireless') {
    if (
      modelStr.includes('wi-fi') ||
      modelStr.includes('wifi') ||
      modelStr.includes('hap') ||
      modelStr.includes('wireless') ||
      modelStr.includes('deco') ||
      modelStr.includes('ezviz')
    ) {
      return true;
    }
    if (['smartphone', 'iot', 'router', 'mesh', 'ont', 'pc', 'ap_ptp'].includes(node.type)) {
      return true;
    }
    return false;
  }

  if (medium === 'coaxial') {
    if (
      modelStr.includes('coaxial') ||
      modelStr.includes('hdcvi') ||
      modelStr.includes('bnc') ||
      modelStr.includes('analog')
    ) {
      return true;
    }
    return node.type === 'cctv';
  }

  if (medium === 'ethernet') {
    // Passive FTTH optical equipment and pure wireless devices have NO RJ45
    if (['odc', 'odp', 'splitter', 'smartphone', 'iot'].includes(node.type)) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Returns a human-friendly display name for a port medium.
 */
export function getMediumDisplayName(medium: PortMedium): string {
  switch (medium) {
    case 'fiber':
      return 'Fiber Optik (SC / SFP)';
    case 'ethernet':
      return 'Ethernet RJ-45';
    case 'coaxial':
      return 'Coaxial BNC';
    case 'wireless':
      return 'Nirkabel / Wi-Fi';
    default:
      return medium;
  }
}

/**
 * Validates whether two nodes can be physically connected via a specific cable type.
 * Returns { allowed: true } or { allowed: false, reason, solutionHint, incompatibleNodeId }.
 */
export function validateCableConnection(
  fromNode: NetworkNode,
  toNode: NetworkNode,
  cableType: NodeCableType
): CableCompatibilityResult {
  const cableMeta = CABLE_METADATA[cableType];
  const cableName = cableMeta?.name || cableType;
  const requiredMedium = mediumForCable(cableType);

  const fromSupports = nodeSupportsMedium(fromNode, requiredMedium);
  const toSupports = nodeSupportsMedium(toNode, requiredMedium);

  if (!fromSupports || !toSupports) {
    const badNode = !fromSupports ? fromNode : toNode;
    const badMediumName = getMediumDisplayName(requiredMedium);

    // 1. Fiber Optic Cables (Feeder, Distribusi, Drop Core)
    if (requiredMedium === 'fiber') {
      return {
        allowed: false,
        incompatibleNodeId: badNode.id,
        reason: `${badNode.name} (${badNode.model || badNode.label || badNode.type}) adalah perangkat tembaga/nirkabel dan tidak memiliki port Fiber Optik fisik (SC/SFP). Konektor kabel ${cableName} tidak dapat dicolokkan ke port RJ-45 tembaga.`,
        solutionHint: `Gunakan Kabel LAN UTP (Cat5e/Cat6) untuk menghubungkan perangkat tembaga, atau pasang Media Converter (HTB) / Modem ONT sebagai perantara optik ke RJ-45.`,
      };
    }

    // 2. Ethernet LAN Cable (Cat5e / Cat6 RJ45)
    if (requiredMedium === 'ethernet') {
      if (['odc', 'odp', 'splitter'].includes(badNode.type)) {
        return {
          allowed: false,
          incompatibleNodeId: badNode.id,
          reason: `${badNode.name} adalah kotak/komponen pasif fiber optik dan tidak memiliki port Ethernet RJ-45 tembaga.`,
          solutionHint: `Gunakan kabel optik yang sesuai (Kabel Feeder, Distribusi, atau Drop Core ber-konektor SC).`,
        };
      }
      if (['smartphone', 'iot'].includes(badNode.type)) {
        return {
          allowed: false,
          incompatibleNodeId: badNode.id,
          reason: `${badNode.name} adalah perangkat nirkabel murni tanpa soket kabel LAN RJ-45.`,
          solutionHint: `Pilih 'Koneksi Nirkabel / Wi-Fi' pada toolbar kabel untuk menghubungkan ke Access Point atau Router.`,
        };
      }
      return {
        allowed: false,
        incompatibleNodeId: badNode.id,
        reason: `${badNode.name} tidak memiliki port Ethernet (RJ-45) untuk kabel ${cableName}.`,
        solutionHint: `Gunakan media transmisi yang didukung oleh perangkat ini.`,
      };
    }

    // 3. Wireless Wi-Fi
    if (requiredMedium === 'wireless') {
      return {
        allowed: false,
        incompatibleNodeId: badNode.id,
        reason: `${badNode.name} (${badNode.model || badNode.label || badNode.type}) tidak memiliki modul radio Wi-Fi / nirkabel.`,
        solutionHint: `Gunakan Kabel LAN UTP berkabel atau hubungkan ke Router / Access Point Wi-Fi.`,
      };
    }

    // 4. Coaxial BNC
    if (requiredMedium === 'coaxial') {
      return {
        allowed: false,
        incompatibleNodeId: badNode.id,
        reason: `${badNode.name} tidak memiliki konektor BNC Coaxial (hanya didukung oleh kamera CCTV Analog/HDCVI atau TV kabel).`,
        solutionHint: `Gunakan Kabel LAN UTP untuk perangkat jaringan berbasis IP.`,
      };
    }

    return {
      allowed: false,
      incompatibleNodeId: badNode.id,
      reason: `${badNode.name} tidak mendukung media ${badMediumName}.`,
      solutionHint: `Pilih jenis kabel yang sesuai dengan spesifikasi port kedua perangkat.`,
    };
  }

  return { allowed: true };
}
