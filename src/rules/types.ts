import type { CableConnection, DiagnosticIssue, NetworkNode } from '../types/network';
export interface RuleContext { nodes: readonly NetworkNode[]; cables: readonly CableConnection[]; }
export type RuleValidator = (ctx: RuleContext) => DiagnosticIssue[];
