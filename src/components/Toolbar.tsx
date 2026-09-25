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
      icon: MousePointer,
      shortcut: 'V',
      color: 'text-slate-200',
    },
    {
      id: 'auto_connect' as const,
      label: 'Auto-Koneksi',
      fullLabel: 'Auto-Koneksi Cerdas (deteksi port otomatis)',
      icon: Zap,
      shortcut: 'A',
      color: 'text-amber-400',
    },
    {
      id: 'ping_tool' as const,
      label: 'Ping',
      fullLabel: 'Alat Cepat Uji Ping (ICMP)',
      icon: Activity,
      shortcut: 'P',
      color: 'text-emerald-400',
    },
    {
      id: 'ethernet_straight' as const,
      label: 'LAN Straight',
      fullLabel: 'Kabel LAN Straight-Through (RJ45)',
      icon: Cable,
      color: 'text-sky-400',
    },
    {
      id: 'ethernet_crossover' as const,
      label: 'LAN Cross',
      fullLabel: 'Kabel LAN Crossover (RJ45)',
      icon: Cable,
      color: 'text-orange-400',
    },
    {
      id: 'fiber_single' as const,
      label: 'Fiber PON',
      fullLabel: 'Fiber Optik Single Mode (GPON SC/APC)',
      icon: Cable,
      color: 'text-yellow-400',
    },
    {
      id: 'fiber_multi' as const,
      label: 'Fiber SFP',
      fullLabel: 'Fiber Optik SFP Multi Mode (LC/LC)',
      icon: Cable,
      color: 'text-teal-400',
    },
    {
      id: 'wireless_link' as const,
      label: 'Nirkabel',
      fullLabel: 'Koneksi Nirkabel (Wi-Fi / Mesh)',
      icon: Radio,
      color: 'text-purple-400',
    },
    {
      id: 'delete_tool' as const,
      label: 'Hapus',
      fullLabel: 'Alat Hapus Perangkat/Kabel',
      icon: Trash2,
      shortcut: 'Del',
      color: 'text-red-400',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl px-2.5 py-2 shadow-xl text-xs select-none">
      {/* Undo / Redo controls in toolbar */}
      {(onUndo || onRedo) && (
        <>
          <div className="flex items-center gap-0.5 pr-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title={undoDescription ? `Urungkan: ${undoDescription} (Ctrl+Z)` : 'Urungkan (Ctrl+Z)'}
              className="p-2 sm:p-1.5 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800/70 disabled:cursor-not-allowed transition-all"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title={redoDescription ? `Ulangi: ${redoDescription} (Ctrl+Y)` : 'Ulangi (Ctrl+Y)'}
              className="p-2 sm:p-1.5 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800/70 disabled:cursor-not-allowed transition-all"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />
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
                  : 'bg-slate-800/70 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : t.color}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-slate-700 mx-1" />

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
                  ? 'bg-slate-700 border-blue-500 text-white ring-1 ring-blue-500'
                  : 'bg-slate-800/70 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${t.color}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-slate-700 mx-1" />

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
          <div className="h-4 w-[1px] bg-slate-700 mx-1" />
          <button
            onClick={onOpenExportImage}
            title="Ekspor Diagram ke Gambar PNG/SVG"
            className="flex items-center gap-1 px-2 py-2 sm:py-1.5 rounded-lg text-[11px] font-medium bg-indigo-950/50 border border-indigo-800/60 text-indigo-200 hover:bg-indigo-900/60 hover:text-white transition-all"
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
              className="text-slate-400 hover:text-white underline text-[10px]"
            >
              Batal
            </button>
          )}
        </div>
      )}
    </div>
  );
};
