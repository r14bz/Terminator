import type { DeviceMetadata, NodeType } from '../types/network';

export const DEVICE_METADATA: Record<NodeType, DeviceMetadata> = {
  internet: {
    type: 'internet',
    name: 'Internet / Cloud WAN',
    category: 'infrastructure',
    shortDesc: 'Uplink Internet Global / ISP Tier 1 / IXP',
    fullDescription: 'Gerbang utama koneksi global (World Wide Web) yang menyediakan rute publik, DNS global (8.8.8.8, 1.1.1.1), dan bandwidth hulu ke ISP.',
    technicianRole: 'Sumber koneksi internet utama. Menyediakan alokasi IP Publik dan default gateway (0.0.0.0/0) yang akan didistribusikan ke jaringan lokal.',
    technicianTips: [
      'Pastikan IP publik dan gateway ISP sudah terpasang dengan benar di router gateway.',
      'Cek kestabilan koneksi dengan melakukan ping berkala ke DNS 8.8.8.8 atau 1.1.1.1.',
      'Perhatikan nilai latency dan jitter pada uplink sebelum komplain ke provider ISP.'
    ],
    defaultPorts: [
      { name: 'WAN 1 (10G)', medium: 'ethernet' },
      { name: 'WAN 2 (10G)', medium: 'ethernet' },
      { name: 'FO Uplink', medium: 'fiber' },
    ],
    color: '#0284c7', // Sky blue
  },
  internet_source: {
    type: 'internet_source',
    name: 'Sumber Internet',
    category: 'infrastructure',
    shortDesc: 'Modem/router ISP siap pakai: sudah punya IP dan DHCP aktif',
    fullDescription: 'Sumber internet instan yang berperan sebagai modem atau router ISP. Selalu punya akses internet selama menyala, sudah memiliki IP gateway LAN, dan DHCP server-nya aktif, sehingga topologi bisa dimulai tanpa membangun Metro, OLT, ODC, ODP, dan ONT terlebih dahulu.',
    technicianRole: 'Pengganti seluruh rantai hulu ISP. Hubungkan langsung ke port WAN MikroTik, router, switch, atau perangkat klien untuk menguji konfigurasi sisi pelanggan.',
    technicianTips: [
      'Hubungkan ke port WAN MikroTik, lalu atur default route MikroTik ke IP gateway Sumber Internet ini.',
      'Matikan DHCP server di sini jika di belakangnya ada router atau MikroTik yang sudah membagikan IP, agar tidak terjadi DHCP ganda.',
      'Untuk meniru kondisi nyata dengan OLT dan ONT, pakai rantai Metro, OLT, ODP, dan ONT. Node ini untuk uji cepat.'
    ],
    defaultPorts: [
      { name: 'LAN 1', medium: 'ethernet' },
      { name: 'LAN 2', medium: 'ethernet' },
      { name: 'LAN 3', medium: 'ethernet' },
      { name: 'LAN 4', medium: 'ethernet' },
    ],
    color: '#16a34a', // Hijau: internet siap
  },
  metro: {
    type: 'metro',
    name: 'Metro Ethernet',
    category: 'infrastructure',
    shortDesc: 'Jaringan Carrier Metro-E / Ring Backbone',
    fullDescription: 'Jaringan transmisi berkecepatan tinggi antar POP (Point of Presence) atau sentral menggunakan teknologi MPLS / Carrier Ethernet untuk menghubungkan NOC dengan OLT.',
    technicianRole: 'Menyediakan pipa bandwidth besar berstandar telco (QinQ / VLAN Trunk) dari core ISP menuju perangkat OLT di sentral ODC/ODF.',
    technicianTips: [
      'Gunakan SFP+ 10G atau 25G Single Mode untuk koneksi jarak jauh (10km - 40km).',
      'Pastikan konfigurasi MTU minimal 1500 (atau 9000 Jumbo Frame) agar paket VLAN ganda (QinQ) tidak terfragmentasi.',
      'Periksa apakah link menggunakan proteksi ring (ERPS/RSTP) agar tidak terjadi downtime saat putus kabel.'
    ],
    defaultPorts: [
      { name: 'Port Core In', medium: 'fiber' },
      { name: 'Port Core Out', medium: 'fiber' },
      { name: 'Uplink 10GE', medium: 'fiber' },
      { name: 'GE Out', medium: 'ethernet' },
    ],
    color: '#4f46e5', // Indigo
  },
  olt: {
    type: 'olt',
    name: 'OLT (Optical Line Terminal)',
    category: 'ftth',
    shortDesc: 'Perangkat Pusat FTTH (GPON / EPON)',
    fullDescription: 'Perangkat aktif di sentral (Central Office/NOC) yang mengubah sinyal listrik standar menjadi sinyal optik GPON untuk didistribusikan ke ratusan atau ribuan pelanggan (ONT) melalui kabel fiber tunggal.',
    technicianRole: 'Otak dari jaringan FTTH. Mengatur modulasi optik GPON downstream (1490nm) dan upstream (1310nm), alokasi bandwidth DBA, dan otorisasi serial number ONT.',
    technicianTips: [
      'Keluaran SFP GPON Class B+ memiliki daya transmisi TX sekitar +1.5 s/d +5.0 dBm (standar +3.0 dBm).',
      'Jangan pernah melihat langsung ke dalam lubang port PON dengan mata telanjang karena laser inframerah tidak terlihat dan merusak retina mata!',
      'Gunakan One-Click Cleaner dan alkohol isopropil 99% untuk membersihkan konektor sebelum dicolok ke SFP.'
    ],
    standardOpticalLoss: 'Output TX: +1.5 ~ +5 dBm',
    defaultPorts: [
      { name: 'Uplink 10G', medium: 'fiber' },
      { name: 'Uplink GE', medium: 'ethernet' },
      { name: 'PON 1', medium: 'fiber' },
      { name: 'PON 2', medium: 'fiber' },
      { name: 'PON 3', medium: 'fiber' },
      { name: 'PON 4', medium: 'fiber' },
    ],
    color: '#059669', // Emerald
  },
  odc: {
    type: 'odc',
    name: 'ODC (Optical Distribution Cabinet)',
    category: 'ftth',
    shortDesc: 'Lemari Pembagi Fiber Optik Luar Ruang',
    fullDescription: 'Kotak / lemari kabinet pelindung di pinggir jalan yang membagi kabel feeder berkapasitas besar (misal 48/96 core) menjadi kabel distribusi (12/24 core) menggunakan splitter pasif tahap pertama (umumnya 1:4).',
    technicianRole: 'Titik transisi kabel bawah tanah / tiang dari OLT menuju kabel distribusi jalanan. Berfungsi juga sebagai tempat patching, splicing, dan testing sinyal.',
    technicianTips: [
      'Biasanya menggunakan splitter 1:4 (redaman sekitar ~7.2 dB).',
      'Pastikan pintu ODC tertutup rapat dan seal karet anti-air terpasang baik untuk mencegah masuknya air hujan, debu, dan sarang serangga.',
      'Beri label nomor tube dan core pada setiap kaset tray splice untuk mempermudah pelacakan saat ada gangguan.'
    ],
    standardOpticalLoss: 'Loss Splitter 1:4: ~7.2 dB',
    defaultPorts: [
      { name: 'Feeder IN', medium: 'fiber' },
      { name: 'Dist 1 (Out)', medium: 'fiber' },
      { name: 'Dist 2 (Out)', medium: 'fiber' },
      { name: 'Dist 3 (Out)', medium: 'fiber' },
      { name: 'Dist 4 (Out)', medium: 'fiber' },
    ],
    color: '#d97706', // Amber
  },
  odp: {
    type: 'odp',
    name: 'ODP (Optical Distribution Point)',
    category: 'ftth',
    shortDesc: 'Kotak Distribusi Tiang ke Rumah Pelanggan',
    fullDescription: 'Kotak terminasi optik yang terpasang di atas tiang telepon/listrik atau dinding gedung. Berisi splitter tahap kedua (umumnya 1:8 atau 1:16) untuk mencabangkan kabel drop core ke rumah-rumah warga.',
    technicianRole: 'Titik sambung terakhir di tiang sebelum kabel drop masuk ke rumah pelanggan. Teknisi menyambungkan konektor SC/UPC atau SC/APC drop cable ke adapter ODP.',
    technicianTips: [
      'Gunakan OPM (Optical Power Meter) untuk mengukur port ODP sebelum menarik kabel drop ke rumah pelanggan. Nilai ideal: -16 dBm s/d -22 dBm.',
      'Jika redaman di ODP sudah di atas -25 dBm, jangan pasang ONT baru sebelum masalah di kabel distribusi atau ODC diperbaiki.',
      'Gunakan tangga pengaman dan sabuk keselamatan (harness) saat bekerja di ketinggian tiang.'
    ],
    standardOpticalLoss: 'Loss Splitter 1:8: ~10.5 dB | 1:16: ~13.8 dB',
    defaultPorts: [
      { name: 'Dist IN', medium: 'fiber' },
      { name: 'Port Drop 1', medium: 'fiber' },
      { name: 'Port Drop 2', medium: 'fiber' },
      { name: 'Port Drop 3', medium: 'fiber' },
      { name: 'Port Drop 4', medium: 'fiber' },
      { name: 'Port Drop 5', medium: 'fiber' },
      { name: 'Port Drop 6', medium: 'fiber' },
      { name: 'Port Drop 7', medium: 'fiber' },
      { name: 'Port Drop 8', medium: 'fiber' },
    ],
    color: '#0d9488', // Teal
  },
  splitter: {
    type: 'splitter',
    name: 'Optical Splitter',
    category: 'ftth',
    shortDesc: 'Pemisah Sinyal Optik Pasif (PLC Splitter)',
    fullDescription: 'Komponen optik pasif tanpa listrik yang membagi satu berkas cahaya menjadi beberapa jalur keluaran dengan perbandingan daya yang sama rata.',
    technicianRole: 'Elemen inti teknologi PON yang memungkinkan penghematan kabel fiber (1 core OLT dibagi ke 8, 16, hingga 64 pelanggan).',
    technicianTips: [
      'Rumus redaman matematis teoritis: 10 * log10(N) + insertion loss.',
      'Rincian redaman riil di lapangan: 1:2 = ~3.5 dB, 1:4 = ~7.2 dB, 1:8 = ~10.5 dB, 1:16 = ~13.8 dB, 1:32 = ~17.2 dB.',
      'Hati-hati dengan bending kabel pigtail splitter; tekukan tajam (macro-bending) akan menambah redaman drastis hingga sinyal hilang total.'
    ],
    standardOpticalLoss: '1:2 (-3.5dB), 1:4 (-7.2dB), 1:8 (-10.5dB), 1:16 (-13.8dB)',
    defaultPorts: [
      { name: 'Input', medium: 'fiber' },
      { name: 'Out 1', medium: 'fiber' },
      { name: 'Out 2', medium: 'fiber' },
      { name: 'Out 3', medium: 'fiber' },
      { name: 'Out 4', medium: 'fiber' },
      { name: 'Out 5', medium: 'fiber' },
      { name: 'Out 6', medium: 'fiber' },
      { name: 'Out 7', medium: 'fiber' },
      { name: 'Out 8', medium: 'fiber' },
    ],
    color: '#e11d48', // Rose
  },
  htb: {
    type: 'htb',
    name: 'HTB Converter (Media Converter)',
    category: 'ftth',
    shortDesc: 'Pengubah Sinyal Optik ke Kabel LAN (Fast/Gigabit)',
    fullDescription: 'Alat pengubah media transmisi dari kabel fiber optik (konektor SC single mode) ke kabel tembaga RJ45 (LAN Ethernet). Sangat populer di jaringan RT/RW Net.',
    technicianRole: 'Solusi transmisi jarak jauh (hingga 20 km) yang ekonomis tanpa memerlukan perangkat OLT GPON mahal.',
    technicianTips: [
      'HTB biasanya berpasangan: HTB Tipe A (Tx 1310nm / Rx 1550nm - Biru) harus dipasangkan dengan HTB Tipe B (Tx 1550nm / Rx 1310nm - Kuning)!',
      'Jika lampu indikator FX-Link mati: periksa arah TX/RX, redaman kabel optik, atau konektor SC fast connector kotor/kurang presisi.',
      'Lampu indikator TP-Link menunjukkan koneksi kabel LAN RJ45 ke router atau switch.'
    ],
    defaultPorts: [
      { name: 'Optic SC Port', medium: 'fiber' },
      { name: 'LAN RJ45 Port', medium: 'ethernet' },
    ],
    color: '#8b5cf6', // Violet
  },
  ont: {
    type: 'ont',
    name: 'ONT / ONU (Optical Modem)',
    category: 'ftth',
    shortDesc: 'Modem Optik Pelanggan (Indihome, Biznet, dsb)',
    fullDescription: 'Perangkat CPE (Customer Premises Equipment) di rumah pelanggan yang mengubah sinyal optik dari kabel drop core menjadi koneksi LAN Ethernet dan Wi-Fi.',
    technicianRole: 'Ujung akhir jaringan FTTH di sisi pelanggan. Bertanggung jawab atas autentikasi PPPoE/IPoE, bridge/route mode, dan pemancar Wi-Fi lokal.',
    technicianTips: [
      'Standar daya terima optik (RX Power) ideal di ONT: -18.0 s/d -24.0 dBm.',
      'Batas toleransi maksimal: -27.0 dBm. Jika daya lebih lemah dari -27 dBm, lampu LOS merah akan menyala/berkedip dan koneksi putus-putus.',
      'Jika lampu PON mati dan LOS merah: lakukan pengetesan kabel drop core dengan VFL (laser merah) untuk mencari titik kabel yang terjepit atau putus.'
    ],
    standardOpticalLoss: 'Target Rx: -18 s/d -24 dBm (LOS < -27 dBm)',
    defaultPorts: [
      { name: 'PON (SC/UPC)', medium: 'fiber' },
      { name: 'LAN 1 (GE)', medium: 'ethernet' },
      { name: 'LAN 2 (FE)', medium: 'ethernet' },
      { name: 'LAN 3 (FE)', medium: 'ethernet' },
      { name: 'LAN 4 (FE)', medium: 'ethernet' },
      { name: 'WLAN 2.4G', medium: 'wireless', maxConnections: 32 },
    ],
    color: '#0284c7', // Sky
  },
  mikrotik: {
    type: 'mikrotik',
    name: 'MikroTik Router (RouterOS)',
    category: 'routing',
    shortDesc: 'Router Manajemen Jaringan, NAT, & Bandwidth',
    fullDescription: 'Router jaringan serbaguna (seperti RB750Gr3, RB4011, CCR) yang digunakan untuk manajemen bandwidth (Queue), Hotspot, PPPoE Server, Routing, dan Firewall.',
    technicianRole: 'Pusat manajemen lalu lintas data. Mengatur pembagian IP (DHCP Server), NAT Masquerade ke internet, pemisahan VLAN, dan pembatasan kecepatan klien.',
    technicianTips: [
      'Selalu aktifkan rule NAT Masquerade pada interface WAN (chain=srcnat action=masquerade out-interface=WAN) agar klien bisa internetan.',
      'Jangan lupa memasang DNS IP dan mencentang "Allow Remote Requests" saat menyalakan DHCP Server.',
      'Amankan port default Winbox (8291), ubah username admin, dan matikan service yang tidak dipakai (telnet, ftp).'
    ],
    defaultPorts: [
      { name: 'ether1 (WAN)', medium: 'ethernet' },
      { name: 'ether2 (LAN)', medium: 'ethernet' },
      { name: 'ether3 (LAN)', medium: 'ethernet' },
      { name: 'ether4 (LAN)', medium: 'ethernet' },
      { name: 'ether5 (LAN)', medium: 'ethernet' },
    ],
    color: '#ea580c', // Orange
  },
  switch: {
    type: 'switch',
    name: 'Switch Hub (Ethernet Switch)',
    category: 'routing',
    shortDesc: 'Pencabang Port Jaringan LAN (Layer 2)',
    fullDescription: 'Perangkat layer 2 yang menghubungkan banyak perangkat berkabel dalam satu jaringan lokal (LAN) menggunakan tabel MAC address.',
    technicianRole: 'Memperbanyak port Ethernet untuk komputer kantor, access point, CCTV, dan server.',
    technicianTips: [
      'Hati-hati dengan loop kabel (kabel dicolok dari switch kembali ke switch yang sama)! Ini menyebabkan Broadcast Storm yang melumpuhkan seluruh jaringan.',
      'Gunakan switch Gigabit (10/100/1000 Mbps) dan kabel Cat6 untuk throughput maksimal.',
      'Jika menggunakan switch managed, atur VLAN trunk pada port uplink dan VLAN access pada port perangkat klien.'
    ],
    defaultPorts: [
      { name: 'Port 1 (Uplink)', medium: 'ethernet' },
      { name: 'Port 2', medium: 'ethernet' },
      { name: 'Port 3', medium: 'ethernet' },
      { name: 'Port 4', medium: 'ethernet' },
      { name: 'Port 5', medium: 'ethernet' },
      { name: 'Port 6', medium: 'ethernet' },
      { name: 'Port 7', medium: 'ethernet' },
      { name: 'Port 8', medium: 'ethernet' },
    ],
    color: '#2563eb', // Blue
  },
  switch_managed: {
    type: 'switch_managed',
    name: 'Switch Hub Manageable (L2/L3)',
    category: 'routing',
    shortDesc: 'Switch Enterprise 24 GE + 4 SFP+ (VLAN 802.1Q, LACP, STP, PoE)',
    fullDescription: 'Switch manageable kelas enterprise dengan kontrol per-port: pembagian VLAN 802.1Q (Trunk/Access), isolasi broadcast domain, STP/RSTP anti loop, Port Mirroring, dan uplink fiber SFP+ 10Gbps.',
    technicianRole: 'Distribusi jaringan inti di gedung, hotel, atau ISP dengan manajemen bandwidth, isolasi pelanggan, dan keamanan port.',
    technicianTips: [
      'Gunakan port Trunk untuk kabel penghubung ke router MikroTik atau antar switch, dan port Access untuk perangkat pengguna/CCTV.',
      'Aktifkan RSTP (Rapid Spanning Tree Protocol) untuk mencegah jaringan lumpuh (broadcast storm) saat ada teknisi salah colok kabel loop.',
      'SFP+ Uplink port (Port 25-28) dapat menggunakan modul SFP 1G atau 10G untuk interkoneksi backbone optik jarak jauh.'
    ],
    defaultPorts: [
      { name: 'Port 1 (GE)', medium: 'ethernet' },
      { name: 'Port 2 (GE)', medium: 'ethernet' },
      { name: 'Port 3 (GE)', medium: 'ethernet' },
      { name: 'Port 4 (GE)', medium: 'ethernet' },
      { name: 'Port 5 (GE)', medium: 'ethernet' },
      { name: 'Port 6 (GE)', medium: 'ethernet' },
      { name: 'Port 7 (GE)', medium: 'ethernet' },
      { name: 'Port 8 (GE)', medium: 'ethernet' },
      { name: 'Port 9 (GE)', medium: 'ethernet' },
      { name: 'Port 10 (GE)', medium: 'ethernet' },
      { name: 'Port 11 (GE)', medium: 'ethernet' },
      { name: 'Port 12 (GE)', medium: 'ethernet' },
      { name: 'Port 13 (GE)', medium: 'ethernet' },
      { name: 'Port 14 (GE)', medium: 'ethernet' },
      { name: 'Port 15 (GE)', medium: 'ethernet' },
      { name: 'Port 16 (GE)', medium: 'ethernet' },
      { name: 'Port 17 (GE)', medium: 'ethernet' },
      { name: 'Port 18 (GE)', medium: 'ethernet' },
      { name: 'Port 19 (GE)', medium: 'ethernet' },
      { name: 'Port 20 (GE)', medium: 'ethernet' },
      { name: 'Port 21 (GE)', medium: 'ethernet' },
      { name: 'Port 22 (GE)', medium: 'ethernet' },
      { name: 'Port 23 (GE)', medium: 'ethernet' },
      { name: 'Port 24 (GE)', medium: 'ethernet' },
      { name: 'SFP+ 25 (10G)', medium: 'fiber' },
      { name: 'SFP+ 26 (10G)', medium: 'fiber' },
      { name: 'SFP+ 27 (10G)', medium: 'fiber' },
      { name: 'SFP+ 28 (10G)', medium: 'fiber' },
    ],
    color: '#1d4ed8', // Dark Blue
  },
  router: {
    type: 'router',
    name: 'Wi-Fi Wireless Router',
    category: 'routing',
    shortDesc: 'Router Rumahan & Kantor dengan Wi-Fi',
    fullDescription: 'Router konsumen dengan port WAN RJ45, switch 4 port terintegrasi, dan pemancar antena Wi-Fi dual-band (2.4GHz & 5GHz).',
    technicianRole: 'Menghubungkan jaringan lokal rumah ke modem ISP dan menyebarkan sinyal nirkabel ke smartphone dan laptop.',
    technicianTips: [
      'Gunakan mode Access Point (AP) jika router diletakkan di belakang MikroTik agar tidak terjadi double NAT.',
      'Pilih kanal Wi-Fi 1, 6, atau 11 pada frekuensi 2.4GHz untuk menghindari tumpang tindih interferensi sinyal tetangga.',
      'Enkripsi Wi-Fi minimal WPA2-PSK (AES) atau WPA3 untuk keamanan.'
    ],
    defaultPorts: [
      { name: 'WAN Port', medium: 'ethernet' },
      { name: 'LAN 1', medium: 'ethernet' },
      { name: 'LAN 2', medium: 'ethernet' },
      { name: 'LAN 3', medium: 'ethernet' },
      { name: 'LAN 4', medium: 'ethernet' },
      { name: 'Wi-Fi 2.4G/5G', medium: 'wireless', maxConnections: 32 },
    ],
    color: '#0891b2', // Cyan
  },
  ap_ptp: {
    type: 'ap_ptp',
    name: 'Access Point PTP (Wireless Outdoor Bridge)',
    category: 'routing',
    shortDesc: 'Koneksi Nirkabel Point-to-Point Jarak Jauh (airMAX, 5GHz/60GHz)',
    fullDescription: 'Perangkat radio outdoor nirkabel berkekuatan tinggi (dish/grid antenna) untuk menghubungkan dua lokasi tanpa kabel (Point-to-Point / PtMP) hingga jarak 20+ kilometer dengan throughput gigabit.',
    technicianRole: 'Menghubungkan tower pemancar BTS ke gedung pelanggan, menghubungkan dua kantor cabang antar pulau/bukit, atau transmisi CCTV pedalaman.',
    technicianTips: [
      'Pointing antena wajib dilakukan berdua: satu teknisi di tower A dan satu di tower B sambil memantau indikator LED sinyal RSSI (-50 dBm s/d -60 dBm ideal).',
      'Pastikan zona Fresnel (Fresnel Zone) 60% bebas hambatan dari pohon, bukit, atau bangunan tinggi agar kecepatan throughput tidak anjlok.',
      'Gunakan kabel outdoor STP berlapis pelindung grounding (shielded) dan pasang Ethernet Surge Protector untuk proteksi petir.'
    ],
    defaultPorts: [
      { name: 'Gigabit PoE LAN (RJ-45)', medium: 'ethernet' },
      { name: 'Wireless PtP Radio', medium: 'wireless' },
    ],
    color: '#0284c7', // Sky dark
  },
  mesh: {
    type: 'mesh',
    name: 'Mesh Wi-Fi / AP Node',
    category: 'routing',
    shortDesc: 'Perluasan Jangkauan Wi-Fi Cerdas (Seamless Roaming)',
    fullDescription: 'Sistem Wi-Fi cerdas tanpa kabel putus (seamless roaming) yang menghubungkan beberapa node untuk memperluas jangkauan nirkabel satu rumah atau kantor besar.',
    technicianRole: 'Menghilangkan zona tanpa sinyal (blind spot/dead zone) dengan satu nama SSID yang sama di seluruh gedung.',
    technicianTips: [
      'Jika memungkinkan, gunakan kabel LAN sebagai penghubung antar node (Ethernet Backhaul) agar kecepatan tetap 100% penuh.',
      'Jarak ideal antar node tanpa kabel adalah maksimal 2 dinding beton atau sekitar 10-15 meter.',
      'Pastikan fitur Fast Roaming (802.11k/v/r) aktif di aplikasi pengelola.'
    ],
    defaultPorts: [
      { name: 'WAN/LAN 1', medium: 'ethernet' },
      { name: 'LAN 2', medium: 'ethernet' },
      { name: 'Wireless Mesh', medium: 'wireless', maxConnections: 32 },
    ],
    color: '#10b981', // Emerald light
  },
  pc: {
    type: 'pc',
    name: 'Komputer / PC Workstation',
    category: 'client_iot',
    shortDesc: 'Komputer Pengguna dengan Kartu Jaringan (NIC)',
    fullDescription: 'Komputer desktop atau laptop dengan antarmuka jaringan Ethernet RJ45 untuk pengujian konektivitas, ping, DNS, dan akses web.',
    technicianRole: 'Alat verifikasi utama di lokasi kerja untuk mengecek apakah internet, gateway, dan DNS berfungsi normal.',
    technicianTips: [
      'Perintah diagnosa dasar pada command prompt (CMD): ipconfig /all, ping, tracert, nslookup.',
      'Jika status kabel "Unidentified Network / No Internet", cek apakah IP address salah subnet atau DHCP server mati.',
      'Periksa lampu indikator LED pada port LAN motherboard: oranye = gigabit, hijau = aktif transfer data.'
    ],
    defaultPorts: [
      { name: 'NIC Ethernet (RJ45)', medium: 'ethernet' },
      { name: 'Wi-Fi Adapter', medium: 'wireless' },
    ],
    color: '#64748b', // Slate
  },
  cctv: {
    type: 'cctv',
    name: 'CCTV IP Camera',
    category: 'client_iot',
    shortDesc: 'Kamera Pengawas Jaringan Berbasis IP (PoE)',
    fullDescription: 'Kamera pengawas digital yang mengirimkan video streaming beresolusi tinggi (RTSP/ONVIF) melalui kabel jaringan LAN, sering ditenagai via PoE (Power over Ethernet).',
    technicianRole: 'Menyediakan rekaman pengawasan keamanan real-time yang dihubungkan ke NVR (Network Video Recorder).',
    technicianTips: [
      'Pastikan switch yang dipakai mendukung standar PoE (802.3af/at) jika kamera tidak memakai adaptor terpisah.',
      'Gunakan IP static untuk setiap CCTV agar rekaman di NVR tidak hilang saat router me-reboot IP DHCP.',
      'Gunakan kompresi H.265 untuk menghemat konsumsi bandwidth jaringan dan kapasitas harddisk hingga 50%.'
    ],
    defaultPorts: [
      { name: 'PoE RJ45 Port', medium: 'ethernet' },
      { name: 'Coaxial BNC', medium: 'coaxial' },
    ],
    color: '#7c3aed', // Purple
  },
  smartphone: {
    type: 'smartphone',
    name: 'Smartphone / Tablet',
    category: 'client_iot',
    shortDesc: 'Perangkat Seluler Nirkabel (Wi-Fi Client)',
    fullDescription: 'Perangkat nirkabel portabel yang terhubung ke jaringan melalui sinyal Wi-Fi 2.4GHz atau 5GHz.',
    technicianRole: 'Menguji performa Wi-Fi, kecepatan speedtest di berbagai sudut ruangan, dan portal login Hotspot.',
    technicianTips: [
      'Gunakan aplikasi seperti Wi-Fi Analyzer di smartphone untuk melihat kekuatan sinyal (RSSI) dan interferensi kanal tetangga.',
      'Nilai RSSI ideal di smartphone adalah antara -45 dBm s/d -65 dBm. Jika lebih buruk dari -75 dBm, video call akan patah-patah.',
      'Jika smartphone sering logout hotspot, periksa MAC address randomization (acak MAC) di setelan Wi-Fi perangkat.'
    ],
    defaultPorts: [
      { name: 'Wi-Fi Interface', medium: 'wireless' },
    ],
    color: '#06b6d4', // Cyan
  },
  iot: {
    type: 'iot',
    name: 'Perangkat IoT (Smart Device)',
    category: 'client_iot',
    shortDesc: 'Sensor Suhu, Smart Lamp, Saklar Cerdas',
    fullDescription: 'Perangkat internet of things ringan seperti mikrokontroler ESP32/ESP8266, smart bulb, atau sensor lingkungan yang memerlukan konektivitas internet hemat daya.',
    technicianRole: 'Memantau dan mengontrol perangkat pintar dari jarak jauh melalui protokol MQTT atau cloud IoT.',
    technicianTips: [
      'Hampir 99% perangkat IoT hanya mendukung frekuensi Wi-Fi 2.4GHz. Pastikan router menyalakan sinyal 2.4GHz terpisah (bukan hanya 5GHz).',
      'Pisahkan perangkat IoT ke VLAN atau subnet khusus (Isolate Network) demi alasan keamanan siber.',
      'Perangkat IoT memerlukan paket data yang sangat kecil namun membutuhkan koneksi yang tidak putus-putus.'
    ],
    defaultPorts: [
      { name: 'Wi-Fi 2.4G Client', medium: 'wireless' },
    ],
    color: '#14b8a6', // Teal
  },
  server: {
    type: 'server',
    name: 'Server Jaringan (DNS / Web / NVR)',
    category: 'infrastructure',
    shortDesc: 'Server Aplikasi, Penyimpanan, & Layanan Lokal',
    fullDescription: 'Komputer server bertenaga tinggi yang menyediakan layanan database, web portal, NVR CCTV, otentikasi RADIUS, atau DNS lokal.',
    technicianRole: 'Penyedia layanan terpusat untuk jaringan intranet maupun internet.',
    technicianTips: [
      'Wajib menggunakan IP Static dengan kartu jaringan redundan (Bonding / LACP) untuk ketersediaan tinggi (High Availability).',
      'Pastikan terhubung dengan UPS (Uninterruptible Power Supply) agar tidak rusak saat mati listrik mendadak.',
      'Buka hanya port firewall yang dibutuhkan (misal: port 80/443 untuk Web, 53 untuk DNS, 554 untuk RTSP CCTV).'
    ],
    defaultPorts: [
      { name: 'LAN 1 (Bonding)', medium: 'ethernet' },
      { name: 'LAN 2 (Management)', medium: 'ethernet' },
      { name: 'Fiber SFP+', medium: 'fiber' },
    ],
    color: '#334155', // Slate dark
  },
  access_point: {
    type: 'access_point',
    name: 'Access Point Enterprise (Ceiling/Wall AP)',
    category: 'routing',
    shortDesc: 'Wi-Fi 6 Enterprise AP (PoE, Multi-SSID, VLAN Tagging)',
    fullDescription: 'Access Point kelas bisnis untuk kantor, hotel, dan kafe dengan dukungan Wi-Fi 6 Dual Band simultan, roaming 802.11k/v/r, PoE gigabit, dan multi-SSID terikat VLAN.',
    technicianRole: 'Menyediakan jangkauan Wi-Fi berkecepatan tinggi ke ratusan klien tanpa interferensi, mendukung captive portal tamu dan pemisahan VLAN kantor.',
    technicianTips: [
      'Gunakan injektor PoE 802.3at (PoE+) atau sambungkan ke Switch PoE port Gigabit.',
      'Gunakan kanal 20MHz/40MHz pada 2.4GHz dan 80MHz pada 5GHz untuk throughput maksimal.',
      'Pasang di plafon terbuka di tengah ruangan (bukan di dalam lemari atau di balik dinding semen tebal).'
    ],
    defaultPorts: [
      { name: 'Gigabit PoE LAN', medium: 'ethernet' },
      { name: 'Wi-Fi 2.4G & 5G Radio', medium: 'wireless', maxConnections: 32 },
    ],
    color: '#0284c7', // Sky
  },
  firewall: {
    type: 'firewall',
    name: 'Hardware Firewall / UTM Gateway',
    category: 'infrastructure',
    shortDesc: 'Keamanan Jaringan Enterprise (IPS/IDS, VPN, Multi-WAN Failover)',
    fullDescription: 'Perangkat keamanan jaringan terdedikasi (Fortinet FortiGate, pfSense) yang memfilter paket data berbahaya (Deep Packet Inspection), mengelola VPN antar cabang, dan proteksi dari serangan DDoS.',
    technicianRole: 'Garis pertahanan pertama antara WAN Internet dan jaringan LAN internal kantor/data center.',
    technicianTips: [
      'Atur policy default: DROP all incoming traffic kecuali yang diizinkan eksplisit.',
      'Aktifkan dual-WAN failover agar koneksi internet otomatis pindah ke backup saat ISP utama down.',
      'Gunakan sertifikat SSL untuk deep inspection HTTPS traffic.'
    ],
    defaultPorts: [
      { name: 'WAN 1 (Internet)', medium: 'ethernet' },
      { name: 'WAN 2 (Backup)', medium: 'ethernet' },
      { name: 'LAN 1 (Internal)', medium: 'ethernet' },
      { name: 'LAN 2 (DMZ)', medium: 'ethernet' },
      { name: 'DMZ SFP+ (10G)', medium: 'fiber' },
    ],
    color: '#dc2626', // Red
  },
  nas: {
    type: 'nas',
    name: 'NAS Storage / NVR CCTV Server',
    category: 'infrastructure',
    shortDesc: 'Pusat Penyimpanan Jaringan & Rekaman CCTV (RAID/NFS/SMB)',
    fullDescription: 'Penyimpanan terpusat jaringan berkapasitas besar (Synology, QNAP) untuk backup data karyawan, file sharing lokal, dan rekaman continuous streaming kamera CCTV IP (NVR).',
    technicianRole: 'Tempat penyimpanan aman file perusahaan dan rekaman footage keamanan real-time 24/7.',
    technicianTips: [
      'Konfigurasikan Link Aggregation (LACP Bonding) di switch managed untuk menggandakan bandwidth transmisi (2x 1Gbps).',
      'Gunakan susunan RAID 5 atau RAID 6 agar data tidak hilang bila ada 1-2 harddisk yang rusak/bad sector.',
      'Gunakan IP Static dan pisahkan traffic penyimpanan ke VLAN khusus.'
    ],
    defaultPorts: [
      { name: 'LAN 1 (GE LACP)', medium: 'ethernet' },
      { name: 'LAN 2 (GE LACP)', medium: 'ethernet' },
    ],
    color: '#475569', // Slate
  },
  laptop: {
    type: 'laptop',
    name: 'Laptop Portable (Wi-Fi & LAN)',
    category: 'client_iot',
    shortDesc: 'Komputer Jinjing Klien dengan Dual Interface',
    fullDescription: 'Perangkat kerja bergerak yang fleksibel terhubung melalui kabel LAN Gigabit saat di meja kerja atau melalui Wi-Fi saat berpindah ruangan.',
    technicianRole: 'Alat uji mobilitas roaming Wi-Fi teknisi dan workstation pengguna dinamis.',
    technicianTips: [
      'Bila laptop dicolok kabel LAN, adaptor Wi-Fi otomatis prioritas nomor 2 untuk menghindari bridge loop.',
      'Cek driver kartu jaringan Wi-Fi untuk memastikan kompatibilitas WPA3 dan Wi-Fi 6 AX.'
    ],
    defaultPorts: [
      { name: 'LAN RJ-45', medium: 'ethernet' },
      { name: 'Wi-Fi 6 Adapter', medium: 'wireless' },
    ],
    color: '#475569', // Slate
  },
  printer: {
    type: 'printer',
    name: 'Network Printer (LAN / Wi-Fi)',
    category: 'client_iot',
    shortDesc: 'Printer Jaringan Kantor / Barcode Scanner',
    fullDescription: 'Printer multifungsi jaringan (Epson, HP, Canon) yang melayani cetak dokumen dari seluruh komputer dalam subnet LAN atau Wi-Fi tanpa perlu share komputer host.',
    technicianRole: 'Perangkat bersama di kantor yang melayani cetak dokumen via protokol TCP RAW port 9100 atau IPP port 631.',
    technicianTips: [
      'Wajib menggunakan IP Static atau DHCP Reservation berdasarkan MAC address agar IP tidak berubah-ubah saat lease habis.',
      'Pastikan printer berada di subnet yang sama dengan komputer atau routing antar-VLAN membuka port 9100.'
    ],
    defaultPorts: [
      { name: 'Ethernet RJ-45', medium: 'ethernet' },
      { name: 'Wi-Fi Interface', medium: 'wireless' },
    ],
    color: '#0f766e', // Teal dark
  },
  voip_phone: {
    type: 'voip_phone',
    name: 'IP Phone / VoIP SIP Terminal',
    category: 'client_iot',
    shortDesc: 'Telepon Suara Jaringan IP (PoE, Voice VLAN, SIP)',
    fullDescription: 'Pesawat telepon digital kantor (Yealink, Grandstream, Cisco) yang terhubung ke IP PBX server melalui protokol SIP untuk komunikasi suara berkualitas HD.',
    technicianRole: 'Komunikasi suara antar divisi dan sambungan telepon kantor via jaringan internet/intranet.',
    technicianTips: [
      'Aktifkan Voice VLAN (LLDP-MED) agar paket suara memiliki prioritas QoS (DSCP EF / CoS 5) dan bebas jitter.',
      'Port PC passthrough dapat dicolokkan ke komputer karyawan sehingga cukup 1 tarikan kabel LAN dari switch ke meja.'
    ],
    defaultPorts: [
      { name: 'LAN (PoE In)', medium: 'ethernet' },
      { name: 'PC Out (Passthrough)', medium: 'ethernet' },
    ],
    color: '#0369a1', // Sky dark
  },
};
