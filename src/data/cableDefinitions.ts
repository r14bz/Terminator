import { NodeCableType } from '../types/network';

export interface CableMetadata {
  type: NodeCableType;
  name: string;
  category: 'fiber' | 'copper' | 'wireless';
  shortDesc: string;
  technicianRole: string;
  attenuationPerKm: number;    // In dB/km for fiber, or dB/100m for copper
  maxDistanceMeters: number;
  standardConnectors: string;
  colorHex: string;
  technicianTips: string[];
}

export const CABLE_METADATA: Record<NodeCableType, CableMetadata> = {
  feeder: {
    type: 'feeder',
    name: 'Kabel Optik Feeder',
    category: 'fiber',
    shortDesc: 'Kabel optik kapasitas besar (24 - 96 core) dari OLT ke ODC',
    technicianRole: 'Menjadi jalur pipa utama (backbone luar) yang membawa seluruh sinyal dari sentral/NOC menuju lemari ODC di area perumahan.',
    attenuationPerKm: 0.35, // ITU-T G.652 standard at 1310/1490nm
    maxDistanceMeters: 20000,
    standardConnectors: 'SC/UPC (Biru) atau SC/APC (Hijau) & Fusion Splice',
    colorHex: '#d97706', // Amber / Gold
    technicianTips: [
      'Gunakan jaket lapis baja (armored) anti-gigitan tikus untuk instalasi kabel tanah (duct/direct buried).',
      'Redaman rata-rata kabel fiber single mode standar adalah 0.35 dB per kilometer pada panjang gelombang 1310nm.',
      'Setiap titik sambungan las (fusion splice) maksimal memiliki redaman loss 0.05 dB.',
    ],
  },
  distribusi: {
    type: 'distribusi',
    name: 'Kabel Optik Distribusi',
    category: 'fiber',
    shortDesc: 'Kabel optik udara (12 - 24 core) dari ODC ke ODP tiang',
    technicianRole: 'Menyebarkan bundel fiber dari lemari ODC menuju titik-titik tiang ODP di sepanjang jalan perumahan.',
    attenuationPerKm: 0.35,
    maxDistanceMeters: 5000,
    standardConnectors: 'SC/UPC atau SC/APC',
    colorHex: '#0284c7', // Sky Blue
    technicianTips: [
      'Tarik kabel pada tiang dengan tegangan teratur, pasang suspension clamp dan dead-end clamp dengan benar.',
      'Sediakan gulungan cadangan (slack cable minimal 10-15 meter) di tiang untuk antisipasi perbaikan jika kabel putus tersangkut truk.',
    ],
  },
  drop_core: {
    type: 'drop_core',
    name: 'Kabel Drop Core (Drop Wire)',
    category: 'fiber',
    shortDesc: 'Kabel optik 1 atau 2 core dengan kawat penggantung (messenger wire)',
    technicianRole: 'Kabel yang ditarik dari kotak ODP di tiang langsung menuju roset optik di dalam rumah pelanggan.',
    attenuationPerKm: 0.40,
    maxDistanceMeters: 350,
    standardConnectors: 'Fast Connector SC/UPC atau SC/APC',
    colorHex: '#059669', // Emerald
    technicianTips: [
      'Panjang tarikan kabel drop core dari ODP ke rumah idealnya di bawah 150 meter (maksimal 250 meter) agar tidak melandai dan membahayakan lalu lintas.',
      'Kawat baja (messenger wire) harus dipotong dan dikupas sebelum memasang Fast Connector agar tidak mengalirkan petir atau merusak stripper.',
      'Pastikan pemotongan fiber menggunakan precision fiber cleaver yang tajam agar sudut potong 90 derajat sempurna.',
    ],
  },
  lan: {
    type: 'lan',
    name: 'Kabel LAN UTP (Cat5e / Cat6)',
    category: 'copper',
    shortDesc: 'Kabel tembaga twisted pair dengan konektor RJ45',
    technicianRole: 'Menghubungkan perangkat jaringan lokal seperti PC, Access Point, Switch, NVR, dan router rumahan.',
    attenuationPerKm: 2.2, // ~2.2 dB per 100m
    maxDistanceMeters: 100,
    standardConnectors: 'RJ45 (Urutan standar TIA/EIA-568B)',
    colorHex: '#4f46e5', // Indigo
    technicianTips: [
      'Panjang maksimal kabel UTP standar adalah 100 meter (90 meter solid horizontal + 10 meter patch cord). Lebih dari itu sinyal akan drop atau negosiasi kecepatan turun ke 10 Mbps.',
      'Gunakan urutan warna standar T568B: Putih Oranye, Oranye, Putih Hijau, Biru, Putih Biru, Hijau, Putih Cokelat, Cokelat.',
      'Gunakan kabel LAN outdoor berbahan tembaga murni (Barent Copper, bukan CCA) jika dipasang di luar ruangan.',
    ],
  },
  coaxial: {
    type: 'coaxial',
    name: 'Kabel Coaxial (RG6 / RG59)',
    category: 'copper',
    shortDesc: 'Kabel tembaga pelindung serat untuk CCTV Analog / TV Kabel',
    technicianRole: 'Membawa sinyal frekuensi radio atau video analog dari kamera analog atau DOCSIS modem.',
    attenuationPerKm: 5.0,
    maxDistanceMeters: 300,
    standardConnectors: 'BNC Connector / F-Connector',
    colorHex: '#475569', // Slate
    technicianTips: [
      'Pastikan serabut shielding ground terpasang kuat pada konektor BNC untuk mencegah interferensi dengung (noise lines).',
      'Hindari menekuk kabel koaksial melebihi radius tekuk minimum agar impedansi 75 ohm tidak berubah.',
    ],
  },
  wireless: {
    type: 'wireless',
    name: 'Koneksi Nirkabel / Wi-Fi',
    category: 'wireless',
    shortDesc: 'Gelombang radio 2.4GHz / 5GHz atau Point-to-Point (PtP)',
    technicianRole: 'Menyediakan koneksi tanpa kabel fisik untuk smartphone, laptop, perangkat IoT, atau link jembatan antar gedung.',
    attenuationPerKm: 0,
    maxDistanceMeters: 50, // Typical indoor AP range
    standardConnectors: 'Antena Omni / Sectoral / Grid',
    colorHex: '#06b6d4', // Cyan
    technicianTips: [
      'Frekuensi 2.4GHz jangkauan lebih luas dan tembus dinding lebih baik, namun kecepatan lebih rendah dan banyak interferensi.',
      'Frekuensi 5GHz memiliki kecepatan jauh lebih tinggi dan latensi rendah, namun rentan terhalang dinding beton tebal.',
      'Untuk koneksi jarak jauh (PtP wireless), pastikan garis pandang (Line of Sight / Fresnel Zone) bersih dari pohon atau bangunan.',
    ],
  },
};
