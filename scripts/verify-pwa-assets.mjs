/**
 * Pemeriksaan aset brand: favicon, icon PWA, apple-touch-icon, dan logo header.
 *   npm run test:pwa-assets
 * Memastikan setiap berkas yang dirujuk ada, ukuran PNG sama dengan yang dideklarasikan,
 * ikon "maskable" terpisah dari "any", dan header memakai logo.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pub = (p) => path.join(root, 'public', p.replace(/^\//, ''));
let count = 0;
const ok = (name, cond) => { count++; assert.ok(cond, name); };
const pngSize = (file) => {
  const b = fs.readFileSync(file);
  ok(`${path.basename(file)} adalah PNG`, b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

const manifest = JSON.parse(fs.readFileSync(pub('manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons) {
  const file = pub(icon.src);
  ok(`manifest: ${icon.src} ada`, fs.existsSync(file));
  const [w, h] = pngSize(file);
  ok(`manifest: ${icon.src} berukuran ${icon.sizes}`, `${w}x${h}` === icon.sizes);
  ok(`manifest: ${icon.src} tidak memakai purpose gabungan "any maskable"`, icon.purpose === 'any' || icon.purpose === 'maskable');
}
for (const size of ['192x192', '512x512']) {
  ok(`manifest: ada ikon any ${size}`, manifest.icons.some((i) => i.sizes === size && i.purpose === 'any'));
  ok(`manifest: ada ikon maskable ${size}`, manifest.icons.some((i) => i.sizes === size && i.purpose === 'maskable'));
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const hrefs = [...html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
ok('index.html: favicon.ico, PNG 32, ikon 192, dan apple-touch-icon terdaftar', ['/favicon.ico', '/icons/favicon-32.png', '/icons/terminator-192.png', '/icons/apple-touch-icon.png'].every((h) => hrefs.includes(h)));
for (const h of hrefs) ok(`index.html: ${h} ada`, fs.existsSync(pub(h)));
const ico = fs.readFileSync(pub('/favicon.ico'));
ok('favicon.ico: header ICO sah dengan minimal 2 ukuran', ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= 2);
ok('apple-touch-icon 180x180', pngSize(pub('/icons/apple-touch-icon.png')).join('x') === '180x180');
ok('favicon-32 berukuran 32x32', pngSize(pub('/icons/favicon-32.png')).join('x') === '32x32');

const nav = fs.readFileSync(path.join(root, 'src/components/Navbar.tsx'), 'utf8');
const logo = nav.match(/src="(\/brand\/[^"]+)"/)?.[1];
ok('Navbar: header memakai gambar logo dari /brand/', !!logo && fs.existsSync(pub(logo)));
const [lw, lh] = pngSize(pub(logo));
ok('Navbar: width dan height logo sesuai rasio berkas (cegah layout bergeser)', /width=\{(\d+)\}\s+height=\{(\d+)\}/.test(nav) && Math.abs(Number(nav.match(/width=\{(\d+)\}/)[1]) / Number(nav.match(/height=\{(\d+)\}/)[1]) - lw / lh) < 0.02);
ok('Navbar: logo punya teks alternatif', /alt="Terminator[^"]*"/.test(nav));
console.log(`pwa asset tests: PASS (${count} assertions)`);
