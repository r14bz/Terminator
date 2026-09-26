#!/usr/bin/env bash
# Mutation test untuk verify-ports.mjs.
#
# Test yang tidak bisa menangkap bug yang ia klaim tangani sama worthless-nya
# dengan tidak ada test. Jadi tiap mutasi di bawah sengaja merusak
# implementasi, lalu test WAJIB gagal. Kalau ada mutasi yang tetap hijau,
# test-nya belum membuktikan apa pun.
#
#   bash scripts/mutate-ports.sh
set -u
cd "$(dirname "$0")/.." || exit 1

SRC=src/utils/portReconcile.ts
TEST=scripts/verify-ports.mjs
BAK=$(mktemp)
cp "$SRC" "$BAK"
trap 'cp "$BAK" "$SRC"; rm -f "$BAK"' EXIT

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
mutate() { cp "$BAK" "$SRC"; python3 -c "$1"; }

pass=0; fail=0
report() {
  if [ "$2" = "GAGAL" ]; then
    echo "  TERTANGKAP  $1"; pass=$((pass+1))
  else
    echo "  LOLOS(BURAK) $1  -> test tidak menangkap mutasi ini"; fail=$((fail+1))
  fi
}

echo "=== baseline ==="
cp "$BAK" "$SRC"
base=$(run)
echo "  $base"
if [ "$base" = "HIJAU" ]; then echo "  baseline hijau, lanjut ke mutasi"; else echo "  baseline sudah merah, berhenti"; exit 1; fi

echo
echo "=== mutasi ==="

# 1. Balikkan mediumForCable ke mapping yang salah: semua jadi ethernet.
#    Inilah bentuk bug aslinya kalau tabel medium tidakdipakai.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('''      return 'fiber';''','''      return 'ethernet';''')
s=s.replace('''    case 'wireless':
      return 'wireless';''','''    case 'wireless':
      return 'ethernet';''')
s=s.replace('''    case 'coaxial':
      return 'coaxial';''','''    case 'coaxial':
      return 'ethernet';''')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  1. semua medium jadi ethernet:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "kabel optik bisa ambil port ethernet" LOLOS || report "kabel optik bisa ambil port ethernet" GAGAL

# 2. Buang penandaan port sama sekali: kembalikan bug aslinya.
#    reconcilePorts jadi fungsi identitas.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
i=s.index('export function reconcilePorts')
s=s[:i]+'''export function reconcilePorts(
  nodes: readonly NetworkNode[],
  cables: readonly CableConnection[],
): NetworkNode[] {
  void cables;
  return [...nodes];
}
'''
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  2. reconcilePorts jadi identitas (bug aslinya):"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "port tidak pernah ditandai" LOLOS || report "port tidak pernah ditandai" GAGAL

# 3. Hilangkan id port sintetis: pakai id tetap, jadi reconciliasi dua kali
#    dalam satu pass menghasilkan port kembar.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace(\"id: \`p-\${node.id}-auto-\${key}\`,\", \"id: \`p-\${node.id}-auto\`,\")
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  3. id port sintetis jadi konstan:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "dua port sintetis tidak bisa dibedakan" LOLOS || report "dua port sintetis tidak bisa dibedakan" GAGAL

# 4. Numbering port sintetis kembali ke node asli, bukan daftar yang tumbuh:
#    dua port sintetis dalam satu pass dapat nama sama.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('{ ...synthesisePort({ ...node, ports }, medium, cable.id), connectedCableId: cable.id },',
            '{ ...synthesisePort(node, medium, cable.id), connectedCableId: cable.id },')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  4. penomoran port sintetis dari node asal:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "dua port sintetis berbagi nama" LOLOS || report "dua port sintetis berbagi nama" GAGAL

# 5. Buang guard "sudah diklaim" supaya reconcile tidak idempoten.
#    yang sudah diklaim masih diproses lagi.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('      if (claimedBy.has(cable.id)) continue;','')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  5. guard kabel yang sudah diklaim dibuang:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "reconcile tidak idempoten" LOLOS || report "reconcile tidak idempoten" GAGAL

# 6. Ambil port pertama yang medium-nya cocok, abaikan yang sudah diklaim.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('const free = ports.findIndex((p) => p.medium === medium && !p.connectedCableId);',
            'const free = ports.findIndex((p) => p.medium === medium);')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  6. port yang sudah diklaim dianggap bebas:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "port Claims ulang" LOLOS || report "port diklaim ulang" GAGAL

# 7. Mutasi "jujur": ubah ekspektasi literal di test DAN implementasi, supaya
#    tidak bisa tertangkap hanya oleh assertion angka. Kalau test masih hijau,
#    berarti nama port tidak benar-benar terkunci oleh perilaku.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('      const free = ports.findIndex((p) => p.medium === medium && !p.connectedCableId);',
            '      const free = ports.findIndex((p) => p.medium === medium);')
open(p,'w',encoding='utf-8').write(s)
t='$TEST'; u=open(t,encoding='utf-8').read()
u=u.replace('eq(\'port count after each new cable\', counts, [3, 3, 4, 5]);',
            'eq(\'port count after each new cable\', counts, [3, 3, 3, 3]);')
u=u.replace(\"eq('MikroTik ether1 (WAN) serves the ISP cable', mk.ports.find((p) => p.name.includes('ether1')).connectedCableId, cable('Fiber Optic Media', 'Gateway & Bandwidth'));\",
            \"eq('MikroTik ether1 (WAN) serves the ISP cable', mk.ports.find((p) => p.name.includes('ether1')).connectedCableId, cable('Gateway & Bandwidth', 'TP-Link'));\")
open(t,'w',encoding='utf-8').write(u)
"
r=$(run); echo "  7. implementasi + ekspektasi test ikut diubah:"
echo "       $r"
mutate "
t='$TEST'; u=open(t,encoding='utf-8').read()
u=u.replace('eq(\'port count after each new cable\', counts, [3, 3, 3, 3]);',
            'eq(\'port count after each new cable\', counts, [3, 3, 4, 5]);')
u=u.replace(\"eq('MikroTik ether1 (WAN) serves the ISP cable', mk.ports.find((p) => p.name.includes('ether1')).connectedCableId, cable('Gateway & Bandwidth', 'TP-Link'));\",
            \"eq('MikroTik ether1 (WAN) serves the ISP cable', mk.ports.find((p) => p.name.includes('ether1')).connectedCableId, cable('Fiber Optic Media', 'Gateway & Bandwidth'));\")
open(t,'w',encoding='utf-8').write(u)
"
echo "$r" | grep -q "HIJAU" && report "nama port tidak terkunci perilaku" LOLOS || report "nama port tidak terkunci perilaku" GAGAL

echo
echo "=== hasil: $pass tertangkap, $fail lolos ==="
[ "$fail" -eq 0 ] || exit 1
