import type { NetworkNode } from '../types/network';
import { addressOf, isValidIpv4 } from './ipUtils';

export type PingPlan =
  | { kind: 'run'; sourceNodeId: string; targetIp: string }
  | { kind: 'reject'; reason: string };

export function planPing(
  source?: NetworkNode,
  target?: NetworkNode,
): PingPlan {
  if (!source) {
    return { kind: 'reject', reason: 'Perangkat sumber ping tidak ditemukan.' };
  }
  if (!target) {
    return { kind: 'reject', reason: 'Target ping tidak ditemukan.' };
  }
  if (!source.poweredOn) {
    return {
      kind: 'reject',
      reason: `Perangkat sumber (${source.name}) dalam keadaan mati.`,
    };
  }
  if (!target.poweredOn) {
    return {
      kind: 'reject',
      reason: `Target ping (${target.name}) dalam keadaan mati.`,
    };
  }

  const targetIp = addressOf(target);
  if (!targetIp || targetIp === '0.0.0.0') {
    return {
      kind: 'reject',
      reason: `Target ping (${target.name}) belum punya alamat IP.`,
    };
  }

  if (!isValidIpv4(targetIp)) {
    return {
      kind: 'reject',
      reason: `Alamat IP target ping (${targetIp}) tidak valid.`,
    };
  }

  return {
    kind: 'run',
    sourceNodeId: source.id,
    targetIp,
  };
}
