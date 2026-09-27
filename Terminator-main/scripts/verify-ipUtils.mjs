/**
 * Sanity checks for the canonical IPv4 helpers in src/utils/ipUtils.ts.
 * Pure functions, no DOM — runnable with plain node, no test framework.
 *
 *   node scripts/verify-ipUtils.mjs
 *
 * Imports the real TypeScript module via Node's native type stripping
 * (Node >= 22.6), so these assertions can never drift from the source.
 */
import assert from 'node:assert/strict';
import { isValidIpv4, ipToNumber, isSameSubnet, maskToPrefixLength } from '../src/utils/ipUtils.ts';

// ---- the assertions ----------------------------------------------------
let n = 0;
const ok = (msg, cond) => {
  n++;
  assert.ok(cond, msg);
};

// Canonical dotted-quad
for (const good of ['0.0.0.0', '1.1.1.1', '192.168.1.1', '255.255.255.255', '10.0.0.1', '8.8.8.8']) {
  ok(`harus valid: ${good}`, isValidIpv4(good));
}
// Surrounding whitespace is tolerated (inputs come from text fields)
ok('spasi luar diabaikan', isValidIpv4('  192.168.1.1  '));

// Rejected: leading zeros used to be the source of the two-implementation bug
for (const bad of ['010.1.1.1', '1.1.1.01', '192.168.001.1']) {
  ok(`leading zero ditolak: ${bad}`, !isValidIpv4(bad));
}
// Rejected: out of range, arity, and exotic numeric literals
for (const bad of [
  '256.1.1.1', '1.1.1.256', '1.1.1', '1.1.1.1.1', '', '   ',
  'a.b.c.d', '1.1.1.-1', '1.1.1.+1', '1.1.1.1e2', '0x1.1.1.1', '1..1.1', '.1.1.1',
]) {
  ok(`harus ditolak: ${JSON.stringify(bad)}`, !isValidIpv4(bad));
}
// Rejected: non-string input must not throw (topology JSON arrives untyped)
for (const bad of [null, undefined, 12345, {}, [], NaN, true, 3232235777]) {
  ok(`non-string ditolak: ${String(bad)}`, !isValidIpv4(bad));
}

ok('ipToNumber 0.0.0.0', ipToNumber('0.0.0.0') === 0);
ok('ipToNumber 255.255.255.255', ipToNumber('255.255.255.255') === 4294967295);
ok('ipToNumber 192.168.1.1', ipToNumber('192.168.1.1') === 3232235777);
ok('ipToNumber input invalid -> 0 (bukan NaN)', ipToNumber('nope') === 0);

ok('prefix /24', maskToPrefixLength('255.255.255.0') === 24);
ok('prefix /30', maskToPrefixLength('255.255.255.252') === 30);
ok('prefix /16', maskToPrefixLength('255.255.0.0') === 16);
ok('prefix /8', maskToPrefixLength('255.0.0.0') === 8);
ok('prefix /0', maskToPrefixLength('0.0.0.0') === 0);
ok('prefix /32', maskToPrefixLength('255.255.255.255') === 32);
// Non-contiguous masks must not silently masquerade as a valid prefix
ok('mask non-kontigu 255.0.255.0 ditolak', maskToPrefixLength('255.0.255.0') === 0);
ok('mask non-kontigu 255.255.0.255 ditolak', maskToPrefixLength('255.255.0.255') === 0);

ok('same /24', isSameSubnet('192.168.1.10', '192.168.1.200'));
ok('beda /24', !isSameSubnet('192.168.1.10', '192.168.2.10'));
ok('beda /25', !isSameSubnet('192.168.1.10', '192.168.1.200', '255.255.255.128'));
ok('sama /25', isSameSubnet('192.168.1.10', '192.168.1.127', '255.255.255.128'));
// High-bit addresses: int32 coercion must not flip the result
ok('sama pada 200.x (uji rollback int32)', isSameSubnet('200.10.1.5', '200.10.1.9'));
ok('beda pada 200.x', !isSameSubnet('200.10.1.5', '201.10.1.9'));
ok('input invalid -> false', !isSameSubnet('010.1.1.1', '10.1.1.1'));

console.log(`ok — ${n} assertions passed`);
