import React from 'react';
import { X, Trash2, Scissors, ArrowRight, Cable as CableIcon } from 'lucide-react';
import type { CableConnection, NetworkNode } from '../types/network';
import { CABLE_METADATA } from '../data/cableDefinitions';

interface CableInspectorProps {
  cable: CableConnection | null;
  nodes: NetworkNode[];
  onClose: () => void;
  onDeleteCable: (cableId: string) => void;
  onUpdateCable: (updated: CableConnection) => void;
}

export const CableInspector: React.FC<CableInspectorProps> = ({
  cable,
  nodes,
  onClose,
  onDeleteCable,
  onUpdateCable,
}) => {
  if (!cable) return null;

  const fromNode = nodes.find((n) => n.id === cable.fromNodeId);
  const toNode = nodes.find((n) => n.id === cable.toNodeId);
  const fromPort = fromNode?.ports.find((p) => p.id === cable.fromPortId);
  const toPort = toNode?.ports.find((p) => p.id === cable.toPortId);

  const meta = CABLE_METADATA[cable.type];
  const isBroken = cable.status === 'broken';

  const handleToggleCut = () => {
    onUpdateCable({
      ...cable,
      status: isBroken ? 'active' : 'broken',
    });
  };

  const handleLengthChange = (newLengthKm: number) => {
    const validLength = Math.max(0.001, Number(newLengthKm.toFixed(3)));
    let loss = 0;
    if (cable.type === 'lan') {
      loss = validLength * 2.2;
    } else if (cable.type === 'drop_core') {
      loss = validLength * 0.40 + 0.50;
    } else {
      loss = validLength * 0.35 + 0.25;
    }

    onUpdateCable({
      ...cable,
      lengthKm: validLength,
      attenuationDb: Number(loss.toFixed(2)),
    });
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-lg rounded-2xl border-2 border-slate-300 bg-white/95 p-4 text-slate-800 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-2xs"
            style={{ backgroundColor: isBroken ? '#ef4444' : meta.colorHex }}
          >
            <CableIcon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 leading-tight">
              {meta.name}
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              Status: {isBroken ? 'PUTUS (FIBER CUT)' : 'AKTIF & TERSAMBUNG'}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Connection Endpoint Nodes & Ports */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Dari Node:</div>
          <div className="font-bold text-slate-900 truncate">{fromNode?.name || 'Node Asal'}</div>
          <div className="text-[10px] text-slate-500 truncate">{fromPort?.name || 'Port'}</div>
        </div>

        <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 mx-2" />

        <div className="flex-1 min-w-0 text-right">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Ke Node:</div>
          <div className="font-bold text-slate-900 truncate">{toNode?.name || 'Node Tujuan'}</div>
          <div className="text-[10px] text-slate-500 truncate">{toPort?.name || 'Port'}</div>
        </div>
      </div>

      {/* Cable Length & Attenuation Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1">
          <label className="text-[10px] font-bold text-slate-600 block">
            Panjang Kabel Fisik
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step={cable.type === 'lan' ? '0.005' : '0.1'}
              min="0.001"
              value={cable.lengthKm}
              onChange={(e) => handleLengthChange(parseFloat(e.target.value) || 0.01)}
              className="w-full rounded-md border border-slate-200 px-2 py-1 font-mono text-xs font-bold text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            <span className="text-[11px] font-bold text-slate-500 font-mono">
              {cable.type === 'lan' ? 'km' : 'km'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            = {(cable.lengthKm * 1000).toFixed(0)} meter
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1">
          <label className="text-[10px] font-bold text-slate-600 block">
            Redaman Terhitung
          </label>
          <div className="text-base font-bold font-mono text-emerald-700 pt-0.5">
            -{cable.attenuationDb.toFixed(2)} dB
          </div>
          <div className="text-[10px] text-slate-400">
            Loss: {meta.attenuationPerKm} dB/km + konektor
          </div>
        </div>
      </div>

      {/* Action Buttons: Cut Simulation & Delete Cable */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={handleToggleCut}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-2xs ${
            isBroken
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
          }`}
          title={isBroken ? 'Sambungkan kembali kabel' : 'Simulasikan kabel putus'}
        >
          <Scissors className="h-3.5 w-3.5" />
          <span>{isBroken ? 'Sambungkan Kabel' : 'Simulasikan Putus'}</span>
        </button>

        {/* PROMINENT DELETE CABLE BUTTON */}
        <button
          onClick={() => {
            onDeleteCable(cable.id);
            onClose();
          }}
          className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-2xs"
          title="Hapus kabel ini dari topologi (Shortcut: Tekan tombol Delete)"
        >
          <Trash2 className="h-4 w-4" />
          <span>HAPUS KABEL</span>
        </button>
      </div>
    </div>
  );
};
