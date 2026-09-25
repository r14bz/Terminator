import React, { useState } from 'react';
import { NetworkDevice, NetworkLink, TestResult } from '../types/network';
import { DiagnosticsReport } from '../utils/diagnosticsEngine';
import {
  FileText,
  Printer,
  Copy,
  Download,
  X,
  Check,
  ShieldCheck,
  Activity,
  Layers,
  Cable,
} from 'lucide-react';

interface DocumentationModalProps {
  topologyName: string;
  devices: NetworkDevice[];
  links: NetworkLink[];
  testResults: TestResult[];
  diagnosticReport: DiagnosticsReport;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  topologyName,
  devices,
  links,
  testResults,
  diagnosticReport,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    let md = `# LAPORAN DOKUMENTASI TOPOLOGI JARINGAN & AUDIT KONEKSI\n`;
    md += `**Nama Proyek:** ${topologyName}\n`;
    md += `**Tanggal Pengujian:** ${dateStr}\n`;
    md += `**Skor Kesehatan Jaringan:** ${diagnosticReport.healthScore}%\n\n`;

    md += `## 1. RINGKASAN EKSEKUTIF\n`;
    md += `- Total Perangkat: ${devices.length} unit\n`;
    md += `- Total Tautan Kabel: ${links.length} jalur\n`;
    md += `- Masalah Terdeteksi: ${diagnosticReport.errorCount} Error, ${diagnosticReport.warningCount} Warning\n\n`;

    md += `## 2. TABEL PENGALAMATAN IP (IP ADDRESSING TABLE)\n`;
    md += `| Perangkat | Port | Alamat IP | Subnet Mask | Default Gateway | Metode |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    devices.forEach((d) => {
      d.ports.forEach((p) => {
        if (p.ipAddress) {
          md += `| ${d.name} | ${p.name} | ${p.ipAddress} | ${p.subnetMask || '-'} | ${p.defaultGateway || '-'} | ${p.ipAssignment} |\n`;
        }
      });
    });
    md += `\n`;

    md += `## 3. MATRIKS KONEKSI FISIK & KABEL\n`;
    md += `| Dari (Node A) | Port A | Menuju (Node B) | Port B | Tipe Kabel | Jarak |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    links.forEach((l) => {
      const devA = devices.find((d) => d.id === l.fromDeviceId)?.name || l.fromDeviceId;
      const devB = devices.find((d) => d.id === l.toDeviceId)?.name || l.toDeviceId;
      md += `| ${devA} | ${l.fromPortId} | ${devB} | ${l.toPortId} | ${l.cableType} | ${l.lengthMeters}m |\n`;
    });
    md += `\n`;

    md += `## 4. HASIL PENGUJIAN KONEKSI (PING & TRACEROUTE)\n`;
    if (testResults.length === 0) {
      md += `*Belum ada pengujian yang dijalankan.*\n\n`;
    } else {
      md += `| Waktu | Sumber | Target IP | Status | Loss % | RTT Avg |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      testResults.forEach((t) => {
        const src = devices.find((d) => d.id === t.sourceDeviceId)?.name || t.sourceDeviceId;
        md += `| ${t.timestamp} | ${src} | ${t.targetIp} | ${t.success ? 'BERHASIL' : 'GAGAL'} | ${t.packetLoss}% | ${t.rttAvg}ms |\n`;
      });
      md += `\n`;
    }

    md += `## 5. TEMUAN DIAGNOSTIK & REKOMENDASI PEMECAHAN MASALAH\n`;
    if (diagnosticReport.issues.length === 0) {
      md += `*Tidak ditemukan kendala jaringan. Seluruh konfigurasi optimal.*\n`;
    } else {
      diagnosticReport.issues.forEach((iss, i) => {
        md += `### ${i + 1}. [${iss.severity.toUpperCase()}] ${iss.title}\n`;
        md += `- **Penyebab:** ${iss.rootCause}\n`;
        md += `- **Solusi:**\n`;
        iss.stepsToFix.forEach((step) => {
          md += `  - ${step}\n`;
        });
        md += `\n`;
      });
    }

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const data = {
      name: topologyName,
      exportedAt: new Date().toISOString(),
      devices,
      links,
      testResults,
      healthScore: diagnosticReport.healthScore,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Terminator_Topology_${topologyName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Laporan Dokumentasi & Audit Topologi Jaringan
              </h3>
              <p className="text-xs text-slate-400">
                Dokumen komprehensif inventaris, tabel IP, hasil pengujian koneksi & troubleshooting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors"
              title="Cetak atau Simpan sebagai PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Markdown'}</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-report" className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-950 text-slate-200 custom-scrollbar">
          {/* Document Title Banner */}
          <div className="border-b border-slate-800 pb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-blue-400">
                Laporan Hasil Audit Rekayasa Jaringan
              </span>
              <h1 className="text-2xl font-black text-white mt-1">{topologyName}</h1>
              <p className="text-xs text-slate-400 mt-1">Digenerate pada: {dateStr}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center gap-4">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Skor Kesehatan:</div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {diagnosticReport.healthScore}%
                </div>
              </div>
              <div className="h-8 w-[1px] bg-slate-800" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Status Audit:</div>
                <div className="text-xs font-semibold text-slate-200">
                  {diagnosticReport.errorCount === 0 ? 'Tervalidasi Baik' : `${diagnosticReport.errorCount} Isu Kritis`}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>1. Ringkasan Eksekutif</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Total Perangkat</span>
                <span className="text-lg font-bold text-white mt-0.5 block">{devices.length} Unit</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Tautan Kabel Fisik</span>
                <span className="text-lg font-bold text-white mt-0.5 block">{links.length} Jalur</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Tes Koneksi Berjalan</span>
                <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{testResults.length} Sesi</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Kendala Terbuka</span>
                <span className="text-lg font-bold text-amber-400 mt-0.5 block">
                  {diagnosticReport.totalIssues} Kasus
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: IP Addressing Table */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>2. Tabel Pengalamatan IP (IP Addressing Scheme)</span>
            </h2>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">Perangkat</th>
                    <th className="py-2.5 px-3 font-semibold">Antarmuka</th>
                    <th className="py-2.5 px-3 font-semibold">Alamat IPv4</th>
                    <th className="py-2.5 px-3 font-semibold">Subnet Mask</th>
                    <th className="py-2.5 px-3 font-semibold">Default Gateway</th>
                    <th className="py-2.5 px-3 font-semibold">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {devices.flatMap((d) =>
                    d.ports
                      .filter((p) => p.ipAddress)
                      .map((p) => (
                        <tr key={`${d.id}_${p.id}`} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-sans font-medium text-white">{d.name}</td>
                          <td className="py-2 px-3 text-slate-400">{p.name}</td>
                          <td className="py-2 px-3 text-emerald-400 font-semibold">{p.ipAddress}</td>
                          <td className="py-2 px-3 text-slate-300">{p.subnetMask || '-'}</td>
                          <td className="py-2 px-3 text-slate-300">{p.defaultGateway || '-'}</td>
                          <td className="py-2 px-3 font-sans uppercase text-[10px] text-slate-400">
                            {p.ipAssignment}
                          </td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Cable Matrix */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Cable className="w-4 h-4 text-cyan-400" />
              <span>3. Matriks Sambungan Kabel & Topologi Fisik</span>
            </h2>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">Node Asal</th>
                    <th className="py-2.5 px-3 font-semibold">Port Asal</th>
                    <th className="py-2.5 px-3 font-semibold">Node Tujuan</th>
                    <th className="py-2.5 px-3 font-semibold">Port Tujuan</th>
                    <th className="py-2.5 px-3 font-semibold">Media Transmisi</th>
                    <th className="py-2.5 px-3 font-semibold">Panjang</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  {links.map((link) => {
                    const devA = devices.find((d) => d.id === link.fromDeviceId);
                    const devB = devices.find((d) => d.id === link.toDeviceId);
                    const portA = devA?.ports.find((p) => p.id === link.fromPortId);
                    const portB = devB?.ports.find((p) => p.id === link.toPortId);

                    return (
                      <tr key={link.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-medium text-white">{devA?.name || '-'}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{portA?.name || '-'}</td>
                        <td className="py-2 px-3 font-medium text-white">{devB?.name || '-'}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{portB?.name || '-'}</td>
                        <td className="py-2 px-3 text-slate-300">{link.cableType.replace('_', ' ')}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{link.lengthMeters} m</td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                            {link.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Connectivity Test Log */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>4. Log Hasil Pengujian Koneksi (Ping / Traceroute)</span>
            </h2>
            {testResults.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
                Belum ada rekaman uji ping pada sesi ini. Jalankan pengujian melalui tombol "Uji Ping" di bilah atas untuk mencatat data real-time.
              </p>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2.5 px-3 font-semibold">Waktu</th>
                      <th className="py-2.5 px-3 font-semibold">Pengirim</th>
                      <th className="py-2.5 px-3 font-semibold">Target IP</th>
                      <th className="py-2.5 px-3 font-semibold">Hasil</th>
                      <th className="py-2.5 px-3 font-semibold">Packet Loss</th>
                      <th className="py-2.5 px-3 font-semibold">Latensi Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {testResults.map((t) => {
                      const src = devices.find((d) => d.id === t.sourceDeviceId)?.name || t.sourceDeviceId;
                      return (
                        <tr key={t.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-slate-400">{t.timestamp}</td>
                          <td className="py-2 px-3 font-sans text-white">{src}</td>
                          <td className="py-2 px-3 text-blue-400">{t.targetIp}</td>
                          <td className="py-2 px-3 font-sans">
                            {t.success ? (
                              <span className="text-emerald-400 font-bold">SUKSES</span>
                            ) : (
                              <span className="text-red-400 font-bold">GAGAL / TIMEOUT</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-300">{t.packetLoss}%</td>
                          <td className="py-2 px-3 text-slate-300">{t.success ? `${t.rttAvg} ms` : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Diagnostic Findings & Troubleshooting Recommendations */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>5. Temuan Diagnostik & Panduan Pemecahan Masalah</span>
            </h2>

            {diagnosticReport.issues.length === 0 ? (
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-emerald-400 text-xs">
                Tidak ada anomali atau kesalahan konfigurasi jaringan yang terdeteksi. Seluruh rute, pengalamatan IP, dan redaman fisik dalam kondisi ideal.
              </div>
            ) : (
              <div className="space-y-3">
                {diagnosticReport.issues.map((iss, index) => (
                  <div key={iss.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs">
                        {index + 1}. [{iss.severity.toUpperCase()}] {iss.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
                        {iss.id}
                      </span>
                    </div>
                    <p className="text-slate-300">{iss.description}</p>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 text-[11px] text-slate-300">
                      <strong>Akar Masalah:</strong> {iss.rootCause}
                    </div>
                    <div className="pt-1">
                      <strong className="text-slate-300 text-[11px] block mb-1">Rekomendasi Langkah Penanganan:</strong>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400">
                        {iss.stepsToFix.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 text-[11px]">
            Laporan ini dibuat sesuai standar pengujian perangkat jaringan IEEE 802.3 & ITU-T G.984.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
          >
            Tutup Laporan
          </button>
        </div>
      </div>
    </div>
  );
};
