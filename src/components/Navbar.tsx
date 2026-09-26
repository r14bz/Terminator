import React, { useRef } from 'react';
import {
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  FolderOpen,
  Camera,
  Activity,
  Undo2,
  Redo2,
  Download,
  Upload,
} from 'lucide-react';
import { DiagnosticIssue, ActiveTool } from '../types/network';

interface NavbarProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  issues: DiagnosticIssue[];
  onOpenTroubleshooting: () => void;
  onOpenGlossary: () => void;
  onOpenTemplates: () => void;
  onSaveImage: () => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportJson: () => void;
  onImportJson: (data: any) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isRunning,
  onToggleRun,
  onReset,
  issues,
  onOpenTroubleshooting,
  onOpenGlossary,
  onOpenTemplates,
  onSaveImage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportJson,
  onImportJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onImportJson(json);
      } catch {
        alert('File JSON tidak valid atau rusak.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md shadow-2xs">
      {/* Primary Row: Brand, Modals & (on Desktop) Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        {/* Zone 1: Wordmark & Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <a href="/" className="flex items-center gap-2 text-slate-900 transition-opacity hover:opacity-85">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white font-bold shadow-sm shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-none">
                TERMINATOR
              </span>
              <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium tracking-wide">
                Network Simulator
              </span>
            </div>
          </a>

          <div className="hidden xl:flex items-center text-xs text-slate-400 pl-2 border-l border-slate-200">
            <span>FTTH & GPON</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>VLAN 802.1Q</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>MikroTik & SOHO</span>
          </div>
        </div>

        {/* Zone 2: Navigation Modals (Topologi, Kamus, Diagnosa) */}
        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-1 sm:gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs whitespace-nowrap"
            title="Muat contoh topologi FTTH, MikroTik, RT/RW Net, & CCTV"
          >
            <FolderOpen className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            <span className="hidden sm:inline">Topologi</span>
          </button>

          <button
            onClick={onOpenGlossary}
            className="flex items-center gap-1 sm:gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs whitespace-nowrap"
            title="Kamus edukasi istilah FTTH, OLT, ODP, dBm, VLAN, dan Jaringan"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Kamus</span>
          </button>

          {/* Diagnostic Issues Button */}
          <button
            onClick={onOpenTroubleshooting}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all shadow-2xs whitespace-nowrap ${
              criticalCount > 0
                ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 animate-pulse'
                : warningCount > 0
                ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
            title="Buka panel diagnosa otomatis & pemecahan masalah teknisi"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Diagnosa</span>
            <span className="font-mono font-bold text-[11px]">
              {criticalCount > 0 ? `(${criticalCount})` : warningCount > 0 ? `(${warningCount})` : 'OK'}
            </span>
          </button>
        </nav>

        {/* Zone 3: Desktop Primary Action Cluster (Hidden on mobile, moved to responsive subrow) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              title="Urungkan (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              title="Ulangi (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Import / Export Topology JSON */}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Buka file topologi (.json) yang pernah disimpan"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span>Buka</span>
          </button>
          <button
            onClick={onExportJson}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Simpan topologi sebagai file (.json) untuk dibuka lagi nanti"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Simpan</span>
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Reset kanvas atau muat ulang perangkat"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Reset</span>
          </button>

          {/* SAVE TOPOLOGY AS IMAGE (PNG) BUTTON */}
          <button
            onClick={onSaveImage}
            className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 hover:border-sky-300 transition-colors shadow-2xs whitespace-nowrap"
            title="Simpan gambar topologi kanvas dalam format gambar PNG resolusi tinggi"
          >
            <Camera className="h-3.5 w-3.5 text-sky-600" />
            <span>Simpan Gambar</span>
          </button>

          {/* RUN / SIMULATION TOGGLE */}
          <button
            onClick={onToggleRun}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all whitespace-nowrap ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-300'
                : 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>JEDA SIMULASI</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>RUN SIMULASI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile-Exclusive Control Bar (Under 768px) */}
      <div className="flex md:hidden flex-col gap-1.5 pt-2 mt-2 border-t border-slate-100">
        {/* Row 1: Undo/Redo + Import/Export */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-700 active:bg-slate-100 disabled:opacity-30 disabled:active:bg-slate-50 transition-colors"
            title="Urungkan"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>Urungkan</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-700 active:bg-slate-100 disabled:opacity-30 disabled:active:bg-slate-50 transition-colors"
            title="Ulangi"
          >
            <Redo2 className="h-3.5 w-3.5" />
            <span>Ulangi</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-700 active:bg-slate-100 transition-colors"
            title="Buka file topologi (.json)"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onExportJson}
            className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-700 active:bg-slate-100 transition-colors"
            title="Simpan topologi (.json)"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Row 2: Reset, Simpan Gambar, RUN */}
        <div className="flex items-center gap-1.5">
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs font-medium text-slate-700 active:bg-slate-100 transition-colors"
          title="Reset kanvas topologi ke awal"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
          <span>Reset</span>
        </button>

        {/* Mobile Simpan Gambar Topologi */}
        <button
          onClick={onSaveImage}
          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-sky-300 bg-sky-50 py-1.5 px-2 text-xs font-bold text-sky-800 active:bg-sky-100 transition-colors shadow-2xs"
          title="Unduh gambar topologi format PNG"
        >
          <Camera className="h-3.5 w-3.5 text-sky-600" />
          <span>Simpan Foto</span>
        </button>

        {/* Mobile RUN / JEDA Button */}
        <button
          onClick={onToggleRun}
          className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-xs font-bold text-white shadow-xs transition-all ${
            isRunning
              ? 'bg-amber-600 active:bg-amber-700'
              : 'bg-emerald-600 active:bg-emerald-700'
          }`}
          title="Mulai atau jeda simulasi paket"
        >
          {isRunning ? (
            <>
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span>JEDA</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>RUN</span>
            </>
          )}
        </button>
        </div>
      </div>
    </header>
  );
};
