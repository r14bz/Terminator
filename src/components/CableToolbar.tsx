import React from 'react';
import { MousePointer, Move, Hand, Cable, Activity, Send, ZoomIn, ZoomOut, ChevronDown } from 'lucide-react';
import type { NodeCableType, ActiveTool } from '../types/network';
import { CABLE_METADATA } from '../data/cableDefinitions';

interface CableToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  selectedCableType: NodeCableType;
  setSelectedCableType: (type: NodeCableType) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  connectingSourceNodeName?: string;
  onCancelConnection: () => void;
  pingSourceNodeName?: string;
  onCancelPing: () => void;
}

const TOOL_META: Record<ActiveTool, { label: string; description: string }> = {
  select: { label: 'Pilih / Detail', description: 'Pilih perangkat atau kabel untuk melihat detail dan konfigurasi.' },
  move: { label: 'Geser Node', description: 'Sentuh lalu tarik perangkat untuk memindahkannya di kanvas.' },
  pan: { label: 'Geser Canvas', description: 'Geser area kosong untuk memindahkan tampilan kanvas.' },
  cable: { label: 'Hubungkan Kabel', description: 'Pilih tipe kabel lalu klik node sumber dan node tujuan.' },
  opm: { label: 'OPM / dBm', description: 'Klik perangkat optik untuk mengukur daya sinyal dalam dBm.' },
  ping: { label: 'Ping Test', description: 'Klik perangkat asal lalu perangkat tujuan untuk menguji koneksi.' },
};

export const CableToolbar: React.FC<CableToolbarProps> = ({
  activeTool,
  setActiveTool,
  selectedCableType,
  setSelectedCableType,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  connectingSourceNodeName,
  onCancelConnection,
  pingSourceNodeName,
  onCancelPing,
}) => {
  const selectTool = (tool: ActiveTool) => {
    setActiveTool(tool);
    if (tool !== 'cable') onCancelConnection();
    if (tool !== 'ping') onCancelPing();
  };

  return (
    <div className="relative">
      <div className="relative z-35 flex items-center justify-between gap-1 border-b border-slate-200 bg-white px-2 py-2 shadow-2xs">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <button onClick={() => selectTool('select')} className={`shrink-0 rounded-xl p-2.5 transition-colors ${activeTool === 'select' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`} title="Pilih / Detail">
            <MousePointer className="h-5 w-5" />
          </button>
          <button onClick={() => selectTool('move')} className={`shrink-0 rounded-xl p-2.5 transition-colors ${activeTool === 'move' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`} title="Geser Node">
            <Move className="h-5 w-5" />
          </button>
          <button onClick={() => selectTool('pan')} className={`shrink-0 rounded-xl p-2.5 transition-colors ${activeTool === 'pan' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`} title="Geser Canvas">
            <Hand className="h-5 w-5" />
          </button>
          <button onClick={() => selectTool('cable')} className={`shrink-0 rounded-xl p-2.5 transition-colors ${activeTool === 'cable' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`} title="Hubungkan Kabel">
            <Cable className="h-5 w-5" />
          </button>
          <button onClick={() => selectTool('opm')} className={`shrink-0 rounded-xl p-2.5 transition-colors ${activeTool === 'opm' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`} title="OPM / cek daya optik (dBm)">
            <Activity className="h-5 w-5" />
          </button>
          <button onClick={() => selectTool('ping')} className={`shrink-0 rounded-xl p-2.5 transition-colors ${activeTool === 'ping' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`} title="Ping Test">
            <Send className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1">
          <button onClick={onZoomOut} className="rounded-lg p-1.5 text-slate-600 hover:bg-white" title="Perkecil tampilan kanvas">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-9 text-center font-mono text-[11px] font-semibold text-slate-700">{Math.round(zoomLevel * 100)}%</span>
          <button onClick={onZoomIn} className="rounded-lg p-1.5 text-slate-600 hover:bg-white" title="Perbesar tampilan kanvas">
            <ZoomIn className="h-4 w-4" />
          </button>
          {/* Fullscreen/fit icon intentionally removed so Ping remains visible. */}
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-full z-30 -translate-x-1/2">
        <div className="pointer-events-auto mt-3 flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-lg">
          {activeTool === 'select' && <MousePointer className="h-3.5 w-3.5" />}
          {activeTool === 'move' && <Move className="h-3.5 w-3.5" />}
          {activeTool === 'pan' && <Hand className="h-3.5 w-3.5" />}
          {activeTool === 'cable' && <Cable className="h-3.5 w-3.5" />}
          {activeTool === 'opm' && <Activity className="h-3.5 w-3.5" />}
          {activeTool === 'ping' && <Send className="h-3.5 w-3.5" />}
          <span className="truncate">{TOOL_META[activeTool].label}</span>
        </div>
      </div>

      {(connectingSourceNodeName || pingSourceNodeName) && (
        <div className="relative z-40 flex justify-center border-b border-slate-200 bg-white px-3 py-1.5 text-xs">
          {connectingSourceNodeName && (
            <div className="flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-sky-800">
              Menghubungkan dari <strong>{connectingSourceNodeName}</strong>
              <button onClick={onCancelConnection} className="font-bold underline">Batal</button>
            </div>
          )}
          {pingSourceNodeName && (
            <div className="flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-purple-800">
              Ping asal <strong>{pingSourceNodeName}</strong>
              <button onClick={onCancelPing} className="font-bold underline">Batal</button>
            </div>
          )}
        </div>
      )}

      {/* Mobile cable drawer: vertical bottom sheet, never a horizontal toolbar. */}
      {activeTool === 'cable' && (
        <div className="fixed inset-x-3 bottom-[92px] z-[55] max-h-[calc(100dvh-220px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/98 p-3 shadow-2xl backdrop-blur-md md:bottom-5 md:left-1/2 md:right-auto md:w-[520px] md:-translate-x-1/2">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Pilih jenis kabel</h3>
              <p className="text-[10px] text-slate-500">Pilih satu sebelum memilih node sumber.</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CABLE_METADATA) as NodeCableType[]).map((cableKey) => {
              const meta = CABLE_METADATA[cableKey];
              const isSelected = selectedCableType === cableKey;
              return (
                <button
                  key={cableKey}
                  onClick={() => setSelectedCableType(cableKey)}
                  className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${
                    isSelected ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-300' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                  }`}
                  title={`${meta.name}: ${meta.shortDesc}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.colorHex }} />
                  <span>{meta.name.split('(')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop keeps cable choices close to the toolbar but still below it. */}
      {activeTool !== 'cable' && (
        <div className="hidden md:block" aria-hidden="true">{TOOL_META[activeTool].description}</div>
      )}
    </div>
  );
};
