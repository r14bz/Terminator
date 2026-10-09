import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  FolderOpen,
  Camera,
  Undo2,
  Redo2,
  Download,
  Upload,
  Sparkles,
  Bot,
  Sun,
  Moon,
} from 'lucide-react';
import type { DiagnosticIssue, ActiveTool } from '../types/network';
import { checkAiStatus, type AiStatusInfo } from '../utils/aiService';

interface NavbarProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  issues: DiagnosticIssue[];
  onOpenTroubleshooting: () => void;
  onOpenGlossary: () => void;
  onOpenTemplates: () => void;
  onOpenAiChat: () => void;
  onSaveImage: () => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportJson: () => void;
  onImportJson: (data: any) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isRunning,
  onToggleRun,
  onReset,
  issues,
  onOpenTroubleshooting,
  onOpenGlossary,
  onOpenTemplates,
  onOpenAiChat,
  onSaveImage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportJson,
  onImportJson,
  theme,
  onToggleTheme,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusInfo | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    checkAiStatus().then(setAiStatus).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (installPrompt && typeof installPrompt.prompt === 'function') {
      await installPrompt.prompt();
      setInstallPrompt(null);
      return;
    }
    alert('Untuk memasang Terminator, buka menu browser lalu pilih “Tambahkan ke layar utama” atau “Install app”.');
  };

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
          <a href="/" aria-label="Terminator - Terminal Network Simulator" className="flex items-center transition-opacity hover:opacity-85">
            <img
              src="/brand/terminator-logo.png"
              alt="Terminator - Terminal Network Simulator"
              width={640}
              height={147}
              draggable={false}
              className="h-9 sm:h-10 w-auto select-none"
            />
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
        <nav className="flex min-w-0 items-center justify-end gap-1 sm:gap-2 shrink-0">
          <button
            onClick={onOpenTemplates}
            className="hidden sm:flex items-center gap-1 sm:gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs whitespace-nowrap"
            title="Muat contoh topologi FTTH, MikroTik, RT/RW Net, & CCTV"
          >
            <FolderOpen className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            <span className="hidden sm:inline">Topologi</span>
          </button>

          <button
            onClick={onOpenGlossary}
            className="hidden sm:flex items-center gap-1 sm:gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs whitespace-nowrap"
            title="Kamus edukasi istilah FTTH, OLT, ODP, dBm, VLAN, dan Jaringan"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Kamus</span>
          </button>

          {/* Diagnostic Issues Button */}
          <button
            onClick={onOpenTroubleshooting}
            className={`hidden sm:flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium transition-all shadow-2xs whitespace-nowrap ${
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

          {/* AI Network Assistant Button */}
          <button
            onClick={onOpenAiChat}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-lg border px-2 py-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold transition-all shadow-2xs whitespace-nowrap ${
              aiStatus?.provider === 'openrouter'
                ? 'border-purple-300 bg-linear-to-r from-purple-50 to-indigo-50 text-purple-900 hover:from-purple-100 hover:to-indigo-100 hover:border-purple-400'
                : 'border-sky-300 bg-linear-to-r from-sky-50 to-indigo-50 text-sky-800 hover:from-sky-100 hover:to-indigo-100 hover:border-sky-400'
            }`}
            title={`Buka Terminator AI (${aiStatus?.providerName || 'AI Asisten'} - ${aiStatus?.model || ''})`}
          >
            <Sparkles
              className={`h-3.5 w-3.5 shrink-0 ${
                aiStatus?.provider === 'openrouter' ? 'text-purple-600' : 'text-sky-600'
              }`}
            />
            <span className="hidden sm:inline">AI Asisten</span>
            <span className="sm:hidden">AI</span>
            {aiStatus && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold tracking-wide ${
                  aiStatus.provider === 'openrouter'
                    ? 'bg-purple-600 text-white'
                    : aiStatus.provider === 'opencode'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-sky-600 text-white'
                }`}
              >
                {aiStatus.provider === 'openrouter'
                  ? 'OpenRouter'
                  : aiStatus.provider === 'opencode'
                  ? 'OpenCode'
                  : 'Gemini'}
              </span>
            )}
          </button>

          {/* Theme toggle: tetap ringkas di mobile, lengkap di desktop. */}
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors dark-theme-control sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-2"
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
            <span className="hidden sm:inline lg:inline">{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
          </button>

          {/* PWA install button: always visible on mobile next to AI. */}
          <button
            onClick={handleInstallPwa}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-2"
            title="Install Terminator"
            aria-label="Install Terminator"
          >
            <Download className="h-4 w-4 text-sky-600" />
            <span className="hidden sm:inline">Install Terminator</span>
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

    </header>
  );
};
