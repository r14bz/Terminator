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
      label: 'Pointer / Pilih Perangkat',
      icon: MousePointer,
      shortcut: 'V',
      color: 'text-slate-200',
    },
    {
      id: 'auto_connect' as const,
      label: 'Auto-Koneksi Cerdas',
      icon: Zap,
      shortcut: 'A',
      color: 'text-amber-400',
      badge: 'Auto Port',
    },
    {
      id: 'ping_tool' as const,
      label: 'Alat Cepat Uji Ping',
      icon: Activity,
      shortcut: 'P',
      color: 'text-emerald-400',
      badge: 'Test ICMP',
    },
    {
      id: 'ethernet_straight' as const,
      label: 'Kabel LAN Straight-Through (RJ45)',
      icon: Cable,
      color: 'text-sky-400',
      tag: 'Straight',
    },
    {
      id: 'ethernet_crossover' as const,
      label: 'Kabel LAN Crossover (RJ45)',
      icon: Cable,
      color: 'text-orange-400',
      tag: 'Cross',
    },
    {
      id: 'fiber_single' as const,
      label: 'Fiber Optik Single Mode (GPON SC/APC)',
      icon: Cable,
      color: 'text-yellow-400',
      tag: 'Fiber PON',
    },
    {
      id: 'fiber_multi' as const,
      label: 'Fiber Optik SFP Multi Mode (LC/LC)',
      icon: Cable,
      color: 'text-teal-400',
      tag: 'Fiber SFP',
    },
    {
      id: 'wireless_link' as const,
      label: 'Koneksi Nirkabel (Wi-Fi / Mesh)',
      icon: Radio,
      color: 'text-purple-400',
      tag: 'Nirkabel',
    },
    {
      id: 'delete_tool' as const,
      label: 'Alat Hapus Perangkat/Kabel',
      icon: Trash2,
      shortcut: 'Del',
      color: 'text-red-400',
    },
  ];

  return (
    <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-xl text-xs select-none">
      {/* Undo / Redo controls in toolbar */}
      {(onUndo || onRedo) && (
        <>
          <div className="flex items-center gap-0.5 pr-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title={undoDescription ? `Urungkan: ${undoDescription} (Ctrl+Z)` : 'Urungkan (Ctrl+Z)'}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title={redoDescription ? `Ulangi: ${redoDescription} (Ctrl+Y)` : 'Ulangi (Ctrl+Y)'}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
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
              title={`${t.label} ${t.shortcut ? `(${t.shortcut})` : ''}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : t.color}`} />
              <span className="hidden md:inline">{t.label.split(' ')[0]}</span>
              {t.badge && (
                <span className={`text-[10px] px-1 py-0.2 rounded ${isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-slate-700 mx-1" />

      {/* Cable Connectors */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-semibold text-slate-400 hidden xl:inline mr-1">Kabel:</span>
        {tools.slice(3, 8).map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              title={t.label}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all ${
                isActive
                  ? 'bg-slate-800 text-white ring-2 ring-blue-500'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${t.color}`} />
              <span className="hidden lg:inline">{t.tag}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-slate-700 mx-1" />

      {/* Delete Tool */}
      <button
        onClick={() => setActiveTool('delete_tool')}
        title="Klik perangkat atau kabel untuk menghapus"
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
          activeTool === 'delete_tool'
            ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
            : 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
        }`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Hapus</span>
      </button>

      {/* Quick Export Image in Toolbar */}
      {onOpenExportImage && (
        <>
          <div className="h-4 w-[1px] bg-slate-700 mx-1" />
          <button
            onClick={onOpenExportImage}
            title="Ekspor Diagram ke Gambar PNG/SVG"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-indigo-300 hover:text-white hover:bg-indigo-950/40 transition-all"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">PNG/SVG</span>
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
