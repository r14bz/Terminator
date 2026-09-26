import React, { useRef } from 'react';
import {
  Network,
  Activity,
  Wrench,
  FileText,
  FolderOpen,
  Download,
  Trash2,
  Sparkles,
  HelpCircle,
  Play,
  RotateCcw,
  Zap,
  Flame,
  Terminal,
  Menu,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Sun,
  Moon,
} from 'lucide-react';
import { PRESET_SCENARIOS, PresetScenario } from '../constants/presetTopologies';
import { DiagnosticsReport } from '../utils/diagnosticsEngine';

interface HeaderProps {
  topologyName: string;
  onSelectScenario: (scenario: PresetScenario) => void;
  diagnosticReport: DiagnosticsReport;
  onRunNetworkTest: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenPingModal: () => void;
  onOpenTroubleshooting: () => void;
  onOpenDocumentation: () => void;
  onOpenTrafficGenerator: () => void;
  onOpenLiveMonitoring: () => void;
  onOpenExportImage: () => void;
  onRunDHCPAllocation: () => void;
  onClearCanvas: () => void;
  onExportJson: () => void;
  onImportJson: (data: any) => void;
  onOpenHelp: () => void;
  isTrafficActive?: boolean;
  logCount?: number;
  onToggleMobileSidebar?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  undoDescription?: string;
  redoDescription?: string;
}

export const Header: React.FC<HeaderProps> = ({
  topologyName,
  onSelectScenario,
  diagnosticReport,
  onRunNetworkTest,
  theme,
  onToggleTheme,
  onOpenPingModal,
  onOpenTroubleshooting,
  onOpenDocumentation,
  onOpenTrafficGenerator,
  onOpenLiveMonitoring,
  onOpenExportImage,
  onRunDHCPAllocation,
  onClearCanvas,
  onExportJson,
  onImportJson,
  onOpenHelp,
  isTrafficActive = false,
  logCount = 0,
  onToggleMobileSidebar,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  undoDescription,
  redoDescription,
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
      } catch (err) {
        alert('File JSON tidak valid atau rusak.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasIssues = diagnosticReport.totalIssues > 0;

  return (
    <header className="h-14 bg-[var(--surface-1)] border-b border-[var(--border-2)] px-3 sm:px-4 flex items-center justify-between gap-2 select-none text-[var(--text-secondary)] z-30 shrink-0">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
            title="Buka Menu Perangkat"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-[var(--text-primary)]">TERMINATOR</span>
              <span className="text-[10px] bg-blue-950 text-blue-300 font-mono px-1 rounded border border-blue-800/60 hidden sm:inline">
                v3.0
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] -mt-0.5 hidden sm:block truncate max-w-[170px] lg:max-w-none">
              Terminal Network Simulator &bull; Topologi, FTTH, IoT &amp; Diagnostik
            </p>
          </div>
        </div>

        {/* Undo / Redo Header Controls */}
        <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-[var(--border-2)]">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title={undoDescription ? `Urungkan: ${undoDescription} (Ctrl+Z)` : 'Urungkan (Ctrl+Z)'}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title={redoDescription ? `Ulangi: ${redoDescription} (Ctrl+Y)` : 'Ulangi (Ctrl+Y)'}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Scenarios Selector — visible on all screen sizes so mobile
            learners can also load example topologies, not just desktop */}
        <div className="flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-[var(--border-2)] min-w-0">
          <span className="text-xs text-[var(--text-muted)] font-medium hidden lg:inline shrink-0">Skenario:</span>
          <select
            onChange={(e) => {
              const sc = PRESET_SCENARIOS.find((s) => s.id === e.target.value);
              if (sc) onSelectScenario(sc);
            }}
            defaultValue=""
            title="Muat Skenario Topologi Contoh"
            className="bg-[var(--surface-2)] border border-[var(--border-2)] text-xs text-[var(--text-secondary)] rounded-lg px-2 sm:px-2.5 py-1 focus:outline-none focus:border-blue-500 hover:border-[var(--border-1)] font-medium transition-colors w-24 sm:w-auto sm:max-w-[10rem] lg:max-w-xs truncate"
          >
            <option value="" disabled>
              Pilih Skenario...
            </option>
            {PRESET_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="relative flex-1 min-w-0 flex justify-end">
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pr-1">
        {/* RUN — one-click test of the whole network at once (pings every
            user device to the gateway/internet), for beginners who don't
            want to manually pick two devices with the Ping tool. */}
        <button
          onClick={onRunNetworkTest}
          title="Jalankan uji koneksi ke semua perangkat sekaligus"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30 transition-all shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run</span>
        </button>

        {/* Test Ping Button */}
        <button
          onClick={onOpenPingModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all shrink-0"
          title="Uji ping manual: pilih 2 perangkat tertentu untuk diuji"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Uji Ping</span>
        </button>

        {/* Traffic Generator Button */}
        <button
          onClick={onOpenTrafficGenerator}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
            isTrafficActive
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/30 animate-pulse'
              : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-amber-300 border-[var(--border-1)]'
          }`}
          title="Simulasi Beban Jaringan & Traffic Saturation"
        >
          <Flame className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Traffic Gen</span>
        </button>

        {/* Live Monitoring & Logs Drawer Button */}
        <button
          onClick={onOpenLiveMonitoring}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] rounded-xl text-xs font-medium border border-[var(--border-1)] transition-all shrink-0"
          title="Buka Terminal Log & Status Real-Time"
        >
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">Log</span>
          {logCount > 0 && (
            <span className="text-[10px] bg-[var(--surface-1)] px-1.5 py-0.2 rounded-full font-mono text-[var(--text-muted)]">
              {logCount}
            </span>
          )}
        </button>

        {/* Diagnostics & Troubleshooting Center */}
        <button
          onClick={onOpenTroubleshooting}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
            hasIssues
              ? 'bg-amber-950/50 text-amber-300 border-amber-500/40 hover:bg-amber-950/70'
              : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border-1)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Diagnostik</span>
          {hasIssues ? (
            <span className="text-[10px] bg-red-600 text-white font-mono px-1.5 py-0.2 rounded-full font-bold animate-pulse">
              {diagnosticReport.errorCount > 0 ? `${diagnosticReport.errorCount} Error` : `${diagnosticReport.totalIssues}`}
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-950 text-emerald-300 font-mono px-1.5 py-0.2 rounded-full border border-emerald-800/40 font-bold">
              {diagnosticReport.healthScore}%
            </span>
          )}
        </button>

        {/* Export Image PNG / SVG Button */}
        <button
          onClick={onOpenExportImage}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all shrink-0"
          title="Ekspor visualisasi kanvas menjadi file gambar PNG atau vektor SVG"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ekspor Gambar</span>
        </button>

        {/* Documentation Report Modal */}
        <button
          onClick={onOpenDocumentation}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Laporan</span>
        </button>

        <div className="h-4 w-[1px] bg-[var(--surface-2)] mx-0.5 hidden sm:block" />

        {/* Import JSON */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Buka / Import file topologi (.json)"
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors shrink-0"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Export JSON */}
        <button
          onClick={onExportJson}
          title="Simpan / Export topologi (.json)"
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Clear Canvas */}
        <button
          onClick={onClearCanvas}
          title="Bersihkan kanvas (Mulai dari awal)"
          className="p-1.5 text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--surface-2)] rounded-lg transition-colors shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Help */}
        <button
          onClick={onOpenHelp}
          title="Bantuan & Petunjuk Penggunaan"
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors shrink-0"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Light / Dark theme toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Ganti ke tampilan terang' : 'Ganti ke tampilan gelap'}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors shrink-0"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Fade hint showing the action row is horizontally scrollable on
          narrow/mobile screens where not all buttons fit at once */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--surface-1)] to-transparent sm:hidden" />
      </div>
    </header>
  );
};
