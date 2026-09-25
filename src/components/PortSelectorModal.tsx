import React, { useState } from 'react';
import { NetworkDevice, PortConfig, CableType, NetworkLink } from '../types/network';
import { CABLE_CATALOG, isPortCompatibleWithCable } from '../constants/cableCatalog';
import { Cable, X, Check, ArrowRight, AlertCircle } from 'lucide-react';

interface PortSelectorModalProps {
  deviceA: NetworkDevice;
  deviceB: NetworkDevice;
  cableType: CableType;
  existingLinks: NetworkLink[];
  onConfirm: (portAId: string, portBId: string, cableType: CableType, lengthMeters: number) => void;
  onCancel: () => void;
}

export const PortSelectorModal: React.FC<PortSelectorModalProps> = ({
  deviceA,
  deviceB,
  cableType,
  existingLinks,
  onConfirm,
  onCancel,
}) => {
  const cableSpec = CABLE_CATALOG[cableType];
  const isOptical = cableSpec.category === 'optical';

  // Check which ports are already occupied
  const isPortOccupied = (portId: string) => {
    return existingLinks.some((l) => l.fromPortId === portId || l.toPortId === portId);
  };

  // Find compatible and free ports
  const compatiblePortsA = deviceA.ports.filter((p) => isPortCompatibleWithCable(p.type, cableType));
  const compatiblePortsB = deviceB.ports.filter((p) => isPortCompatibleWithCable(p.type, cableType));

  const firstAvailableA = compatiblePortsA.find((p) => !isPortOccupied(p.id)) || compatiblePortsA[0];
  const firstAvailableB = compatiblePortsB.find((p) => !isPortOccupied(p.id)) || compatiblePortsB[0];

  const [selectedPortA, setSelectedPortA] = useState<string>(firstAvailableA?.id || '');
  const [selectedPortB, setSelectedPortB] = useState<string>(firstAvailableB?.id || '');
  const [selectedCable, setSelectedCable] = useState<CableType>(cableType);
  const [lengthMeters, setLengthMeters] = useState<number>(isOptical ? 1500 : 15);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortA || !selectedPortB) return;
    onConfirm(selectedPortA, selectedPortB, selectedCable, lengthMeters);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
              <Cable className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Hubungkan Kabel Antar Perangkat</h3>
              <p className="text-xs text-slate-400">
                Pilih port fisik pada masing-masing perangkat untuk memasang kabel
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Cable Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Jenis Kabel & Media Transmisi
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.values(CABLE_CATALOG).map((c) => (
                <button
                  type="button"
                  key={c.type}
                  onClick={() => setSelectedCable(c.type)}
                  className={`flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs ${
                    selectedCable === c.type
                      ? 'border-blue-500 bg-blue-950/40 text-white ring-1 ring-blue-500'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: c.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.shortName}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">{c.speedMbps} Mbps</span>
                </button>
              ))}
            </div>
          </div>

          {/* Port Selection Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device A */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                    Perangkat 1 (Sumber)
                  </span>
                  <div className="text-sm font-semibold text-white">{deviceA.name}</div>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  {deviceA.type}
                </span>
              </div>

              <label className="block text-xs text-slate-400 font-medium">Pilih Port:</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {deviceA.ports.map((port) => {
                  const occupied = isPortOccupied(port.id);
                  const compatible = isPortCompatibleWithCable(port.type, selectedCable);
                  const isSelected = selectedPortA === port.id;

                  return (
                    <button
                      type="button"
                      key={port.id}
                      disabled={!compatible}
                      onClick={() => setSelectedPortA(port.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-left transition-all border ${
                        isSelected
                          ? 'bg-blue-600/30 border-blue-500 text-white font-medium'
                          : !compatible
                          ? 'opacity-40 border-slate-800/40 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                          : occupied
                          ? 'border-amber-600/30 bg-amber-950/10 text-slate-300'
                          : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-mono font-medium">{port.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {port.type.replace('_', ' ')} {port.ipAddress ? `• ${port.ipAddress}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 ml-2">
                        {occupied && (
                          <span className="text-[10px] bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded">
                            Terpakai
                          </span>
                        )}
                        {!compatible && (
                          <span className="text-[10px] text-red-400">Inkompatibel</span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Device B */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">
                    Perangkat 2 (Tujuan)
                  </span>
                  <div className="text-sm font-semibold text-white">{deviceB.name}</div>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  {deviceB.type}
                </span>
              </div>

              <label className="block text-xs text-slate-400 font-medium">Pilih Port:</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {deviceB.ports.map((port) => {
                  const occupied = isPortOccupied(port.id);
                  const compatible = isPortCompatibleWithCable(port.type, selectedCable);
                  const isSelected = selectedPortB === port.id;

                  return (
                    <button
                      type="button"
                      key={port.id}
                      disabled={!compatible}
                      onClick={() => setSelectedPortB(port.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-left transition-all border ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-500 text-white font-medium'
                          : !compatible
                          ? 'opacity-40 border-slate-800/40 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                          : occupied
                          ? 'border-amber-600/30 bg-amber-950/10 text-slate-300'
                          : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-mono font-medium">{port.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {port.type.replace('_', ' ')} {port.ipAddress ? `• ${port.ipAddress}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 ml-2">
                        {occupied && (
                          <span className="text-[10px] bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded">
                            Terpakai
                          </span>
                        )}
                        {!compatible && (
                          <span className="text-[10px] text-red-400">Inkompatibel</span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cable Length Setting */}
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="font-medium text-slate-200">Estimasi Panjang Kabel:</span>
              <p className="text-[11px] text-slate-400">
                {isOptical
                  ? 'Mempengaruhi redaman sinyal optik (dBm loss ITU-T)'
                  : 'Standar UTP Cat6 maksimal 100 meter'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={isOptical ? 40000 : 100}
                value={lengthMeters}
                onChange={(e) => setLengthMeters(Number(e.target.value) || 1)}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-right text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400">Meter</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!selectedPortA || !selectedPortB}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-lg shadow-blue-500/25 transition-all"
            >
              <span>Sambungkan Port</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
