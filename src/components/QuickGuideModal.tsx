import React from 'react';
import {
  HelpCircle,
  X,
  Zap,
  Cable,
  Activity,
  Wrench,
  FileText,
  Terminal,
  MousePointer,
} from 'lucide-react';

interface QuickGuideModalProps {
  onClose: () => void;
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Panduan Penggunaan TERMINATOR</h3>
              <p className="text-xs text-slate-400">
                Cara menggunakan simulator topologi jaringan, auto-koneksi, dan diagnostik
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar text-xs">
          {/* Step 1 */}
          <div className="flex gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-blue-950 text-blue-400 shrink-0 h-fit">
              <MousePointer className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">1. Memasang & Menggeser Perangkat</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Pilih perangkat dari sidebar kiri (PC, Switch, Router, MikroTik, OLT, ONT, CCTV, Access Point) lalu klik atau seret (drag-and-drop) ke kanvas. Klik dan tahan perangkat untuk menggeser posisinya.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-amber-950 text-amber-400 shrink-0 h-fit">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">2. Auto-Koneksi & Pemasangan Kabel</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Gunakan alat <strong>Auto-Koneksi (A)</strong>: klik perangkat pertama, lalu klik perangkat kedua. Sistem otomatis memilih jenis kabel yang sesuai (Kabel LAN UTP, Fiber Optik GPON, atau Wi-Fi) dan port bebas pertama. Anda juga bisa memilih jenis kabel secara manual di toolbar.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-purple-950 text-purple-400 shrink-0 h-fit">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">3. Konfigurasi IP, Routing & CLI</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                <strong>Klik dua kali (Double-click)</strong> pada perangkat manapun untuk membuka panel konfigurasi. Anda dapat mengatur IP Address, Subnet Mask, Default Gateway, DHCP Server, redaman fiber optik, streaming CCTV, hingga menjalankan perintah langsung di Terminal CLI Cisco, MikroTik, atau Windows CMD.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 shrink-0 h-fit">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">4. Uji Koneksi Ping & Animasi Paket</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Klik tombol <strong>"Uji Ping & Rute"</strong> di bilah atas atau gunakan alat Ping Cepat (P) pada toolbar. Saksikan paket ICMP beranimasi melintasi kabel secara visual hop-by-hop dengan laporan latensi dan packet loss real-time.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-rose-950 text-rose-400 shrink-0 h-fit">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">5. Diagnostik & Pemecahan Masalah Otomatis</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Panel <strong>Diagnostik</strong> mendeteksi secara proaktif kesalahan seperti IP Ganda (Konflik IP), Subnet Mismatch, Default Gateway hilang, port Administratively Down, dan Redaman Optik tinggi. Tersedia tombol <strong>"Perbaiki Otomatis"</strong> dengan satu klik!
              </p>
            </div>
          </div>

          {/* Step 6 */}
          <div className="flex gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 shrink-0 h-fit">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">6. Laporan Dokumentasi & Cetak PDF</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Klik <strong>"Laporan Dokumentasi"</strong> untuk menghasilkan dokumen profesional yang memuat Ringkasan Eksekutif, Tabel Pengalamatan IP lengkap, Matriks Koneksi Fisik, Log Uji Ping, dan Temuan Audit yang siap dicetak ke PDF atau disalin dalam format Markdown.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            Mengerti & Mulai Simulasi
          </button>
        </div>
      </div>
    </div>
  );
};
