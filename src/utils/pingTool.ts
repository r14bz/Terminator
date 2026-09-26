import type { NetworkNode } from '../types/network';
import { addressOf, isValidIpv4 } from './ipUtils';

/**
 * Discriminant is a string literal, not a boolean: this project runs with
 * `strictNullChecks` off, and TypeScript does not narrow a union on a boolean
 * tag in that mode (it reports `Property 'reason' does not exist` even inside
 * `if (!plan.ok)`). A string tag narrows correctly with or without strict.
 */
export type PingPlan =
  | { kind: 'run'; sourceNodeId: string; targetIp: string; targetName: string }
  | { kind: 'reject'; reason: string };

/**
 * Decides whether the canvas ping tool can run, and against which address.
 *
 * The tool runs on a node pair, but the terminal it opens speaks in IP
 * addresses -- so the target's address has to be resolved up front. Returning a
 * plan instead of acting on it keeps the checks testable and means App only has
 * to translate a `reason` into a toast.
 *
 * The address is read through {@link addressOf}, the same helper TerminalModal
 * uses to match a ping back to a node. If the two ever diverged, the terminal
 * would open already running a ping that cannot find the node the technician
 * just clicked.
 */
export function planPing(source: NetworkNode | undefined, target: NetworkNode | undefined): PingPlan {
  if (!source || !target) {
    return { kind: 'reject', reason: 'Node sumber atau target tidak ditemukan.' };
  }
  if (!source.poweredOn) {
    return { kind: 'reject', reason: `Ping gagal: ${source.name} dalam keadaan mati.` };
  }
  if (!target.poweredOn) {
    return { kind: 'reject', reason: `Ping gagal: Target ${target.name} dalam keadaan mati.` };
  }

  const targetIp = addressOf(target);
  if (!isValidIpv4(targetIp)) {
    return {
      kind: 'reject',
      reason: `Ping gagal: ${target.name} belum punya alamat IP. Set IP di Node Inspector dulu.`,
    };
  }

  return { kind: 'run', sourceNodeId: source.id, targetIp, targetName: target.name };
}
