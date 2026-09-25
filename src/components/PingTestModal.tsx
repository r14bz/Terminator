import React, { useState } from 'react';
import { NetworkDevice, NetworkLink, TestResult, TrafficGeneratorStream } from '../types/network';
import { simulatePing, simulateTraceroute, SimulationResult } from '../utils/networkEngine';
import {
  Activity,
  X,
  Play,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Wrench,
  Flame,
  Radio,
  Share2,
} from 'lucide-react';

interface PingTestModalProps {
  devices: NetworkDevice[];
  links: NetworkLink[];
  activeStreams?: TrafficGeneratorStream[];
  onTriggerAnimation?: (pathCoordinates: { x: number; y: number }[], success: boolean) => void;
  onSaveTestResult: (result: TestResult) => void;
  onOpenTroubleshooting?: () => void;
  onClose: () => void;
}

export const PingTestModal: React.FC<PingTestModalProps> = ({
  devices,
  links,
  activeStreams = [],
  onTriggerAnimation,
  onSaveTestResult,
  onOpenTroubleshooting,
  onClose,
}) => {
  // Filter devices that can act as ping sender (devices with an IP)
  const capableSenders = devices.filter((d) =>
    ['pc', 'laptop', 'server', 'router', 'mikrotik', 'smartphone', 'ont', 'sensor_temp', 'smart_plug', 'smart_cam'].includes(d.type),
  );

  const [sourceId, setSourceId] = useState<string>(capableSenders[0]?.id || '');
  const [targetType, setTargetType] = useState<'device' | 'ip'>('device');
  const [targetDeviceId, setTargetDeviceId] = useState<string>(capableSenders[1]?.id || '');
  const [customIp, setCustomIp] = useState<string>('8.8.8.8');
  const [testMode, setTestMode] = useState<'ping' | 'traceroute'>('ping');

  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);

  const handleRunTest = () => {
    setIsRunning(true);
    setLastResult(null);

    const destination = targetType === 'device' ? targetDeviceId : customIp;

    setTimeout(() => {
      let simResult: SimulationResult;
      if (testMode === 'ping') {
        simResult = simulatePing(sourceId, destination, devices, links, activeStreams);
      } else {
        simResult = simulateTraceroute(sourceId, destination, devices, links, activeStreams);
      }

      setLastResult(simResult);
      setIsRunning(false);

      // Trigger visual packet flow on canvas
      if (simResult.pathCoordinates.length > 1 && onTriggerAnimation) {
        onTriggerAnimation(simResult.pathCoordinates, simResult.success);
      }

      // Record test result for documentation report
      const newTestResult: TestResult = {
        id: `test_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        sourceDeviceId: simResult.sourceDevice.id,
        targetDeviceId: simResult.targetDevice?.id || 'manual_ip',
        targetIp: simResult.targetIp,
        success: simResult.success,
        packetsSent: simResult.packetsSent,
        packetsReceived: simResult.packetsReceived,
        packetLoss: simResult.packetLossPercent,
        rttMin: simResult.success ? Number((simResult.roundTripTimeMs * 0.8).toFixed(1)) : 0,
        rttAvg: simResult.success ? Number(simResult.roundTripTimeMs.toFixed(1)) : 0,
        rttMax: simResult.success ? Number((simResult.roundTripTimeMs * 1.2).toFixed(1)) : 0,
        hops: simResult.hops.map((h) => `${h.deviceName} (${h.rttMs}ms)`),
        logs: simResult.logs,
        diagnosisMessage: simResult.errorMessage,
      };

      onSaveTestResult(newTestResult);
    }, 500);
  };

  const sourceDev = devices.find((d) => d.id === sourceId);
  const sourcePort = sourceDev?.ports.find((p) => p.isUp && p.ipAddress);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Uji Konektivitas Real-Time (ICMP &amp; Rute)</h3>
              <p className="text-xs text-slate-400">
                Simulasi paket Ping &amp; Traceroute dengan kalkulasi latency kongesti, OSPF, BGP, dan redaman FTTH
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Source & Destination Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Source */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Perangkat Pengirim (Source)
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {capableSenders.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.ports.find((p) => p.isUp && p.ipAddress)?.ipAddress || 'No IP'})
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">
                IP Pengirim: {sourcePort?.ipAddress || 'Belum diatur'}
              </div>
            </div>

            {/* Target */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Tujuan (Destination)</label>
                <div className="flex items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={targetType === 'device'}
                      onChange={() => setTargetType('device')}
                      className="accent-blue-500"
                    />
                    <span>Perangkat</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={targetType === 'ip'}
                      onChange={() => setTargetType('ip')}
                      className="accent-blue-500"
                    />
                    <span>IP Bebas</span>
                  </label>
                </div>
              </div>

              {targetType === 'device' ? (
                <select
                  value={targetDeviceId}
                  onChange={(e) => setTargetDeviceId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.ports.find((p) => p.isUp && p.ipAddress)?.ipAddress || d.type})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="8.8.8.8 atau 192.168.1.1"
                  value={customIp}
                  onChange={(e) => setCustomIp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          </div>

          {/* Mode Toggle & Action */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Metode:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTestMode('ping')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    testMode === 'ping' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ping (ICMP 4 Paket)
                </button>
                <button
                  type="button"
                  onClick={() => setTestMode('traceroute')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    testMode === 'traceroute' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Traceroute (Lacak Hop)
                </button>
              </div>
            </div>

            <button
              onClick={handleRunTest}
              disabled={isRunning || !sourceId}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Mengirim Paket...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Jalankan Pengujian</span>
                </>
              )}
            </button>
          </div>

          {/* Test Console Output */}
          <div className="bg-black border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 min-h-44 flex flex-col justify-between shadow-inner">
            <div className="space-y-1 overflow-y-auto max-h-52 custom-scrollbar">
              {lastResult ? (
                lastResult.logs.map((log, index) => (
                  <div
                    key={index}
                    className={`leading-relaxed ${
                      log.includes('Balasan dari') || log.includes('0% loss')
                        ? 'text-emerald-400'
                        : log.includes('timed out') || log.includes('unreachable') || log.includes('ERROR')
                        ? 'text-red-400'
                        : log.includes('PERINGATAN') || log.includes('kongesti')
                        ? 'text-amber-400 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-600 text-center py-8">
                  Pilih perangkat sumber dan tujuan di atas, lalu klik &quot;Jalankan Pengujian&quot;.
                </div>
              )}
            </div>

            {/* Quick Status Bar */}
            {lastResult && (
              <div className="pt-3 mt-3 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  {lastResult.success ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Status: SUKSES ({lastResult.packetLossPercent}% Packet Loss)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Status: GAGAL / TIMEOUT ({lastResult.packetLossPercent}% Loss)
                    </span>
                  )}

                  {lastResult.protocolUsed && (
                    <span className="bg-slate-900 px-1.5 py-0.5 rounded text-sky-400 border border-slate-800">
                      Rute: {lastResult.protocolUsed}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {lastResult.congestedLinksEncountered && lastResult.congestedLinksEncountered.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Flame className="w-3 h-3 text-red-400 animate-pulse" />
                      Link Jenuh
                    </span>
                  )}
                  {lastResult.success && (
                    <span className="text-slate-400">
                      Latensi: <strong>{lastResult.roundTripTimeMs} ms</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Troubleshooting Recommendation Banner if Failed */}
          {lastResult && !lastResult.success && lastResult.solutionSteps && (
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Kendala Terdeteksi: {lastResult.errorMessage}</span>
              </div>
              {lastResult.errorDetail && (
                <p className="text-slate-300 text-[11px] leading-relaxed pl-6">
                  {lastResult.errorDetail}
                </p>
              )}
              <div className="pl-6 space-y-1">
                <div className="font-semibold text-slate-200">Langkah Pemecahan Masalah:</div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                  {lastResult.solutionSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>

              {onOpenTroubleshooting && (
                <div className="pt-2 pl-6">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTroubleshooting();
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 underline"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Buka Panel Diagnostik Jaringan untuk Perbaikan Otomatis &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Hasil pengujian otomatis dicatat ke riwayat laporan dokumentasi.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
