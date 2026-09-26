#!/usr/bin/env bash
# Mutation test untuk verify-ipalloc.mjs.
#
# Test yang tidak bisa menangkap bug yang ia klaim tangani sama worthless-nya
# dengan tidak ada test. Jadi tiap mutasi di bawah sengaja merusak
# implementasi, lalu test WAJIB gagal. Kalau ada mutasi yang tetap hijau,
# test-nya belum membuktikan apa pun.
#
#   bash scripts/mutate-ipalloc.sh
set -u
cd "$(dirname "$0")/.." || exit 1

ALLOC=src/utils/ipAlloc.ts
DIAG=src/utils/diagnosticEngine.ts
APP=src/App.tsx
INSPECTOR=src/components/NodeInspector.tsx
TEST=scripts/verify-ipalloc.mjs
BAK=$(mktemp)
cp "$ALLOC" "$BAK"
DIAG_BAK=$(mktemp)
cp "$DIAG" "$DIAG_BAK"
APP_BAK=$(mktemp)
cp "$APP" "$APP_BAK"
INSPECTOR_BAK=$(mktemp)
cp "$INSPECTOR" "$INSPECTOR_BAK"
trap 'cp "$BAK" "$ALLOC"; cp "$DIAG_BAK" "$DIAG"; cp "$APP_BAK" "$APP"; cp "$INSPECTOR_BAK" "$INSPECTOR"; rm -f "$BAK" "$DIAG_BAK" "$APP_BAK" "$INSPECTOR_BAK"' EXIT

restore() { cp "$BAK" "$ALLOC"; cp "$DIAG_BAK" "$DIAG"; cp "$APP_BAK" "$APP"; cp "$INSPECTOR_BAK" "$INSPECTOR"; }

run() {
  local out
  out=$(node --import ./scripts/ts-resolve.mjs "$TEST" 2>&1)
  if echo "$out" | grep -q "ok —"; then
    echo "HIJAU"
  else
    echo "$out" | grep -oE "AssertionError \[ERR_ASSERTION\]: .*" \
      | sed -E 's/^AssertionError \[ERR_ASSERTION\]: //' | head -3 \
      | sed 's/^/          - /' | tr '\n' ' '
    echo "$out" | grep -qE "TypeError|SyntaxError" && echo "[tidak jalan] "
  fi
}
mutate() { restore; python3 -c "$1"; }

pass=0; fail=0
report() {
  if [ "$2" = "GAGAL" ]; then
    echo "  TERTANGKAP  $1"; pass=$((pass+1))
  else
    echo "  LOLOS(BURAK) $1  -> test tidak menangkap mutasi ini"; fail=$((fail+1))
  fi
}

echo "=== baseline ==="
cp "$BAK" "$ALLOC"
base=$(run)
echo "  $base"
if [ "$base" = "HIJAU" ]; then echo "  baseline hijau, lanjut ke mutasi"; else echo "  baseline sudah merah, berhenti"; exit 1; fi

echo
echo "=== mutasi ==="

# 1. Kembalikan bug aslinya: host konstan .115 untuk semua klien.
mutate "
p='$ALLOC'; s=open(p,encoding='utf-8').read()
i=s.index('export function allocateDhcpLease')
j=s.index('\n}', i)+2
s=s[:i]+'''export function allocateDhcpLease(
  gateway: NetworkNode | null | undefined,
  nodes: readonly NetworkNode[],
  forNodeId?: string,
): string | null {
  void nodes; void forNodeId;
  const lan = gateway ? addressOf(gateway) : undefined;
  return lan ? \`\${lan.replace(/\\\\.\\\\d+\$/, '')}.115\` : null;
}
'''+s[j:]
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  1. lease DHCP balik ke .115 konstan:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "semua klien dapat IP sama" LOLOS || report "semua klien dapat IP sama" GAGAL

# 2. Kembalikan bug aslinya di handleAddDevice: nomor per tipe, bukan per alamat.
#    Dicerminkan di sini lewat allocateStaticHost yang mengabaikan "used".
mutate "
p='$ALLOC'; s=open(p,encoding='utf-8').read()
i=s.index('export function allocateStaticHost')
j=s.index('\n}', i)+2
s=s[:i]+'''export function allocateStaticHost(
  gateway: NetworkNode | null | undefined,
  nodes: readonly NetworkNode[],
): string | null {
  const pool = gateway ? dhcpPoolOf(gateway) : FALLBACK_LAN;
  if (!pool) return null;
  return \`\${pool.prefix}\${pool.start}\`;
}
'''+s[j:]
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  2. alokasi statis mengabaikan alamat terpakai:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "IP statis bentrok dengan yang ada" LOLOS || report "IP statis bentrok dengan yang ada" GAGAL

# 3. Pool habis harus null; kalau dibungkus ke awal range, klien dapat IP orang.
mutate "
p='$ALLOC'; s=open(p,encoding='utf-8').read()
i=s.index('export function firstFreeHost')
j=s.index('\n}', i)+2
s=s[:i]+'''export function firstFreeHost(
  pool: AddressPool,
  used: ReadonlySet<string>,
  keep?: string,
): string | null {
  for (let host = pool.start; host <= pool.end; host++) {
    const candidate = join(pool.prefix, host);
    if (used.has(candidate) && candidate !== keep) continue;
    return candidate;
  }
  return join(pool.prefix, pool.start);
}
'''+s[j:]
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  3. pool habis dibungkus ke host pertama:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "lease fell back ke IP yang terpakai" LOLOS || report "lease fell back ke IP yang terpakai" GAGAL

# 4. `keep` diabaikan lagi: node yang sudah punya lease didorong ke host berikutnya.
mutate "
p='$ALLOC'; s=open(p,encoding='utf-8').read()
s=s.replace('if (used.has(candidate) && candidate !== keep) continue;','if (used.has(candidate)) continue;')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  4. pengecualian 'keep' dibuang:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "lease lama tidak dipertahankan" LOLOS || report "lease lama tidak dipertahankan" GAGAL

# 5. Kembalikan bug asli Check 6: hanya mode static yang diperiksa.
mutate "
p='$DIAG'; s=open(p,encoding='utf-8').read()
s=s.replace('''    if (!node.poweredOn) continue;
    const ip = addressOf(node)?.trim();
    if (!ip || ip === '0.0.0.0' || !isValidIpv4(ip)) continue;''','''    if (!node.poweredOn) continue;
    if (node.ipConfig?.mode !== 'static') continue;
    const ip = node.ipConfig?.ip?.trim();
    if (!ip || ip === '0.0.0.0' || !isValidIpv4(ip)) continue;''')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  5. Check 6 hanya periksa mode static:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "konflik di mode DHCP tak terdeteksi" LOLOS || report "konflik di mode DHCP tak terdeteksi" GAGAL
python3 -c "
p='$DIAG'; s=open(p,encoding='utf-8').read()
s=s.replace('''    if (node.ipConfig?.mode !== 'static') continue;
    const ip = node.ipConfig?.ip?.trim();''','''    const ip = addressOf(node)?.trim();''')
open(p,'w',encoding='utf-8').write(s)
"

# 6. Node yang dimatikan tetap dihitung sebagai pemegang alamat.
mutate "
p='$DIAG'; s=open(p,encoding='utf-8').read()
s=s.replace('    if (!node.poweredOn) continue;\n    const ip = addressOf(node)?.trim();','    const ip = addressOf(node)?.trim();')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  6. node powered off ikut dihitung:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "perangkat mati dilaporkan konflik" LOLOS || report "perangkat mati dilaporkan konflik" GAGAL
python3 -c "
p='$DIAG'; s=open(p,encoding='utf-8').read()
s=s.replace('''    const ip = addressOf(node)?.trim();
    if (!ip || ip === '0.0.0.0' || !isValidIpv4(ip)) continue;''','''    if (!node.poweredOn) continue;
    const ip = addressOf(node)?.trim();
    if (!ip || ip === '0.0.0.0' || !isValidIpv4(ip)) continue;''')
open(p,'w',encoding='utf-8').write(s)
"

# 7. Range DHCP terbalik atau lintas subnet tidak boleh ditolak diam-diam.
mutate "
p='$ALLOC'; s=open(p,encoding='utf-8').read()
s=s.replace('      if (start >= 1 && end <= 254 && start <= end) return { prefix: startPrefix, start, end };','      if (start >= 1) return { prefix: startPrefix, start, end: Math.max(end, start) };')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  7. range DHCP rusak tidak ditolak:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "range terbalik/lintas subnet diterima" LOLOS || report "range terbalik/lintas subnet diterima" GAGAL

# 8. Mutasi "jujur": ganti ekspektasi literal di test DAN implementasi.
#    Kalau test masih hijau, berarti tidak ada yang benar-benar terkunci.
mutate "
p='$ALLOC'; s=open(p,encoding='utf-8').read()
s=s.replace('  return { prefix, start: 100, end: 254 };','  return { prefix, start: 115, end: 254 };')
open(p,'w',encoding='utf-8').write(s)
t='$TEST'; u=open(t,encoding='utf-8').read()
u=u.replace(\"{ prefix: '192.168.88.', start: 100, end: 254 }\",\"{ prefix: '192.168.88.', start: 115, end: 254 }\")
u=u.replace(\"eq('leases start at the bottom of the pool', taken[0], '192.168.88.100');\",\"eq('leases start at the bottom of the pool', taken[0], '192.168.88.115');\")
u=u.replace(\"eq('the template PC at .100 is not reused', got, ['192.168.1.101', '192.168.1.102', '192.168.1.103']);\",\"eq('the template PC at .100 is not reused', got, ['192.168.1.115', '192.168.1.116', '192.168.1.117']);\")
u=u.replace(\"eq('an unknown node id gets the next genuinely free host', allocateDhcpLease(gw, nodes, 'tidak-ada'), '192.168.88.104');\",\"eq('an unknown node id gets the next genuinely free host', allocateDhcpLease(gw, nodes, 'tidak-ada'), '192.168.88.119');\")
open(t,'w',encoding='utf-8').write(u)
"
r=$(run); echo "  8. pool + ekspektasi test ikut diubah:"; echo "       $r"
mutate "
t='$TEST'; u=open(t,encoding='utf-8').read()
u=u.replace(\"{ prefix: '192.168.88.', start: 115, end: 254 }\",\"{ prefix: '192.168.88.', start: 100, end: 254 }\")
u=u.replace(\"eq('leases start at the bottom of the pool', taken[0], '192.168.88.115');\",\"eq('leases start at the bottom of the pool', taken[0], '192.168.88.100');\")
u=u.replace(\"eq('the template PC at .100 is not reused', got, ['192.168.1.115', '192.168.1.116', '192.168.1.117']);\",\"eq('the template PC at .100 is not reused', got, ['192.168.1.101', '192.168.1.102', '192.168.1.103']);\")
u=u.replace(\"eq('an unknown node id gets the next genuinely free host', allocateDhcpLease(gw, nodes, 'tidak-ada'), '192.168.88.119');\",\"eq('an unknown node id gets the next genuinely free host', allocateDhcpLease(gw, nodes, 'tidak-ada'), '192.168.88.104');\")
open(t,'w',encoding='utf-8').write(u)
"
echo "$r" | grep -q "HIJAU" && report "batas pool tidak terkunci perilaku" LOLOS || report "batas pool tidak terkunci perilaku" GAGAL

# 9-11. Scan sumber harus menangkap konstanta yang dikembalikan ke JSX. Tanpa
#       ketiga mutasi ini, empat assertion "no fabricated host numbers" bisa
#       hijau hanya karena grep-nya tidak pernah jalan.
mutate "
p='$INSPECTOR'; s=open(p,encoding='utf-8').read()
s=s.replace('ip: lease ?? \'\',','ip: lease ?? \`\\\${leaseGateway.replace(/\\\\.\\\\d+\$/, \'\')}.115\`,')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  9. lease .115 konstan dikembalikan ke inspector:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "konstanta .115 kembali ke UI" LOLOS || report "konstanta .115 kembali ke UI" GAGAL

mutate "
p='$APP'; s=open(p,encoding='utf-8').read()
s=s.replace('ip: lanAddress ?? \'192.168.1.100\',','ip: \`192.168.1.\\\${100 + countSameType}\`,')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo " 10. penomoran per-tipe dikembalikan ke handleAddDevice:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "nomor per-tipe kembali" LOLOS || report "nomor per-tipe kembali" GAGAL

mutate "
p='$INSPECTOR'; s=open(p,encoding='utf-8').read()
s=s.replace('''                            {isValidIpv4(node.ipConfig?.ip ?? '') ? (''','''                            {node.ipConfig?.ip || '192.168.1.100' ? (''')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo " 11. fallback tampilan 192.168.1.100 dikembalikan:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "fallback tampilan kembali" LOLOS || report "fallback tampilan kembali" GAGAL

# 12. Mutasi terhadap scan-nya sendiri. Both fixes document the constants they
#     replaced, so the scan strips comments first. That stripper has to be
#     load-bearing: here it is turned into a no-op *and* a constant is put back
#     in a comment. If the test stays green, the four scan assertions are
#     decorative -- the source of the fix writes the same literal twice.
mutate "
p='$APP'; s=open(p,encoding='utf-8').read()
s=s.replace('const displayName =','// dulu: 192.168.1.100 dipakai untuk semua tipe\n    const displayName =')
open(p,'w',encoding='utf-8').write(s)
t='$TEST'; u=open(t,encoding='utf-8').read()
u=u.replace(\"  const stripComments = (src) => src\", \"  const stripComments = (src) => src || src\")
open(t,'w',encoding='utf-8').write(u)
"
r=$(run); echo " 12. stripper komentar dimatikan + konstanta dikembalikan ke komentar:"
echo "       $r"
mutate "
p='$APP'; s=open(p,encoding='utf-8').read()
s=s.replace('// dulu: 192.168.1.100 dipakai untuk semua tipe\n','')
open(p,'w',encoding='utf-8').write(s)
t='$TEST'; u=open(t,encoding='utf-8').read()
u=u.replace(\"  const stripComments = (src) => src || src\", \"  const stripComments = (src) => src\")
open(t,'w',encoding='utf-8').write(u)
"
echo "$r" | grep -q "HIJAU" && report "stripper komentar tidak memikul scan" LOLOS || report "stripper komentar tidak memikul scan" GAGAL

echo
echo "=== hasil: $pass tertangkap, $fail lolos ==="
[ "$fail" -eq 0 ] || exit 1
