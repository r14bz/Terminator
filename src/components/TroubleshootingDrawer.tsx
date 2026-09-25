import React from 'react';
import { DiagnosticIssue, NetworkDevice, NetworkLink } from '../types/network';
import { DiagnosticsReport } from '../utils/diagnosticsEngine';
import {
  Wrench,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface TroubleshootingDrawerProps {
  report: DiagnosticsReport;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onApplyAutoFix: (action: string) => void;
}

export const TroubleshootingDrawer: React.FC<TroubleshootingDrawerProps> = ({
  report,
  isOpen,
  onClose,
  onRefresh,
  onApplyAutoFix,
}) => {
  if (!isOpen) return null;

  const { issues, healthScore, errorCount, warningCount, infoCount } = report;

  const getHealthBadge = (score: number) => {
    if (score >= 90) return { label: 'Optimal', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (score >= 60) return { label: 'Perlu Perhatian', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    return { label: 'Kritis / Ada Gangguan', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  };

  const healthBadge = getHealthBadge(healthScore);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-200 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Pusat Diagnostik & Pemecahan Masalah
            </h3>
            <p className="text-xs text-slate-400">
              Deteksi otomatis kesalahan konfigurasi & langkah perbaikan jaringan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            title="Scan ulang jaringan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Health Score Overview */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/40 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Skor Kesehatan Jaringan:</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black font-mono text-white">{healthScore}%</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${healthBadge.color}`}>
                {healthBadge.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="bg-red-950/40 border border-red-900/40 px-2.5 py-1.5 rounded-lg text-center">
              <div className="font-bold text-red-400">{errorCount}</div>
              <div className="text-[10px] text-slate-400">Error</div>
            </div>
            <div className="bg-amber-950/40 border border-amber-900/40 px-2.5 py-1.5 rounded-lg text-center">
              <div className="font-bold text-amber-400">{warningCount}</div>
              <div className="text-[10px] text-slate-400">Warning</div>
            </div>
            <div className="bg-blue-950/40 border border-blue-900/40 px-2.5 py-1.5 rounded-lg text-center">
              <div className="font-bold text-blue-400">{infoCount}</div>
              <div className="text-[10px] text-slate-400">Info</div>
            </div>
          </div>
        </div>

        {/* Health Progress Bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              healthScore >= 90
                ? 'bg-emerald-500'
                : healthScore >= 60
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {issues.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 bg-emerald-950/50 border border-emerald-600/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-white">Topologi Sempurna!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tidak ditemukan kendala konektivitas, konflik IP, ataupun port down. Jaringan siap beroperasi dan mengirim paket dengan lancar.
            </p>
          </div>
        ) : (
          issues.map((issue) => {
            const isError = issue.severity === 'error';
            const isWarning = issue.severity === 'warning';

            return (
              <div
                key={issue.id}
                className={`p-4 rounded-xl border transition-all ${
                  isError
                    ? 'bg-red-950/20 border-red-900/50'
                    : isWarning
                    ? 'bg-amber-950/20 border-amber-900/50'
                    : 'bg-blue-950/20 border-blue-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {isError ? (
                      <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">
                        {issue.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        {issue.description}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] uppercase px-2 py-0.5 rounded font-bold shrink-0 ${
                      isError
                        ? 'bg-red-900/60 text-red-300'
                        : isWarning
                        ? 'bg-amber-900/60 text-amber-300'
                        : 'bg-blue-900/60 text-blue-300'
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>

                {/* Root Cause */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Akar Penyebab (Root Cause):
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 italic">
                    "{issue.rootCause}"
                  </p>
                </div>

                {/* Steps to Fix */}
                <div className="mt-2.5 text-xs">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                    Langkah Solusi Pemecahan Masalah:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                    {issue.stepsToFix.map((step, idx) => (
                      <li key={idx} className="leading-snug">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 1-Click Auto Fix Button */}
                {issue.autoFixAvailable && issue.autoFixAction && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex justify-end">
                    <button
                      onClick={() => onApplyAutoFix(issue.autoFixAction!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      <span>Perbaiki Otomatis</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">
          Sistem heuristik diagnostik menganalisis OSI Layer 1, 2, dan 3.
        </span>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors"
        >
          Tutup Panel
        </button>
      </div>
    </div>
  );
};
