import React, { useState } from 'react';
import {
  Boxes,
  Undo2,
  Camera,
  FileJson,
  Download,
  Upload,
  RotateCcw,
  Pause,
  Play,
  X,
} from 'lucide-react';

interface BottomDockProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onSaveImage: () => void;
  canUndo: boolean;
  onUndo: () => void;
  onImportJson: () => void;
  onExportJson: () => void;
  isDevicePaletteOpen: boolean;
  onToggleDevicePalette: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  isRunning,
  onToggleRun,
  onReset,
  onSaveImage,
  canUndo,
  onUndo,
  onImportJson,
  onExportJson,
  isDevicePaletteOpen,
  onToggleDevicePalette,
}) => {
  const [jsonMenuOpen, setJsonMenuOpen] = useState(false);

  const toggleJsonMenu = () => {
    if (isDevicePaletteOpen) onToggleDevicePalette();
    setJsonMenuOpen((open) => !open);
  };

  const runImport = () => {
    setJsonMenuOpen(false);
    onImportJson();
  };

  const runExport = () => {
    setJsonMenuOpen(false);
    onExportJson();
  };

  return (
    <>
      {jsonMenuOpen && (
        <div className="fixed bottom-[88px] left-1/2 z-[60] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl md:bottom-20">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-bold text-slate-800">Topologi JSON</span>
            <button
              onClick={() => setJsonMenuOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Tutup menu JSON"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={runImport}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              title="Import JSON"
            >
              <Upload className="h-4 w-4 text-sky-600" />
              Import JSON
            </button>
            <button
              onClick={runExport}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              title="Download JSON"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              Download JSON
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <div className="grid grid-cols-6 gap-1.5 rounded-3xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur-md">
          <button
            onClick={onToggleDevicePalette}
            className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-bold transition-colors ${
              isDevicePaletteOpen ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Buka/tutup katalog perangkat"
          >
            <Boxes className="mb-0.5 h-5 w-5" />
            Perangkat
          </button>

          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-30"
            title="Urungkan perubahan"
          >
            <Undo2 className="mb-0.5 h-5 w-5" />
            Undo
          </button>

          <button
            onClick={onSaveImage}
            className="flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-100"
            title="Simpan foto topologi"
          >
            <Camera className="mb-0.5 h-5 w-5" />
            Foto
          </button>

          <button
            onClick={toggleJsonMenu}
            className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-bold transition-colors ${
              jsonMenuOpen ? 'bg-sky-50 text-sky-800' : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Import atau download JSON"
          >
            <FileJson className="mb-0.5 h-5 w-5" />
            JSON
          </button>

          <button
            onClick={onReset}
            className="flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-100"
            title="Reset topologi"
          >
            <RotateCcw className="mb-0.5 h-5 w-5" />
            Reset
          </button>

          <button
            onClick={onToggleRun}
            className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-bold text-white transition-colors ${
              isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
            title={isRunning ? 'Jeda simulasi' : 'Jalankan simulasi'}
          >
            {isRunning ? <Pause className="mb-0.5 h-5 w-5" /> : <Play className="mb-0.5 h-5 w-5" />}
            {isRunning ? 'Jeda' : 'Run'}
          </button>
        </div>
      </div>
    </>
  );
};
