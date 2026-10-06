import React, { useState } from 'react';
import {
  X,
  Power,
  Trash2,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Sliders,
  ShieldCheck,
  Globe,
  Wifi,
  Lock,
  Tag,
  Gauge,
  Video,
  Radio,
  Share2,
  Layers,
  Cpu,
  Compass,
  Plus,
  Minus,
  ArrowRightLeft,
  Zap,
  Cable,
  Shield,
  HardDrive,
  Laptop,
  Printer,
  Phone,
  Sparkles,
  Bot,
} from 'lucide-react';
import type { NetworkNode, CableConnection, PortMedium } from '../types/network';
import { DEVICE_METADATA } from '../data/deviceDefinitions';
import { DEVICE_BRANDS } from '../data/deviceBrands';
import type { OpticalCalculationResult } from '../utils/opticalCalculator';
import { cablesOnPort, portCapacity } from '../utils/portReconcile';
import { SPLITTER_LOSS_MAP } from '../utils/opticalCalculator';
import { findUpstreamGateway, isSameSubnet, isValidIpv4, checkInternetAccess } from '../utils/ipUtils';
import { allocateDhcpLease, allocateStaticHost, lanDefaultsFor } from '../utils/ipAlloc';

interface NodeInspectorProps {
  node: NetworkNode;
  onClose: () => void;
  onUpdateNode: (updated: NetworkNode) => void;
  onDeleteNode: (nodeId: string) => void;
  opticalResult?: OpticalCalculationResult;
  onOpenTerminal?: (nodeId: string) => void;
  connectedCables: CableConnection[];
  allNodes?: NetworkNode[];
  allCables?: CableConnection[];
  onDisconnectCable?: (cableId: string) => void;
  onSelectCable?: (cableId: string) => void;
  onOpenAiChat?: (prompt?: string) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  onClose,
  onUpdateNode,
  onDeleteNode,
  opticalResult,
  onOpenTerminal,
  connectedCables,
  allNodes = [],
  allCables = [],
  onDisconnectCable,
  onSelectCable,
  onOpenAiChat,
}) => {
  const meta = DEVICE_METADATA[node.type];
  const brandList = DEVICE_BRANDS[node.type] || [];

  const upstreamGateway = findUpstreamGateway(node, allNodes, allCables);
  const routerLanIp =
    upstreamGateway?.type === 'ont'
      ? upstreamGateway.ontConfig?.lanIp || upstreamGateway.ipConfig?.ip || '192.168.1.1'
      : upstreamGateway?.ipConfig?.ip || '192.168.88.1';
  const routerSubnet =
    upstreamGateway?.type === 'ont'
      ? upstreamGateway.ontConfig?.lanSubnet || upstreamGateway.ipConfig?.subnet || '255.255.255.0'
      : upstreamGateway?.ipConfig?.subnet || '255.255.255.0';

  const isGatewayMismatch =
    node.ipConfig?.mode === 'static' &&
    Boolean(upstreamGateway) &&
    Boolean(node.ipConfig?.gateway) &&
    node.ipConfig.gateway !== routerLanIp;

  const isSubnetMismatch =
    node.ipConfig?.mode === 'static' &&
    Boolean(node.ipConfig?.ip) &&
    Boolean(node.ipConfig?.gateway) &&
    isValidIpv4(node.ipConfig.ip) &&
    isValidIpv4(node.ipConfig.gateway) &&
    node.ipConfig.gateway !== '0.0.0.0' &&
    !isSameSubnet(node.ipConfig.ip, node.ipConfig.gateway, node.ipConfig.subnet || '255.255.255.0');

  const isIpOutsideRouterSubnet =
    node.ipConfig?.mode === 'static' &&
    Boolean(upstreamGateway) &&
    Boolean(node.ipConfig?.ip) &&
    isValidIpv4(node.ipConfig.ip) &&
    !isSameSubnet(node.ipConfig.ip, routerLanIp, routerSubnet);

  const isUpstreamOntBridge =
    upstreamGateway?.type === 'ont' && upstreamGateway.ontConfig?.wanMode === 'bridge';

  const isDhcpServerOff =
    upstreamGateway?.type === 'ont'
      ? upstreamGateway.ontConfig?.dhcpServerEnabled === false ||
        (upstreamGateway.ipConfig?.isDhcpServerEnabled === false && upstreamGateway.ontConfig?.dhcpServerEnabled === undefined)
      : upstreamGateway?.type === 'mikrotik'
      ? upstreamGateway.ipConfig?.isDhcpServerEnabled === false
      : false;

  const connectedClientNodes =
    node.type === 'ont'
      ? allNodes.filter(
          (n) =>
            ['pc', 'laptop', 'printer', 'voip_phone', 'cctv', 'smartphone', 'iot', 'server'].includes(n.type) &&
            findUpstreamGateway(n, allNodes, allCables)?.id === node.id
        )
      : [];

  const internetStatus = checkInternetAccess(node, allNodes, allCables);

  const [activeTab, setActiveTab] = useState<'config' | 'telemetry' | 'hardware' | 'sop'>('config');
  const [showAddPortDropdown, setShowAddPortDropdown] = useState(false);
  const [speedtestRunning, setSpeedtestRunning] = useState(false);
  const [speedtestResult, setSpeedtestResult] = useState<{
    down: number;
    up: number;
    ping: number;
    failed?: boolean;
    error?: string;
  } | null>(null);

  const handleAddPort = (medium: PortMedium) => {
    const mediumName =
      medium === 'ethernet'
        ? 'LAN'
        : medium === 'fiber'
        ? 'Optik'
        : medium === 'coaxial'
        ? 'Coax'
        : 'Wi-Fi';
    const sameMediumCount = node.ports.filter((p) => p.medium === medium).length;
    const newPort = {
      id: `p-${node.id}-${Date.now().toString(36)}`,
      name: `${mediumName} ${sameMediumCount + 1}`,
      medium,
      status: 'up' as const,
    };
    onUpdateNode({
      ...node,
      ports: [...node.ports, newPort],
    });
    setShowAddPortDropdown(false);
  };

  const handleRemovePort = (portId: string) => {
    onUpdateNode({
      ...node,
      ports: node.ports.filter((p) => p.id !== portId),
    });
  };

  const handleTogglePower = () => {
    onUpdateNode({
      ...node,
      poweredOn: !node.poweredOn,
      status: !node.poweredOn ? 'online' : 'offline',
    });
  };

  const handleBrandChange = (newBrand: string) => {
    const brandData = brandList.find((b) => b.brand === newBrand);
    const defaultModel = brandData?.models[0] || `${newBrand} Device`;
    onUpdateNode({
      ...node,
      brand: newBrand,
      model: defaultModel,
      label: defaultModel,
      name: `${node.name.split('(')[0].trim()} (${newBrand})`,
    });
  };

  const handleModelChange = (newModel: string) => {
    onUpdateNode({
      ...node,
      model: newModel,
      label: newModel,
    });
  };

  const handleIpChange = (field: string, value: string) => {
    onUpdateNode({
      ...node,
      ipConfig: {
        mode: node.ipConfig?.mode ?? 'static',
        ip: node.ipConfig?.ip ?? '',
        subnet: node.ipConfig?.subnet ?? '255.255.255.0',
        gateway: node.ipConfig?.gateway ?? '',
        dns: node.ipConfig?.dns ?? '8.8.8.8',
        isDhcpServerEnabled: node.ipConfig?.isDhcpServerEnabled ?? false,
        [field]: value,
      },
    });
  };

  const runSpeedtest = () => {
    setSpeedtestRunning(true);
    setSpeedtestResult(null);
    setTimeout(() => {
      setSpeedtestRunning(false);
      if (!internetStatus.hasInternet) {
        setSpeedtestResult({
          down: 0,
          up: 0,
          ping: 0,
          failed: true,
          error: internetStatus.reason || 'Koneksi Internet Terputus / Tidak Ada Gateway Routing',
        });
      } else {
        setSpeedtestResult({
          down: Math.floor(Math.random() * 45) + 50, // 50 - 95 Mbps
          up: Math.floor(Math.random() * 25) + 20,
          ping: Math.floor(Math.random() * 6) + 4,
          failed: false,
        });
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] border-l border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/90">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 font-bold text-xs shadow-2xs">
            {node.type.slice(0, 3).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight truncate max-w-[240px]">
              {node.name}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <span className="font-semibold text-sky-800">{node.brand || 'Standar'}</span>
              <span>·</span>
              <span className="truncate max-w-[180px]">{node.model || meta.name}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 bg-white px-3 py-1.5 gap-1">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all text-center ${
            activeTab === 'config'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Konfigurasi
        </button>
        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all text-center ${
            activeTab === 'hardware'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Merk & Model
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all text-center ${
            activeTab === 'telemetry'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Status & Port
        </button>
        <button
          onClick={() => setActiveTab('sop')}
          className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all text-center ${
            activeTab === 'sop'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          SOP & Edukasi
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Power Toggle & Quick Status */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleTogglePower}
              className={`p-2 rounded-lg transition-colors ${
                node.poweredOn
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
              title={node.poweredOn ? 'Matikan Daya Perangkat' : 'Nyalakan Daya Perangkat'}
            >
              <Power className="h-4 w-4" />
            </button>
            <div>
              <div className="font-semibold text-slate-800">
                Power: {node.poweredOn ? 'Menyala (ON)' : 'Mati (OFF)'}
              </div>
              <div className="text-[10.5px] text-slate-500">
                {connectedCables.length} kabel fisik terpasang
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenAiChat && (
              <button
                onClick={() =>
                  onOpenAiChat(
                    `Lakukan diagnosa teknis dan berikan rekomendasi konfigurasi optimal untuk perangkat "${node.name}" (Tipe: ${node.type}, Merk/Model: "${node.brand || ''} ${node.model || ''}").\n- Konfigurasi IP: ${node.ipConfig?.ip || 'Tidak ada'} / ${node.ipConfig?.subnet || '-'}\n- Gateway: ${node.ipConfig?.gateway || '-'}\n- Redaman Optik Rx: ${opticalResult?.rxPowerDbm !== undefined && opticalResult?.rxPowerDbm !== null ? `${opticalResult.rxPowerDbm.toFixed(2)} dBm` : 'N/A'}\n- Kabel terhubung: ${connectedCables.length} kabel fisik.`
                  )
                }
                className="flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 hover:border-sky-400 transition-colors shadow-2xs"
                title="Tanyakan rekomendasi konfigurasi dan troubleshooting perangkat ini ke AI"
              >
                <Bot className="h-3.5 w-3.5 text-sky-600" />
                <span>Analisa AI</span>
              </button>
            )}

            {['pc', 'mikrotik', 'server'].includes(node.type) && onOpenTerminal && (
              <button
                onClick={() => onOpenTerminal(node.id)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-2xs"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Buka Terminal</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: HARDWARE & BRAND SELECTOR */}
        {activeTab === 'hardware' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Brand selector */}
            <div className="space-y-1.5 rounded-xl border border-slate-200 p-3 bg-white">
              <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-sky-600" />
                <span>Pilih Merk Pabrikan (Brand)</span>
              </label>

              {brandList.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {brandList.map((b) => (
                    <button
                      key={b.brand}
                      onClick={() => handleBrandChange(b.brand)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                        (node.brand || brandList[0]?.brand) === b.brand
                          ? 'border-sky-600 bg-sky-50 text-sky-900 shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {b.brand}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={node.brand || ''}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  placeholder="Ketik merk perangkat..."
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                />
              )}
            </div>

            {/* Model Selector */}
            <div className="space-y-1.5 rounded-xl border border-slate-200 p-3 bg-white">
              <label className="text-[11px] font-bold text-slate-800">
                Pilih Seri / Tipe Model Perangkat
              </label>

              {(() => {
                const currentBrandObj = brandList.find(
                  (b) => b.brand === (node.brand || brandList[0]?.brand)
                );
                if (currentBrandObj && currentBrandObj.models.length > 0) {
                  return (
                    <div className="space-y-1 pt-1">
                      {currentBrandObj.models.map((mod) => (
                        <button
                          key={mod}
                          onClick={() => handleModelChange(mod)}
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border text-left transition-all flex items-center justify-between ${
                            node.model === mod || (!node.model && mod === currentBrandObj.models[0])
                              ? 'border-sky-600 bg-sky-50 font-bold text-sky-900'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{mod}</span>
                          {(node.model === mod || (!node.model && mod === currentBrandObj.models[0])) && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0 ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  );
                } else {
                  return (
                    <input
                      type="text"
                      value={node.model || ''}
                      onChange={(e) => handleModelChange(e.target.value)}
                      placeholder="Masukkan seri model..."
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                    />
                  );
                }
              })()}
            </div>
          </div>
        )}

        {/* TAB 2: REALISTIC CONFIGURATION */}
        {activeTab === 'config' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Real-time Internet Connectivity Banner for Client Devices */}
            {['pc', 'cctv', 'smartphone', 'iot', 'server'].includes(node.type) && (
              <div
                className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs transition-all shadow-2xs ${
                  internetStatus.hasInternet
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                {internetStatus.hasInternet ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {internetStatus.hasInternet
                        ? 'Status Internet: TERHUBUNG (Normal)'
                        : 'Status Internet: TERPUTUS (OFFLINE)'}
                    </span>
                    <span
                      className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold ${
                        internetStatus.hasInternet
                          ? 'bg-emerald-200/80 text-emerald-800'
                          : 'bg-rose-200 text-rose-800'
                      }`}
                    >
                      {internetStatus.hasInternet ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight opacity-90">
                    {internetStatus.hasInternet
                      ? `Perangkat berhasil terhubung ke gateway rute ${upstreamGateway?.name || 'Router'} (${routerLanIp}) dengan akses internet WAN aktif.`
                      : internetStatus.reason}
                  </p>
                </div>
              </div>
            )}

            {/* REAL ONT (MODEM) WEB GUI SIMULATION */}
            {node.type === 'ont' && (
              <div className="space-y-3.5">
                {/* 1. WAN CONFIGURATION CARD */}
                <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                    <div className="font-bold text-sky-900 text-xs flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-sky-600" />
                      <span>1. Konfigurasi WAN (Uplink OLT / ISP)</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      {node.brand || 'ZTE'} {node.model || 'F609'}
                    </span>
                  </div>

                  {/* WAN Connection Type Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-700">Mode Koneksi WAN:</label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['pppoe', 'dhcp', 'static', 'bridge'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            const isBridge = mode === 'bridge';
                            onUpdateNode({
                              ...node,
                              ontConfig: {
                                brand: node.brand || 'ZTE',
                                model: node.model || 'F609',
                                wanMode: mode,
                                pppoeUsername: node.ontConfig?.pppoeUsername || '1223456789@telkom.net',
                                pppoePassword: node.ontConfig?.pppoePassword || '••••••••',
                                vlanId: node.ontConfig?.vlanId || 1049,
                                staticWanIp: node.ontConfig?.staticWanIp || '10.10.0.15',
                                staticWanSubnet: node.ontConfig?.staticWanSubnet || '255.255.255.0',
                                staticWanGateway: node.ontConfig?.staticWanGateway || '10.10.0.1',
                                staticWanDns: node.ontConfig?.staticWanDns || '8.8.8.8',
                                lanIp: node.ontConfig?.lanIp || node.ipConfig?.ip || '192.168.1.1',
                                lanSubnet: node.ontConfig?.lanSubnet || node.ipConfig?.subnet || '255.255.255.0',
                                dhcpServerEnabled: isBridge ? false : (node.ontConfig?.dhcpServerEnabled ?? true),
                                dhcpPoolStart: node.ontConfig?.dhcpPoolStart || '192.168.1.2',
                                dhcpPoolEnd: node.ontConfig?.dhcpPoolEnd || '192.168.1.254',
                                wifiSsid: node.ontConfig?.wifiSsid || 'Wi-Fi-Rumah-5G',
                              },
                              ipConfig: {
                                mode: 'static',
                                ip: node.ontConfig?.lanIp || node.ipConfig?.ip || '192.168.1.1',
                                subnet: node.ontConfig?.lanSubnet || node.ipConfig?.subnet || '255.255.255.0',
                                gateway: node.ontConfig?.staticWanGateway || '10.10.0.1',
                                dns: '8.8.8.8',
                                isDhcpServerEnabled: isBridge ? false : (node.ontConfig?.dhcpServerEnabled ?? true),
                              },
                            });
                          }}
                          className={`py-1 text-[10.5px] font-bold rounded border text-center transition-all ${
                            (node.ontConfig?.wanMode || 'pppoe') === mode
                              ? 'border-sky-600 bg-sky-600 text-white shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode 1: PPPoE Credentials */}
                  {(node.ontConfig?.wanMode || 'pppoe') === 'pppoe' && (
                    <div className="space-y-2 rounded-lg bg-white p-2.5 border border-sky-100 text-xs">
                      <div className="text-[10px] font-bold text-sky-800 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        <span>Autentikasi PPPoE Client ISP:</span>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600">PPPoE Username / Nomor Internet:</label>
                        <input
                          type="text"
                          value={node.ontConfig?.pppoeUsername || '1223456789@telkom.net'}
                          onChange={(e) =>
                            onUpdateNode({
                              ...node,
                              ontConfig: {
                                ...node.ontConfig,
                                brand: node.brand || 'ZTE',
                                model: node.model || 'F609',
                                wanMode: 'pppoe',
                                pppoeUsername: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600">Password PPPoE:</label>
                          <input
                            type="password"
                            value={node.ontConfig?.pppoePassword || 'password123'}
                            onChange={(e) =>
                              onUpdateNode({
                                ...node,
                                ontConfig: {
                                  ...node.ontConfig,
                                  brand: node.brand || 'ZTE',
                                  model: node.model || 'F609',
                                  wanMode: 'pppoe',
                                  pppoePassword: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600">VLAN ID (Internet):</label>
                          <input
                            type="number"
                            value={node.ontConfig?.vlanId || 1049}
                            onChange={(e) =>
                              onUpdateNode({
                                ...node,
                                ontConfig: {
                                  ...node.ontConfig,
                                  brand: node.brand || 'ZTE',
                                  model: node.model || 'F609',
                                  wanMode: 'pppoe',
                                  vlanId: parseInt(e.target.value) || 1049,
                                },
                              })
                            }
                            className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: DHCP (IPoE Dynamic) */}
                  {node.ontConfig?.wanMode === 'dhcp' && (
                    <div className="space-y-2 rounded-lg bg-white p-2.5 border border-sky-100 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Mode IPoE Dynamic (DHCP Client WAN)</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        ONT meminta konfigurasi IP WAN secara otomatis dari DHCP Server BRAS/OLT ISP tanpa perlu login username PPPoE.
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-sans">IP WAN Otomatis:</span>
                          <span className="font-bold text-sky-800">10.10.0.15</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-sans">Gateway ISP:</span>
                          <span className="font-bold text-slate-700">10.10.0.1</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-sans">Subnet Mask:</span>
                          <span className="font-bold text-slate-700">255.255.255.0</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-sans">DNS Utama:</span>
                          <span className="font-bold text-slate-700">8.8.8.8</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: Static WAN Configuration */}
                  {node.ontConfig?.wanMode === 'static' && (
                    <div className="space-y-2 rounded-lg bg-white p-2.5 border border-sky-100 text-xs">
                      <div className="flex items-center gap-1.5 text-sky-900 font-bold text-[11px]">
                        <Sliders className="h-3.5 w-3.5 text-sky-600" />
                        <span>Konfigurasi IP Statik WAN (ISP Dedikasi / Corporate)</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Digunakan jika ISP memberikan alokasi IP Publik statik khusus (bukan dynamic/PPPoE).
                      </p>
                      <div className="space-y-1.5 pt-1">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600">IP Address WAN Publik:</label>
                          <input
                            type="text"
                            value={node.ontConfig?.staticWanIp || '10.10.0.15'}
                            onChange={(e) =>
                              onUpdateNode({
                                ...node,
                                ontConfig: {
                                  ...node.ontConfig,
                                  brand: node.brand || 'ZTE',
                                  model: node.model || 'F609',
                                  wanMode: 'static',
                                  staticWanIp: e.target.value,
                                },
                              })
                            }
                            placeholder="10.10.0.15"
                            className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-600">Subnet Mask:</label>
                            <input
                              type="text"
                              value={node.ontConfig?.staticWanSubnet || '255.255.255.0'}
                              onChange={(e) =>
                                onUpdateNode({
                                  ...node,
                                  ontConfig: {
                                    ...node.ontConfig,
                                    brand: node.brand || 'ZTE',
                                    model: node.model || 'F609',
                                    wanMode: 'static',
                                    staticWanSubnet: e.target.value,
                                  },
                                })
                              }
                              placeholder="255.255.255.0"
                              className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-600">Gateway ISP:</label>
                            <input
                              type="text"
                              value={node.ontConfig?.staticWanGateway || '10.10.0.1'}
                              onChange={(e) =>
                                onUpdateNode({
                                  ...node,
                                  ontConfig: {
                                    ...node.ontConfig,
                                    brand: node.brand || 'ZTE',
                                    model: node.model || 'F609',
                                    wanMode: 'static',
                                    staticWanGateway: e.target.value,
                                  },
                                })
                              }
                              placeholder="10.10.0.1"
                              className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600">DNS Server:</label>
                          <input
                            type="text"
                            value={node.ontConfig?.staticWanDns || '8.8.8.8'}
                            onChange={(e) =>
                              onUpdateNode({
                                ...node,
                                ontConfig: {
                                  ...node.ontConfig,
                                  brand: node.brand || 'ZTE',
                                  model: node.model || 'F609',
                                  wanMode: 'static',
                                  staticWanDns: e.target.value,
                                },
                              })
                            }
                            placeholder="8.8.8.8"
                            className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 4: Bridge Mode */}
                  {node.ontConfig?.wanMode === 'bridge' && (
                    <div className="space-y-2 rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-xs">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Mode Bridge Transparan (Layer 2) - Router & NAT Nonaktif</span>
                      </div>
                      <p className="text-[10.5px] text-amber-900/90 leading-relaxed">
                        ONT hanya bertindak sebagai konverter optik-ke-tembaga Layer 2. Dial PPPoE, alokasi IP, NAT, dan firewall <b>TIDAK DIJALANKAN OLEH ONT</b>.
                      </p>
                      <div className="rounded bg-white p-2 border border-amber-200 text-[10px] space-y-1">
                        <div className="font-bold text-rose-700 flex items-center gap-1">
                          <span>⚠️ Dampak ke Klien Langsung (PC / CCTV):</span>
                        </div>
                        <p className="text-slate-600 leading-snug">
                          Klien yang terhubung langsung ke port LAN ONT <b>TIDAK AKAN BISA MENGAKSES INTERNET</b> karena ONT tidak melakukan routing IP. Diperlukan router sekunder (seperti MikroTik RouterOS) untuk melakukan dial PPPoE ke ISP dan membagikan koneksi ke LAN.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. LAN & DHCP SERVER CONFIGURATION CARD (Sisi Klien/Pelanggan) */}
                <div className="rounded-xl border border-sky-200 bg-white p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Server className="h-4 w-4 text-sky-600" />
                      <span>2. Pengaturan LAN & DHCP Server (Sisi Rumah/Klien)</span>
                    </div>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                      Gateway Lokal
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600">IP LAN ONT (Gateway):</label>
                      <input
                        type="text"
                        value={node.ontConfig?.lanIp || node.ipConfig?.ip || '192.168.1.1'}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateNode({
                            ...node,
                            ontConfig: {
                              ...node.ontConfig,
                              brand: node.brand || 'ZTE',
                              model: node.model || 'F609',
                              wanMode: node.ontConfig?.wanMode || 'pppoe',
                              lanIp: val,
                            },
                            ipConfig: {
                              mode: 'static',
                              ip: val,
                              subnet: node.ontConfig?.lanSubnet || node.ipConfig?.subnet || '255.255.255.0',
                              gateway: node.ontConfig?.staticWanGateway || '10.10.0.1',
                              dns: '8.8.8.8',
                              isDhcpServerEnabled: node.ontConfig?.dhcpServerEnabled ?? node.ipConfig?.isDhcpServerEnabled ?? true,
                            },
                          });
                        }}
                        placeholder="192.168.1.1"
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600">Subnet Mask LAN:</label>
                      <input
                        type="text"
                        value={node.ontConfig?.lanSubnet || node.ipConfig?.subnet || '255.255.255.0'}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateNode({
                            ...node,
                            ontConfig: {
                              ...node.ontConfig,
                              brand: node.brand || 'ZTE',
                              model: node.model || 'F609',
                              wanMode: node.ontConfig?.wanMode || 'pppoe',
                              lanSubnet: val,
                            },
                            ipConfig: {
                              mode: 'static',
                              ip: node.ontConfig?.lanIp || node.ipConfig?.ip || '192.168.1.1',
                              subnet: val,
                              gateway: node.ontConfig?.staticWanGateway || '10.10.0.1',
                              dns: '8.8.8.8',
                              isDhcpServerEnabled: node.ontConfig?.dhcpServerEnabled ?? node.ipConfig?.isDhcpServerEnabled ?? true,
                            },
                          });
                        }}
                        placeholder="255.255.255.0"
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* DHCP Server Toggle */}
                  <label className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Aktifkan DHCP Server ONT</div>
                      <p className="text-[10px] text-slate-500">Membagikan IP & Gateway otomatis ke PC, CCTV, Smartphone</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.ontConfig?.dhcpServerEnabled ?? node.ipConfig?.isDhcpServerEnabled ?? true}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onUpdateNode({
                          ...node,
                          ontConfig: {
                            ...node.ontConfig,
                            brand: node.brand || 'ZTE',
                            model: node.model || 'F609',
                            wanMode: node.ontConfig?.wanMode || 'pppoe',
                            dhcpServerEnabled: checked,
                          },
                          ipConfig: {
                            mode: 'static',
                            ip: node.ontConfig?.lanIp || node.ipConfig?.ip || '192.168.1.1',
                            subnet: node.ontConfig?.lanSubnet || node.ipConfig?.subnet || '255.255.255.0',
                            gateway: node.ontConfig?.staticWanGateway || '10.10.0.1',
                            dns: '8.8.8.8',
                            isDhcpServerEnabled: checked,
                          },
                        });
                      }}
                      className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                    />
                  </label>

                  {/* DHCP IP Range Pool */}
                  {(node.ontConfig?.dhcpServerEnabled ?? node.ipConfig?.isDhcpServerEnabled ?? true) ? (
                    <div className="space-y-1.5 bg-sky-50/50 p-2.5 rounded-lg border border-sky-100 text-xs">
                      <div className="text-[10.5px] font-bold text-sky-900">Rentang Alamat IP Pool DHCP:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9.5px] text-slate-500">Mulai (Start IP):</label>
                          <input
                            type="text"
                            value={node.ontConfig?.dhcpPoolStart || '192.168.1.2'}
                            onChange={(e) =>
                              onUpdateNode({
                                ...node,
                                ontConfig: {
                                  ...node.ontConfig,
                                  brand: node.brand || 'ZTE',
                                  model: node.model || 'F609',
                                  wanMode: node.ontConfig?.wanMode || 'pppoe',
                                  dhcpPoolStart: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] bg-white text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] text-slate-500">Selesai (End IP):</label>
                          <input
                            type="text"
                            value={node.ontConfig?.dhcpPoolEnd || '192.168.1.254'}
                            onChange={(e) =>
                              onUpdateNode({
                                ...node,
                                ontConfig: {
                                  ...node.ontConfig,
                                  brand: node.brand || 'ZTE',
                                  model: node.model || 'F609',
                                  wanMode: node.ontConfig?.wanMode || 'pppoe',
                                  dhcpPoolEnd: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] bg-white text-slate-800"
                          />
                        </div>
                      </div>
                      <p className="text-[9.5px] text-slate-500 pt-0.5">
                        Klien yang disetel ke "DHCP" akan menerima IP dalam rentang ini dengan Default Gateway: <b>{node.ontConfig?.lanIp || node.ipConfig?.ip || '192.168.1.1'}</b>.
                      </p>

                      {/* Connected Client Leases Counter */}
                      <div className="mt-2 pt-2 border-t border-sky-200/60 flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-600 font-medium">Perangkat Klien Terhubung:</span>
                        <span className="font-bold text-sky-800 bg-white px-2 py-0.5 rounded border border-sky-200">
                          {connectedClientNodes.length} Perangkat Terhubung
                        </span>
                      </div>
                      {connectedClientNodes.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {connectedClientNodes.map((client) => (
                            <div
                              key={client.id}
                              className="flex items-center justify-between text-[10px] bg-white p-1.5 rounded border border-slate-200"
                            >
                              <span className="font-semibold text-slate-700 truncate max-w-[140px]">{client.name}</span>
                              <span className="font-mono text-slate-500">
                                {client.ipConfig?.ip || 'DHCP Req'} ({client.ipConfig?.mode === 'dhcp' ? 'DHCP' : 'Static'})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-[10.5px] text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>DHCP Server Dimatikan (Disabled)</span>
                      </div>
                      <p className="text-[10px] text-amber-800">
                        Klien seperti PC, CCTV, Smartphone tidak akan mendapatkan IP otomatis (APIPA 169.254.x.x). Semua perangkat harus dikonfigurasi dengan IP Statis manual yang satu subnet dengan {node.ontConfig?.lanIp || '192.168.1.1'}.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Wi-Fi SSID Config */}
                <div className="space-y-1.5 rounded-xl border border-sky-200 bg-white p-3.5">
                  <div className="flex items-center gap-1 font-bold text-slate-800 text-xs border-b border-slate-100 pb-1.5">
                    <Wifi className="h-4 w-4 text-sky-600" />
                    <span>3. Pengaturan Wi-Fi (WLAN 2.4GHz / 5GHz)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600">Nama Wi-Fi (SSID):</label>
                      <input
                        type="text"
                        value={node.ontConfig?.wifiSsid || 'Wi-Fi-Rumah-5G'}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            ontConfig: {
                              ...node.ontConfig,
                              brand: node.brand || 'ZTE',
                              model: node.model || 'F609',
                              wanMode: node.ontConfig?.wanMode || 'pppoe',
                              wifiSsid: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-medium text-[11px] text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600">Password Wi-Fi:</label>
                      <input
                        type="text"
                        value={node.ontConfig?.wifiPassword || 'admin12345'}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            ontConfig: {
                              ...node.ontConfig,
                              brand: node.brand || 'ZTE',
                              model: node.model || 'F609',
                              wanMode: node.ontConfig?.wanMode || 'pppoe',
                              wifiPassword: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* REAL MIKROTIK ROUTEROS WINBOX CONFIGURATION */}
            {node.type === 'mikrotik' && (
              <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
                  <div className="font-bold text-orange-950 text-xs flex items-center gap-1.5">
                    <Server className="h-4 w-4 text-orange-600" />
                    <span>Winbox RouterOS ({node.model || 'RB750Gr3'})</span>
                  </div>
                  <span className="text-[10px] font-mono text-orange-800">v7.15 Stable</span>
                </div>

                {/* NAT Masquerade */}
                <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-orange-100 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">Firewall NAT Masquerade</span>
                    <p className="text-[10px] text-slate-500">Menerjemahkan paket LAN ke Internet</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={node.mikrotikConfig?.firewallNat ?? true}
                    onChange={(e) =>
                      onUpdateNode({
                        ...node,
                        mikrotikConfig: {
                          ...node.mikrotikConfig,
                          firewallNat: e.target.checked,
                          pppoeServer: node.mikrotikConfig?.pppoeServer ?? false,
                          dnsServer: node.mikrotikConfig?.dnsServer ?? true,
                          totalQueues: node.mikrotikConfig?.totalQueues ?? 5,
                        },
                      })
                    }
                    className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                </label>

                {/* Bandwidth Simple Queue */}
                <div className="bg-white p-2.5 rounded-lg border border-orange-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px]">Simple Queue (Limit Bandwidth):</span>
                    <span className="font-mono text-orange-700 font-bold">
                      {node.mikrotikConfig?.bandwidthLimitMbps || 50} Mbps
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={node.mikrotikConfig?.bandwidthLimitMbps || 50}
                    onChange={(e) =>
                      onUpdateNode({
                        ...node,
                        mikrotikConfig: {
                          ...node.mikrotikConfig,
                          firewallNat: node.mikrotikConfig?.firewallNat ?? true,
                          pppoeServer: node.mikrotikConfig?.pppoeServer ?? false,
                          dnsServer: node.mikrotikConfig?.dnsServer ?? true,
                          totalQueues: node.mikrotikConfig?.totalQueues ?? 5,
                          bandwidthLimitMbps: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-orange-600"
                  />
                </div>

                {/* DHCP Server */}
                <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-orange-100 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">DHCP Server Otomatis</span>
                    <p className="text-[10px] text-slate-500">Bagi IP otomatis ke klien LAN</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={node.ipConfig?.isDhcpServerEnabled ?? true}
                    onChange={(e) =>
                      onUpdateNode({
                        ...node,
                        ipConfig: {
                          mode: 'static',
                          // Keep the address the gateway already has; if it has
                          // none, take a free one rather than inventing
                          // 192.168.88.1, which is a real address elsewhere in
                          // the shipped SOHO template.
                          ip:
                            node.ipConfig?.ip ||
                            allocateStaticHost(upstreamGateway, allNodes) ||
                            '',
                          subnet: node.ipConfig?.subnet ?? '255.255.255.0',
                          gateway: node.ipConfig?.gateway ?? '180.252.10.1',
                          dns: node.ipConfig?.dns ?? '8.8.8.8',
                          isDhcpServerEnabled: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                </label>
              </div>
            )}

            {/* REAL OLT GPON CONFIGURATION */}
            {node.type === 'olt' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <Server className="h-4 w-4 text-emerald-600" />
                    <span>Manajemen OLT ({node.brand || 'ZTE'})</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800">GPON ITU-T G.984</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-slate-700">Tipe Modul SFP GPON:</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['B+ (+3dBm)', 'C+ (+5dBm)', 'C++ (+7dBm)'] as const).map((cls) => {
                      const powerMap: Record<string, number> = {
                        'B+ (+3dBm)': 3.0,
                        'C+ (+5dBm)': 5.0,
                        'C++ (+7dBm)': 7.0,
                      };
                      return (
                        <button
                          key={cls}
                          onClick={() =>
                            onUpdateNode({
                              ...node,
                              opticalConfig: {
                                ...node.opticalConfig,
                                txPowerDbm: powerMap[cls],
                              },
                            })
                          }
                          className={`py-1 text-[10px] font-bold rounded border text-center transition-all ${
                            (node.opticalConfig?.txPowerDbm ?? 3.0) === powerMap[cls]
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* REAL SWITCH CONFIGURATION */}
            {node.type === 'switch' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                  <div className="font-bold text-blue-950 text-xs">
                    Switch Management ({node.brand || 'TP-Link'})
                  </div>
                  <span className="text-[10px] font-mono text-blue-800">Layer 2 Gigabit</span>
                </div>

                <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-blue-100 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">STP / RSTP Loop Protection</span>
                    <p className="text-[10px] text-slate-500">Mencegah broadcast storm & loop kabel</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={node.switchConfig?.stpEnabled ?? true}
                    onChange={(e) =>
                      onUpdateNode({
                        ...node,
                        switchConfig: {
                          brand: node.brand || 'TP-Link',
                          model: node.model || 'TL-SG108',
                          isManaged: true,
                          stpEnabled: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            )}

            {/* REAL MANAGEABLE SWITCH CONFIGURATION */}
            {node.type === 'switch_managed' && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                  <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-700" />
                    <span>Switch Manageable ({node.brand || 'Cisco / Ruijie'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    24 GE + 4 SFP+ (L2/L3)
                  </span>
                </div>

                {/* Management IP */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-indigo-100">
                  <span className="text-[11px] font-bold text-slate-800 block">IP Manajemen Switch:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">IP Address</label>
                      <input
                        type="text"
                        value={node.managedSwitchConfig?.managementIp || node.ipConfig?.ip || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateNode({
                            ...node,
                            managedSwitchConfig: {
                              managementIp: val,
                              managementSubnet: node.managedSwitchConfig?.managementSubnet || '255.255.255.0',
                              managementGateway: node.managedSwitchConfig?.managementGateway || '',
                              stpMode: node.managedSwitchConfig?.stpMode || 'rstp',
                              igmpSnooping: node.managedSwitchConfig?.igmpSnooping ?? true,
                              lacpTrunkEnabled: node.managedSwitchConfig?.lacpTrunkEnabled ?? false,
                              portMirroring: node.managedSwitchConfig?.portMirroring ?? false,
                              poeBudgetWatts: node.managedSwitchConfig?.poeBudgetWatts || 370,
                              poeUsageWatts: node.managedSwitchConfig?.poeUsageWatts || 45,
                              loopProtect: node.managedSwitchConfig?.loopProtect ?? true,
                            },
                          });
                        }}
                        placeholder="IP Manajemen"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">Subnet Mask</label>
                      <input
                        type="text"
                        value={node.managedSwitchConfig?.managementSubnet || node.ipConfig?.subnet || '255.255.255.0'}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateNode({
                            ...node,
                            managedSwitchConfig: {
                              managementIp: node.managedSwitchConfig?.managementIp || '',
                              managementSubnet: val,
                              managementGateway: node.managedSwitchConfig?.managementGateway || '',
                              stpMode: node.managedSwitchConfig?.stpMode || 'rstp',
                              igmpSnooping: node.managedSwitchConfig?.igmpSnooping ?? true,
                              lacpTrunkEnabled: node.managedSwitchConfig?.lacpTrunkEnabled ?? false,
                              portMirroring: node.managedSwitchConfig?.portMirroring ?? false,
                              poeBudgetWatts: node.managedSwitchConfig?.poeBudgetWatts || 370,
                              poeUsageWatts: node.managedSwitchConfig?.poeUsageWatts || 45,
                              loopProtect: node.managedSwitchConfig?.loopProtect ?? true,
                            },
                          });
                        }}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* STP / RSTP Mode */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800">Spanning Tree Protocol (STP):</span>
                    <span className="text-[10px] text-indigo-700 font-mono font-bold uppercase">
                      {node.managedSwitchConfig?.stpMode || 'rstp'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['rstp', 'stp', 'mstp', 'disabled'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() =>
                          onUpdateNode({
                            ...node,
                            managedSwitchConfig: {
                              managementIp: node.managedSwitchConfig?.managementIp || '',
                              managementSubnet: node.managedSwitchConfig?.managementSubnet || '255.255.255.0',
                              managementGateway: node.managedSwitchConfig?.managementGateway || '',
                              stpMode: mode,
                              igmpSnooping: node.managedSwitchConfig?.igmpSnooping ?? true,
                              lacpTrunkEnabled: node.managedSwitchConfig?.lacpTrunkEnabled ?? false,
                              portMirroring: node.managedSwitchConfig?.portMirroring ?? false,
                              poeBudgetWatts: node.managedSwitchConfig?.poeBudgetWatts || 370,
                              poeUsageWatts: node.managedSwitchConfig?.poeUsageWatts || 45,
                              loopProtect: node.managedSwitchConfig?.loopProtect ?? true,
                            },
                          })
                        }
                        className={`py-1 px-1.5 text-[10px] font-bold rounded border uppercase text-center transition-all ${
                          (node.managedSwitchConfig?.stpMode || 'rstp') === mode
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    RSTP (Rapid STP) mendeteksi loop kabel dan memulihkan topologi dalam hitungan milidetik.
                  </p>
                </div>

                {/* Enterprise Features Toggles */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Loop Protection</span>
                      <p className="text-[10px] text-slate-500">Mati otomatis port jika loop terdeteksi</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.managedSwitchConfig?.loopProtect ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          managedSwitchConfig: {
                            managementIp: node.managedSwitchConfig?.managementIp || '',
                            managementSubnet: node.managedSwitchConfig?.managementSubnet || '255.255.255.0',
                            managementGateway: node.managedSwitchConfig?.managementGateway || '',
                            stpMode: node.managedSwitchConfig?.stpMode || 'rstp',
                            igmpSnooping: node.managedSwitchConfig?.igmpSnooping ?? true,
                            lacpTrunkEnabled: node.managedSwitchConfig?.lacpTrunkEnabled ?? false,
                            portMirroring: node.managedSwitchConfig?.portMirroring ?? false,
                            poeBudgetWatts: node.managedSwitchConfig?.poeBudgetWatts || 370,
                            poeUsageWatts: node.managedSwitchConfig?.poeUsageWatts || 45,
                            loopProtect: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">IGMP Snooping</span>
                      <p className="text-[10px] text-slate-500">Optimasi stream multicast CCTV & IPTV</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.managedSwitchConfig?.igmpSnooping ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          managedSwitchConfig: {
                            managementIp: node.managedSwitchConfig?.managementIp || '',
                            managementSubnet: node.managedSwitchConfig?.managementSubnet || '255.255.255.0',
                            managementGateway: node.managedSwitchConfig?.managementGateway || '',
                            stpMode: node.managedSwitchConfig?.stpMode || 'rstp',
                            igmpSnooping: e.target.checked,
                            lacpTrunkEnabled: node.managedSwitchConfig?.lacpTrunkEnabled ?? false,
                            portMirroring: node.managedSwitchConfig?.portMirroring ?? false,
                            poeBudgetWatts: node.managedSwitchConfig?.poeBudgetWatts || 370,
                            poeUsageWatts: node.managedSwitchConfig?.poeUsageWatts || 45,
                            loopProtect: node.managedSwitchConfig?.loopProtect ?? true,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">LACP Trunk (802.3ad)</span>
                      <p className="text-[10px] text-slate-500">Agregasi bandwidth port ganda (Link Bonding)</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.managedSwitchConfig?.lacpTrunkEnabled ?? false}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          managedSwitchConfig: {
                            managementIp: node.managedSwitchConfig?.managementIp || '',
                            managementSubnet: node.managedSwitchConfig?.managementSubnet || '255.255.255.0',
                            managementGateway: node.managedSwitchConfig?.managementGateway || '',
                            stpMode: node.managedSwitchConfig?.stpMode || 'rstp',
                            igmpSnooping: node.managedSwitchConfig?.igmpSnooping ?? true,
                            lacpTrunkEnabled: e.target.checked,
                            portMirroring: node.managedSwitchConfig?.portMirroring ?? false,
                            poeBudgetWatts: node.managedSwitchConfig?.poeBudgetWatts || 370,
                            poeUsageWatts: node.managedSwitchConfig?.poeUsageWatts || 45,
                            loopProtect: node.managedSwitchConfig?.loopProtect ?? true,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </div>

                {/* PoE Monitor */}
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>PoE Power Budget (802.3at/af)</span>
                    </span>
                    <span className="font-mono text-[11px] font-bold text-indigo-700">
                      {node.managedSwitchConfig?.poeUsageWatts || 45}W / {node.managedSwitchConfig?.poeBudgetWatts || 370}W
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round(((node.managedSwitchConfig?.poeUsageWatts || 45) / (node.managedSwitchConfig?.poeBudgetWatts || 370)) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Sisa daya PoE: {(node.managedSwitchConfig?.poeBudgetWatts || 370) - (node.managedSwitchConfig?.poeUsageWatts || 45)}W untuk AP & CCTV.
                  </p>
                </div>
              </div>
            )}

            {/* REAL MESH WI-FI CONFIGURATION */}
            {node.type === 'mesh' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <Radio className="h-4 w-4 text-emerald-600" />
                    <span>Mesh Wi-Fi System ({node.brand || 'TP-Link Deco / Ruijie Reyee'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Seamless Roaming 802.11k/v/r
                  </span>
                </div>

                {/* Node Role Selector */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-emerald-100">
                  <label className="text-[11px] font-bold text-slate-800 block">Peran Node dalam Jaringan Mesh:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        onUpdateNode({
                          ...node,
                          meshConfig: {
                            role: 'root',
                            backhaulType: node.meshConfig?.backhaulType || 'wireless_5ghz',
                            fastRoaming: node.meshConfig?.fastRoaming ?? true,
                            ssid: node.meshConfig?.ssid || 'Mesh-WiFi-Home',
                            wifiKey: node.meshConfig?.wifiKey || 'admin12345',
                            bandSteering: node.meshConfig?.bandSteering ?? true,
                            rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                            channel24G: node.meshConfig?.channel24G || 6,
                            channel5G: node.meshConfig?.channel5G || 44,
                            hopCount: 0,
                          },
                        })
                      }
                      className={`p-2 rounded-lg border text-left text-xs transition-all ${
                        (node.meshConfig?.role || 'root') === 'root'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-bold">Root Node (Master)</span>
                      <span className="text-[10px] font-normal text-slate-500 block">Terhubung langsung ke Router / Modem</span>
                    </button>
                    <button
                      onClick={() =>
                        onUpdateNode({
                          ...node,
                          meshConfig: {
                            role: 'satellite',
                            backhaulType: node.meshConfig?.backhaulType || 'wireless_5ghz',
                            fastRoaming: node.meshConfig?.fastRoaming ?? true,
                            ssid: node.meshConfig?.ssid || 'Mesh-WiFi-Home',
                            wifiKey: node.meshConfig?.wifiKey || 'admin12345',
                            bandSteering: node.meshConfig?.bandSteering ?? true,
                            rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                            channel24G: node.meshConfig?.channel24G || 6,
                            channel5G: node.meshConfig?.channel5G || 44,
                            hopCount: (node.meshConfig?.hopCount || 0) > 0 ? node.meshConfig!.hopCount : 1,
                          },
                        })
                      }
                      className={`p-2 rounded-lg border text-left text-xs transition-all ${
                        node.meshConfig?.role === 'satellite'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-bold">Satellite Node (Extender)</span>
                      <span className="text-[10px] font-normal text-slate-500 block">Memperluas sinyal nirkabel tanpa jeda</span>
                    </button>
                  </div>
                </div>

                {/* Backhaul Type */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-emerald-100">
                  <label className="text-[11px] font-bold text-slate-800 block">Jalur Interkoneksi Backhaul:</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() =>
                        onUpdateNode({
                          ...node,
                          meshConfig: {
                            role: node.meshConfig?.role || 'root',
                            backhaulType: 'ethernet',
                            fastRoaming: node.meshConfig?.fastRoaming ?? true,
                            ssid: node.meshConfig?.ssid || 'Mesh-WiFi-Home',
                            wifiKey: node.meshConfig?.wifiKey || 'admin12345',
                            bandSteering: node.meshConfig?.bandSteering ?? true,
                            rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                            channel24G: node.meshConfig?.channel24G || 6,
                            channel5G: node.meshConfig?.channel5G || 44,
                          },
                        })
                      }
                      className={`p-2 rounded-lg border text-left transition-all ${
                        node.meshConfig?.backhaulType === 'ethernet'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-bold">Ethernet Backhaul (Kabel)</span>
                      <span className="text-[10px] font-normal text-slate-500 block">1000 Mbps Full Duplex (Terstabil)</span>
                    </button>
                    <button
                      onClick={() =>
                        onUpdateNode({
                          ...node,
                          meshConfig: {
                            role: node.meshConfig?.role || 'root',
                            backhaulType: 'wireless_5ghz',
                            fastRoaming: node.meshConfig?.fastRoaming ?? true,
                            ssid: node.meshConfig?.ssid || 'Mesh-WiFi-Home',
                            wifiKey: node.meshConfig?.wifiKey || 'admin12345',
                            bandSteering: node.meshConfig?.bandSteering ?? true,
                            rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                            channel24G: node.meshConfig?.channel24G || 6,
                            channel5G: node.meshConfig?.channel5G || 44,
                          },
                        })
                      }
                      className={`p-2 rounded-lg border text-left transition-all ${
                        (node.meshConfig?.backhaulType || 'wireless_5ghz') === 'wireless_5ghz'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-bold">Wireless 5GHz Backhaul</span>
                      <span className="text-[10px] font-normal text-slate-500 block">Nirkabel dedicated frekuensi 5GHz</span>
                    </button>
                  </div>
                </div>

                {/* Mesh SSID & Password */}
                <div className="space-y-2 bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-[11px] font-bold text-slate-800 block">Setelan SSID Wi-Fi Tunggal:</span>
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">Nama SSID Mesh</label>
                      <input
                        type="text"
                        value={node.meshConfig?.ssid || 'Mesh-WiFi-Home'}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            meshConfig: {
                              role: node.meshConfig?.role || 'root',
                              backhaulType: node.meshConfig?.backhaulType || 'wireless_5ghz',
                              fastRoaming: node.meshConfig?.fastRoaming ?? true,
                              ssid: e.target.value,
                              wifiKey: node.meshConfig?.wifiKey || 'admin12345',
                              bandSteering: node.meshConfig?.bandSteering ?? true,
                              rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                              channel24G: node.meshConfig?.channel24G || 6,
                              channel5G: node.meshConfig?.channel5G || 44,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">Password WPA2/WPA3</label>
                      <input
                        type="text"
                        value={node.meshConfig?.wifiKey || 'admin12345'}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            meshConfig: {
                              role: node.meshConfig?.role || 'root',
                              backhaulType: node.meshConfig?.backhaulType || 'wireless_5ghz',
                              fastRoaming: node.meshConfig?.fastRoaming ?? true,
                              ssid: node.meshConfig?.ssid || 'Mesh-WiFi-Home',
                              wifiKey: e.target.value,
                              bandSteering: node.meshConfig?.bandSteering ?? true,
                              rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                              channel24G: node.meshConfig?.channel24G || 6,
                              channel5G: node.meshConfig?.channel5G || 44,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Roaming & Band Steering */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-emerald-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">802.11k/v/r Fast Roaming</span>
                      <p className="text-[10px] text-slate-500">Pindah access point otomatis tanpa putus koneksi</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.meshConfig?.fastRoaming ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          meshConfig: {
                            role: node.meshConfig?.role || 'root',
                            backhaulType: node.meshConfig?.backhaulType || 'wireless_5ghz',
                            fastRoaming: e.target.checked,
                            ssid: node.meshConfig?.ssid || 'Mesh-WiFi-Home',
                            wifiKey: node.meshConfig?.wifiKey || 'admin12345',
                            bandSteering: node.meshConfig?.bandSteering ?? true,
                            rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                            channel24G: node.meshConfig?.channel24G || 6,
                            channel5G: node.meshConfig?.channel5G || 44,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-emerald-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Band Steering (Smart Connect)</span>
                      <p className="text-[10px] text-slate-500">Gabungkan 2.4GHz & 5GHz jadi satu nama otomatis</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.meshConfig?.bandSteering ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          meshConfig: {
                            role: node.meshConfig?.role || 'root',
                            backhaulType: node.meshConfig?.backhaulType || 'wireless_5ghz',
                            fastRoaming: node.meshConfig?.fastRoaming ?? true,
                            ssid: node.meshConfig?.ssid || 'Mesh-WiFi-Home',
                            wifiKey: node.meshConfig?.wifiKey || 'admin12345',
                            bandSteering: e.target.checked,
                            rssiThresholdDbm: node.meshConfig?.rssiThresholdDbm || -70,
                            channel24G: node.meshConfig?.channel24G || 6,
                            channel5G: node.meshConfig?.channel5G || 44,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* REAL ACCESS POINT POINT-TO-POINT CONFIGURATION */}
            {node.type === 'ap_ptp' && (
              <div className="rounded-xl border border-sky-300 bg-sky-50/40 p-3.5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                  <div className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                    <Radio className="h-4 w-4 text-sky-600" />
                    <span>Access Point PtP ({node.brand || 'Ubiquiti / MikroTik'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                    Outdoor Wireless Bridge
                  </span>
                </div>

                {/* Operating Mode */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-sky-100">
                  <label className="text-[11px] font-bold text-slate-800 block">Mode Operasi Nirkabel:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'ap_ptp', label: 'Access Point PtP', desc: 'Pemancar Tower' },
                      { id: 'station_ptp', label: 'Station PtP', desc: 'Penerima Klien' },
                      { id: 'ap_ptmp', label: 'AP PtMP', desc: 'Multi-Point' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() =>
                          onUpdateNode({
                            ...node,
                            ptpConfig: {
                              mode: m.id as any,
                              frequencyMhz: node.ptpConfig?.frequencyMhz || 5745,
                              channelWidthMhz: node.ptpConfig?.channelWidthMhz || 80,
                              distanceKm: node.ptpConfig?.distanceKm || 1.5,
                              txPowerDbm: node.ptpConfig?.txPowerDbm || 23,
                              antennaGainDbi: node.ptpConfig?.antennaGainDbi || 23,
                              ssid: node.ptpConfig?.ssid || 'PTP-LINK-TOWER',
                              securityKey: node.ptpConfig?.securityKey || 'wpa2ptpsecret',
                              signalRssiDbm: node.ptpConfig?.signalRssiDbm || -56,
                              linkQualityPercent: node.ptpConfig?.linkQualityPercent || 99,
                            },
                          })
                        }
                        className={`p-1.5 text-center rounded border text-xs transition-all ${
                          (node.ptpConfig?.mode || 'ap_ptp') === m.id
                            ? 'bg-sky-600 text-white font-bold border-sky-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="block font-bold text-[10.5px]">{m.label}</span>
                        <span className="text-[9px] opacity-80 block">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency & Channel Width */}
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">Frekuensi (MHz)</label>
                      <select
                        value={node.ptpConfig?.frequencyMhz || 5745}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            ptpConfig: {
                              mode: node.ptpConfig?.mode || 'ap_ptp',
                              frequencyMhz: Number(e.target.value),
                              channelWidthMhz: node.ptpConfig?.channelWidthMhz || 80,
                              distanceKm: node.ptpConfig?.distanceKm || 1.5,
                              txPowerDbm: node.ptpConfig?.txPowerDbm || 23,
                              antennaGainDbi: node.ptpConfig?.antennaGainDbi || 23,
                              ssid: node.ptpConfig?.ssid || 'PTP-LINK-TOWER',
                              securityKey: node.ptpConfig?.securityKey || 'wpa2ptpsecret',
                              signalRssiDbm: node.ptpConfig?.signalRssiDbm || -56,
                              linkQualityPercent: node.ptpConfig?.linkQualityPercent || 99,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value={5180}>5180 MHz (UNII-1 Ch 36)</option>
                        <option value={5240}>5240 MHz (UNII-1 Ch 48)</option>
                        <option value={5500}>5500 MHz (DFS Ch 100)</option>
                        <option value={5745}>5745 MHz (UNII-3 Ch 149)</option>
                        <option value={5825}>5825 MHz (UNII-3 Ch 165)</option>
                        <option value={60000}>60 GHz (Millimeter Wave 10G)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">Channel Width</label>
                      <select
                        value={node.ptpConfig?.channelWidthMhz || 80}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            ptpConfig: {
                              mode: node.ptpConfig?.mode || 'ap_ptp',
                              frequencyMhz: node.ptpConfig?.frequencyMhz || 5745,
                              channelWidthMhz: Number(e.target.value) as any,
                              distanceKm: node.ptpConfig?.distanceKm || 1.5,
                              txPowerDbm: node.ptpConfig?.txPowerDbm || 23,
                              antennaGainDbi: node.ptpConfig?.antennaGainDbi || 23,
                              ssid: node.ptpConfig?.ssid || 'PTP-LINK-TOWER',
                              securityKey: node.ptpConfig?.securityKey || 'wpa2ptpsecret',
                              signalRssiDbm: node.ptpConfig?.signalRssiDbm || -56,
                              linkQualityPercent: node.ptpConfig?.linkQualityPercent || 99,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value={20}>20 MHz (Jangkauan Maksimal)</option>
                        <option value={40}>40 MHz (Standar Industri)</option>
                        <option value={80}>80 MHz (Throughput Tinggi)</option>
                        <option value={160}>160 MHz (Ultra Gigabit)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">SSID Wireless Bridge</label>
                      <input
                        type="text"
                        value={node.ptpConfig?.ssid || 'PTP-LINK-TOWER'}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            ptpConfig: {
                              mode: node.ptpConfig?.mode || 'ap_ptp',
                              frequencyMhz: node.ptpConfig?.frequencyMhz || 5745,
                              channelWidthMhz: node.ptpConfig?.channelWidthMhz || 80,
                              distanceKm: node.ptpConfig?.distanceKm || 1.5,
                              txPowerDbm: node.ptpConfig?.txPowerDbm || 23,
                              antennaGainDbi: node.ptpConfig?.antennaGainDbi || 23,
                              ssid: e.target.value,
                              securityKey: node.ptpConfig?.securityKey || 'wpa2ptpsecret',
                              signalRssiDbm: node.ptpConfig?.signalRssiDbm || -56,
                              linkQualityPercent: node.ptpConfig?.linkQualityPercent || 99,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block">Kunci WPA2-PSK</label>
                      <input
                        type="text"
                        value={node.ptpConfig?.securityKey || 'wpa2ptpsecret'}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            ptpConfig: {
                              mode: node.ptpConfig?.mode || 'ap_ptp',
                              frequencyMhz: node.ptpConfig?.frequencyMhz || 5745,
                              channelWidthMhz: node.ptpConfig?.channelWidthMhz || 80,
                              distanceKm: node.ptpConfig?.distanceKm || 1.5,
                              txPowerDbm: node.ptpConfig?.txPowerDbm || 23,
                              antennaGainDbi: node.ptpConfig?.antennaGainDbi || 23,
                              ssid: node.ptpConfig?.ssid || 'PTP-LINK-TOWER',
                              securityKey: e.target.value,
                              signalRssiDbm: node.ptpConfig?.signalRssiDbm || -56,
                              linkQualityPercent: node.ptpConfig?.linkQualityPercent || 99,
                            },
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Pointing & Sinyal Meter */}
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5 text-sky-600" />
                      <span>Indikator Pointing Sinyal RSSI</span>
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-600">
                      {node.ptpConfig?.signalRssiDbm || -56} dBm (99% CCQ)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full w-[85%] rounded-full" />
                  </div>
                  <div className="flex justify-between text-[9.5px] text-slate-500 font-mono">
                    <span>Noise Floor: -96 dBm</span>
                    <span>SNR: 40 dB (Sangat Bagus)</span>
                  </div>
                </div>
              </div>
            )}

            {/* REAL PASSIVE OPTICAL SPLITTER CONFIGURATION
                Shared by 'splitter', 'odc' and 'odp': all three are passive
                PLC splitters (handleAddDevice gives every one of them the
                same opticalConfig.splitterRatio/attenuationDb shape), just
                at different stages of the PON tree. This used to only match
                node.type === 'splitter', so opening an ODC or ODP showed no
                configuration panel at all even though they carry the same
                fields -- exactly the "empty config" gap. */}
            {['splitter', 'odc', 'odp'].includes(node.type) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                  <div className="font-bold text-rose-950 text-xs flex items-center gap-1.5">
                    <Share2 className="h-4 w-4 text-rose-600" />
                    <span>
                      {node.type === 'odc' ? 'Splitter Tahap 1 - ODC' : node.type === 'odp' ? 'Splitter Tahap 2 - ODP' : 'Optical PLC Splitter'}
                      {' '}({node.opticalConfig?.splitterRatio || '1:8'})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    Redaman: ~{SPLITTER_LOSS_MAP[node.opticalConfig?.splitterRatio || '1:8'] || 10.5} dB
                  </span>
                </div>

                {/* Splitter Ratio Selection */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-rose-100">
                  <label className="text-[11px] font-bold text-slate-800 block">
                    Pilih Rasio Splitter Pembagi Fiber:
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['1:2', '1:4', '1:8', '1:16', '1:32'] as const).map((ratio) => {
                      const isCurrent = (node.opticalConfig?.splitterRatio || '1:8') === ratio;
                      const loss = SPLITTER_LOSS_MAP[ratio];
                      // ODC/ODP keep their own port naming (Feeder IN / Dist IN,
                      // Dist N (Out) / Port Drop N) instead of the generic
                      // Input/Out N used by a standalone splitter, so
                      // regenerating ports for those two doesn't relabel them
                      // into names that don't match their real-world role.
                      const inputLabel =
                        node.type === 'odc' ? 'Feeder IN' : node.type === 'odp' ? 'Dist IN' : 'Input';
                      const outputLabel = (i: number) =>
                        node.type === 'odc'
                          ? `Dist ${i} (Out)`
                          : node.type === 'odp'
                          ? `Port Drop ${i}`
                          : `Out ${i}`;
                      return (
                        <button
                          key={ratio}
                          onClick={() => {
                            const numOutputs = parseInt(ratio.split(':')[1], 10);
                            // The input is always whatever port is first in
                            // this device's port list, regardless of its
                            // current label.
                            const existingInputPort = node.ports[0];
                            const inputPort = existingInputPort
                              ? { ...existingInputPort, name: inputLabel }
                              : {
                                  id: `p-${node.id}-input`,
                                  name: inputLabel,
                                  medium: 'fiber' as const,
                                  status: 'up' as const,
                                };

                            const newPorts: typeof node.ports = [inputPort];
                            for (let i = 1; i <= numOutputs; i++) {
                              const portName = outputLabel(i);
                              // Match existing output ports positionally (index i
                              // among the non-input ports), not by name: the
                              // label changes with the device type/ratio, but
                              // the underlying port -- and any cable plugged
                              // into it -- should carry over.
                              const existing = node.ports[i];
                              newPorts.push(
                                existing
                                  ? { ...existing, name: portName }
                                  : {
                                      id: `p-${node.id}-out-${i}`,
                                      name: portName,
                                      medium: 'fiber' as const,
                                      status: 'up' as const,
                                    }
                              );
                            }

                            onUpdateNode({
                              ...node,
                              ports: newPorts,
                              opticalConfig: {
                                ...node.opticalConfig,
                                splitterRatio: ratio,
                                attenuationDb: loss,
                              },
                            });
                          }}
                          className={`p-1.5 text-center rounded border transition-all ${
                            isCurrent
                              ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="block font-bold text-xs">{ratio}</span>
                          <span className="text-[9px] opacity-80 block">~{loss}dB</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Mengubah rasio splitter otomatis menyesuaikan jumlah port output fisik dan redaman optik pada simulator OPM.
                  </p>
                </div>

                {/* Connector Type */}
                <div className="bg-white p-2.5 rounded-lg border border-rose-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">Tipe Konektor Pigtail:</span>
                    <span className="text-[10px] text-slate-500">
                      {node.opticalConfig?.connectorType || 'SC/UPC'} (Standar FTTH GPON)
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(['SC/UPC', 'SC/APC'] as const).map((conn) => (
                      <button
                        key={conn}
                        onClick={() =>
                          onUpdateNode({
                            ...node,
                            opticalConfig: {
                              ...node.opticalConfig,
                              connectorType: conn,
                            },
                          })
                        }
                        className={`px-2 py-1 text-[10px] font-bold rounded border uppercase ${
                          (node.opticalConfig?.connectorType || 'SC/UPC') === conn
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {conn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* REAL CCTV CONFIGURATION */}
            {node.type === 'cctv' && (
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
                  <div className="font-bold text-purple-950 text-xs flex items-center gap-1.5">
                    <Video className="h-4 w-4 text-purple-600" />
                    <span>Streaming IP Camera ({node.brand || 'Hikvision'})</span>
                  </div>
                  <span
                    className={`text-[9.5px] font-mono px-2 py-0.5 rounded font-bold ${
                      !node.poweredOn
                        ? 'bg-slate-200 text-slate-600'
                        : !internetStatus.hasInternet
                        ? 'bg-rose-100 text-rose-700 border border-rose-300'
                        : isGatewayMismatch || isSubnetMismatch || isIpOutsideRouterSubnet
                        ? 'bg-rose-100 text-rose-700 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {!node.poweredOn
                      ? 'Power OFF'
                      : !internetStatus.hasInternet
                      ? 'STREAM OFFLINE (NO ROUTE)'
                      : isGatewayMismatch || isSubnetMismatch || isIpOutsideRouterSubnet
                      ? 'STREAM OFFLINE (GATEWAY SALAH)'
                      : 'PoE & Stream Online'}
                  </span>
                </div>

                {/* Real-time Streaming Alert / Diagnostic in CCTV inspector */}
                {(!internetStatus.hasInternet || isGatewayMismatch || isSubnetMismatch || isIpOutsideRouterSubnet) && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-rose-800 text-[11px]">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Stream CCTV Terputus / Tidak Dapat Diakses</span>
                    </div>
                    <p className="text-[10px] text-rose-700 leading-relaxed">
                      {!internetStatus.hasInternet && (
                        <span className="block mb-1 font-semibold text-rose-800">
                          {internetStatus.reason}
                        </span>
                      )}
                      {isGatewayMismatch && (
                        <span>
                          Default Gateway CCTV disetel ke <b>{node.ipConfig?.gateway}</b>, padahal terhubung ke router{' '}
                          <b>{upstreamGateway?.name}</b> (IP LAN: <b>{routerLanIp}</b>). Karena gateway tidak ada di segmen lokal, kamera CCTV tidak bisa mengirim stream ke NVR / Cloud!
                        </span>
                      )}
                      {isSubnetMismatch && (
                        <span>
                          Alamat IP CCTV (<b>{node.ipConfig?.ip}</b>) dan Gateway (<b>{node.ipConfig?.gateway}</b>) berada pada subnet yang berbeda!
                        </span>
                      )}
                      {isIpOutsideRouterSubnet && (
                        <span>
                          Alamat IP CCTV (<b>{node.ipConfig?.ip}</b>) tidak sekelas dengan subnet LAN router (<b>{routerLanIp} / {routerSubnet}</b>)!
                        </span>
                      )}
                    </p>
                    {upstreamGateway && upstreamGateway.ontConfig?.wanMode !== 'bridge' && (
                      <button
                        onClick={() => {
                          // The button only appears when the camera is on the
                          // wrong subnet, so its current address is unusable
                          // and there is nothing to preserve. A free host on
                          // the router's LAN is the fix; the constant .50 was
                          // not, and put a second camera on top of the first
                          // one every time it was pressed.
                          const fixed = allocateStaticHost(upstreamGateway, allNodes);
                          const defaults = lanDefaultsFor(upstreamGateway);
                          onUpdateNode({
                            ...node,
                            ipConfig: {
                              mode: 'static',
                              ip: fixed ?? '',
                              subnet: defaults.subnet,
                              gateway: defaults.gateway,
                              dns: '8.8.8.8',
                            },
                          });
                        }}
                        className="mt-1 w-full rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10.5px] py-1 shadow-2xs transition-colors"
                      >
                        Perbaiki Otomatis (Set Gateway ke {routerLanIp})
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-500 font-medium">RTSP Video Stream URL:</label>
                  <input
                    type="text"
                    // A camera with no address has no stream. This used to
                    // render 192.168.1.50 into the box, so an unconfigured
                    // camera showed a copy-pasteable URL for a host that does
                    // not exist.
                    value={
                      isValidIpv4(node.ipConfig?.ip ?? '')
                        ? `rtsp://${node.ipConfig?.ip}:554/ch1/main`
                        : 'rtsp://(kamera belum punya alamat IP):554/ch1/main'
                    }
                    readOnly
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 pt-0.5">
                  <div className="bg-white p-2 rounded border border-purple-100">
                    <span className="text-slate-400 block">Router Terhubung:</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {upstreamGateway ? upstreamGateway.name : 'Tidak Terhubung'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-purple-100">
                    <span className="text-slate-400 block">IP Gateway Router:</span>
                    <span
                      className={`font-mono font-bold ${
                        isGatewayMismatch ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {upstreamGateway ? routerLanIp : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Standard IP Address settings (PC, Router, Server, CCTV, Smartphone, IoT) */}
            {['pc', 'laptop', 'printer', 'voip_phone', 'server', 'router', 'cctv', 'smartphone', 'iot'].includes(node.type) && (
              <div className="space-y-2.5 rounded-xl border border-slate-200 p-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    Pengaturan IPv4
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                    <button
                      onClick={() => {
                        // Subnet and gateway come as a pair for the same reason
                        // as the DHCP toggle: mixing a lease from one LAN with a
                        // gateway from another is a contradiction, not a config.
                        const defaults = lanDefaultsFor(upstreamGateway);
                        onUpdateNode({
                          ...node,
                          ipConfig: {
                            mode: 'static',
                            // A free host on the LAN, not a fixed .100. The
                            // constant put every client that had no lease yet
                            // onto 192.168.1.100, colliding with whatever was
                            // already there.
                            ip:
                              node.ipConfig?.ip ||
                              allocateStaticHost(upstreamGateway, allNodes) ||
                              '',
                            subnet: node.ipConfig?.subnet || defaults.subnet,
                            gateway: node.ipConfig?.gateway || defaults.gateway,
                            dns: node.ipConfig?.dns || '8.8.8.8',
                          },
                        });
                      }}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                        (node.ipConfig?.mode ?? 'static') === 'static'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      Static IP
                    </button>
                    <button
                      onClick={() => {
                        // A real lease: the first address in the server's pool
                        // that nobody holds. The old code wrote a hardcoded
                        // `<subnet>.115` for every client, so two routers on one
                        // hub both came up as 192.168.88.115 -- and the same
                        // constant was written into `gateway`, leaving each
                        // router's default gateway equal to its own address.
                        //
                        // `no lease` (pool full, or no DHCP server reachable)
                        // leaves the address empty rather than inventing one;
                        // the APIPA panel below already covers that state.
                        const lease = allocateDhcpLease(upstreamGateway, allNodes, node.id);
                        // Decided as a pair. Taking the gateway from
                        // `routerLanIp` while the lease came from a different
                        // LAN produced a client whose default gateway was
                        // unreachable by construction.
                        const leaseDefaults = lanDefaultsFor(upstreamGateway);
                        onUpdateNode({
                          ...node,
                          ipConfig: {
                            mode: 'dhcp',
                            ip: lease ?? '',
                            subnet: leaseDefaults.subnet,
                            gateway: leaseDefaults.gateway,
                            dns: '8.8.8.8',
                          },
                        });
                      }}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                        node.ipConfig?.mode === 'dhcp'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      DHCP Client
                    </button>
                  </div>
                </div>

                {node.ipConfig?.mode === 'dhcp' ? (
                  isDhcpServerOff || isUpstreamOntBridge ? (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-rose-900">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                          DHCP Gagal ({isUpstreamOntBridge ? 'ONT Mode Bridge' : 'DHCP Server Mati'})
                        </span>
                        <span className="text-[9.5px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-mono font-bold">
                          APIPA 169.254.x.x
                        </span>
                      </div>
                      <p className="text-[10px] text-rose-700 leading-relaxed">
                        {isUpstreamOntBridge
                          ? `ONT (${upstreamGateway?.name || 'Modem'}) berada dalam Mode Bridge (Layer 2) dan DHCP Server dinonaktifkan. Klien tidak memperoleh alamat IP dan tidak bisa berinternet tanpa router PPPoE dialer.`
                          : `Layanan DHCP Server pada ${upstreamGateway?.name || 'Router'} dimatikan. Klien tidak memperoleh konfigurasi IP otomatis.`}
                      </p>
                      <div className="text-[9.5px] text-slate-600 bg-white p-2 rounded border border-rose-200">
                        Solusi: Aktifkan kembali mode router & DHCP Server pada {upstreamGateway?.name || 'Router'}, atau gunakan IP Statis dengan router perantara.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-sky-50 border border-sky-100 p-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-sky-900">
                        <span>DHCP Client Aktif</span>
                        <span className="text-[9.5px] bg-sky-200/70 text-sky-800 px-1.5 py-0.5 rounded font-mono">
                          {upstreamGateway ? `Server: ${upstreamGateway.name}` : 'Mencari Server...'}
                        </span>
                      </div>
                      {upstreamGateway ? (
                        <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono text-[10px] text-slate-700">
                          <div className="bg-white p-1.5 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-400 block font-sans">IP Diperoleh:</span>
                            {/* Shown only when a lease actually exists. This used
                                to fall back to a hardcoded 192.168.1.100, so a
                                client with no lease -- and every client before
                                the pool-aware allocator existed -- displayed
                                the same made-up address. */}
                            {isValidIpv4(node.ipConfig?.ip ?? '') ? (
                              <span className="font-bold text-sky-800">{node.ipConfig?.ip}</span>
                            ) : (
                              <span className="font-bold text-amber-700">
                                Belum ada lease (APIPA 169.254.x.x)
                              </span>
                            )}
                          </div>
                          <div className="bg-white p-1.5 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-400 block font-sans">Subnet Mask:</span>
                            <span className="font-bold">{routerSubnet}</span>
                          </div>
                          <div className="bg-white p-1.5 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-400 block font-sans">Gateway:</span>
                            <span className="font-bold text-emerald-700">
                              {node.ipConfig?.gateway || routerLanIp}
                            </span>
                          </div>
                          <div className="bg-white p-1.5 rounded border border-sky-100">
                            <span className="text-[9px] text-slate-400 block font-sans">DNS:</span>
                            <span className="font-bold">8.8.8.8</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-700 pt-0.5">
                          ⚠️ Belum terhubung ke ONT/Router dengan DHCP Server aktif.
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">IP Address:</label>
                      <input
                        type="text"
                        value={node.ipConfig?.ip ?? ''}
                        onChange={(e) => handleIpChange('ip', e.target.value)}
                        placeholder="192.168.1.100"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1 font-mono text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Subnet Mask:</label>
                      <input
                        type="text"
                        value={node.ipConfig?.subnet ?? '255.255.255.0'}
                        onChange={(e) => handleIpChange('subnet', e.target.value)}
                        placeholder="255.255.255.0"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1 font-mono text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500">Default Gateway:</label>
                        {upstreamGateway && (
                          <button
                            type="button"
                            onClick={() => handleIpChange('gateway', routerLanIp)}
                            className="text-[9.5px] font-bold text-sky-600 hover:text-sky-800 hover:underline"
                          >
                            Gunakan IP Router ({routerLanIp})
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={node.ipConfig?.gateway ?? ''}
                        onChange={(e) => handleIpChange('gateway', e.target.value)}
                        placeholder="192.168.1.1"
                        className={`w-full rounded-md border px-2.5 py-1 font-mono text-xs text-slate-800 focus:outline-none ${
                          isGatewayMismatch || isSubnetMismatch
                            ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                            : 'border-slate-200 focus:border-sky-500'
                        }`}
                      />

                      {/* Live Gateway Validation Feedback */}
                      <div className="text-[10px] pt-1">
                        {!node.ipConfig?.gateway || node.ipConfig.gateway === '0.0.0.0' ? (
                          <div className="text-amber-600 flex items-center gap-1 font-medium">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Gateway kosong: Perangkat hanya bisa diakses di LAN lokal, tidak ada rute keluar.</span>
                          </div>
                        ) : isSubnetMismatch ? (
                          <div className="text-rose-600 flex items-center gap-1 font-bold">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Error Subnet: Gateway ({node.ipConfig?.gateway}) di luar segmen IP ({node.ipConfig?.ip})!</span>
                          </div>
                        ) : isGatewayMismatch ? (
                          <div className="text-rose-600 flex items-center gap-1 font-bold">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Error Gateway: Terhubung ke router ({routerLanIp}), tetapi gateway disetel ke ({node.ipConfig?.gateway})!</span>
                          </div>
                        ) : isIpOutsideRouterSubnet ? (
                          <div className="text-rose-600 flex items-center gap-1 font-bold">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>IP di luar subnet router ({routerLanIp} / {routerSubnet})!</span>
                          </div>
                        ) : isUpstreamOntBridge ? (
                          <div className="text-rose-600 flex items-start gap-1 font-bold">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>Error: ONT ({upstreamGateway?.name}) dalam Mode Bridge! Modem tidak memiliki fungsi routing/NAT ke internet.</span>
                          </div>
                        ) : (
                          <div className="text-emerald-700 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span>✓ Gateway Valid & Terhubung ke {upstreamGateway?.name || 'Router'} ({routerLanIp})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* REAL IEEE 802.1Q VLAN TAGGING CONFIGURATION
                'switch_managed' was missing from this list even though a
                manageable switch is the primary real-world device for VLAN
                trunking (it is the "trunk neighbour" the vlan-trunk-drop
                check and its auto-fix already reason about) -- without it,
                a managed switch could never actually be put into Trunk mode
                from this panel. */}
            {['switch', 'switch_managed', 'mikrotik', 'ont', 'olt', 'pc', 'cctv', 'server', 'router'].includes(node.type) && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-indigo-600" />
                    <span>Tagging VLAN (IEEE 802.1Q)</span>
                  </div>
                  <span
                    className={`text-[9.5px] font-mono px-2 py-0.5 rounded font-bold ${
                      node.vlanConfig?.enabled
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {node.vlanConfig?.enabled
                      ? `VLAN ${node.vlanConfig.vlanId} (${node.vlanConfig.mode.toUpperCase()})`
                      : 'VLAN Nonaktif (Untagged)'}
                  </span>
                </div>

                {/* Enable VLAN Tagging Toggle */}
                <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      Aktifkan Tagging VLAN pada {node.name}
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Membungkus paket data dengan header 802.1Q 4-byte (TPID 0x8100 + VID)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={node.vlanConfig?.enabled ?? false}
                    onChange={(e) =>
                      onUpdateNode({
                        ...node,
                        vlanConfig: {
                          enabled: e.target.checked,
                          vlanId: node.vlanConfig?.vlanId || (node.type === 'cctv' ? 100 : node.type === 'ont' ? 1049 : 10),
                          vlanName: node.vlanConfig?.vlanName || (node.type === 'cctv' ? 'VLAN 100 - CCTV' : node.type === 'ont' ? 'VLAN 1049 - Internet' : 'VLAN 10 - Manajemen'),
                          mode: node.vlanConfig?.mode || (['switch', 'switch_managed', 'mikrotik'].includes(node.type) ? 'trunk' : 'access'),
                          allowedVlans: node.vlanConfig?.allowedVlans || [10, 20, 50, 100, 1049],
                          priorityCos: node.vlanConfig?.priorityCos ?? 0,
                          nativeVlan: node.vlanConfig?.nativeVlan || 1,
                        },
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                {node.vlanConfig?.enabled && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                    {/* Mode: Access vs Trunk */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-700">Tipe Mode Port VLAN:</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateNode({
                              ...node,
                              vlanConfig: {
                                ...node.vlanConfig!,
                                mode: 'access',
                              },
                            })
                          }
                          className={`py-1.5 px-2 text-[10.5px] rounded border text-left transition-all ${
                            node.vlanConfig.mode === 'access'
                              ? 'border-indigo-600 bg-white ring-2 ring-indigo-200 font-bold text-indigo-900'
                              : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span className="block font-bold">Access Mode (Untagged)</span>
                          <span className="text-[9px] text-slate-500 font-normal">Untuk perangkat akhir (PC, CCTV, IoT)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateNode({
                              ...node,
                              vlanConfig: {
                                ...node.vlanConfig!,
                                mode: 'trunk',
                              },
                            })
                          }
                          className={`py-1.5 px-2 text-[10.5px] rounded border text-left transition-all ${
                            node.vlanConfig.mode === 'trunk'
                              ? 'border-indigo-600 bg-white ring-2 ring-indigo-200 font-bold text-indigo-900'
                              : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span className="block font-bold">Trunk Mode (Tagged)</span>
                          <span className="text-[9px] text-slate-500 font-normal">Uplink multi-VLAN (Switch / MikroTik)</span>
                        </button>
                      </div>
                    </div>

                    {/* VLAN ID & Name */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[10px] font-semibold text-slate-700">VLAN ID (VID):</label>
                        <input
                          type="number"
                          min={1}
                          max={4094}
                          value={node.vlanConfig.vlanId || 10}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            onUpdateNode({
                              ...node,
                              vlanConfig: {
                                ...node.vlanConfig!,
                                vlanId: Math.min(4094, Math.max(1, val)),
                              },
                            });
                          }}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-bold text-indigo-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-slate-700">Nama VLAN / Service:</label>
                        <input
                          type="text"
                          value={node.vlanConfig.vlanName || ''}
                          onChange={(e) =>
                            onUpdateNode({
                              ...node,
                              vlanConfig: {
                                ...node.vlanConfig!,
                                vlanName: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g. VLAN 10 - Manajemen"
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick VLAN Presets */}
                    <div className="space-y-1">
                      <span className="text-[9.5px] font-medium text-slate-500">Pilihan Cepat Standar Industri:</span>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: 10, label: '10 (Manajemen)' },
                          { id: 20, label: '20 (Hotspot)' },
                          { id: 50, label: '50 (IPTV)' },
                          { id: 100, label: '100 (CCTV)' },
                          { id: 1049, label: '1049 (Internet Telkom)' },
                        ].map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              onUpdateNode({
                                ...node,
                                vlanConfig: {
                                  ...node.vlanConfig!,
                                  vlanId: preset.id,
                                  vlanName: `VLAN ${preset.id} - ${preset.label.split('(')[1].replace(')', '')}`,
                                },
                              })
                            }
                            className={`px-2 py-0.5 text-[9.5px] font-mono rounded border transition-colors ${
                              node.vlanConfig?.vlanId === preset.id
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Trunk Allowed VLANs (if Trunk Mode) */}
                    {node.vlanConfig.mode === 'trunk' && (
                      <div className="space-y-1 rounded bg-white p-2 border border-indigo-100 text-xs">
                        <label className="text-[10px] font-semibold text-slate-700">Daftar Allowed VLANs (Trunk):</label>
                        <input
                          type="text"
                          value={(node.vlanConfig.allowedVlans || [10, 20, 50, 100, 1049]).join(', ')}
                          onChange={(e) => {
                            const list = e.target.value
                              .split(',')
                              .map((v) => parseInt(v.trim()))
                              .filter((v) => !isNaN(v) && v >= 1 && v <= 4094);
                            onUpdateNode({
                              ...node,
                              vlanConfig: {
                                ...node.vlanConfig!,
                                allowedVlans: list,
                              },
                            });
                          }}
                          placeholder="10, 20, 50, 100, 1049"
                          className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-800 focus:outline-none"
                        />
                        <span className="text-[9px] text-slate-500 block">
                          Daftar VLAN ID yang diizinkan lewat melewati trunk ini (pisahkan dengan koma).
                        </span>
                      </div>
                    )}

                    {/* 802.1Q Frame Tag Technical Inspection */}
                    <div className="rounded-lg bg-slate-900 p-2 text-white font-mono text-[10px] space-y-1">
                      <div className="text-[9px] text-indigo-300 font-sans font-semibold flex items-center justify-between">
                        <span>Format Frame Header Ethernet (IEEE 802.1Q)</span>
                        <span className="text-emerald-400">4-Byte Tag</span>
                      </div>
                      <div className="flex items-center gap-1 overflow-x-auto text-[9.5px] py-0.5">
                        <div className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-[8px] text-slate-400 block font-sans">TPID:</span>
                          <span className="text-amber-300">0x8100</span>
                        </div>
                        <div className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-[8px] text-slate-400 block font-sans">PCP:</span>
                          <span className="text-sky-300">{node.vlanConfig.priorityCos ?? 0}</span>
                        </div>
                        <div className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-[8px] text-slate-400 block font-sans">DEI:</span>
                          <span className="text-slate-300">0</span>
                        </div>
                        <div className="bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-500 font-bold">
                          <span className="text-[8px] text-indigo-300 block font-sans">VLAN ID (VID):</span>
                          <span className="text-white text-xs">{node.vlanConfig.vlanId}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PC & Laptop Speedtest Feature */}
            {(node.type === 'pc' || node.type === 'laptop') && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <Gauge className="h-4 w-4 text-sky-600" />
                    <span>Uji Kecepatan Internet (Speedtest)</span>
                  </span>
                  <button
                    onClick={runSpeedtest}
                    disabled={speedtestRunning || !node.poweredOn}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                  >
                    {speedtestRunning ? 'Menguji...' : 'Mulai Tes'}
                  </button>
                </div>

                {/* Real-time Internet Health Warning */}
                {!internetStatus.hasInternet && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-rose-800 text-[10.5px]">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span>Tidak Ada Akses Internet</span>
                    </div>
                    <p className="text-[10px] text-rose-700 leading-tight">
                      {internetStatus.reason}
                    </p>
                  </div>
                )}

                {speedtestResult && (
                  speedtestResult.failed ? (
                    <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-200 text-center font-mono space-y-1">
                      <div className="text-xs font-bold text-rose-700">❌ UJI KECEPATAN GAGAL (0 Mbps)</div>
                      <div className="text-[10px] text-rose-600 font-sans">{speedtestResult.error}</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[9px] text-slate-500">UNDUH</div>
                        <div className="text-sm font-bold text-sky-700">{speedtestResult.down} Mbps</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[9px] text-slate-500">UNGGAH</div>
                        <div className="text-sm font-bold text-emerald-700">{speedtestResult.up} Mbps</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[9px] text-slate-500">PING</div>
                        <div className="text-sm font-bold text-slate-700">{speedtestResult.ping} ms</div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* REAL ACCESS POINT ENTERPRISE CONFIGURATION */}
            {node.type === 'access_point' && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                  <div className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                    <Wifi className="h-4 w-4 text-sky-600" />
                    <span>Access Point Enterprise ({node.brand || 'UniFi / Ruijie'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                    Wi-Fi 6 PoE
                  </span>
                </div>

                <div className="space-y-2 bg-white p-2.5 rounded-lg border border-sky-100 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">SSID 2.4GHz</label>
                    <input
                      type="text"
                      value={node.accessPointConfig?.ssid24 || 'Office-WiFi'}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          accessPointConfig: {
                            ssid24: e.target.value,
                            ssid5: node.accessPointConfig?.ssid5 || 'Office-WiFi-5G',
                            wifiKey: node.accessPointConfig?.wifiKey || 'kantor12345',
                            channel24: node.accessPointConfig?.channel24 || 1,
                            channel5: node.accessPointConfig?.channel5 || 36,
                            poePowered: node.accessPointConfig?.poePowered ?? true,
                            vlanTagged: node.accessPointConfig?.vlanTagged ?? true,
                            vlanId: node.accessPointConfig?.vlanId || 20,
                            txPowerDbm: node.accessPointConfig?.txPowerDbm || 20,
                            guestPortalEnabled: node.accessPointConfig?.guestPortalEnabled ?? false,
                          },
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">SSID 5GHz (High Speed)</label>
                    <input
                      type="text"
                      value={node.accessPointConfig?.ssid5 || 'Office-WiFi-5G'}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          accessPointConfig: {
                            ssid24: node.accessPointConfig?.ssid24 || 'Office-WiFi',
                            ssid5: e.target.value,
                            wifiKey: node.accessPointConfig?.wifiKey || 'kantor12345',
                            channel24: node.accessPointConfig?.channel24 || 1,
                            channel5: node.accessPointConfig?.channel5 || 36,
                            poePowered: node.accessPointConfig?.poePowered ?? true,
                            vlanTagged: node.accessPointConfig?.vlanTagged ?? true,
                            vlanId: node.accessPointConfig?.vlanId || 20,
                            txPowerDbm: node.accessPointConfig?.txPowerDbm || 20,
                            guestPortalEnabled: node.accessPointConfig?.guestPortalEnabled ?? false,
                          },
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Password WPA2/WPA3</label>
                    <input
                      type="text"
                      value={node.accessPointConfig?.wifiKey || 'kantor12345'}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          accessPointConfig: {
                            ssid24: node.accessPointConfig?.ssid24 || 'Office-WiFi',
                            ssid5: node.accessPointConfig?.ssid5 || 'Office-WiFi-5G',
                            wifiKey: e.target.value,
                            channel24: node.accessPointConfig?.channel24 || 1,
                            channel5: node.accessPointConfig?.channel5 || 36,
                            poePowered: node.accessPointConfig?.poePowered ?? true,
                            vlanTagged: node.accessPointConfig?.vlanTagged ?? true,
                            vlanId: node.accessPointConfig?.vlanId || 20,
                            txPowerDbm: node.accessPointConfig?.txPowerDbm || 20,
                            guestPortalEnabled: node.accessPointConfig?.guestPortalEnabled ?? false,
                          },
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-sky-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">VLAN Tagging (SSID Tamu / Hotspot)</span>
                      <p className="text-[10px] text-slate-500">Pisahkan traffic tamu via VLAN ID</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.accessPointConfig?.vlanTagged ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          accessPointConfig: {
                            ssid24: node.accessPointConfig?.ssid24 || 'Office-WiFi',
                            ssid5: node.accessPointConfig?.ssid5 || 'Office-WiFi-5G',
                            wifiKey: node.accessPointConfig?.wifiKey || 'kantor12345',
                            channel24: node.accessPointConfig?.channel24 || 1,
                            channel5: node.accessPointConfig?.channel5 || 36,
                            poePowered: node.accessPointConfig?.poePowered ?? true,
                            vlanTagged: e.target.checked,
                            vlanId: node.accessPointConfig?.vlanId || 20,
                            txPowerDbm: node.accessPointConfig?.txPowerDbm || 20,
                            guestPortalEnabled: node.accessPointConfig?.guestPortalEnabled ?? false,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                    />
                  </label>
                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-sky-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Captive Guest Portal</span>
                      <p className="text-[10px] text-slate-500">Halaman login web voucher hotspot</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.accessPointConfig?.guestPortalEnabled ?? false}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          accessPointConfig: {
                            ssid24: node.accessPointConfig?.ssid24 || 'Office-WiFi',
                            ssid5: node.accessPointConfig?.ssid5 || 'Office-WiFi-5G',
                            wifiKey: node.accessPointConfig?.wifiKey || 'kantor12345',
                            channel24: node.accessPointConfig?.channel24 || 1,
                            channel5: node.accessPointConfig?.channel5 || 36,
                            poePowered: node.accessPointConfig?.poePowered ?? true,
                            vlanTagged: node.accessPointConfig?.vlanTagged ?? true,
                            vlanId: node.accessPointConfig?.vlanId || 20,
                            txPowerDbm: node.accessPointConfig?.txPowerDbm || 20,
                            guestPortalEnabled: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* REAL HARDWARE FIREWALL CONFIGURATION */}
            {node.type === 'firewall' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
                  <div className="font-bold text-rose-950 text-xs flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-rose-600" />
                    <span>Hardware Firewall / UTM ({node.brand || 'Fortinet'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    UTM Next-Gen
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Stateful Firewall & NAT Masquerade</span>
                      <p className="text-[10px] text-slate-500">Translasi IP privat LAN ke IP publik WAN</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.firewallConfig?.natEnabled ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          firewallConfig: {
                            natEnabled: e.target.checked,
                            ipsEnabled: node.firewallConfig?.ipsEnabled ?? true,
                            vpnServer: node.firewallConfig?.vpnServer ?? false,
                            wanFailover: node.firewallConfig?.wanFailover ?? true,
                            blockedPorts: node.firewallConfig?.blockedPorts || [23, 445, 3389],
                            bandwidthShaping: node.firewallConfig?.bandwidthShaping ?? true,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                  </label>
                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Intrusion Prevention System (IPS)</span>
                      <p className="text-[10px] text-slate-500">Blokir otomatis serangan exploit dan port scanning</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.firewallConfig?.ipsEnabled ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          firewallConfig: {
                            natEnabled: node.firewallConfig?.natEnabled ?? true,
                            ipsEnabled: e.target.checked,
                            vpnServer: node.firewallConfig?.vpnServer ?? false,
                            wanFailover: node.firewallConfig?.wanFailover ?? true,
                            blockedPorts: node.firewallConfig?.blockedPorts || [23, 445, 3389],
                            bandwidthShaping: node.firewallConfig?.bandwidthShaping ?? true,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                  </label>
                  <label className="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-100 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Dual-WAN Failover</span>
                      <p className="text-[10px] text-slate-500">Pindah jalur internet otomatis saat ISP utama putus</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.firewallConfig?.wanFailover ?? true}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          firewallConfig: {
                            natEnabled: node.firewallConfig?.natEnabled ?? true,
                            ipsEnabled: node.firewallConfig?.ipsEnabled ?? true,
                            vpnServer: node.firewallConfig?.vpnServer ?? false,
                            wanFailover: e.target.checked,
                            blockedPorts: node.firewallConfig?.blockedPorts || [23, 445, 3389],
                            bandwidthShaping: node.firewallConfig?.bandwidthShaping ?? true,
                          },
                        })
                      }
                      className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                  </label>
                </div>

                <div className="bg-white p-2 rounded-lg border border-rose-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-700 block">Port Rentan Terblokir (Security Policy):</span>
                  <div className="flex flex-wrap gap-1">
                    {['Port 23 (Telnet)', 'Port 445 (SMB/WannaCry)', 'Port 3389 (RDP Public)'].map((p) => (
                      <span key={p} className="text-[9.5px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* REAL NAS STORAGE & NVR CONFIGURATION */}
            {node.type === 'nas' && (
              <div className="rounded-xl border border-slate-300 bg-slate-50/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4 text-slate-700" />
                    <span>NAS Storage & NVR ({node.brand || 'Synology'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                    {node.nasConfig?.raidLevel || 'RAID 5'} (16 TB)
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-600">Kapasitas Penyimpanan:</span>
                    <span className="font-mono text-[11px] font-bold text-slate-800">4.2 TB / 16.0 TB (26%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-sky-600 h-full rounded-full" style={{ width: '26%' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                    <div className="p-1 rounded bg-slate-50 border border-slate-100">
                      <span className="text-slate-500 block">Protokol Share:</span>
                      <strong className="text-slate-800 font-mono">SMB 3.0 / NFS v4</strong>
                    </div>
                    <div className="p-1 rounded bg-slate-50 border border-slate-100">
                      <span className="text-slate-500 block">Rekaman CCTV:</span>
                      <strong className="text-emerald-700">Aktif (Continuous)</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* REAL VOIP PHONE CONFIGURATION */}
            {node.type === 'voip_phone' && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                  <div className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-sky-600" />
                    <span>IP Phone VoIP ({node.brand || 'Yealink'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    SIP REGISTERED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-sky-100 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold font-sans block">Nomor Ekstensi</label>
                    <input
                      type="text"
                      value={node.voipConfig?.sipExtension || '1001'}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          voipConfig: {
                            sipExtension: e.target.value,
                            sipServerIp: node.voipConfig?.sipServerIp || '192.168.1.200',
                            codec: node.voipConfig?.codec || 'G.711u',
                            voiceVlanId: node.voipConfig?.voiceVlanId || 30,
                            status: 'registered',
                          },
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold font-sans block">Voice VLAN ID</label>
                    <input
                      type="number"
                      value={node.voipConfig?.voiceVlanId || 30}
                      onChange={(e) =>
                        onUpdateNode({
                          ...node,
                          voipConfig: {
                            sipExtension: node.voipConfig?.sipExtension || '1001',
                            sipServerIp: node.voipConfig?.sipServerIp || '192.168.1.200',
                            codec: node.voipConfig?.codec || 'G.711u',
                            voiceVlanId: Number(e.target.value),
                            status: 'registered',
                          },
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* REAL NETWORK PRINTER CONFIGURATION */}
            {node.type === 'printer' && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-teal-200/80 pb-2">
                  <div className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                    <Printer className="h-4 w-4 text-teal-700" />
                    <span>Printer Jaringan ({node.brand || 'Epson / HP'})</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    SIAP CETAK
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-teal-100 text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-semibold">Protokol Print:</span>
                    <span className="font-mono text-slate-800 font-bold">RAW Port 9100 / IPP 631</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-semibold block">Level Tinta / Toner:</span>
                    <div className="grid grid-cols-4 gap-1 text-center font-mono text-[9px]">
                      <div className="p-1 rounded bg-cyan-50 border border-cyan-200">
                        <div className="font-bold text-cyan-800">C: 85%</div>
                      </div>
                      <div className="p-1 rounded bg-pink-50 border border-pink-200">
                        <div className="font-bold text-pink-800">M: 90%</div>
                      </div>
                      <div className="p-1 rounded bg-yellow-50 border border-yellow-200">
                        <div className="font-bold text-yellow-800">Y: 88%</div>
                      </div>
                      <div className="p-1 rounded bg-slate-100 border border-slate-300">
                        <div className="font-bold text-slate-900">K: 95%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TELEMETRY & PHYSICAL PORTS */}
        {activeTab === 'telemetry' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Optical Telemetry Section */}
            {opticalResult && opticalResult.status !== 'disconnected' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <span>Daya Terima Optik (Rx Power)</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-800">
                    {opticalResult.rxPowerDbm} dBm
                  </span>
                </div>

                <div className="text-[11px] text-emerald-900">
                  Status: <strong>{opticalResult.statusLabel}</strong>
                </div>

                {opticalResult.lossBreakdown.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-950 uppercase">
                      Rincian Redaman Optik (Power Budget):
                    </span>
                    {opticalResult.lossBreakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10.5px] text-emerald-900">
                        <span className="truncate pr-2">{item.description}</span>
                        <span className="font-mono shrink-0">-{item.lossDb.toFixed(1)} dB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ports Status Table */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-[11px] block uppercase">
                    Daftar Port Fisik ({node.ports.length} Port)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {node.ports.reduce((n, p) => n + cablesOnPort(p).length, 0)} terpakai, {node.ports.reduce((n, p) => n + (portCapacity(p) - cablesOnPort(p).length), 0)} tersedia
                  </span>
                </div>
                <button
                  onClick={() => setShowAddPortDropdown(!showAddPortDropdown)}
                  className="flex items-center gap-1 px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded text-[10.5px] font-bold transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>Tambah Port</span>
                </button>
              </div>

              {/* Add Port Dropdown / Selector */}
              {showAddPortDropdown && (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 animate-in fade-in duration-100">
                  <span className="text-[10px] font-bold text-slate-700 block">Pilih Tipe Media Port Baru:</span>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { medium: 'ethernet' as const, label: 'LAN (RJ45)' },
                      { medium: 'fiber' as const, label: 'Optik (SC)' },
                      { medium: 'wireless' as const, label: 'Wi-Fi' },
                      { medium: 'coaxial' as const, label: 'Coaxial' },
                    ].map((m) => (
                      <button
                        key={m.medium}
                        onClick={() => handleAddPort(m.medium)}
                        className="py-1 px-1.5 text-[10px] font-semibold bg-white hover:bg-sky-50 hover:text-sky-800 hover:border-sky-300 rounded border border-slate-200 transition-colors text-center"
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {node.ports.map((port) => {
                  const plugCables = cablesOnPort(port)
                    .map((id) => allCables.find((c) => c.id === id))
                    .filter((c): c is CableConnection => Boolean(c));
                  const plugCable = plugCables[0];
                  const isPlugged = plugCables.length > 0;
                  const isSharedPort = portCapacity(port) > 1;
                  const peerNames = plugCables.map((c) => {
                    const id = c.fromNodeId === node.id ? c.toNodeId : c.fromNodeId;
                    return allNodes.find((n) => n.id === id)?.name || 'Perangkat Lain';
                  });
                  const peerNode = peerNames.length > 0 ? { name: peerNames[0] } : undefined;

                  return (
                    <div
                      key={port.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          title={port.status === 'up' ? 'Status Link: Up' : 'Status Link: Down'}
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            port.status === 'up' ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 block truncate">{port.name}</span>
                          <span className={`block text-[10px] truncate ${isPlugged ? 'text-sky-700 font-medium' : 'text-slate-500'}`}>
                            {isSharedPort
                              ? isPlugged
                                ? `${plugCables.length}/${portCapacity(port)} klien: ${peerNames.slice(0, 3).join(', ')}${peerNames.length > 3 ? ` +${peerNames.length - 3} lagi` : ''}`
                                : `Radio Wi-Fi, siap melayani sampai ${portCapacity(port)} klien`
                              : isPlugged
                              ? `Terpasang Kabel -> ${peerNode?.name || 'Perangkat Lain'}`
                              : 'Port Kosong (Siap Dihubungkan)'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                            isPlugged
                              ? 'text-sky-700 bg-sky-50 border-sky-200 font-semibold'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          {isSharedPort ? `${plugCables.length}/${portCapacity(port)}` : isPlugged ? 'Terisi' : 'Kosong'}
                        </span>
                        <span className="font-mono text-[10px] uppercase text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {port.medium}
                        </span>
                        {isPlugged && !isSharedPort && onSelectCable && plugCable && (
                          <button
                            onClick={() => onSelectCable(plugCable.id)}
                            title="Pilih & buka pengaturan kabel ini"
                            className="px-2 py-0.5 text-[9.5px] font-bold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded transition-colors flex items-center gap-1"
                          >
                            <Cable className="h-3 w-3" />
                            <span>Pilih Kabel</span>
                          </button>
                        )}
                        {isPlugged && !isSharedPort && onDisconnectCable && plugCable && (
                          <button
                            onClick={() => onDisconnectCable(plugCable.id)}
                            title="Cabut kabel dari port ini"
                            className="px-1.5 py-0.5 text-[9.5px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
                          >
                            Cabut
                          </button>
                        )}
                        {!isPlugged && node.ports.length > 1 && (
                          <button
                            onClick={() => handleRemovePort(port.id)}
                            title="Hapus port kosong ini"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOP & EDUKASI */}
        {activeTab === 'sop' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-sky-900 text-xs">
                <Info className="h-4 w-4 text-sky-600 shrink-0" />
                <span>Fungsi Utama di Lapangan</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                {meta.fullDescription}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
                <span>SOP & Tips Teknisi Lapangan</span>
              </div>
              <ul className="space-y-1 text-[10.5px] text-amber-950 list-disc pl-3.5 leading-snug">
                {meta.technicianTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {/* Di mobile, dock bawah (fixed, z-50) menimpa footer panel ini; beri ruang setinggi dock agar tombol bisa diklik. */}
      <div className="p-3 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] md:pb-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <button
          onClick={() => onDeleteNode(node.id)}
          className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          <span>Hapus Node</span>
        </button>

        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
        >
          Selesai
        </button>
      </div>
    </div>
  );
};
