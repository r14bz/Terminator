#!/usr/bin/env bash
# Mutation test untuk verify-placement.mjs.
#
# Test yang tidak bisa menangkap bug yang ia klaim tangani sama worthless-nya
# dengan tidak ada test. Jadi tiap mutasi di bawah
# sengaja merusak implementasi, lalu test WAJIB gagal. Kalau ada mutasi
# yang tetap hijau, test-nya belum membuktikan apa pun.
#
#   bash scripts/mutate-placement.sh
set -u
cd "$(dirname "$0")/.." || exit 1

SRC=src/utils/nodePlacement.ts
BAK=$(mktemp)
cp "$SRC" "$BAK"
trap 'cp "$BAK" "$SRC"; rm -f "$BAK"' EXIT

# Mengembalikan "hijau" atau pesan assertion yang pertama gagal, supaya output
#_mutasi_ menunjukkan bukan hanya "ada yang rusak" tapi kontrak mana yang
# menangkapnya.
run() {
  local out
  out=$(node --import ./scripts/ts-resolve.mjs scripts/verify-placement.mjs 2>&1)
  if echo "$out" | grep -q "ok —"; then
    echo "HIJAU"
  else
    # Semua assertion yang gagal, bukan cuma yang pertama, supaya jelas mana
    # yang menangkap dan mana yang hanya menangkap karena angka literal.
    echo "$out" | grep -oE "AssertionError \[ERR_ASSERTION\]: .*" \
      | sed -E 's/^AssertionError \[ERR_ASSERTION\]: //' | head -4 \
      | sed 's/^/          - /' | tr '\n' ' '
  fi
}
mutate() { cp "$BAK" "$SRC"; python3 -c "$1"; }

pass=0; fail=0
report() {
  if [ "$2" = "GAGAL" ]; then
    echo "  TERTANGKAP  $1"; pass=$((pass+1))
  else
    echo "  LOLOS(BURUK) $1  -> test tidak menangkap mutasi ini"; fail=$((fail+1))
  fi
}

echo "=== baseline ==="
cp "$BAK" "$SRC"
base=$(run)
echo "  $base"
if [ "$base" = "HIJAU" ]; then echo "  baseline hijau, lanjut ke mutasi"; else echo "  baseline sudah merah, berhenti"; exit 1; fi

echo
echo "=== mutasi ==="

# 1. Buang pembatasan kuadran pertama: spiral ke semua arah lagi.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('for (let j = 0; j <= ring; j++) {','for (let j = -ring; j <= ring; j++) {')
s=s.replace('for (let i = 0; i <= ring; i++) {','for (let i = -ring; i <= ring; i++) {')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  1. spiral ke semua kuadran:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "koordinat negatif kembali" LOLOS || report "koordinat negatif kembali" GAGAL

# 2. Kembalikan tinggi collision ke 120px, seperti bug aslinya.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('export const CARD_MAX_HEIGHT = 200;','export const CARD_MAX_HEIGHT = 120;')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  2. tinggi collision balik 120px:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "kartu 188px ditumpuk lagi" LOLOS || report "kartu 188px ditumpuk lagi" GAGAL

# 2b. Mutasi "jujur": ubah konstanta DAN assertion literalnya, supaya tidak
#     bisa ditangkap hanya oleh `CARD_MAX_HEIGHT === 200`. Kalau test ini masih
#     hijau, berarti tinggi collision tidak benar-benar terkunci oleh perilaku.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('export const CARD_MAX_HEIGHT = 200;','export const CARD_MAX_HEIGHT = 120;')
open(p,'w',encoding='utf-8').write(s)
t='scripts/verify-placement.mjs'; u=open(t,encoding='utf-8').read()
u=u.replace('CARD_MAX_HEIGHT === 200','CARD_MAX_HEIGHT === 120')
open(t,'w',encoding='utf-8').write(u)
"
r=$(run); echo "  2b. konstanta 120 + assertion ikut diubah:"; echo "       $r"
mutate "
t='scripts/verify-placement.mjs'; u=open(t,encoding='utf-8').read()
u=u.replace('CARD_MAX_HEIGHT === 120','CARD_MAX_HEIGHT === 200')
open(t,'w',encoding='utf-8').write(u)
"
echo "$r" | grep -q "HIJAU" && report "tinggi collision tidak terkunci perilaku" LOLOS || report "tinggi collision tidak terkunci perilaku" GAGAL

# 3. Kembalikan pitch vertikal ke 120px.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('export const SLOT_STEP: Point = { x: 200, y: 200 };','export const SLOT_STEP: Point = { x: 200, y: 120 };')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  3. pitch vertikal balik 120px:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "lattice vertikal rapat" LOLOS || report "lattice vertikal rapat" GAGAL

# 4. Balik urutan loop jadi kolom-dulu.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
s=s.replace('''    for (let j = 0; j <= ring; j++) {
      for (let i = 0; i <= ring; i++) {''','''    for (let i = 0; i <= ring; i++) {
      for (let j = 0; j <= ring; j++) {''')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  4. urutan loop kolom-dulu:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "urutan baca kolom-dulu" LOLOS || report "urutan baca kolom-dulu" GAGAL

# 5. Kembalikan rumus lama persis.
mutate "
p='$SRC'; s=open(p,encoding='utf-8').read()
i=s.index('export function findFreeSlot')
j=s.index('\n}', i)+2
s=s[:i]+'''export function findFreeSlot(
  occupied: readonly Point[],
  origin: Point = DEFAULT_ORIGIN,
  step: Point = SLOT_STEP,
  fp: Footprint = { width: CARD_WIDTH, height: CARD_MAX_HEIGHT },
): Point {
  const used = occupied.length;
  return { x: 200 + (used % 5) * 60, y: 160 + (used % 4) * 40 };
}
'''+s[j:]
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  5. rumus lama dipulihkan:"; echo "       $r"
echo "$r" | grep -q "HIJAU" && report "rumus modulo lama" LOLOS || report "rumus modulo lama" GAGAL

echo
echo "=== hasil: $pass tertangkap, $fail lolos ==="
[ "$fail" -eq 0 ] || exit 1
