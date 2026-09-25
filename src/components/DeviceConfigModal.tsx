import React, { useState } from 'react';
import {
  NetworkDevice,
  PortConfig,
  RouteEntry,
  DHCPServerConfig,
  WirelessConfig,
  OpticalConfig,
  CCTVConfig,
  OSPFConfig,
  BGPConfig,
  IoTTelemetry,
  IoTAutomationRule,
} from '../types/network';
import { COMMON_SUBNETS, isValidIpv4 } from '../utils/ipCalculator';
import {
  X,
  Settings,
  Terminal,
  Activity,
  Wifi,
  Zap,
  Camera,
  Layers,
  Check,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Share2,
  Cpu,
  Radio,
  Sliders,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface DeviceConfigModalProps {
  device: NetworkDevice;
  allDevices: NetworkDevice[];
  onUpdateDevice: (updated: NetworkDevice) => void;
  onClose: () => void;
}

export const DeviceConfigModal: React.FC<DeviceConfigModalProps> = ({
  device,
  allDevices,
  onUpdateDevice,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ports' | 'routing' | 'services' | 'ftth' | 'iot' | 'cli'>('ports');
  const [devData, setDevData] = useState<NetworkDevice>(JSON.parse(JSON.stringify(device)));

  const isRouter = devData.type === 'router' || devData.type === 'mikrotik';
  const isSwitch = devData.type === 'switch' || devData.type === 'switch_hub';
  const isOptical = ['olt', 'ont', 'odc', 'odp', 'splitter', 'splitter_1_8', 'splitter_1_4', 'splitter_1_2'].includes(devData.type);
  const isIoT = ['sensor_temp', 'smart_plug', 'smart_cam', 'iot_hub'].includes(devData.type) || !!devData.iotTelemetry;

  const getInitialPrompt = () => {
    if (devData.type === 'router') return `${devData.name}# `;
    if (devData.type === 'mikrotik') return `[admin@${devData.name}] > `;
    return `C:\\Users\\Admin> `;
  };

  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState<string[]>([
    `Terminator OS [Versi 2.5.0]`,
    `Tersambung ke ${devData.name} (${devData.type.toUpperCase()}). Ketik 'help' untuk daftar perintah.`,
    '',
  ]);

  const handlePortChange = (portId: string, updates: Partial<PortConfig>) => {
    setDevData((prev) => ({
      ...prev,
      ports: prev.ports.map((p) => (p.id === portId ? { ...p, ...updates } : p)),
    }));
  };

  const handleSave = () => {
    onUpdateDevice(devData);
    onClose();
  };

  // Add static route
  const handleAddRoute = () => {
    const newRoute: RouteEntry = {
      id: `rt_${Date.now()}`,
      network: '192.168.2.0',
      netmask: '255.255.255.0',
      gateway: '10.0.0.2',
      interfaceName: devData.ports[0]?.name || 'GigabitEthernet0/0',
      metric: 1,
    };
    setDevData((prev) => ({
      ...prev,
      routingTable: [...(prev.routingTable || []), newRoute],
    }));
  };

  const handleRemoveRoute = (routeId: string) => {
    setDevData((prev) => ({
      ...prev,
      routingTable: (prev.routingTable || []).filter((r) => r.id !== routeId),
    }));
  };

  // Add OSPF / BGP handlers
  const handleToggleOSPF = (enabled: boolean) => {
    setDevData((prev) => ({
      ...prev,
      ospfConfig: {
        enabled,
        processId: prev.ospfConfig?.processId || 1,
        routerId: prev.ospfConfig?.routerId || '1.1.1.1',
        areaId: prev.ospfConfig?.areaId !== undefined ? prev.ospfConfig.areaId : 0,
        cost: prev.ospfConfig?.cost || 10,
        neighbors: prev.ospfConfig?.neighbors || [],
      },
    }));
  };

  const handleToggleBGP = (enabled: boolean) => {
    setDevData((prev) => ({
      ...prev,
      bgpConfig: {
        enabled,
        asNumber: prev.bgpConfig?.asNumber || 65001,
        routerId: prev.bgpConfig?.routerId || '1.1.1.1',
        neighbors: prev.bgpConfig?.neighbors || [],
        advertisedNetworks: prev.bgpConfig?.advertisedNetworks || ['192.168.1.0/24'],
      },
    }));
  };

  // CLI Command processing
  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmd = cliInput.trim();
    const prompt = getInitialPrompt();
    const newLogs = [...cliHistory, `${prompt}${cmd}`];

    const lower = cmd.toLowerCase();

    if (lower === 'help' || lower === '?') {
      newLogs.push('Perintah yang didukung:');
      newLogs.push('  ipconfig / ifconfig         - Tampilkan informasi antarmuka & IP');
      newLogs.push('  show ip route               - Tampilkan tabel rute IPv4');
      newLogs.push('  show ip ospf neighbor       - Tampilkan status tetangga OSPF');
      newLogs.push('  show ip bgp summary         - Tampilkan status peering BGP');
      newLogs.push('  show optical power          - Tampilkan daya optik redaman dBm');
      newLogs.push('  ping <ip>                   - Uji konektivitas ICMP');
      newLogs.push('  clear                       - Bersihkan layar terminal');
    } else if (lower === 'clear' || lower === 'cls') {
      setCliHistory([]);
      setCliInput('');
      return;
    } else if (lower.startsWith('ipconfig') || lower.startsWith('ifconfig') || lower === 'show ip int brief') {
      newLogs.push(`--- Status Port Antarmuka ${devData.name} ---`);
      for (const p of devData.ports) {
        newLogs.push(
          `  ${p.name.padEnd(20)} ${p.isUp ? 'UP  ' : 'DOWN'} ${p.ipAddress || 'Unassigned'} [${p.type}] VLAN:${p.vlanId || 1}`,
        );
      }
    } else if (lower.startsWith('show ip route')) {
      newLogs.push(`Gateway of last resort is not set`);
      newLogs.push(`Codes: C - connected, S - static, O - OSPF, B - BGP`);
      for (const p of devData.ports) {
        if (p.isUp && p.ipAddress) {
          newLogs.push(`C    ${p.ipAddress}/24 is directly connected, ${p.name}`);
        }
      }
      for (const r of devData.routingTable || []) {
        newLogs.push(`S    ${r.network} via ${r.gateway}, ${r.interfaceName}`);
      }
      if (devData.ospfConfig?.enabled) {
        newLogs.push(`O    10.0.0.0/30 [110/10] via OSPF Area ${devData.ospfConfig.areaId}`);
      }
    } else if (lower.startsWith('show ip ospf neighbor')) {
      if (devData.ospfConfig?.enabled) {
        newLogs.push(`Neighbor ID     Pri   State           Dead Time   Address         Interface`);
        newLogs.push(`2.2.2.2           1   FULL/DR         00:00:33    10.0.0.2        Gi0/1`);
      } else {
        newLogs.push(`% OSPF proses tidak aktif pada perangkat ini.`);
      }
    } else if (lower.startsWith('show ip bgp summary')) {
      if (devData.bgpConfig?.enabled) {
        newLogs.push(`BGP router identifier ${devData.bgpConfig.routerId}, local AS number ${devData.bgpConfig.asNumber}`);
        newLogs.push(`Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd`);
        for (const n of devData.bgpConfig.neighbors) {
          const peerIp = (n.neighborIp || n.ipAddress || '0.0.0.0').padEnd(15);
          newLogs.push(`${peerIp} 4 ${n.remoteAs.toString().padEnd(5)}    142     145        1    0    0 02:41:19 ${n.status || n.state || 'Established'}`);
        }
      } else {
        newLogs.push(`% BGP tidak aktif pada perangkat ini.`);
      }
    } else if (lower.startsWith('show optical power')) {
      newLogs.push(`--- Diagnostik SFP & Redaman Optik ---`);
      newLogs.push(`Modul SFP: ${devData.opticalConfig?.sfpModuleType || 'Class B+'}`);
      newLogs.push(`Tx Power : +${devData.opticalConfig?.txPowerDbm || 3.0} dBm`);
      newLogs.push(`Rx Sens  : ${devData.opticalConfig?.rxSensitivityDbm || -27.0} dBm`);
    } else {
      newLogs.push(`% Perintah '${cmd}' tidak dikenali. Ketik 'help' untuk panduan.`);
    }

    setCliHistory(newLogs);
    setCliInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={devData.name}
                  onChange={(e) => setDevData({ ...devData, name: e.target.value })}
                  className="font-bold text-white text-base bg-transparent border-b border-dashed border-slate-600 hover:border-blue-400 focus:border-blue-500 focus:outline-none px-1"
                />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {devData.type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400">Atur parameter jaringan, port, protokol routing, dan layanan perangkat</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 bg-slate-950/60 border-b border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('ports')}
            className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'ports' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Port, IP &amp; VLAN ({devData.ports.length})</span>
          </button>

          {(isRouter || isSwitch) && (
            <button
              onClick={() => setActiveTab('routing')}
              className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-all ${
                activeTab === 'routing' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Routing (OSPF / BGP / Statik)</span>
            </button>
          )}

          {(isRouter || devData.type === 'server') && (
            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-all ${
                activeTab === 'services' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Layanan DHCP Server</span>
            </button>
          )}

          {isOptical && (
            <button
              onClick={() => setActiveTab('ftth')}
              className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-all ${
                activeTab === 'ftth' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>FTTH Serat Optik</span>
            </button>
          )}

          {isIoT && (
            <button
              onClick={() => setActiveTab('iot')}
              className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-all ${
                activeTab === 'iot' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>IoT Telemetri &amp; Otomasi</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'cli' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal CLI</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* TAB 1: PORTS, IP & VLAN */}
          {activeTab === 'ports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span>Daftar antarmuka fisik, IP Address, dan konfigurasi VLAN (802.1Q)</span>
                <span className="font-mono text-[11px]">Status sakelar hijau menandakan port aktif</span>
              </div>

              <div className="space-y-4">
                {devData.ports.map((port) => (
                  <div
                    key={port.id}
                    className={`p-4 rounded-xl border transition-all ${
                      port.isUp ? 'bg-slate-950/70 border-slate-800' : 'bg-red-950/10 border-red-900/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-3 h-3 rounded-full ${port.isUp ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-red-500'}`} />
                        <div>
                          <span className="text-sm font-semibold text-white font-mono">{port.name}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({port.type.replace('_', ' ').toUpperCase()}) • {port.speedMbps} Mbps
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-[11px] text-slate-400 font-mono">MAC: {port.mac}</div>
                        <button
                          type="button"
                          onClick={() => handlePortChange(port.id, { isUp: !port.isUp })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            port.isUp
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/40'
                              : 'bg-red-600/30 text-red-300 border border-red-500/50 hover:bg-red-600/40'
                          }`}
                        >
                          {port.isUp ? 'Status: UP' : 'Status: DOWN'}
                        </button>
                      </div>
                    </div>

                    {/* IP & VLAN Settings */}
                    {port.isUp && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 text-xs">
                        {/* Assignment Method */}
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Metode IP</label>
                          <select
                            value={port.ipAssignment}
                            onChange={(e) => handlePortChange(port.id, { ipAssignment: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="static">Statik</option>
                            <option value="dhcp">DHCP Otomatis</option>
                            <option value="none">Tidak Ada (Switch / L2)</option>
                          </select>
                        </div>

                        {/* IP Address */}
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Alamat IP (IPv4)</label>
                          <input
                            type="text"
                            placeholder="192.168.1.10"
                            disabled={port.ipAssignment !== 'static'}
                            value={port.ipAddress || ''}
                            onChange={(e) => handlePortChange(port.id, { ipAddress: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-50 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Subnet Mask */}
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Subnet Mask</label>
                          <input
                            type="text"
                            placeholder="255.255.255.0"
                            disabled={port.ipAssignment !== 'static'}
                            value={port.subnetMask || ''}
                            onChange={(e) => handlePortChange(port.id, { subnetMask: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-50 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Default Gateway */}
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Default Gateway</label>
                          <input
                            type="text"
                            placeholder="192.168.1.1"
                            disabled={port.ipAssignment !== 'static'}
                            value={port.defaultGateway || ''}
                            onChange={(e) => handlePortChange(port.id, { defaultGateway: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-50 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* VLAN Configuration (For Switches & End devices) */}
                        <div className="sm:col-span-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <label className="block text-slate-300 font-semibold mb-1">Mode Port VLAN (802.1Q)</label>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`vlan_mode_${port.id}`}
                                checked={port.vlanMode !== 'trunk'}
                                onChange={() => handlePortChange(port.id, { vlanMode: 'access' })}
                                className="accent-blue-500"
                              />
                              <span>Access (Untagged)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`vlan_mode_${port.id}`}
                                checked={port.vlanMode === 'trunk'}
                                onChange={() => handlePortChange(port.id, { vlanMode: 'trunk' })}
                                className="accent-blue-500"
                              />
                              <span>Trunk (Tagged 802.1Q)</span>
                            </label>
                          </div>
                        </div>

                        {/* VLAN ID input */}
                        <div className="sm:col-span-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          {port.vlanMode === 'trunk' ? (
                            <div>
                              <label className="block text-slate-300 font-semibold mb-1">Allowed Trunk VLANs</label>
                              <input
                                type="text"
                                placeholder="1, 10, 20, 30"
                                value={(port.trunkAllowedVlans || [1, 10, 20]).join(', ')}
                                onChange={(e) => {
                                  const vlans = e.target.value
                                    .split(',')
                                    .map((v) => parseInt(v.trim(), 10))
                                    .filter((v) => !isNaN(v));
                                  handlePortChange(port.id, { trunkAllowedVlans: vlans });
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-slate-300 font-semibold mb-1">VLAN ID (1-4094)</label>
                              <input
                                type="number"
                                min="1"
                                max="4094"
                                value={port.vlanId || 1}
                                onChange={(e) => handlePortChange(port.id, { vlanId: parseInt(e.target.value, 10) || 1 })}
                                className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ROUTING (OSPF & BGP & STATIK) */}
          {activeTab === 'routing' && (
            <div className="space-y-6">
              {/* OSPF Configuration Section */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-bold text-white">Open Shortest Path First (OSPF v2)</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!devData.ospfConfig?.enabled}
                      onChange={(e) => handleToggleOSPF(e.target.checked)}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-slate-300">Aktifkan OSPF</span>
                  </label>
                </div>

                {devData.ospfConfig?.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">OSPF Process ID</label>
                      <input
                        type="number"
                        value={devData.ospfConfig.processId}
                        onChange={(e) =>
                          setDevData({
                            ...devData,
                            ospfConfig: { ...devData.ospfConfig!, processId: parseInt(e.target.value, 10) || 1 },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Router-ID</label>
                      <input
                        type="text"
                        value={devData.ospfConfig.routerId}
                        onChange={(e) =>
                          setDevData({
                            ...devData,
                            ospfConfig: { ...devData.ospfConfig!, routerId: e.target.value },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">OSPF Area ID (0 = Backbone)</label>
                      <input
                        type="number"
                        value={devData.ospfConfig.areaId}
                        onChange={(e) =>
                          setDevData({
                            ...devData,
                            ospfConfig: { ...devData.ospfConfig!, areaId: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* BGP Configuration Section */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">Border Gateway Protocol (BGP-4)</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!devData.bgpConfig?.enabled}
                      onChange={(e) => handleToggleBGP(e.target.checked)}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-slate-300">Aktifkan BGP</span>
                  </label>
                </div>

                {devData.bgpConfig?.enabled && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Autonomous System (AS Number)</label>
                        <input
                          type="number"
                          value={devData.bgpConfig.asNumber}
                          onChange={(e) =>
                            setDevData({
                              ...devData,
                              bgpConfig: { ...devData.bgpConfig!, asNumber: parseInt(e.target.value, 10) || 65001 },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">BGP Router-ID</label>
                        <input
                          type="text"
                          value={devData.bgpConfig.routerId}
                          onChange={(e) =>
                            setDevData({
                              ...devData,
                              bgpConfig: { ...devData.bgpConfig!, routerId: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Jaringan yang Di-advertise</label>
                      <input
                        type="text"
                        placeholder="192.168.1.0/24, 10.0.0.0/8"
                        value={(devData.bgpConfig.advertisedNetworks || []).join(', ')}
                        onChange={(e) => {
                          const nets = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setDevData({
                            ...devData,
                            bgpConfig: { ...devData.bgpConfig!, advertisedNetworks: nets },
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Static Routes Table */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-white">Tabel Rute Statik (Static Routes)</h3>
                  <button
                    onClick={handleAddRoute}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Rute
                  </button>
                </div>

                <div className="space-y-2">
                  {(devData.routingTable || []).map((route) => (
                    <div key={route.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs items-center">
                      <input
                        type="text"
                        value={route.network}
                        onChange={(e) => {
                          const updated = devData.routingTable!.map((r) => (r.id === route.id ? { ...r, network: e.target.value } : r));
                          setDevData({ ...devData, routingTable: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                        placeholder="192.168.2.0"
                      />
                      <input
                        type="text"
                        value={route.netmask}
                        onChange={(e) => {
                          const updated = devData.routingTable!.map((r) => (r.id === route.id ? { ...r, netmask: e.target.value } : r));
                          setDevData({ ...devData, routingTable: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                        placeholder="255.255.255.0"
                      />
                      <input
                        type="text"
                        value={route.gateway}
                        onChange={(e) => {
                          const updated = devData.routingTable!.map((r) => (r.id === route.id ? { ...r, gateway: e.target.value } : r));
                          setDevData({ ...devData, routingTable: updated });
                        }}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                        placeholder="10.0.0.2"
                      />
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleRemoveRoute(route.id)}
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SERVICES (DHCP) */}
          {activeTab === 'services' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Layanan DHCP Server</h3>
                  <p className="text-xs text-slate-400">Menyediakan penyewaan alamat IP otomatis untuk klien di broadcast domain</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!devData.dhcpServer?.enabled}
                    onChange={(e) => {
                      setDevData({
                        ...devData,
                        dhcpServer: {
                          enabled: e.target.checked,
                          interfaceName: devData.ports[0]?.name || 'GigabitEthernet0/1',
                          network: '192.168.1.0',
                          netmask: '255.255.255.0',
                          rangeStart: '192.168.1.10',
                          rangeEnd: '192.168.1.100',
                          gateway: '192.168.1.1',
                          dns: '8.8.8.8',
                          leaseTimeHours: 24,
                        },
                      });
                    }}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-300">Aktifkan DHCP</span>
                </label>
              </div>

              {devData.dhcpServer?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Antarmuka Distribusi</label>
                    <select
                      value={devData.dhcpServer.interfaceName}
                      onChange={(e) =>
                        setDevData({
                          ...devData,
                          dhcpServer: { ...devData.dhcpServer!, interfaceName: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      {devData.ports.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Awal Rentang IP (Start)</label>
                    <input
                      type="text"
                      value={devData.dhcpServer.rangeStart}
                      onChange={(e) =>
                        setDevData({
                          ...devData,
                          dhcpServer: { ...devData.dhcpServer!, rangeStart: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Akhir Rentang IP (End)</label>
                    <input
                      type="text"
                      value={devData.dhcpServer.rangeEnd}
                      onChange={(e) =>
                        setDevData({
                          ...devData,
                          dhcpServer: { ...devData.dhcpServer!, rangeEnd: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Default Gateway Klien</label>
                    <input
                      type="text"
                      value={devData.dhcpServer.gateway}
                      onChange={(e) =>
                        setDevData({
                          ...devData,
                          dhcpServer: { ...devData.dhcpServer!, gateway: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">DNS Server</label>
                    <input
                      type="text"
                      value={devData.dhcpServer.dns}
                      onChange={(e) =>
                        setDevData({
                          ...devData,
                          dhcpServer: { ...devData.dhcpServer!, dns: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FTTH OPTICAL */}
          {activeTab === 'ftth' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  Konfigurasi Fisik Serat Optik &amp; Power Budget FTTH
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {devData.type === 'olt' ? (
                  <>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Tipe Modul SFP PON</label>
                      <select
                        value={devData.opticalConfig?.sfpModuleType || 'class_b_plus'}
                        onChange={(e) => {
                          const type = e.target.value;
                          const tx = type === 'class_c_plus' ? +5.0 : type === 'class_c_plus_plus' ? +7.0 : +2.5;
                          setDevData({
                            ...devData,
                            opticalConfig: {
                              ...devData.opticalConfig,
                              sfpModuleType: type as any,
                              txPowerDbm: tx,
                              rxSensitivityDbm: -28.0,
                            },
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      >
                        <option value="class_b_plus">SFP Class B+ (Tx: +2.5 dBm, Rx: -28 dBm)</option>
                        <option value="class_c_plus">SFP Class C+ (Tx: +5.0 dBm, Rx: -32 dBm)</option>
                        <option value="class_c_plus_plus">SFP Class C++ (Tx: +7.0 dBm, Rx: -35 dBm)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Daya Pancar Laser (Tx Power)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={devData.opticalConfig?.txPowerDbm || 2.5}
                        onChange={(e) =>
                          setDevData({
                            ...devData,
                            opticalConfig: {
                              ...devData.opticalConfig,
                              txPowerDbm: parseFloat(e.target.value) || 2.5,
                              rxSensitivityDbm: devData.opticalConfig?.rxSensitivityDbm || -28.0,
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Rasio Splitter Optik</label>
                      <select
                        value={devData.opticalConfig?.splitRatio || '1:4'}
                        onChange={(e) =>
                          setDevData({
                            ...devData,
                            opticalConfig: {
                              ...devData.opticalConfig,
                              splitRatio: e.target.value as any,
                              txPowerDbm: devData.opticalConfig?.txPowerDbm || 0,
                              rxSensitivityDbm: devData.opticalConfig?.rxSensitivityDbm || -27.0,
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      >
                        <option value="1:2">Splitter 1:2 (Loss: ~3.5 dB)</option>
                        <option value="1:4">Splitter 1:4 (Loss: ~7.2 dB)</option>
                        <option value="1:8">Splitter 1:8 (Loss: ~10.5 dB)</option>
                        <option value="1:16">Splitter 1:16 (Loss: ~13.8 dB)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Batas Sensitivitas Rx ONT (dBm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={devData.opticalConfig?.rxSensitivityDbm || -27.0}
                        onChange={(e) =>
                          setDevData({
                            ...devData,
                            opticalConfig: {
                              ...devData.opticalConfig,
                              rxSensitivityDbm: parseFloat(e.target.value) || -27.0,
                              txPowerDbm: devData.opticalConfig?.txPowerDbm || 0,
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: IOT TELEMETRY */}
          {activeTab === 'iot' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  Telemetri Sensor &amp; Aturan Otomasi Cerdas
                </h3>
              </div>

              {/* Sensor adjustment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-400 font-medium">Simulasi Suhu Lingkungan (°C)</label>
                    <span className="font-mono font-bold text-amber-400">
                      {devData.iotTelemetry?.tempCelsius || 28}°C
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="0.5"
                    value={devData.iotTelemetry?.tempCelsius || 28}
                    onChange={(e) =>
                      setDevData({
                        ...devData,
                        iotTelemetry: {
                          ...devData.iotTelemetry,
                          deviceCategory: devData.iotTelemetry?.deviceCategory || 'sensor',
                          tempCelsius: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Status Saklar Pintar (Smart Plug)</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDevData({
                          ...devData,
                          iotTelemetry: {
                            ...devData.iotTelemetry,
                            deviceCategory: 'actuator',
                            plugState: devData.iotTelemetry?.plugState === 'ON' ? 'OFF' : 'ON',
                            powerWatt: devData.iotTelemetry?.plugState === 'ON' ? 0 : 850,
                          },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        devData.iotTelemetry?.plugState === 'ON'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Saklar: {devData.iotTelemetry?.plugState || 'OFF'}
                    </button>
                    <span className="font-mono text-slate-300">
                      Daya: {devData.iotTelemetry?.plugState === 'ON' ? '850 Watt' : '0 Watt'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TERMINAL CLI */}
          {activeTab === 'cli' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-72 overflow-y-auto custom-scrollbar flex flex-col justify-between">
                <div className="space-y-1 select-text">
                  {cliHistory.map((line, i) => (
                    <div key={i} className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleRunCommand} className="flex items-center gap-2">
                <span className="text-slate-400 font-bold shrink-0">{getInitialPrompt()}</span>
                <input
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder="Ketik perintah (contoh: ipconfig, show ip route, show optical power)..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shrink-0"
                >
                  Kirim
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
};
