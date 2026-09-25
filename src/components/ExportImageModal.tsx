import React, { useState, useMemo } from 'react';
import {
  Download,
  Image as ImageIcon,
  Copy,
  Check,
  X,
  Sparkles,
  Layers,
  FileCode,
  Palette,
  Sliders,
} from 'lucide-react';
import { NetworkDevice, NetworkLink } from '../types/network';
import {
  ExportImageOptions,
  generateTopologySvg,
  downloadTopologyPng,
  downloadTopologySvg,
  copyTopologyImageToClipboard,
} from '../utils/exportImage';

interface ExportImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: NetworkDevice[];
  links: NetworkLink[];
  topologyName: string;
}

export const ExportImageModal: React.FC<ExportImageModalProps> = ({
  isOpen,
  onClose,
  devices,
  links,
  topologyName,
}) => {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [theme, setTheme] = useState<'dark' | 'blueprint' | 'light' | 'transparent'>('dark');
  const [scale, setScale] = useState<1 | 2>(2);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeIpBadges, setIncludeIpBadges] = useState(true);
  const [includeWatermark, setIncludeWatermark] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const options: ExportImageOptions = useMemo(
    () => ({
      format,
      theme,
      scale,
      includeLabels,
      includeIpBadges,
      includeWatermark,
      topologyName,
    }),
    [format, theme, scale, includeLabels, includeIpBadges, includeWatermark, topologyName],
  );

  // Generate preview SVG
  const { svgString } = useMemo(() => {
    return generateTopologySvg(devices, links, options);
  }, [devices, links, options]);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsExporting(true);
    if (format === 'svg') {
      downloadTopologySvg(devices, links, options);
      setIsExporting(false);
    } else {
      downloadTopologyPng(devices, links, options, () => {
        setIsExporting(false);
      });
    }
  };

  const handleCopyClipboard = async () => {
    setCopied(false);
    const success = await copyTopologyImageToClipboard(devices, links, options);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      // Fallback: download directly
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Ekspor Visualisasi Topologi (Gambar PNG / Vektor SVG)
              </h2>
              <p className="text-xs text-slate-400">
                Unduh diagram resolusi tinggi untuk laporan teknis, presentasi, atau dokumentasi arsitektur jaringan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* Format & Theme Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Format Selector */}
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-blue-400" /> Format Berkas
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormat('png')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border text-center ${
                    format === 'png'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  PNG (Raster HD)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('svg')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border text-center ${
                    format === 'svg'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  SVG (Vektor Skalabel)
                </button>
              </div>
            </div>

            {/* Theme Selector */}
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" /> Tema Tampilan Latar
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-1"
              >
                <option value="dark">Dark Slate (Default Terminator)</option>
                <option value="blueprint">Blueprint Blue (Teknikal)</option>
                <option value="light">Clean Light (Latar Putih Dokumen)</option>
                <option value="transparent">Transparan (Tanpa Latar Belakang)</option>
              </select>
            </div>

            {/* Resolution Scale */}
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Resolusi Gambar
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setScale(1)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border text-center ${
                    scale === 1
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  1x Standard
                </button>
                <button
                  type="button"
                  onClick={() => setScale(2)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border text-center ${
                    scale === 2
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  2x HD Retina
                </button>
              </div>
            </div>
          </div>

          {/* Toggle Options */}
          <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <span className="font-semibold text-slate-400">Elemen Diagram:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeIpBadges}
                onChange={(e) => setIncludeIpBadges(e.target.checked)}
                className="accent-blue-500 w-3.5 h-3.5 rounded"
              />
              <span>Label Alamat IP</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLabels}
                onChange={(e) => setIncludeLabels(e.target.checked)}
                className="accent-blue-500 w-3.5 h-3.5 rounded"
              />
              <span>Spesifikasi &amp; Jarak Kabel</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWatermark}
                onChange={(e) => setIncludeWatermark(e.target.checked)}
                className="accent-blue-500 w-3.5 h-3.5 rounded"
              />
              <span>Header Judul &amp; Waktu Ekspor</span>
            </label>
          </div>

          {/* Live Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Pratinjau Diagram (Live Preview):</span>
              <span>{devices.length} perangkat terpasang</span>
            </div>

            <div className="w-full h-80 rounded-xl border border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center p-3 relative shadow-inner">
              <div
                className="w-full h-full flex items-center justify-center overflow-auto custom-scrollbar"
                dangerouslySetInnerHTML={{ __html: svgString }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleCopyClipboard}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Berhasil Disalin ke Clipboard!' : 'Salin Gambar ke Clipboard'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Memproses Berkas...' : `Unduh ${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
