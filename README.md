# Terminator - Terminal Network Simulator

Aplikasi web interaktif simulator topologi jaringan modern (mirip Cisco Packet Tracer) yang dirancang khusus untuk memodelkan jaringan **FTTH (Fiber to the Home)**, **Carrier Metro Ethernet**, **MikroTik RouterOS**, **Switching**, dan **Perangkat Klien & IoT**.

**Demo online:** https://t3rm1n4t0r.vercel.app/

Dilengkapi dengan kalkulator redaman kabel optik riil (**Optical Power Budget & OPM Probe**), diagnostik otomatis & panduan pemecahan masalah untuk teknisi pemula, serta antarmuka tema terang (*light theme*) yang ramah perangkat seluler (*mobile-friendly*).

---

## 🚀 Fitur Utama

1. **Simulasi Lengkap Perangkat Jaringan (17 Perangkat)**:
   - **FTTH & Optik**: OLT (Optical Line Terminal GPON), ODC (Optical Distribution Cabinet), ODP (Optical Distribution Point), PLC Splitter Pasif (1:2 s/d 1:32), HTB Media Converter (WDM BiDi A & B), dan ONT/ONU (Modem Pelanggan).
   - **Routing & Switching**: Metro Ethernet Ring, MikroTik RouterOS (RB750/CCR), Switch Hub Gigabit (8/24-Port), Wi-Fi Wireless Router, dan Mesh Wi-Fi AP.
   - **Klien & IoT**: Komputer Desktop (PC), CCTV IP Camera (PoE), Smartphone Wi-Fi, Perangkat IoT Pintar (ESP32/Sensor), Server Terpusat, dan Uplink Internet Global.

2. **Koneksi Kabel Nyata & Validasi Fisik**:
   - Kabel Optik Feeder (24-96 core, ~0.35 dB/km)
   - Kabel Optik Distribusi (12-24 core, ~0.35 dB/km)
   - Kabel Optik Drop Core (1-2 core dengan messenger wire, ~0.40 dB/km)
   - Kabel LAN UTP (Cat5e / Cat6 RJ45, max 100m)
   - Kabel Coaxial (RG6 / BNC)
   - Sinyal Nirkabel / Wi-Fi (2.4GHz & 5GHz): satu radio ONT / Router / Mesh / Access Point melayani hingga **32 perangkat** sekaligus, sedangkan adapter Wi-Fi klien tetap satu koneksi.

   **DHCP otomatis**: PC, Laptop, Printer, IP Phone, CCTV, Smartphone, dan IoT otomatis menjadi DHCP client. Begitu kabel (LAN atau Wi-Fi) tersambung ke ONT / MikroTik / Router dengan DHCP Server aktif, IP, subnet, dan gateway langsung terisi tanpa perlu klik apa pun. Jika DHCP Server dimatikan atau ONT dalam Mode Bridge, klien kembali tanpa IP (APIPA). IP statis tetap bisa dipilih manual di Node Inspector.

3. **Mesin Simulasi Real-Time (Tombol RUN)**:
   - Animasi aliran paket data dan pulsa cahaya optik antar kabel.
   - Mode Jeda / Jalankan simulasi kapan saja.

4. **Pusat Diagnosa & Pemecahan Masalah (Troubleshooting Engine)**:
   - Deteksi otomatis alarm **LOS Merah (Loss of Signal)** pada ONT.
   - Peringatan redaman optik marjinal atau kritis (< -27 dBm).
   - Peringatan Overpower (> -8 dBm).
   - Deteksi tabrakan IP (**IP Conflict**).
   - Deteksi kabel LAN melebihi batas 100 meter.
   - Deteksi switching loop & bahaya *broadcast storm*.
   - Deteksi NAT Masquerade MikroTik yang belum aktif.
   - Deteksi ketidakcocokan pasangan HTB (Tipe A harus bertemu Tipe B).
   - Penjelasan **Gejala & Penyebab** serta **Langkah Perbaikan Teknisi** dalam bahasa Indonesia yang mudah dipahami.

5. **Optical Power Meter (OPM) Virtual Instrument**:
   - Ukur nilai daya terima cahaya optik (dBm) di sembarang titik dengan probe digital.
   - Pilihan panjang gelombang (1310nm, 1490nm, 1550nm).
   - Indikator LED PASS / WARNING / FAIL.

6. **Terminal CLI Interaktif**:
   - Command Prompt (CMD) untuk PC: `ping`, `ipconfig`, `tracert`, `help`.
   - RouterOS Console untuk MikroTik: `/interface print`, `/ip address print`, `/ip firewall nat print`, `/ping`.

7. **Kamus Edukasi FTTH & Jaringan**:
   - Glosarium istilah teknis lengkap dengan standar nilai dan tips kerja lapangan.

8. **Topologi Siap Pakai (Templates)**:
   - FTTH GPON Standar (Telco / ISP ke Rumah Pelanggan)
   - Kantor SOHO & MikroTik RB750Gr3
   - RT/RW-Net Media Converter (HTB)

---

## 🛠️ Panduan Menjalankan Secara Lokal (Local Development)

1. **Clone Repositori**:
   ```bash
   git clone https://github.com/r14bz/Terminator.git
   cd Terminator
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variable (.env)**:
   Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Buka file `.env` dan masukkan API Key Anda:
   ```env
   # Pilihan provider: "openrouter", "gemini", atau "opencode"
   AI_PROVIDER="openrouter"

   # Jika menggunakan OpenRouter:
   OPENROUTER_API_KEY="sk-or-v1-xxxxxxxx..."
   OPENROUTER_MODEL="deepseek/deepseek-chat"

   # Jika menggunakan Google Gemini:
   GEMINI_API_KEY="AIzaSyxxxx..."
   ```

4. **Jalankan Aplikasi**:
   ```bash
   npm run dev
   ```
   Buka browser di `http://localhost:3000`.

5. **Jalankan Pengujian (opsional)**:
   ```bash
   npm test
   ```

---

## 📦 Panduan Push ke GitHub

1. **Commit dan Push**:
   ```bash
   git add .
   git commit -m "feat: Wi-Fi 32 klien dan DHCP otomatis"
   git push origin main
   ```
   *(Catatan: File `.env` yang berisi private API key Anda secara otomatis diabaikan oleh `.gitignore` sehingga aman dari kebocoran ke publik).*

2. **Deploy di Vercel / Render / Cloud Run**:
   - Hubungkan repositori GitHub Anda ke **Vercel** atau platform hosting pilihan Anda.
   - Tambahkan Environment Variables di dashboard hosting (`AI_PROVIDER`, `OPENROUTER_API_KEY`, atau `GEMINI_API_KEY`).
   - Selesai! Web simulator aktif secara online.

## Aturan validator topologi

Spesifikasi aturan ada di `docs/aturan-validator-simulator.md` dan menjadi sumber kebenaran validator
(`src/rules/*`, `src/utils/topologyValidator.ts`). Jangan mengubah aturan di kode tanpa mengubah dokumen itu terlebih dahulu.

- `npm test` menjalankan seluruh suite, termasuk `test:topology-rules`, `test:mikrotik-rules`, `test:wireless-rules`, dan `test:rule-outcomes`.
- Nama setiap pengecekan di test memuat ID aturan dokumen (misalnya `4B.10`).
- `npm run test:coverage` membandingkan semua ID aturan di dokumen dengan ID di kode dan test.
  ID yang belum dievaluasi dicatat di `PENDING_RULES` (`src/utils/topologyValidator.ts`).
