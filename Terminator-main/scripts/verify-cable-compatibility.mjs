/**
 * Verification suite for physical cable medium compatibility and validation.
 *
 * Run via:
 *   node --import ./scripts/ts-resolve.mjs scripts/verify-cable-compatibility.mjs
 */
import assert from 'node:assert/strict';
import { nodeSupportsMedium, validateCableConnection } from '../src/utils/cableCompatibility.ts';
import { runNetworkDiagnostics } from '../src/utils/diagnosticEngine.ts';
import { applyAutoFix, isAutoFixable } from '../src/utils/autoFix.ts';

let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};
const eq = (msg, actual, expected) => {
  n++;
  assert.deepEqual(actual, expected, `${msg}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
};

// Helper to build realistic nodes
const createNode = (id, type, name, model = '') => ({
  id,
  type,
  name,
  label: model || name,
  model,
  poweredOn: true,
  status: 'online',
  x: 0,
  y: 0,
  ports: [],
});

// -------------------------------------------------------------
// 1. Physical Hardware Medium Support (nodeSupportsMedium)
// -------------------------------------------------------------
const rb750 = createNode('mk1', 'mikrotik', 'MikroTik RB750Gr3', 'MikroTik RB750Gr3 (hEX Gigabit 5-Port)');
const archer = createNode('rtr1', 'router', 'TP-Link Archer', 'TP-Link Archer C6 Dual-Band AC1200');
const odp = createNode('odp1', 'odp', 'ODP Tiang 01');
const ont = createNode('ont1', 'ont', 'ONT ZTE F609', 'ZTE ZXHN F609 (GPON 4GE+Wi-Fi)');
const htb = createNode('htb1', 'htb', 'HTB Converter A');
const phone = createNode('ph1', 'smartphone', 'Smartphone User');
const pc = createNode('pc1', 'pc', 'PC Workstation');
const cctv = createNode('cctv1', 'cctv', 'CCTV IP Camera');
const rb4011 = createNode('mk2', 'mikrotik', 'MikroTik RB4011', 'MikroTik RB4011iGS+RM (10x Gigabit + SFP+ 10G)');

// RB750Gr3: Pure copper RJ-45
eq('RB750Gr3 supports ethernet', nodeSupportsMedium(rb750, 'ethernet'), true);
eq('RB750Gr3 does NOT support fiber', nodeSupportsMedium(rb750, 'fiber'), false);
eq('RB750Gr3 does NOT support wireless', nodeSupportsMedium(rb750, 'wireless'), false);
eq('RB750Gr3 does NOT support coaxial', nodeSupportsMedium(rb750, 'coaxial'), false);

// TP-Link Archer: Ethernet RJ-45 + Wi-Fi
eq('Archer supports ethernet', nodeSupportsMedium(archer, 'ethernet'), true);
eq('Archer supports wireless', nodeSupportsMedium(archer, 'wireless'), true);
eq('Archer does NOT support fiber', nodeSupportsMedium(archer, 'fiber'), false);
eq('Archer does NOT support coaxial', nodeSupportsMedium(archer, 'coaxial'), false);

// RB4011 (with SFP+): supports both Ethernet and Fiber
eq('RB4011 supports ethernet', nodeSupportsMedium(rb4011, 'ethernet'), true);
eq('RB4011 supports fiber (SFP+)', nodeSupportsMedium(rb4011, 'fiber'), true);

// ODP: Passive fiber box
eq('ODP supports fiber', nodeSupportsMedium(odp, 'fiber'), true);
eq('ODP does NOT support ethernet', nodeSupportsMedium(odp, 'ethernet'), false);
eq('ODP does NOT support wireless', nodeSupportsMedium(odp, 'wireless'), false);

// Smartphone: Pure Wi-Fi client
eq('Smartphone supports wireless', nodeSupportsMedium(phone, 'wireless'), true);
eq('Smartphone does NOT support ethernet', nodeSupportsMedium(phone, 'ethernet'), false);
eq('Smartphone does NOT support fiber', nodeSupportsMedium(phone, 'fiber'), false);

// HTB Media Converter: Fiber + Ethernet
eq('HTB supports fiber', nodeSupportsMedium(htb, 'fiber'), true);
eq('HTB supports ethernet', nodeSupportsMedium(htb, 'ethernet'), true);

// ONT GPON Modem: Fiber + Ethernet + Wireless
eq('ONT supports fiber', nodeSupportsMedium(ont, 'fiber'), true);
eq('ONT supports ethernet', nodeSupportsMedium(ont, 'ethernet'), true);
eq('ONT supports wireless', nodeSupportsMedium(ont, 'wireless'), true);

// -------------------------------------------------------------
// 2. Cable Connection Validation (validateCableConnection)
// -------------------------------------------------------------

// Case: RB750Gr3 <-> TP-Link Archer via Drop Core -> MUST BE REJECTED!
const testDropCore = validateCableConnection(rb750, archer, 'drop_core');
eq('RB750Gr3 to Archer via Drop Core is rejected', testDropCore.allowed, false);
ok('Rejection reason explains lack of fiber port', testDropCore.reason.includes('port Fiber Optik'));
ok('Solution hints at LAN UTP cable or HTB', testDropCore.solutionHint.includes('Kabel LAN UTP'));

// Case: RB750Gr3 <-> TP-Link Archer via LAN UTP -> MUST BE ALLOWED!
const testLan = validateCableConnection(rb750, archer, 'lan');
eq('RB750Gr3 to Archer via LAN is allowed', testLan.allowed, true);

// Case: ODP <-> ONT via Drop Core -> MUST BE ALLOWED!
const testOdpOnt = validateCableConnection(odp, ont, 'drop_core');
eq('ODP to ONT via Drop Core is allowed', testOdpOnt.allowed, true);

// Case: ODP <-> ONT via LAN UTP -> MUST BE REJECTED (ODP has no RJ45)
const testOdpLan = validateCableConnection(odp, ont, 'lan');
eq('ODP to ONT via LAN is rejected', testOdpLan.allowed, false);

// Case: Smartphone <-> Archer via LAN -> MUST BE REJECTED (Phone has no RJ45)
const testPhoneLan = validateCableConnection(phone, archer, 'lan');
eq('Smartphone to Archer via LAN is rejected', testPhoneLan.allowed, false);

// Case: Smartphone <-> Archer via Wireless -> MUST BE ALLOWED!
const testPhoneWifi = validateCableConnection(phone, archer, 'wireless');
eq('Smartphone to Archer via Wireless is allowed', testPhoneWifi.allowed, true);

// -------------------------------------------------------------
// 3. Diagnostics & AutoFix for Physical Mismatch
// -------------------------------------------------------------
const badCable = {
  id: 'c-bad-fo',
  fromNodeId: rb750.id,
  toNodeId: archer.id,
  type: 'drop_core',
  status: 'active',
  lengthKm: 0.05,
  attenuationDb: 0.02,
};

const issues = runNetworkDiagnostics([rb750, archer], [badCable], new Map());
const mismatchIssue = issues.find((i) => i.id.startsWith('physical-mismatch-'));
ok('Diagnostics detects physical medium mismatch issue', !!mismatchIssue);
eq('Mismatch issue severity is critical', mismatchIssue?.severity, 'critical');
eq('Mismatch issue is marked auto-fixable', isAutoFixable(mismatchIssue), true);

const fixResult = applyAutoFix(mismatchIssue, [rb750, archer], [badCable]);
ok('AutoFix succeeded', !!fixResult);
eq('Cable converted to LAN', fixResult.cables[0].type, 'lan');

// Re-run diagnostics on fixed topology
const afterIssues = runNetworkDiagnostics(fixResult.nodes, fixResult.cables, new Map());
const remainingMismatch = afterIssues.find((i) => i.id.startsWith('physical-mismatch-'));
eq('Physical mismatch issue is completely resolved after AutoFix', !!remainingMismatch, false);

console.log(`ok — ${n} cable compatibility assertions passed`);
