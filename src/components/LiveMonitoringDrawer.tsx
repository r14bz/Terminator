import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Activity,
  Layers,
  Cpu,
  Wifi,
  Radio,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import { NetworkDevice, NetworkLink, TrafficGeneratorStream } from '../types/network';
import { calculateLinkCongestion } from '../utils/trafficEngine';
import { calculateDeviceOpticalPower } from '../utils/networkEngine';

interface LiveMonitoringDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: string[];
  onClearLogs: () => void;
  devices: NetworkDevice[];
  links: NetworkLink[];
  activeStreams: TrafficGeneratorStream[];
}

export const LiveMonitoringDrawer: React.FC<LiveMonitoringDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  devices,
  links,
  activeStreams,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'devices' | 'throughput' | 'ftth_iot'>('logs');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom on new entry
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const congestionMetrics = calculateLinkCongestion(devices, links, activeStreams);
  const onlineDevicesCount = devices.filter((d) => d.status === 'online').length;

  const handleExportLogs = () => {
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `terminator_live_logs_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700/80 shadow-2xl flex flex-col transition-all duration-200 text-slate-100 ${
        isExpanded ? 'h-[75vh]' : 'h-64 sm:h-72'
      }`}
    >
      {/* Drawer Header Bar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Monitoring &amp; Log Real-Time</span>
            <span className="sm:hidden">Monitoring</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'logs' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Log Aktivitas</span>
              <span className="text-[10px] bg-slate-800 px-1.5 rounded-full">{logs.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'devices' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Status Perangkat</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 rounded-full">
                {onlineDevicesCount}/{devices.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('throughput')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'throughput' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Throughput Link</span>
              {congestionMetrics.some((m) => m.status === 'congested' || m.status === 'critical') && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('ftth_iot')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'ftth_iot' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">FTTH &amp; IoT Sensor</span>
              <span className="sm:hidden">Optik &amp; IoT</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {activeTab === 'logs' && (
            <>
              <button
                onClick={handleExportLogs}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Ekspor Log ke .txt"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClearLogs}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Bersihkan Semua Log"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={isExpanded ? 'Kecilkan Panel' : 'Perbesar Panel'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Tutup Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-hidden p-3 bg-slate-950/70">
        {/* TAB 1: LOGS */}
        {activeTab === 'logs' && (
          <div
            ref={logContainerRef}
            className="h-full overflow-y-auto font-mono text-xs space-y-1 p-2 bg-slate-950 rounded-lg border border-slate-800/80 custom-scrollbar select-text"
          >
            {logs.length === 0 ? (
              <div className="text-slate-600 italic py-4 text-center">
                Belum ada aktivitas simulasi tercatat. Jalankan Ping, Traceroute, DHCP, atau Traffic Generator untuk melihat log real-time.
              </div>
            ) : (
              logs.map((log, idx) => {
                let colorClass = 'text-slate-300';
                if (log.includes('ERROR') || log.includes('gagal') || log.includes('timed out') || log.includes('ALARM')) {
                  colorClass = 'text-rose-400 font-semibold';
                } else if (log.includes('PERINGATAN') || log.includes('kongesti') || log.includes('jenuh')) {
                  colorClass = 'text-amber-400 font-semibold';
                } else if (log.includes('Balasan dari') || log.includes('berhasil') || log.includes('Established')) {
                  colorClass = 'text-emerald-400';
                } else if (log.includes('OSPF') || log.includes('BGP')) {
                  colorClass = 'text-sky-300';
                } else if (log.includes('IoT') || log.includes('Sensor')) {
                  colorClass = 'text-purple-300';
                }

                return (
                  <div key={idx} className={`leading-relaxed break-all ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: DEVICE HEALTH & STATUS */}
        {activeTab === 'devices' && (
          <div className="h-full overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 custom-scrollbar">
            {devices.map((dev) => {
              const activePorts = dev.ports.filter((p) => p.isUp && p.ipAddress);
              const isOnline = dev.status === 'online';

              return (
                <div
                  key={dev.id}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
                        }`}
                      />
                      <span className="truncate">{dev.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      Tipe: {dev.type.toUpperCase()} • {dev.ports.length} Port
                    </div>
                    {activePorts.length > 0 && (
                      <div className="text-[10px] font-mono text-blue-400 truncate mt-0.5">
                        IP: {activePorts[0].ipAddress}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isOnline
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    {dev.ospfConfig?.enabled && (
                      <div className="text-[9px] text-sky-400 font-mono mt-1">OSPF A{dev.ospfConfig.areaId}</div>
                    )}
                    {dev.bgpConfig?.enabled && (
                      <div className="text-[9px] text-purple-400 font-mono mt-1">AS {dev.bgpConfig.asNumber}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: THROUGHPUT & LINK CONGESTION */}
        {activeTab === 'throughput' && (
          <div className="h-full overflow-y-auto space-y-2 custom-scrollbar">
            {congestionMetrics.length === 0 ? (
              <div className="text-slate-500 text-xs italic text-center py-6">
                Belum ada kabel link aktif yang terpasang di kanvas.
              </div>
            ) : (
              congestionMetrics.map((metric) => {
                const link = links.find((l) => l.id === metric.linkId);
                const fromDev = devices.find((d) => d.id === link?.fromDeviceId);
                const toDev = devices.find((d) => d.id === link?.toDeviceId);

                let barColor = 'bg-emerald-500';
                let textColor = 'text-emerald-400';
                if (metric.status === 'congested') {
                  barColor = 'bg-amber-500';
                  textColor = 'text-amber-400';
                } else if (metric.status === 'critical') {
                  barColor = 'bg-red-500';
                  textColor = 'text-red-400 font-bold';
                }

                return (
                  <div
                    key={metric.linkId}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate font-medium text-slate-200">
                        <span>{fromDev?.name || 'A'}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-500" />
                        <span>{toDev?.name || 'B'}</span>
                        <span className="text-[10px] text-slate-500 font-mono font-normal">
                          ({link?.cableType})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={textColor}>
                          {metric.currentLoadMbps} / {metric.capacityMbps} Mbps
                        </span>
                        <span className="text-[11px] font-bold text-slate-300">
                          {metric.loadPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full ${barColor} transition-all duration-300`}
                        style={{ width: `${metric.loadPercent}%` }}
                      />
                    </div>

                    {/* Bottleneck notification */}
                    {(metric.status === 'congested' || metric.status === 'critical') && (
                      <div className="text-[10px] text-rose-400 flex items-center justify-between pt-0.5 font-medium">
                        <span>⚠️ Link Mengalami Kongesti! (+{metric.additionalLatencyMs}ms latency)</span>
                        <span>Packet Drop: {metric.packetLossPercent}%</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: FTTH & IOT SENSORS */}
        {activeTab === 'ftth_iot' && (
          <div className="h-full overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 custom-scrollbar">
            {/* FTTH Optical Devices */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                Daya Redaman Serat Optik (FTTH GPON)
              </h4>
              {devices.filter((d) => ['ont', 'odp', 'odc', 'olt', 'splitter', 'splitter_1_8', 'splitter_1_4', 'splitter_1_2'].includes(d.type)).map((d) => {
                const power = calculateDeviceOpticalPower(d.id, devices, links);
                return (
                  <div key={d.id} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">{d.name} ({d.type.toUpperCase()})</span>
                      <span className={`font-mono text-xs font-bold ${power.isWithinMargin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {power.rxPowerDbm} dBm
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Jalur: {power.pathDescription}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* IoT Telemetry */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Telemetri &amp; Otomasi IoT
              </h4>
              {devices.filter((d) => d.iotTelemetry).map((d) => {
                const t = d.iotTelemetry!;
                return (
                  <div key={d.id} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">{d.name}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {t.deviceCategory}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      {t.tempCelsius !== undefined && (
                        <span className="text-amber-400">{t.tempCelsius.toFixed(1)}°C Suhu</span>
                      )}
                      {t.humidityPercent !== undefined && (
                        <span className="text-blue-400">{t.humidityPercent}% RH</span>
                      )}
                      {t.plugState !== undefined && (
                        <span className={t.plugState === 'ON' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                          Saklar: {t.plugState} ({t.powerWatt || 0}W)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
