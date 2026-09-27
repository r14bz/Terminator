# Terminator - Terminal Network Simulator

Aplikasi web interaktif simulator topologi jaringan modern (mirip Cisco Packet Tracer) yang dirancang khusus untuk memodelkan jaringan **FTTH (Fiber to the Home)**, **Carrier Metro Ethernet**, **MikroTik RouterOS**, **Switching**, dan **Perangkat Klien & IoT**.

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
   - Sinyal Nirkabel / Wi-Fi (2.4GHz & 5GHz)

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

## 📦 Panduan Deploy ke Vercel via GitHub

Aplikasi ini dibangun menggunakan **Vite + React 19 + TypeScript + Tailwind CSS** tanpa dependensi server runtime khusus, sehingga dapat di-deploy secara instan di **Vercel**:

1. **Upload ke GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Terminator Network Simulator"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO_NAME.git
   git push -u origin main
   ```

2. **Deploy di Vercel**:
   - Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
   - Klik **"Add New..."** lalu pilih **"Project"**.
   - Pilih repositori GitHub `REPO_NAME` yang baru saja Anda push.
   - Vercel akan otomatis mendeteksi framework:
     - **Framework Preset**: `Vite`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`
   - Klik **"Deploy"**.
   - Dalam ~30 detik, web simulator Terminator sudah aktif online dan dapat diakses dari mana saja!
