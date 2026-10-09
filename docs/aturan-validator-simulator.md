# Aturan Validator Simulator Topologi Jaringan

Dokumen ini adalah spesifikasi aturan untuk simulator. Berikan ke AI sebagai dasar membuat validator dan test.

## Instruksi untuk AI

1. Implementasikan semua aturan di bawah sebagai **validator terpusat**, terpisah dari UI. Aturan per jenis perangkat disimpan di file terpisah (misalnya `rules/ont`, `rules/vlan`, `rules/mikrotik`, `rules/switch`), satu validator membaca semuanya.
2. Setiap hasil simulasi **wajib menampilkan alasannya** dalam bahasa sederhana (contoh: "Tidak ada internet karena MikroTik belum punya aturan NAT").
3. Buat **satu test per baris skenario**. Sertakan juga topologi valid yang harus lolos dan topologi tidak valid yang harus ditolak, termasuk kasus aneh (input kosong, port penuh, IP bentrok).
4. Jangan mengarang aturan. Jika kondisi tidak tercakup di dokumen ini, tandai sebagai **"tidak terdefinisi"** dan tanyakan ke pengguna.
5. Hasil acak (lihat aturan DHCP ganda) harus memakai **seed yang bisa dikunci**, atau test menerima semua hasil yang sah.
6. Menambah perangkat baru tidak boleh merusak test perangkat lama.
7. **Jangan menampilkan peringatan untuk hal yang normal.** Peringatan atau error hanya boleh muncul untuk kondisi yang secara eksplisit diatur sebagai masalah di dokumen ini. Jika ragu apakah sesuatu itu masalah, tandai "tidak terdefinisi" dan tanyakan, jangan langsung menolak topologinya.
8. Setiap node harus punya **panel konfigurasi** seperti perangkat aslinya (lihat bagian 7). Validator membaca konfigurasi itu sebagai satu-satunya sumber kebenaran.
9. **Dokumen ini adalah sumber kebenaran.** Jika kode yang sudah ada bertentangan dengan dokumen, **ubah kodenya, bukan dokumennya**. Dilarang mengubah, menyederhanakan, menggabungkan, atau menambah aturan atas inisiatif sendiri.
10. **Jika menemukan konflik**, baik antara aturan di dokumen dan kode lama maupun antar aturan di dokumen, **berhenti dan laporkan** (sebutkan ID aturan dan letak konfliknya). Jangan menyelesaikannya sendiri. Pengguna yang memutuskan.
11. **Dilarang mengubah, menghapus, atau melemahkan test supaya lulus.** Jika test gagal, perbaiki kodenya. Test hanya boleh berubah jika pengguna mengubah aturan di dokumen.
12. **Beri ID pada test.** Nama test memuat ID aturan (misalnya `4A.7`). Buat skrip yang membandingkan semua ID di dokumen dengan ID di test, lalu melaporkan ID yang belum punya test.
13. **Kerjakan bertahap**, satu bagian dokumen per sesi (misalnya bagian 3 tentang VLAN dulu), dan selesaikan sebelum pindah ke bagian berikutnya. Jangan mengimplementasikan seluruh dokumen sekaligus.
14. **Laporan akhir tiap tahap:** daftar ID yang sudah diimplementasikan dan lulus, yang belum, dan yang tidak bisa diimplementasikan beserta alasannya. Jangan menyatakan selesai jika masih ada ID yang belum.
15. **Satu sumber status internet.** Status yang tampil di kartu node, panel konfigurasi, dan hasil validator harus berasal dari sumber yang sama (`buildInternetAccessMap`). Komponen UI tidak boleh memanggil pemeriksaan internet lama (`checkInternetAccess`) langsung.

## Prinsip umum

**Urutan pengecekan, dari bawah ke atas.** Validator memeriksa berurutan, dan kegagalan di lapisan bawah menghentikan lapisan di atasnya:

1. Fisik: kabel, optik (LOS)
2. Layer 2: VLAN, trunk, STP
3. IP: interface, DHCP
4. Route
5. NAT
6. Layanan: PPPoE, hotspot

**Empat status hasil yang harus dibedakan:**

| Status | Arti |
|---|---|
| Tidak tersambung | Gagal di fisik atau layer 2 |
| Tersambung, tidak dapat IP | DHCP tidak menjangkau client |
| Dapat IP, tidak ada internet | Gagal di route, NAT, atau uplink |
| Internet normal | Semua lapisan benar |

**Aturan inti:**

- Client punya internet hanya jika: (1) ada jalur sampai ke perangkat yang punya sumber internet, **dan** (2) IP-nya diberikan oleh DHCP yang berada di jalur menuju sumber tersebut.
- Jika ada lebih dari satu DHCP server aktif dalam satu jaringan layer 2 yang sama, client mengambil IP dari server **terdekat** (lompatan layer 2 paling sedikit), karena OFFER-nya tiba lebih dulu. Hanya jika jaraknya seri, pilihannya **acak** (deterministik per client lewat seed). Jika server yang terpilih tidak punya jalur ke internet (misalnya ONT mode bridge), client kehilangan internet.
- Jalur VLAN harus **tidak putus** dari ujung ke ujung. Satu titik yang tidak mengizinkan sebuah VLAN memutus VLAN itu.

### Aturan alamat IP dan peringatan (hindari false positive)

**Peringatan hanya boleh muncul untuk masalah nyata.** Alamat IP yang sama pada perangkat berbeda **normal** selama perangkat itu berada di **jaringan layer 2 yang terpisah**.

- Pengecekan bentrok IP dilakukan **per domain layer 2** (satu segmen broadcast), bukan global di seluruh topologi.
- Domain layer 2 terputus oleh: batas router, batas NAT, dan batas VLAN. ONT mode router memisahkan sisi LAN-nya dari sisi WAN-nya, jadi LAN tiap ONT adalah domain tersendiri.
- Koneksi PON (OLT ke banyak ONT) **bukan LAN bersama**. IP LAN tiap ONT tidak perlu dibandingkan dengan ONT lain di OLT yang sama.
- **Tidak ada daftar alamat IP "resmi"** untuk gateway. IP bawaan berbeda per merk (contoh: 192.168.1.1, 192.168.100.1, 192.168.0.1, 192.168.8.1, 10.0.0.1), dan semuanya valid.

| # | Kondisi | Hasil |
|---|---|---|
| P1 | Beberapa ONT router mode di satu OLT, gateway LAN sama (misalnya 192.168.1.1) | **Normal, tanpa peringatan.** Tiap LAN terisolasi di belakang NAT ONT-nya |
| P2 | Gateway ONT 192.168.100.1 (atau IP bawaan merk lain) | **Valid, tanpa peringatan** |
| P3 | Dua perangkat di domain layer 2 yang sama memakai IP yang sama | IP bentrok, peringatan |
| P4 | LAN dua ONT dihubungkan kabel ke satu segmen layer 2 yang sama, dan kedua ONT memakai IP gateway yang sama | IP bentrok, peringatan |
| P5 | Gateway berada di luar subnet interface-nya | Tidak valid |
| P6 | Gateway sama dengan alamat jaringan atau alamat broadcast subnet | Tidak valid |
| P7 | Dua interface pada satu router berada di subnet yang sama atau bertumpuk | Tidak valid (lihat 4A.3) |
| P8 | Format IP bukan IPv4 yang sah (misalnya angka lebih dari 255) | Tidak valid |

Tambahkan juga **test negatif**: topologi yang sah (P1 dan P2) harus **tidak** menghasilkan peringatan apa pun.

## Topologi acuan (RT/RW net)

```
Internet > BRAS > OLT ISP > ONT ISP > MikroTik > (switch manageable, opsional)
> OLT RT/RW > ONT RT/RW net (SSID 1 = VLAN 10, SSID 2 = VLAN 20) > client
```

Ada dua segmen optik yang terpisah:

- **Segmen ISP:** OLT ISP ke ONT ISP
- **Segmen RT/RW net:** OLT RT/RW ke ONT pelanggan

## 1. Optik dan LOS

| # | Kondisi | Hasil |
|---|---|---|
| 1.1 | Kabel optik ONT terhubung dan sinyal normal | Uplink ONT aktif |
| 1.2 | Kabel optik ONT putus | LOS, ONT tidak punya uplink |
| 1.3 | Fiber ISP putus (ONT ISP LOS) | Semua pelanggan RT/RW net tetap dapat IP dari perangkat lokal, tapi **tidak ada internet** |
| 1.4 | Fiber antara OLT RT/RW dan satu ONT pelanggan putus | LOS **hanya untuk pelanggan itu**, pelanggan lain normal |

## 2. ONT

ONT punya dua mode untuk tiap koneksi WAN: **router (PPPoE)** atau **bridge**. Aturan DHCP bergantung pada mode ini.

| # | Kondisi | Hasil |
|---|---|---|
| 2.1 | ONT tanpa optik disambung LAN ke ONT lain yang online, mode **bridge**, DHCP ONT mati | Client dapat IP dan internet dari ONT yang online |
| 2.2 | Kasus 2.1, tapi DHCP ONT tanpa optik **aktif** | Client dapat IP dari ONT tanpa optik, **tidak ada internet** |
| 2.3 | ONT tanpa optik, **bukan bridge**, DHCP aktif, disambung ke ONT online | ONT itu sendiri tidak punya internet. Client yang lebih dekat ke ONT ini (atau berjarak sama) mendapat IP darinya dan kehilangan internet |
| 2.4 | ONT mode router (PPPoE), DHCP aktif | Wajar. Client hanya melihat DHCP dari ONT-nya sendiri, tidak ada DHCP ganda |
| 2.5 | WAN mode bridge, tapi DHCP ONT aktif untuk SSID yang memakai WAN itu | Client mengambil IP dari ONT, melewati MikroTik (termasuk voucher). Hasil salah |
| 2.6 | ONT router punya VLAN (trunk atau access) pada konfigurasinya, dan client LAN tanpa tag tersambung ke ONT itu (langsung, lewat HTB, atau lewat ONT bridge lain) | Client tetap berada di LAN ONT dan mendapat IP dari DHCP ONT. VLAN pada ONT hanya berlaku untuk sisi WAN/uplink-nya |
| 2.7 | ONT mode bridge memakai IP LAN bawaan yang sama dengan ONT router di segmen yang sama (misalnya 192.168.1.1) | Bukan IP bentrok. ONT bridge hanya meneruskan Layer 2, jadi alamat LAN-nya tidak dicek |
| 2.8 | Client menempel ke ONT bridge yang DHCP-nya aktif (langsung atau lewat HTB), sementara ONT router lain di segmen yang sama juga punya DHCP | Server terdekat menang: client di ONT bridge mendapat IP dari ONT bridge dan **tidak ada internet**. Client di LAN ONT router tetap normal. Jika DHCP ONT bridge dimatikan, semua client normal |

## 3. VLAN

- **Access port:** satu port, satu VLAN, tanpa tag. Untuk perangkat biasa.
- **Trunk port:** membawa banyak VLAN dengan tag. Daftar VLAN yang diizinkan harus diatur.
- Perangkat di VLAN berbeda hanya bisa berkomunikasi lewat router atau switch layer 3.
- Broadcast (termasuk DHCP) berhenti di batas VLAN-nya.

| # | Kondisi | Hasil |
|---|---|---|
| 3.1 | Dua perangkat di VLAN yang sama pada switch yang sama | Bisa komunikasi |
| 3.2 | Dua perangkat di VLAN berbeda, tanpa router | Tidak bisa komunikasi |
| 3.3 | VLAN berbeda dengan router yang menangani routing antar-VLAN dan gateway benar | Bisa komunikasi lewat router |
| 3.4 | Dua switch dihubungkan trunk yang mengizinkan VLAN 10, PC di VLAN 10 di kedua sisi | Bisa komunikasi |
| 3.5 | Kasus 3.4, tapi trunk tidak mengizinkan VLAN 10 | Tidak bisa komunikasi |
| 3.6 | Client di VLAN 10, DHCP server di VLAN 20, tanpa DHCP relay | Client tidak dapat IP |
| 3.7 | Router terhubung ke switch lewat trunk dengan sub-interface per VLAN | Routing antar-VLAN jalan |
| 3.8 | Router terhubung lewat port access (satu VLAN saja) | Hanya VLAN itu yang punya gateway |

## 4. Switch manageable

| # | Kondisi | Hasil |
|---|---|---|
| 4.1 | Dua port access di VLAN 10 | Bisa saling komunikasi |
| 4.2 | Port access VLAN 10 dan VLAN 20, tanpa router | Tidak bisa saling komunikasi |
| 4.3 | Port trunk ke MikroTik tidak mengizinkan VLAN 20 | VLAN 20 tidak sampai ke MikroTik |
| 4.4 | PC dicolok ke port trunk (bukan access) | PC tidak mengerti tag, tidak tersambung ke VLAN bertag |
| 4.5 | Dua kabel antar-switch yang sama, tanpa STP | Broadcast storm, jaringan lumpuh |
| 4.6 | Kasus 4.5, tapi STP aktif | Satu jalur diblokir, jaringan normal |
| 4.7 | Jalur utama putus, STP aktif | Jalur cadangan aktif otomatis |

Fitur tambahan (opsional): port mirroring, link aggregation, rate limit, port security.

## 4A. Router umum

Router menghubungkan **dua jaringan atau lebih** yang berbeda subnet. Tiap interface router punya IP sendiri, dan IP itu menjadi **gateway** bagi client di jaringan tersebut.

MikroTik adalah router dengan fitur tambahan (PPPoE server, hotspot, firewall lanjutan), jadi **aturan bagian ini juga berlaku untuk MikroTik**. ONT dalam mode router (PPPoE) juga berperilaku sebagai router, sedangkan ONT mode bridge bukan router. Di kode, jadikan MikroTik turunan dari node router.

| # | Kondisi | Hasil |
|---|---|---|
| 4A.1 | Router punya interface di jaringan A dan B, gateway client mengarah ke IP router di jaringannya | Client A dan B bisa berkomunikasi lewat router |
| 4A.2 | Gateway client kosong atau salah | Hanya bisa berkomunikasi di jaringan lokal, tidak ke jaringan lain atau internet |
| 4A.3 | Dua interface router berada di subnet yang sama | Tidak valid, ditolak (subnet bertumpuk) |
| 4A.4 | IP gateway sama dengan IP perangkat lain di jaringan itu | IP bentrok, hasil tidak stabil |
| 4A.5 | Router tanpa default route | Jaringan yang terhubung langsung tetap bisa berkomunikasi, tapi tidak ada internet |
| 4A.6 | Router di sisi WAN tanpa NAT | Client dapat IP, tapi tidak ada internet |
| 4A.7 | Router A tersambung ke router B, router A tidak punya static route ke LAN B | Client LAN A tidak bisa menjangkau LAN B. Client LAN B tetap bisa ke internet lewat A jika default route dan NAT benar |
| 4A.8 | Router A punya static route ke LAN B lewat router B | Client LAN A bisa menjangkau LAN B, selama router B tidak melakukan NAT di sisi yang menghadap A |
| 4A.9 | Dua router dengan DHCP aktif di jaringan layer 2 yang sama | DHCP ganda: server terdekat menang, jika jarak seri dipilih acak (lihat prinsip umum) |
| 4A.10 | Router di belakang router lain (NAT berlapis) | Internet tetap jalan, tapi koneksi dari luar ke perangkat di dalam tidak bisa tanpa port forward di tiap lapis |

## 4B. Access point (AP)

AP menghubungkan perangkat nirkabel ke jaringan kabel. Anggap AP sebagai **switch dengan WiFi**: bekerja di layer 2, tidak melakukan routing, dan secara normal tidak memberi IP. AP bersifat opsional dan bisa dipasang di belakang ONT RT/RW, router, atau switch.

Hal yang diatur pada AP: SSID, password, band (2,4 GHz atau 5 GHz), kanal, dan (jika didukung) pemetaan SSID ke VLAN.

| # | Kondisi | Hasil |
|---|---|---|
| 4B.1 | AP mode bridge/AP, kabel ke port LAN router, DHCP AP mati, DHCP router aktif | Client WiFi dapat IP dari router dan internet |
| 4B.2 | AP tanpa uplink (kabel putus atau belum terpasang), DHCP AP mati | Client bisa tersambung ke WiFi, tapi tidak dapat IP |
| 4B.3 | AP tanpa uplink, DHCP AP aktif | Client dapat IP dari AP, tapi tidak ada internet |
| 4B.4 | DHCP AP aktif, kabel ke port LAN router yang DHCP-nya juga aktif | DHCP ganda, client mendapat IP acak dari salah satunya |
| 4B.5 | AP mode router, kabel ke port LAN router utama | NAT berlapis. Client dapat internet, tapi berada di subnet terpisah |
| 4B.6 | Password WiFi salah | Client tidak tersambung |
| 4B.7 | Client di luar jangkauan sinyal | Client tidak tersambung. Sinyal lemah membuat koneksi lambat |
| 4B.8 | Client hanya mendukung 2,4 GHz, SSID hanya tersedia di 5 GHz | Client tidak bisa melihat atau menyambung ke SSID itu |
| 4B.9 | SSID dipetakan ke VLAN 20, port switch ke AP mengizinkan VLAN 20 (trunk) | Client SSID itu masuk VLAN 20 |
| 4B.10 | SSID dipetakan ke VLAN 20, tapi port switch ke AP berupa access (atau tidak mengizinkan VLAN 20) | Client tersambung ke WiFi, tapi tidak dapat IP |
| 4B.11 | Dua AP berdekatan memakai kanal yang saling tumpang tindih | Kecepatan turun, tapi masih tersambung |
| 4B.12 | Dua AP atau lebih dihubungkan kabel membentuk loop, tanpa STP | Broadcast storm, jaringan lumpuh |

## 4C. Mesh

Mesh adalah beberapa node yang bekerja sebagai **satu jaringan dengan satu SSID**. Satu node (node utama, atau *root*) terhubung ke router atau ISP lewat kabel. Node lain (satelit) terhubung ke node utama lewat **backhaul**, yaitu nirkabel atau kabel.

| # | Kondisi | Hasil |
|---|---|---|
| 4C.1 | Node utama terhubung ke router/ISP, satelit dalam jangkauan backhaul | Semua node satu jaringan, satu SSID. Client berpindah antar-node tanpa ganti jaringan |
| 4C.2 | Satelit di luar jangkauan node mana pun | Satelit terputus dan tidak membentuk jaringan |
| 4C.3 | Backhaul nirkabel memakai radio yang sama dengan client | Kecepatan turun di tiap lompatan (hop) |
| 4C.4 | Backhaul memakai kabel, atau band khusus backhaul | Kecepatan lebih stabil dibanding backhaul nirkabel biasa |
| 4C.5 | Node utama tanpa uplink | Client bisa tersambung ke mesh, tapi tidak ada internet |
| 4C.6 | Node utama mode router di belakang router lain | NAT berlapis. Atur node utama ke mode AP/bridge untuk menghindarinya |
| 4C.7 | Node dari sistem mesh yang berbeda | Tidak bisa bergabung, kecuali sama-sama mendukung standar yang sama (misalnya EasyMesh) |
| 4C.8 | Satelit mesh, DHCP | DHCP hanya dijalankan node utama. Satelit tidak boleh menjalankan DHCP sendiri |

Dukungan **VLAN per SSID pada mesh** bergantung pada perangkatnya. Jika tidak ditentukan pengguna, tandai sebagai "tidak terdefinisi" dan tanyakan.

## 5. MikroTik

Tiap fitur bergantung pada fitur di lapisan bawahnya.

### 5.1 Interface, IP, dan DHCP

| # | Kondisi | Hasil |
|---|---|---|
| 5.1.1 | Interface VLAN 20 punya IP dan DHCP server | Client dapat IP |
| 5.1.2 | DHCP server dibuat, tapi interface tidak punya IP address | DHCP tidak jalan |
| 5.1.3 | MikroTik tidak punya interface VLAN 20 | SSID 2 tidak dapat IP |

### 5.2 Route

- **Connected route** muncul otomatis untuk tiap interface yang punya IP.
- **Default route** (`0.0.0.0/0`) mengarah ke ONT ISP. Tanpa ini, MikroTik tidak tahu jalur ke internet.
- Gateway default route harus berada di jaringan yang sama dengan interface keluar.

| # | Kondisi | Hasil |
|---|---|---|
| 5.2.1 | Ada default route ke ONT ISP, NAT benar | Internet jalan |
| 5.2.2 | Tidak ada default route | Dapat IP, tidak ada internet |
| 5.2.3 | Gateway default route di jaringan yang tidak sama dengan interface keluar | Route tidak aktif |
| 5.2.4 | PC VLAN 10 ke PC VLAN 20 melalui MikroTik, tanpa aturan firewall | Tembus (connected route) |

### 5.3 NAT

NAT masquerade mengganti IP sumber paket keluar dengan IP interface keluar, lalu mencatat koneksi di tabel supaya balasan kembali ke client yang benar. NAT bisa berlapis (ONT RT/RW, MikroTik, ONT ISP) dan internet tetap jalan.

| # | Kondisi | Hasil |
|---|---|---|
| 5.3.1 | Masquerade dipasang di interface keluar ke ONT ISP | Client punya internet |
| 5.3.2 | Tidak ada aturan NAT | Dapat IP, tidak ada internet |
| 5.3.3 | Masquerade dipasang di interface yang salah (misalnya VLAN client) | Dapat IP, tidak ada internet |
| 5.3.4 | Koneksi dimulai dari luar ke IP lokal client tanpa port forward | Ditolak |

### 5.4 PPPoE

PPPoE membuat sesi login (username dan password) di atas Ethernet. Discovery memakai broadcast, sehingga **jalur layer 2 dari ONT sampai MikroTik harus utuh**.

Ada dua sesi PPPoE yang terpisah:

- ONT ISP ke BRAS (milik ISP)
- ONT RT/RW net ke MikroTik (milik sendiri)

Komponen PPPoE server di MikroTik: server (dipasang di satu interface), profile (aturan bersama), dan secret (satu akun per pelanggan).

| # | Kondisi | Hasil |
|---|---|---|
| 5.4.1 | Jalur VLAN utuh, secret cocok, server aktif di interface yang benar | Sesi tersambung |
| 5.4.2 | Username atau password salah | Gagal autentikasi. Client tetap dapat IP dari ONT, tapi tidak ada internet |
| 5.4.3 | PPPoE server dipasang di interface yang salah | ONT tidak menemukan server |
| 5.4.4 | VLAN WAN tidak diizinkan di OLT RT/RW | ONT tidak menemukan server |
| 5.4.5 | Sesi tersambung, tapi NAT atau default route belum benar | ONT online, client tidak ada internet |

### 5.5 Hotspot voucher

| # | Kondisi | Hasil |
|---|---|---|
| 5.5.1 | Hotspot aktif di VLAN 20, client belum login | Hanya halaman login yang terbuka |
| 5.5.2 | Hotspot aktif, client sudah login dengan voucher valid | Internet jalan |

### 5.6 Firewall

Pada konfigurasi pengguna, **VLAN 10 dan VLAN 20 diblok firewall satu sama lain** di MikroTik. Tanpa aturan blok, MikroTik otomatis menjadi jembatan antar-VLAN karena punya interface di keduanya.

| # | Kondisi | Hasil |
|---|---|---|
| 5.6.1 | Ada aturan firewall yang memblokir VLAN 10 dan VLAN 20 | Client kedua VLAN tidak bisa saling komunikasi, tapi tetap bisa ke internet |
| 5.6.2 | Aturan blok dihapus atau tidak ada | Client kedua VLAN bisa saling komunikasi |
| 5.6.3 | Aturan blok dipasang terlalu luas (memblokir semua trafik forward) | Client kehilangan internet |

## 6. Skenario gabungan RT/RW net

**Konfigurasi nyata pengguna:**

- SSID 1 (VLAN 10): mode router (PPPoE), DHCP ONT aktif.
- SSID 2 (VLAN 20): mode **bridge ke MikroTik**. Terkonfirmasi: gateway client SSID 2 bukan IP ONT dan halaman login voucher (captive portal) muncul, sehingga DHCP dan hotspot voucher dijalankan oleh MikroTik. DHCP ONT tidak boleh melayani SSID 2.

Simulator tetap menyediakan **mode WAN per SSID sebagai pengaturan yang bisa dipilih** (PPPoE atau bridge), supaya kedua desain bisa dibandingkan.

| # | Kondisi | Hasil |
|---|---|---|
| 6.1 | PPPoE ONT ke MikroTik berhasil, VLAN WAN diizinkan di OLT RT/RW, optik ISP normal, DHCP ONT aktif | Client dapat IP dari ONT dan internet |
| 6.2 | VLAN WAN tidak diizinkan di OLT RT/RW | PPPoE gagal. Client dapat IP dari ONT, tidak ada internet |
| 6.3 | Username atau password PPPoE salah | Sama seperti 6.2 |
| 6.4 | Fiber ISP putus | PPPoE ke MikroTik tetap tersambung, tidak ada internet |
| 6.5 | Fiber ke satu ONT pelanggan putus | LOS hanya untuk pelanggan itu |
| 6.6 | SSID 2 mode bridge ke hotspot MikroTik, DHCP ONT untuk SSID 2 mati, VLAN 20 utuh sampai MikroTik | Client dapat IP dari MikroTik, melihat halaman login voucher |
| 6.7 | SSID 2 mode bridge, tapi DHCP ONT aktif untuk SSID 2 | Client dapat IP dari ONT dan melewati voucher |
| 6.8 | Port LAN ONT atau OLT RT/RW tidak mengizinkan VLAN 20 | SSID 2 tidak dapat IP |
| 6.9 | Client SSID 1 mencoba menghubungi client SSID 2 | Ditolak, karena firewall MikroTik memblokir VLAN 10 dan VLAN 20. Tembus hanya jika aturan blok dihapus |

## 7. Konfigurasi per node (panel pengaturan)

Tujuan: pengguna bisa melihat dan mengubah konfigurasi tiap node seperti di perangkat aslinya, sehingga simulator juga menjadi alat belajar membaca konfigurasi nyata.

**Prinsip:**

1. Tiap node punya **panel konfigurasi** yang strukturnya mengikuti perangkat asli: nama menu, istilah, dan urutan field dibuat semirip mungkin.
2. Konfigurasi adalah **satu-satunya sumber kebenaran**. Validator hanya membaca dari konfigurasi ini, bukan dari data lain.
3. Setiap perubahan field **memicu validasi ulang** dan menampilkan hasil beserta alasannya.
4. Field punya **nilai bawaan** yang meniru perangkat umum, ditandai wajib atau opsional, dan divalidasi (format IP, VLAN ID 1 sampai 4094, password tidak kosong, dan seterusnya).
5. Opsional: sediakan **tampilan ringkasan konfigurasi dalam bentuk teks** (mirip hasil export atau CLI) agar pengguna terbiasa membaca konfigurasi nyata.
6. Nama field berbeda antar merk. Boleh disederhanakan, tapi jangan mengarang field yang tidak ada di perangkat nyata. Jika tidak yakin, tandai "tidak terdefinisi" dan tanyakan.

**Field per node:**

| Node | Kelompok | Field |
|---|---|---|
| **ONT** | Status | Status optik (terhubung atau LOS) |
| | Koneksi WAN (bisa lebih dari satu) | Nama, mode (PPPoE/router atau bridge), VLAN ID WAN, username dan password PPPoE (jika PPPoE), binding ke SSID atau port LAN |
| | LAN | IP gateway, subnet mask, DHCP server (aktif/mati, rentang IP, lease time) |
| | WLAN (per SSID) | Nama SSID, aktif/mati, keamanan dan password, band, kanal, VLAN, WAN yang dipakai |
| | Port LAN | Status, pemetaan VLAN per port |
| **OLT** | PON | Status port PON, daftar ONU terdaftar (autentikasi lewat serial number atau MAC) |
| | Profil layanan | VLAN yang dibawa tiap ONU, pemetaan VLAN per layanan |
| | Uplink | Port uplink, mode trunk, VLAN yang diizinkan |
| **Switch manageable** | Per port | Status, mode (access atau trunk), VLAN access (PVID), daftar VLAN yang diizinkan pada trunk |
| | VLAN | Daftar VLAN (ID dan nama) |
| | STP | Aktif/mati, prioritas |
| | Opsional | Port mirroring, link aggregation, rate limit, port security |
| **Router umum** | Interface | Nama, IP dan mask, status |
| | DHCP | Per interface: aktif/mati, rentang IP, gateway, DNS |
| | Route | Route statis (tujuan dan gateway), default route |
| | NAT | Aktif/mati, interface keluar |
| **MikroTik** (turunan router) | Interfaces | Port ether, interface VLAN (nama, VLAN ID, interface induk), bridge (opsional) |
| | IP | Address (alamat dan interface), pool, DHCP server (interface, pool, network, gateway, DNS), routes |
| | Firewall | NAT (chain, action masquerade, out-interface), filter rules (chain forward, sumber, tujuan, action drop atau accept) |
| | PPP | Profile, secret (nama, password, profile, service pppoe), PPPoE server (interface, service name, default profile) |
| | Hotspot | Interface, address pool, profile, user atau voucher (username, password, batas waktu) |
| **Access point** | Umum | Mode (AP/bridge atau router), port uplink, DHCP (aktif/mati) |
| | SSID | Nama, password, band, kanal, VLAN |
| **Mesh** | Node | Peran (utama atau satelit), tipe backhaul (kabel atau nirkabel), mode (router atau AP/bridge), sistem mesh (untuk aturan 4C.7), SSID tunggal |
| **BRAS** (opsional) | Layanan | Akun PPPoE pelanggan (username dan password), profil kecepatan, status internet upstream |
| **Sumber Internet** | LAN | IP gateway, subnet mask, DHCP server (aktif/mati, pool awal dan akhir), DNS |
| **Client** | IP | Mode (DHCP atau statis), IP, mask, gateway, DNS |
| | WiFi | SSID tujuan dan password |

Untuk MikroTik, susun menu mengikuti kelompok yang ada di RouterOS (Interfaces, IP, Firewall, PPP, Hotspot) agar pengguna terbiasa dengan strukturnya.

**Alat uji pada client (disarankan):** sediakan pengecekan sederhana (mirip ping atau traceroute) yang menunjukkan **di lapisan mana koneksi gagal**: fisik, layer 2, IP/DHCP, route, atau NAT. Ini mendukung empat status hasil di bagian prinsip umum.

## 8. Sumber Internet

Node untuk uji cepat: modem atau router ISP siap pakai. Node ini sudah memiliki IP gateway LAN (bawaan 192.168.1.1/24) dan DHCP server aktif (pool 192.168.1.2 sampai 192.168.1.254, DNS 8.8.8.8), serta **selalu punya internet selama menyala**, sehingga topologi tidak perlu dimulai dari Metro, OLT, ODC, ODP, dan ONT.

Diperlakukan sebagai router: batas domain layer 2, pemberi DHCP, dan gateway. Tidak punya uplink optik, jadi aturan optik dan LOS tidak berlaku untuknya.

| # | Kondisi | Hasil |
|---|---|---|
| 8.0 | Node ditambahkan dari palet kategori Infrastruktur | Langsung berisi IP gateway LAN dan DHCP aktif, dengan 4 port LAN ethernet |
| 8.1 | Client dihubungkan langsung ke Sumber Internet | Client mendapat IP dari pool DHCP dan internet normal. Sumber Internet sendiri berstatus online |
| 8.2 | Beberapa client lewat switch ke Sumber Internet | Semua internet normal, IP tiap client unik |
| 8.3 | Sumber Internet disambung ke port WAN MikroTik, client di belakang MikroTik | Internet normal. Jika NAT MikroTik mati, client tidak ada internet (5.3.2) |
| 8.4 | Sumber Internet dimatikan | Semua client di belakangnya tidak ada internet, dan kartunya Putus |
| 8.5 | DHCP Sumber Internet dimatikan, client memakai DHCP | Client tersambung tapi tidak mendapat IP |
| 8.6 | Client IP statis dengan gateway sama dengan IP Sumber Internet | Internet normal. Gateway salah: tidak ada internet |
| 8.7 | ONT mode bridge (DHCP mati) di belakang Sumber Internet, client di ONT | Client mendapat IP dan internet dari Sumber Internet (perluasan aturan 2.1). IP bawaan ONT bridge tidak dihitung bentrok (2.7) |
| 8.8 | Dua Sumber Internet dengan DHCP aktif di jaringan layer 2 yang sama | DHCP ganda (4A.9). Client tetap mendapat IP dan internet dari salah satunya |
| 8.9 | Ping 8.8.8.8 dari client saat tidak ada node Internet | Menuju Sumber Internet. Ping ke IP gateway-nya menuju dirinya sendiri |

## Keputusan yang sudah dikonfirmasi pengguna

- ONT RT/RW net dial PPPoE ke MikroTik (MikroTik berperan sebagai PPPoE server).
- VLAN 10 dan VLAN 20 diblok firewall satu sama lain.
- Client LAN tanpa tag yang tersambung ke ONT ber-VLAN tetap mendapat IP dari DHCP ONT (dilaporkan pengguna dari topologi nyata, menjadi aturan 2.6 dan 2.7).
- Switch manageable bersifat opsional: sebagian topologi RT/RW net memakainya, sebagian tidak. Simulator harus mendukung kedua kasus, dan aturan switch (bagian 4) hanya berlaku jika switch ada di topologi.

## Catatan verifikasi

Aturan di dokumen ini disusun lewat diskusi dan **belum diuji di perangkat nyata**. Karena simulator dipakai untuk belajar, verifikasi tiap aturan lewat dokumentasi resmi (misalnya wiki MikroTik), Cisco Packet Tracer, GNS3, atau perangkat asli sebelum dipercaya.
