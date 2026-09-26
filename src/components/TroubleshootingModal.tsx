import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Wrench,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { DiagnosticIssue } from '../types/network';

interface TroubleshootingModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: DiagnosticIssue[];
  onFocusNode: (nodeId: string) => void;
}

export const TroubleshootingModal: React.FC<TroubleshootingModalProps> = ({
  isOpen,
  onClose,
  issues,
  onFocusNode,
}) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');

  if (!isOpen) return null;

  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  const warningIssues = issues.filter((i) => i.severity === 'warning');

  const filteredIssues = issues.filter((i) => {
    if (filter === 'critical') return i.severity === 'critical';
    if (filter === 'warning') return i.severity === 'warning';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-2xs">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Pusat Pemecahan Masalah & Diagnosa Teknisi
              </h2>
              <p className="text-xs text-slate-500">
                Deteksi otomatis kesalahan konfigurasi kabel optik, loop switch, dan IP network
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-2.5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({issues.length})
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                filter === 'critical'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Kritis ({criticalIssues.length})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                filter === 'warning'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              Peringatan ({warningIssues.length})
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden sm:block">
            {issues.length === 0 ? 'Kondisi Sempurna' : 'Perlu Perbaikan'}
          </div>
        </div>

        {/* Issue Cards List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-slate-50/50">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 shadow-xs">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Topologi Jaringan Berjalan Sempurna!
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
                Tidak ada kabel putus, redaman optik PON berada dalam batas aman ITU-T G.984, tidak ada loop switch, dan rute IP valid.
              </p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Tidak ada masalah dalam kategori ini.
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className={`rounded-xl border p-4 shadow-2xs bg-white transition-all ${
                  issue.severity === 'critical'
                    ? 'border-rose-200 hover:border-rose-300'
                    : 'border-amber-200 hover:border-amber-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                        issue.severity === 'critical'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {issue.severity === 'critical' ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {issue.title}
                      </h4>
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Kategori: {issue.category}
                      </span>
                    </div>
                  </div>

                  {issue.targetNodeId && (
                    <button
                      onClick={() => {
                        onFocusNode(issue.targetNodeId!);
                        onClose();
                      }}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-colors shrink-0 shadow-2xs"
                      title="Lihat dan pilih node ini di kanvas"
                    >
                      <span>Sorot Node</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Body explanation: Cause & Solution */}
                <div className="mt-3 space-y-2 text-xs">
                  {/* Gejala & Penyebab */}
                  <div className="rounded-lg bg-slate-50 p-2.5 text-slate-700 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                      Gejala & Penyebab Masalah:
                    </div>
                    <p className="text-[11.5px] leading-relaxed">{issue.cause}</p>
                  </div>

                  {/* Solusi Teknisi */}
                  <div
                    className={`rounded-lg p-2.5 border ${
                      issue.severity === 'critical'
                        ? 'bg-rose-50/70 border-rose-200/80 text-rose-950'
                        : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                      <span>Langkah Solusi untuk Teknisi:</span>
                    </div>
                    <p className="text-[11.5px] font-medium leading-relaxed">
                      {issue.solution}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <HelpCircle className="h-4 w-4 text-sky-600" />
            <span>Saran perbaikan di atas dibuat berdasarkan standar ITU-T G.984 & RFC Networking.</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};
