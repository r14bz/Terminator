import React from 'react';
import {
  MousePointer,
  Cable,
  Zap,
  Activity,
  Trash2,
  Radio,
  Share2,
  Undo2,
  Redo2,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
import { CableType } from '../types/network';

export type ActiveTool =
  | 'pointer'
  | 'auto_connect'
  | 'ping_tool'
  | 'delete_tool'
  | CableType
  | `cable_${string}`;

interface ToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  isAutoConnecting: boolean;
  onCancelConnecting?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  undoDescription?: string;
  redoDescription?: string;
  onOpenExportImage?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  isAutoConnecting,
  onCancelConnecting,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  undoDescription,
  redoDescription,
  onOpenExportImage,
}) => {
  const tools = [
    {
      id: 'pointer' as const,
      label: 'Pilih',
      fullLabel: 'Pointer / Pilih Perangkat',
      desc: 'Klik untuk memilih perangkat, seret untuk memindahkannya di kanvas.',
      icon: MousePointer,
      shortcut: 'V',
      color: 'text-[var(--text-secondary)]',
    },
    {
      id: 'auto_connect' as const,
      label: 'Auto-Koneksi',
      fullLabel: 'Auto-Koneksi Cerdas (deteksi port otomatis)',
      desc: 'Klik 2 perangkat berurutan — sistem otomatis memilih jenis kabel & port yang cocok untuk kamu.',
      icon: Zap,
      shortcut: 'A',
      color: 'text-amber-400',
    },
    {
      id: 'ping_tool' as const,
      label: 'Ping',
      fullLabel: 'Alat Cepat Uji Ping (ICMP)',
      desc: 'Klik 2 perangkat untuk mengecek apakah keduanya bisa saling terhubung (kirim paket uji/ICMP).',
      icon: Activity,
      shortcut: 'P',
      color: 'text-emerald-400',
    },
    {
      id: 'ethernet_straight' as const,
      label: 'LAN Straight',
      fullLabel: 'Kabel LAN Straight-Through (RJ45)',
      desc: 'Kabel LAN biasa. Pakai ini untuk menghubungkan perangkat BERBEDA jenis, misal PC ke Switch, atau Switch ke Router.',
      icon: Cable,
      color: 'text-sky-400',
    },
    {
      id: 'ethernet_crossover' as const,
      label: 'LAN Cross',
      fullLabel: 'Kabel LAN Crossover (RJ45)',
      desc: 'Kabel LAN silang. Pakai ini untuk menghubungkan perangkat yang SAMA jenis, misal PC ke PC, atau Switch ke Switch.',
      icon: Cable,
      color: 'text-orange-400',
    },
    {
      id: 'fiber_single' as const,
      label: 'Fiber PON',
      fullLabel: 'Fiber Optik Single Mode (GPON SC/APC)',
      desc: 'Kabel fiber optik untuk jaringan FTTH — menyambungkan OLT ke ODP/Splitter, atau ODP ke ONT pelanggan.',
      icon: Cable,
      color: 'text-yellow-400',
    },
    {
      id: 'fiber_multi' as const,
      label: 'Fiber SFP',
      fullLabel: 'Fiber Optik SFP Multi Mode (LC/LC)',
      desc: 'Kabel fiber untuk uplink kecepatan tinggi antar perangkat inti, misal antar Switch Core atau Switch ke Router.',
      icon: Cable,
      color: 'text-teal-400',
    },
    {
      id: 'wireless_link' as const,
      label: 'Nirkabel',
      fullLabel: 'Koneksi Nirkabel (Wi-Fi / Mesh)',
      desc: 'Sambungan tanpa kabel fisik — untuk perangkat Wi-Fi, Access Point, atau Mesh Node.',
      icon: Radio,
      color: 'text-purple-400',
    },
    {
      id: 'delete_tool' as const,
      label: 'Hapus',
      fullLabel: 'Alat Hapus Perangkat/Kabel',
      desc: 'Klik perangkat atau kabel yang ingin dihapus dari topologi. Hati-hati, tidak ada konfirmasi ulang.',
      icon: Trash2,
      shortcut: 'Del',
      color: 'text-red-400',
    },
  ];

  const activeToolInfo = tools.find((t) => t.id === activeTool);

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-[var(--surface-1)]/95 backdrop-blur-md border border-[var(--border-1)] rounded-xl px-2.5 py-2 shadow-xl text-xs select-none">
      {/* Undo / Redo controls in toolbar */}
      {(onUndo || onRedo) && (
        <>
          <div className="flex items-center gap-0.5 pr-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title={undoDescription ? `Urungkan: ${undoDescription} (Ctrl+Z)` : 'Urungkan (Ctrl+Z)'}
              className="p-2 sm:p-1.5 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--border-1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:hover:bg-[var(--surface-2)]/80 disabled:cursor-not-allowed transition-all"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title={redoDescription ? `Ulangi: ${redoDescription} (Ctrl+Y)` : 'Ulangi (Ctrl+Y)'}
              className="p-2 sm:p-1.5 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--border-1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:hover:bg-[var(--surface-2)]/80 disabled:cursor-not-allowed transition-all"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-4 w-[1px] bg-[var(--surface-3)] mx-0.5" />
        </>
      )}

      {/* Primary pointer & auto tools */}
      <div className="flex items-center gap-1">
        {tools.slice(0, 3).map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              title={`${t.fullLabel} ${t.shortcut ? `(${t.shortcut})` : ''}`}
              className={`flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-lg font-semibold border transition-all ${
                isActive
                  ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                  : 'bg-[var(--surface-2)]/80 border-[var(--border-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:border-[var(--border-1)]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : t.color}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-[var(--surface-3)] mx-1" />

      {/* Cable Connectors */}
      <div className="flex items-center gap-1 flex-wrap">
        {tools.slice(3, 8).map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              title={t.fullLabel}
              className={`flex items-center gap-1 px-2 py-2 sm:py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                isActive
                  ? 'bg-[var(--surface-3)] border-blue-500 text-[var(--text-primary)] ring-1 ring-blue-500'
                  : 'bg-[var(--surface-2)]/80 border-[var(--border-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:border-[var(--border-1)]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${t.color}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-[var(--surface-3)] mx-1" />

      {/* Delete Tool */}
      <button
        onClick={() => setActiveTool('delete_tool')}
        title="Klik perangkat atau kabel untuk menghapus"
        className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
          activeTool === 'delete_tool'
            ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-500/20'
            : 'bg-red-950/40 border-red-900/60 text-red-300 hover:bg-red-950/70 hover:border-red-700'
        }`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Hapus</span>
      </button>

      {/* Quick Export Image in Toolbar */}
      {onOpenExportImage && (
        <>
          <div className="h-4 w-[1px] bg-[var(--surface-3)] mx-1" />
          <button
            onClick={onOpenExportImage}
            title="Ekspor Diagram ke Gambar PNG/SVG"
            className="flex items-center gap-1 px-2 py-2 sm:py-1.5 rounded-lg text-[11px] font-medium bg-indigo-950/50 border border-indigo-800/60 text-indigo-200 hover:bg-indigo-900/60 hover:text-[var(--text-primary)] transition-all"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>PNG/SVG</span>
          </button>
        </>
      )}

      {isAutoConnecting && (
        <div className="flex items-center gap-2 bg-blue-950/80 border border-blue-600 text-blue-200 px-2.5 py-1 rounded-md text-[11px] ml-2 animate-pulse">
          <span>Pilih perangkat kedua...</span>
          {onCancelConnecting && (
            <button
              onClick={onCancelConnecting}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] underline text-[10px]"
            >
              Batal
            </button>
          )}
        </div>
      )}

      {/* Beginner-friendly live explanation of whichever tool is currently
          selected — always visible, so a novice technician never has to
          guess what an icon does. Updates automatically on tool switch. */}
      {activeToolInfo && (
        <div className="basis-full flex items-start gap-1.5 pt-1.5 mt-0.5 border-t border-[var(--border-1)]/70 text-[11px] text-[var(--text-secondary)] leading-snug">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-[var(--text-primary)]">{activeToolInfo.label}:</strong> {activeToolInfo.desc}
          </span>
        </div>
      )}
    </div>
  );
};
