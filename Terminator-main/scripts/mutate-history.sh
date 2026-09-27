#!/usr/bin/env bash
# Mutation test untuk perbaikan langkah undo semu.
#
# Bug-nya: 500ms setelah setiap page load, template yang masih bersih ikut
# terekam ke riwayat. Undo jadi bisa diklik padahal tidak ada yang bisa di-undo,
# dan kliknya mengembalikan topologi yang identik sambil tetap memunculkan
# "Perubahan diurungkan."
#
# Test yang tidak menangkap bug yang diklaim tangani sama worthless-nya dengan
# tidak ada test. Jadi tiap mutasi di bawah sengaja merusak implementasi, lalu
# test WAJIB gagal. Kalau ada yang tetap hijau, klaim keamanan itu belum
# dibuktikan.
#
#   bash scripts/mutate-history.sh
set -u
cd "$(dirname "$0")/.." || exit 1

CORE=src/utils/historyCore.ts
APP=src/App.tsx
WIRE=scripts/verify-history-wiring.mjs
STACK=scripts/verify-history.mjs

b1=$(mktemp); b2=$(mktemp)
cp "$CORE" "$b1"; cp "$APP" "$b2"
trap 'cp "$b1" "$CORE"; cp "$b2" "$APP"; rm -f "$b1" "$b2"' EXIT

# Laporan assertion yang gagal, bukan hanya "ada yang rusak".
run() {
  local out
  out=$(
    node --import ./scripts/ts-resolve.mjs "$WIRE" 2>&1
    node --import ./scripts/ts-resolve.mjs "$STACK" 2>&1
  )
  if echo "$out" | grep -q "^ok —"; then
    if [ "$(echo "$out" | grep -c "^ok —")" -eq 2 ]; then
      echo "HIJAU"
      return
    fi
  fi
  echo "$out" | grep -oE "AssertionError \[ERR_ASSERTION\]: .*" \
    | sed -E 's/^AssertionError \[ERR_ASSERTION\]: //' | head -3 \
    | sed 's/^/          - /' | tr '\n' ' '
}

restore() { cp "$b1" "$CORE"; cp "$b2" "$APP"; }
mutate() { restore; python3 -c "$1"; }

pass=0; fail=0
report() {
  if [ "$2" = "GAGAL" ]; then
    echo "  TERTANGKAP  $1"; pass=$((pass+1))
  else
    echo "  LOLOS(BURUK) $1  -> test tidak menangkap mutasi ini"; fail=$((fail+1))
  fi
}
check_red() { case "$1" in *HIJAU*) report "$2" LOLOS ;; *) report "$2" GAGAL ;; esac; }

echo "=== baseline ==="
restore
base=$(run)
echo "  $base"
if [ "$base" = "HIJAU" ]; then
  echo "  baseline hijau, lanjut ke mutasi"
else
  echo "  baseline sudah merah, berhenti"; exit 1
fi

echo
echo "=== mutasi ==="

# 1. Guard mati total: selalu bilang "berubah".
mutate "
p='$CORE'; s=open(p,encoding='utf-8').read()
s=s.replace('  state.present.nodes === next.nodes && state.present.cables === next.cables;','  false;')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  1. isSameSnapshot selalu false:"; echo "       $r"
check_red "$r" "langkah undo semu kembali"

# 2. Guard terlalu-longgar: selalu bilang "tidak berubah", jadi tidak ada
#    edit yang pernah terekam.
mutate "
p='$CORE'; s=open(p,encoding='utf-8').read()
s=s.replace('  state.present.nodes === next.nodes && state.present.cables === next.cables;','  true;')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  2. isSameSnapshot selalu true:"; echo "       $r"
check_red "$r" "edit nyata tidak pernah terekam"

# 3. Hanya(nodes yang dibandingkan -- cables diabaikan.
mutate "
p='$CORE'; s=open(p,encoding='utf-8').read()
s=s.replace('  state.present.nodes === next.nodes && state.present.cables === next.cables;','  state.present.nodes === next.nodes;')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  3. cables tidak ikut dibandingkan:"; echo "       $r"
check_red "$r" "perubahan kabel tidak terdeteksi"

# 4. Deep-equal ganti identitas -- pilihan sadar, harus terdeteksi.

mutate "
p='$CORE'; s=open(p,encoding='utf-8').read()
s=s.replace('  state.present.nodes === next.nodes && state.present.cables === next.cables;',
'''  JSON.stringify(state.present.nodes) === JSON.stringify(next.nodes) &&
  JSON.stringify(state.present.cables) === JSON.stringify(next.cables);''')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  4. deep-equal ganti identitas:"; echo "       $r"
check_red "$r" "pilihan identitas-vs-nilai berubah diam-diam"

# 5. Kembalikan App.tsx ke tiga clone terpisah -- bug aslinya, persis.
mutate "
p='$APP'; s=open(p,encoding='utf-8').read()
s=s.replace('const [nodes, setNodes] = useState<NetworkNode[]>(initial.nodes);',
            'const [nodes, setNodes] = useState<NetworkNode[]>(() => cloneTemplate(TOPOLOGY_TEMPLATES[0]).nodes);')
s=s.replace('const [cables, setCables] = useState<CableConnection[]>(initial.cables);',
            'const [cables, setCables] = useState<CableConnection[]>(() => cloneTemplate(TOPOLOGY_TEMPLATES[0]).cables);')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  5. App.tsx balik ke tiga clone terpisah:"; echo "       $r"
check_red "$r" "clone seed terpecah lagi"

# 6. Buang guardnya di App.tsx.
mutate "
p='$APP'; s=open(p,encoding='utf-8').read()
s=s.replace('isSameSnapshot(h, { nodes, cables }) ? h : pushSnapshot(h, { nodes, cables })','pushSnapshot(h, { nodes, cables })')
open(p,'w',encoding='utf-8').write(s)
"
r=$(run); echo "  6. guard dibuang dari App.tsx:"; echo "       $r"
check_red "$r" "guard hilang di sisi pemanggil"

echo
echo "=== hasil: $pass tertangkap, $fail lolos ==="
restore
[ "$fail" -eq 0 ] || exit 1
