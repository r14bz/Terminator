/**
 * Laporan cakupan aturan: membandingkan semua ID aturan di dokumen dengan ID yang
 * dirujuk di kode (ruleRef) dan di test (scripts/verify-*.mjs).
 *   npm run test:coverage            laporan saja
 *   npm run test:coverage -- --strict  gagal jika ada ID yang tidak punya test dan tidak tercatat pending
 * Dokumen: docs/aturan-validator-simulator.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { PENDING_RULES } from '../src/utils/topologyValidator.ts';

const root = path.resolve(import.meta.dirname, '..');
const doc = fs.readFileSync(path.join(root, 'docs/aturan-validator-simulator.md'), 'utf8');
const ids = [...new Set(doc.split('\n').map((l) => l.match(/^\| (P\d+|\d+[A-C]?(?:\.\d+)+) \|/)?.[1]).filter(Boolean))];

const walk = (dir, ok) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p, ok) : ok(p) ? [p] : [];
});
const read = (files) => files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const code = read(walk(path.join(root, 'src'), (p) => /\.tsx?$/.test(p)));
const tests = read(walk(path.join(root, 'scripts'), (p) => /verify-.*\.mjs$/.test(p) && !p.includes('rule-coverage')));
const esc = (s) => s.replace(/\./g, '\\.');

// ID yang disebut di PENDING_RULES, mis. "4A.7 dan 4A.8", "4B.6 sampai 4B.8", "6.x per-SSID"
const pending = new Set();
for (const line of PENDING_RULES) {
  const head = line.split(':')[0];
  const found = head.match(/\d+[A-C]?(?:\.(?:\d+|x))+/g) ?? [];
  if (/sampai/.test(head) && found.length === 2) {
    const [a, b] = found.map((x) => x.split('.'));
    for (let n = Number(a[a.length - 1]); n <= Number(b[b.length - 1]); n++) pending.add(`${a.slice(0, -1).join('.')}.${n}`);
  }
  for (const f of found) {
    if (f.endsWith('.x')) ids.filter((i) => i.startsWith(f.slice(0, -1))).forEach((i) => pending.add(i));
    else pending.add(f);
  }
}

const rows = ids.map((id) => ({
  id,
  code: new RegExp(`ruleRef:\\s*'${esc(id)}'`).test(code),
  test: new RegExp(`['"\`\\[ (]${esc(id)}['"\`\\] :,)]`).test(tests),
  pending: pending.has(id),
}));
const group = (f) => rows.filter(f).map((r) => r.id);
const report = {
  'kode + test': group((r) => r.code && r.test),
  'kode saja (belum ada test)': group((r) => r.code && !r.test),
  'test saja (hasil normal/tanpa issue)': group((r) => !r.code && r.test),
  'pending (tercatat di PENDING_RULES)': group((r) => !r.code && !r.test && r.pending),
  'BELUM ADA kode, test, maupun catatan pending': group((r) => !r.code && !r.test && !r.pending),
};
console.log(`Total ID aturan di dokumen: ${ids.length}`);
for (const [k, v] of Object.entries(report)) console.log(`\n${k}: ${v.length}\n  ${v.join(' ') || '-'}`);
if (process.argv.includes('--strict') && (report['BELUM ADA kode, test, maupun catatan pending'].length || report['kode saja (belum ada test)'].length)) {
  console.error('\nSTRICT: masih ada ID tanpa test atau tanpa catatan pending.');
  process.exit(1);
}
