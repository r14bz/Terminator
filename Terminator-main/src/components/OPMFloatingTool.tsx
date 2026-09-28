import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { OpticalCalculationResult } from '../utils/opticalCalculator';
import type { NetworkNode } from '../types/network';

interface OPMFloatingToolProps {
  probedNode: NetworkNode | null;
  opticalResult?: OpticalCalculationResult;
  onClose: () => void;
}

export const OPMFloatingTool: React.FC<OPMFloatingToolProps> = ({
  probedNode,
  opticalResult,
  onClose,
}) => {
  const [wavelength, setWavelength] = useState<'1490nm' | '1310nm' | '1550nm'>('1490nm');

  if (!probedNode) return null;

  const powerVal = opticalResult?.rxPowerDbm ?? -99;
  const isOptimal = powerVal >= -24.0 && powerVal <= -8.0;
  const isAcceptable = powerVal >= -27.0 && powerVal < -24.0;
  const isFail = powerVal < -27.0;

  return (
    <div className="fixed bottom-4 left-4 z-40 w-80 rounded-2xl border-2 border-slate-700 bg-slate-900 p-4 text-white shadow-2xl animate-in slide-in-from-bottom duration-200">
      {/* Top Header of OPM Instrument */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-emerald-400">
            OPTICAL POWER METER (OPM)
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Target Node info */}
      <div className="mt-2 text-xs text-slate-300">
        Titik Ukur: <strong className="text-white">{probedNode.name}</strong> ({probedNode.type.toUpperCase()})
      </div>

      {/* Digital LCD Display Box */}
      <div className="mt-3 rounded-xl border border-emerald-900 bg-emerald-950/80 p-3 shadow-inner">
        <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
          <span>λ = {wavelength}</span>
          <span>GPON ITU-T</span>
        </div>

        {/* Large Digital dBm readout */}
        <div className="my-1.5 flex items-baseline justify-center gap-1 font-mono">
          <span
            className={`text-3xl font-extrabold tracking-tight ${
              isFail ? 'text-rose-400' : isAcceptable ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {powerVal <= -90 ? 'LO' : powerVal.toFixed(2)}
          </span>
          <span className="text-sm font-bold text-emerald-500">dBm</span>
        </div>

        {/* Visual Bar Graph */}
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[9px] font-mono text-slate-400">
            <span>-30 dBm (LOS)</span>
            <span>-24 (Warn)</span>
            <span>-18 (Ideal)</span>
            <span>0 dBm</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                isFail ? 'bg-rose-500' : isAcceptable ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{
                width: `${Math.max(5, Math.min(100, ((powerVal + 30) / 35) * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Status LED & Verdict */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {isOptimal ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : isAcceptable ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          )}
          <span className="font-semibold text-[11px]">
            {isOptimal
              ? 'PASS (Sinyal Normal)'
              : isAcceptable
              ? 'WARNING (Marjinal)'
              : 'FAIL / LOS (Merah Kedip)'}
          </span>
        </div>

        {/* Wavelength Toggle buttons */}
        <div className="flex gap-1">
          {(['1310nm', '1490nm', '1550nm'] as const).map((wl) => (
            <button
              key={wl}
              onClick={() => setWavelength(wl)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                wavelength === wl ? 'bg-emerald-700 text-white font-bold' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {wl.replace('nm', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
