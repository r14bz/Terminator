import React, { useState } from 'react';
import {
  Activity,
  Play,
  Square,
  Plus,
  Trash2,
  AlertTriangle,
  Zap,
  Gauge,
  ArrowRight,
  X,
  Flame,
  Radio,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { NetworkDevice, NetworkLink, TrafficGeneratorStream } from '../types/network';
import { calculateLinkCongestion, LinkCongestionMetrics } from '../utils/trafficEngine';

interface TrafficGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: NetworkDevice[];
  links: NetworkLink[];
  activeStreams: TrafficGeneratorStream[];
  onUpdateStreams: (streams: TrafficGeneratorStream[]) => void;
}

export const TrafficGeneratorModal: React.FC<TrafficGeneratorModalProps> = ({
  isOpen,
  onClose,
  devices,
  links,
  activeStreams,
  onUpdateStreams,
}) => {
  const [sourceDevId, setSourceDevId] = useState<string>(devices[0]?.id || '');
  const [targetDevId, setTargetDevId] = useState<string>(devices[1]?.id || '');
  const [rateMbps, setRateMbps] = useState<number>(85);
  const [trafficType, setTrafficType] = useState<TrafficGeneratorStream['trafficType']>('udp');
  const [streamName, setStreamName] = useState<string>('Stream Uji Beban');

  if (!isOpen) return null;

  const validSourceDevs = devices.filter((d) => d.status === 'online');
  const validTargetDevs = devices.filter((d) => d.status === 'online' && d.id !== sourceDevId);

  // Link congestion calculations
  const congestionMetrics = calculateLinkCongestion(devices, links, activeStreams);
  const congestedLinks = congestionMetrics.filter((m) => m.status === 'congested' || m.status === 'critical');
  const totalLoadMbps = activeStreams.reduce((acc, s) => acc + (s.isActive ? s.rateMbps : 0), 0);

  const handleAddStream = () => {
    if (!sourceDevId || !targetDevId) return;

    const newStream: TrafficGeneratorStream = {
      id: `stream_${Date.now()}`,
      name: streamName || `Trafik ${sourceDevId} -> ${targetDevId}`,
      sourceDeviceId: sourceDevId,
      targetDeviceId: targetDevId,
      rateMbps,
      packetSizeBytes: 1400,
      trafficType,
      isActive: true,
      currentThroughputMbps: rateMbps,
      latencyInflationMs: rateMbps > 80 ? 65 : 12,
      packetLossPercent: rateMbps > 95 ? 14 : (rateMbps > 85 ? 5 : 0),
    };

    onUpdateStreams([...activeStreams, newStream]);
    setStreamName(`Stream ${activeStreams.length + 2}`);
  };

  const handleToggleStream = (id: string) => {
    const updated = activeStreams.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s));
    onUpdateStreams(updated);
  };

  const handleDeleteStream = (id: string) => {
    const updated = activeStreams.filter((s) => s.id !== id);
    onUpdateStreams(updated);
  };

  const handleQuickPreset = (type: 'saturate_fe' | 'heavy_udp' | 'voip_stream') => {
    if (devices.length < 2) return;
    const sId = devices[0].id;
    const tId = devices[devices.length - 1].id;

    if (type === 'saturate_fe') {
      onUpdateStreams([
        {
          id: `preset_fe_${Date.now()}`,
          name: 'Bottleneck Saturation (95 Mbps)',
          sourceDeviceId: sId,
          targetDeviceId: tId,
          rateMbps: 95,
          packetSizeBytes: 1500,
          trafficType: 'udp',
          isActive: true,
          currentThroughputMbps: 95,
          latencyInflationMs: 85,
          packetLossPercent: 12,
        },
      ]);
    } else if (type === 'heavy_udp') {
      onUpdateStreams([
        {
          id: `preset_udp_${Date.now()}`,
          name: 'Heavy UDP Flood (350 Mbps)',
          sourceDeviceId: sId,
          targetDeviceId: tId,
          rateMbps: 350,
          packetSizeBytes: 1400,
          trafficType: 'udp',
          isActive: true,
          currentThroughputMbps: 350,
          latencyInflationMs: 140,
          packetLossPercent: 28,
        },
      ]);
    } else if (type === 'voip_stream') {
      onUpdateStreams([
        {
          id: `preset_voip_${Date.now()}`,
          name: 'VoIP Call Stream G.711 (5 Mbps)',
          sourceDeviceId: sId,
          targetDeviceId: tId,
          rateMbps: 5,
          packetSizeBytes: 200,
          trafficType: 'voip',
          isActive: true,
          currentThroughputMbps: 5,
          latencyInflationMs: 2,
          packetLossPercent: 0,
        },
      ]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Simulasi Beban Jaringan & Traffic Generator
                {activeStreams.some((s) => s.isActive) && (
                  <span className="flex items-center gap-1 text-[11px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    <Flame className="w-3 h-3 text-red-400" />
                    LIVE GENERATING
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Injeksi aliran paket data sintetis untuk mensimulasikan bottleneck, packet loss, dan lonjakan latency saat link jenuh.
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* Top Quick Status Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" /> Total Beban
              </div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {totalLoadMbps.toFixed(0)} <span className="text-xs text-slate-400 font-sans">Mbps</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{activeStreams.filter((s) => s.isActive).length} stream aktif</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Link Bottleneck
              </div>
              <div className={`text-xl font-bold font-mono mt-1 ${congestedLinks.length > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {congestedLinks.length} <span className="text-xs text-slate-400 font-sans">link jenuh</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Kapasitas link &ge; 85%</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" /> Max Latency Spike
              </div>
              <div className="text-xl font-bold font-mono text-purple-300 mt-1">
                +{congestedLinks.length > 0 ? (congestedLinks[0].additionalLatencyMs).toFixed(0) : '0'} <span className="text-xs text-slate-400 font-sans">ms</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Penurunan RTT</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" /> Packet Drop
              </div>
              <div className={`text-xl font-bold font-mono mt-1 ${congestedLinks.some((l) => l.packetLossPercent > 0) ? 'text-rose-400' : 'text-emerald-400'}`}>
                {congestedLinks.length > 0 ? (congestedLinks[0].packetLossPercent).toFixed(0) : '0'}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Buffer tail-drop</div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Preset Pengujian Instan:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleQuickPreset('saturate_fe')}
                className="px-2.5 py-1 text-xs font-medium bg-red-950/50 hover:bg-red-900/60 text-red-200 border border-red-800/60 rounded-lg transition-all flex items-center gap-1.5"
              >
                <span>🔥 Bottleneck FE (95 Mbps)</span>
              </button>
              <button
                onClick={() => handleQuickPreset('heavy_udp')}
                className="px-2.5 py-1 text-xs font-medium bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 border border-purple-800/60 rounded-lg transition-all flex items-center gap-1.5"
              >
                <span>⚡ UDP Flood (350 Mbps)</span>
              </button>
              <button
                onClick={() => handleQuickPreset('voip_stream')}
                className="px-2.5 py-1 text-xs font-medium bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-800/60 rounded-lg transition-all flex items-center gap-1.5"
              >
                <span>📞 VoIP Stream (5 Mbps)</span>
              </button>
            </div>
          </div>

          {/* Stream Generator Builder Form */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" /> Buat Aliran Beban Data Baru (Traffic Stream)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Source Device */}
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Perangkat Pengirim (Source)</label>
                <select
                  value={sourceDevId}
                  onChange={(e) => setSourceDevId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {validSourceDevs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Device */}
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Perangkat Tujuan (Target)</label>
                <select
                  value={targetDevId}
                  onChange={(e) => setTargetDevId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {validTargetDevs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Protocol Type */}
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Tipe Protokol</label>
                <select
                  value={trafficType}
                  onChange={(e) => setTrafficType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="udp">UDP Data Stream (Stress Test)</option>
                  <option value="tcp">TCP Stream (Window Flow)</option>
                  <option value="voip">VoIP Call (Sensitif Jitter)</option>
                  <option value="video">4K Video Stream (RTP)</option>
                </select>
              </div>

              {/* Rate Slider & Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-medium text-slate-400">Kecepatan Beban</label>
                  <span className="text-xs font-mono font-bold text-amber-400">{rateMbps} Mbps</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="1000"
                  step="5"
                  value={rateMbps}
                  onChange={(e) => setRateMbps(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <input
                type="text"
                placeholder="Nama Stream (Opsional)..."
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 w-64 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddStream}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Mulai & Injeksi Aliran Beban
              </button>
            </div>
          </div>

          {/* Active Streams List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Daftar Aliran Beban Aktif ({activeStreams.length})</span>
              {activeStreams.length > 0 && (
                <button
                  onClick={() => onUpdateStreams([])}
                  className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Hentikan & Hapus Semua
                </button>
              )}
            </h3>

            {activeStreams.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                Belum ada aliran trafik yang sedang di-generate. Pilih parameter di atas lalu klik &quot;Injeksi Aliran Beban&quot;.
              </div>
            ) : (
              <div className="space-y-2">
                {activeStreams.map((s) => {
                  const src = devices.find((d) => d.id === s.sourceDeviceId);
                  const tgt = devices.find((d) => d.id === s.targetDeviceId);

                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        s.isActive
                          ? 'bg-slate-950/80 border-amber-500/40 shadow-sm shadow-amber-500/10'
                          : 'bg-slate-950/30 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => handleToggleStream(s.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            s.isActive
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                          title={s.isActive ? 'Jeda Stream' : 'Lanjutkan Stream'}
                        >
                          {s.isActive ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        </button>

                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                            <span>{s.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 uppercase font-mono text-slate-300">
                              {s.trafficType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                            <span className="text-blue-300">{src?.name || s.sourceDeviceId}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="text-emerald-300">{tgt?.name || s.targetDeviceId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stream stats & controls */}
                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 pl-11 sm:pl-0">
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-amber-400">
                            {s.rateMbps} <span className="text-[10px] text-slate-400 font-sans">Mbps</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {s.isActive ? 'Sedang Mentransmisikan' : 'Dijeda'}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteStream(s.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                          title="Hapus stream"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Trafik aktif akan secara dinamis dihitung pada kanvas dan pengujian Ping.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};
