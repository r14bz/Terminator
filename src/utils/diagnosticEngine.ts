import type { NetworkNode, CableConnection, DiagnosticIssue } from '../types/network';
import type { OpticalCalculationResult } from './opticalCalculator';
import { validateTopology } from './topologyValidator';

/** Pintu masuk diagnostik untuk UI dan autoFix: semua aturan dibaca dari validator terpusat. */
export function runNetworkDiagnostics(
  nodes: NetworkNode[],
  cables: CableConnection[],
  _opticalResults: Map<string, OpticalCalculationResult>,
): DiagnosticIssue[] {
  return validateTopology(nodes, cables).issues;
}
