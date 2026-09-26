export interface GlossaryItem {
  term: string;
  category: 'FTTH & Optik' | 'Networking & IP' | 'Alat Kerja Teknisi';
  definition: string;
  standardValue?: string;
  fieldTips: string;
}

export const NETWORK_GLOSSARY: GlossaryItem[] = [
  {
    term: 'OLT (Optical Line Terminal)',
    category: 'FTTH & Optik',
    definition: 'Perangkat aktif di sentral (Central Office/NOC) penyedia layanan yang menjadi titik awal jaringan optik pasif (PON). Menyalurkan data ke ribuan ONT.',
    standardValue: 'Output SFP GPON Class B+: +1.5 ~ +5.0 dBm',
    fieldTips: 'Jangan melihat langsung ke port optik OLT karena sinar laser inframerah tidak terlihat dan merusak mata secara permanen.',
  },
  {
    term: 'ODC (Optical Distribution Cabinet)',
    category: 'FTTH & Optik',
    definition: 'Kabinet luar ruang (outdoor) tempat terminasi kabel feeder dari OLT dan pencabangan ke kabel distribusi menggunakan splitter tahap 1 (biasanya 1:4).',
    standardValue: 'Loss Splitter 1:4: ~7.2 dB',
    fieldTips: 'Pastikan kaset tray sambungan fusion tertutup rapi dan silica gel terpasang agar tidak berjamur.',
  },
  {
    term: 'ODP (Optical Distribution Point)',
    category: 'FTTH & Optik',
    definition: 'Kotak distribusi di atas tiang atau dinding luar yang membagi kabel distribusi ke kabel drop core pelanggan menggunakan splitter tahap 2 (1:8 atau 1:16).',
    standardValue: 'Daya optik di port ODP: -15 s/d -22 dBm',
    fieldTips: 'Lakukan pengukuran daya dengan OPM di port ODP sebelum menarik kabel ke rumah pelanggan.',
  },
  {
    term: 'ONT / ONU (Optical Network Terminal)',
    category: 'FTTH & Optik',
    definition: 'Modem optik di rumah pelanggan yang mengubah cahaya dari kabel drop core menjadi sinyal internet LAN dan Wi-Fi.',
    standardValue: 'Rentang aman Rx Power: -18 s/d -24 dBm (Batas LOS: < -27 dBm)',
    fieldTips: 'Lampu indikator LOS berkedip merah menandakan kabel putus atau redaman lebih buruk dari -27 dBm.',
  },
  {
    term: 'PLC Splitter Pasif',
    category: 'FTTH & Optik',
    definition: 'Komponen optik tanpa listrik yang membagi 1 core input menjadi beberapa port output secara seimbang.',
    standardValue: '1:2 = 3.5dB | 1:4 = 7.2dB | 1:8 = 10.5dB | 1:16 = 13.8dB | 1:32 = 17.2dB',
    fieldTips: 'Perhatikan radius tekukan pigtail splitter; tekukan sudut lancip akan menyebabkan redaman tinggi (macro-bending).',
  },
  {
    term: 'OPM (Optical Power Meter)',
    category: 'Alat Kerja Teknisi',
    definition: 'Alat ukur utama teknisi fiber optik untuk mengukur besaran daya cahaya yang diterima (dalam satuan dBm atau mW) pada panjang gelombang 1310/1490/1550nm.',
    standardValue: 'Rentang ukur umum: -70 dBm s/d +10 dBm',
    fieldTips: 'Selalu kalibrasi panjang gelombang OPM (λ) ke 1490nm saat mengukur sinyal downstream GPON dari OLT.',
  },
  {
    term: 'VFL (Visual Fault Locator / Laser Merah)',
    category: 'Alat Kerja Teknisi',
    definition: 'Senter laser sinar merah tampak (panjang gelombang 650nm) untuk mencari titik kabel yang putus, retak, atau terjepit di dalam closure atau pipa.',
    standardValue: 'Daya laser: 10mW ~ 30mW (Jangkauan 10 ~ 25km)',
    fieldTips: 'Cahaya merah akan berpendar terang di titik isolasi kabel yang patah atau bengkok.',
  },
  {
    term: 'Fusion Splicer',
    category: 'Alat Kerja Teknisi',
    definition: 'Mesin penyambung kabel kaca fiber optik dengan cara melelehkan kedua ujung inti kaca menggunakan busur api listrik tegangan tinggi secara mikron presisi.',
    standardValue: 'Standar loss sambungan: ≤ 0.03 dB',
    fieldTips: 'Bersihkan lensa V-Groove secara berkala dan pastikan pemotongan sudut fiber di bawah 1 derajat.',
  },
  {
    term: 'NAT (Network Address Translation) Masquerade',
    category: 'Networking & IP',
    definition: 'Teknik di router (seperti MikroTik) untuk menerjemahkan banyak alamat IP Private lokal (192.168.x.x) menjadi satu alamat IP Public agar bisa mengakses internet.',
    fieldTips: 'Jika klien lokal terhubung ke router tapi tidak bisa buka Google, periksa rule NAT di IP > Firewall > NAT (action=masquerade).',
  },
  {
    term: 'DHCP (Dynamic Host Configuration Protocol)',
    category: 'Networking & IP',
    definition: 'Protokol otomatis yang membagikan alamat IP, Subnet Mask, Gateway, dan DNS ke perangkat klien tanpa perlu setting manual.',
    fieldTips: 'Pastikan hanya ada SATU DHCP Server aktif dalam satu broadcast domain untuk menghindari konflik pemberian IP liar (Rogue DHCP).',
  },
  {
    term: 'VLAN (Virtual Local Area Network)',
    category: 'Networking & IP',
    definition: 'Metode untuk memecah satu switch fisik menjadi beberapa jaringan logika terisolasi untuk keamanan dan efisiensi broadcast.',
    fieldTips: 'Gunakan mode Trunk untuk kabel penghubung antar switch/router dan mode Access untuk port yang menuju PC/perangkat klien.',
  },
  {
    term: 'HTB Converter (Media Converter)',
    category: 'FTTH & Optik',
    definition: 'Perangkat pengubah sinyal Ethernet kabel LAN RJ45 tembaga menjadi sinyal optik fiber (WDM BiDi) satu core.',
    standardValue: 'HTB A: TX 1310nm / RX 1550nm; HTB B: TX 1550nm / RX 1310nm',
    fieldTips: 'HTB tidak bisa berjalan jika kedua sisi memakai tipe yang sama (misal A dengan A). Harus pasangan A dan B!',
  },
];
