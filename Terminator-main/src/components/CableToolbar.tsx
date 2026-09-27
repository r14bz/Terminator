import React from 'react';
import { MousePointer, Move, Hand, Cable, Activity, Send, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
      {/* Primary Tool Modes */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {/* Tool 1: Pilih / Inspeksi */}
        <button
          onClick={() => {
            setActiveTool('select');
            onCancelConnection();
            onCancelPing();
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all shrink-0 ${
            activeTool === 'select'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Klik node untuk melihat detail, konfigurasi IP, dan status port"
        >
          <MousePointer className="h-3.5 w-3.5" />
          <span>Pilih / Detail</span>
        </button>

        {/* Tool 2: Geser Node (DEDICATED BUTTON SEPARATED AS REQUESTED) */}
        <button
          onClick={() => {
            setActiveTool('move');
            onCancelConnection();
            onCancelPing();
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all shrink-0 ${
            activeTool === 'move'
              ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-300'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Mode Khusus: Sentuh/tarik perangkat untuk memindahkan posisinya di kanvas"
        >
          <Move className="h-3.5 w-3.5" />
          <span>Geser Node</span>
        </button>

        {/* Tool 3: Geser Kanvas (Pan) */}
        <button
          onClick={() => {
            setActiveTool('pan');
            onCancelConnection();
            onCancelPing();
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all shrink-0 ${
            activeTool === 'pan'
              ? 'bg-slate-700 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Geser area tampilan kanvas"
        >
          <Hand className="h-3.5 w-3.5" />
          <span>Geser Kanvas</span>
        </button>

        {/* Tool 4: Hubungkan Kabel */}
        <button
          onClick={() => {
            setActiveTool('cable');
            onCancelPing();
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all shrink-0 ${
            activeTool === 'cable'
              ? 'bg-sky-600 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Tarik kabel antar port perangkat"
        >
          <Cable className="h-3.5 w-3.5" />
          <span>Hubungkan Kabel</span>
        </button>

        {/* Tool 5: OPM Probe */}
        <button
          onClick={() => {
            setActiveTool('opm');
            onCancelConnection();
            onCancelPing();
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all shrink-0 ${
            activeTool === 'opm'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Optical Power Meter: Klik perangkat/kabel untuk cek daya optik (dBm)"
        >
          <Activity className="h-3.5 w-3.5" />
          <span>OPM Probe (dBm)</span>
        </button>

        {/* Tool 6: Ping Packet Test */}
        <button
          onClick={() => {
            setActiveTool('ping');
            onCancelConnection();
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all shrink-0 ${
            activeTool === 'ping'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Uji kirim paket ICMP Ping dari perangkat asal ke tujuan"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Ping Test</span>
        </button>
      </div>

      {/* Cable Selector if Cable tool is active */}
      {activeTool === 'cable' && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
            Tipe Kabel:
          </span>
          {(Object.keys(CABLE_METADATA) as NodeCableType[]).map((cableKey) => {
            const meta = CABLE_METADATA[cableKey];
            const isSelected = selectedCableType === cableKey;
            return (
              <button
                key={cableKey}
                onClick={() => setSelectedCableType(cableKey)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all whitespace-nowrap border ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50 text-sky-900 font-semibold shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
                title={`${meta.name}: ${meta.shortDesc}`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: meta.colorHex }}
                />
                <span>{meta.name.split('(')[0]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Status banner if connecting or pinging */}
      {connectingSourceNodeName && (
        <div className="flex items-center gap-2 rounded-md bg-sky-50 px-2.5 py-1 border border-sky-200 text-sky-800 text-xs">
          <span>Menghubungkan dari: <strong>{connectingSourceNodeName}</strong>. Klik node target.</span>
          <button
            onClick={onCancelConnection}
            className="text-sky-900 hover:underline font-bold text-[11px]"
          >
            Batal
          </button>
        </div>
      )}

      {pingSourceNodeName && (
        <div className="flex items-center gap-2 rounded-md bg-purple-50 px-2.5 py-1 border border-purple-200 text-purple-800 text-xs">
          <span>Ping asal: <strong>{pingSourceNodeName}</strong>. Klik node target.</span>
          <button
            onClick={onCancelPing}
            className="text-purple-900 hover:underline font-bold text-[11px]"
          >
            Batal
          </button>
        </div>
      )}

      {/* Zoom controls & 2-finger indicator */}
      <div className="flex items-center gap-1.5 text-slate-600">
        <span className="hidden xl:inline text-[10px] text-slate-400">
          (Cubit 2 jari untuk zoom)
        </span>
        <button
          onClick={onZoomOut}
          className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Perkecil Tampilan Kanvas"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="font-mono text-[11px] font-semibold text-slate-700 min-w-10 text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Perbesar Tampilan Kanvas"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={onResetZoom}
          className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Kembalikan Tampilan Normal (100%)"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
