import { DeviceMetadata, NodeType } from '../types/network';

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
      { name: 'WLAN 2.4G', medium: 'wireless' },
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
      { name: 'Wi-Fi 2.4G/5G', medium: 'wireless' },
    ],
    color: '#0891b2', // Cyan
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
      { name: 'Wireless Mesh', medium: 'wireless' },
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
};
