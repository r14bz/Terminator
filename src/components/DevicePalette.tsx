import React, { useState } from 'react';
import {
  Globe, Radio, Server, Layers, Box, Share2, Cpu, Monitor, Camera, Smartphone, Zap, Info,
  ChevronDown, ChevronUp, Plus, Wifi, Shield, HardDrive, Laptop, Printer, Phone, X,
} from 'lucide-react';
import type { NodeType, DeviceCategory } from '../types/network';
import { DEVICE_METADATA } from '../data/deviceDefinitions';

interface DevicePaletteProps {
  onAddDevice: (type: NodeType) => void;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_TABS: Array<{ id: DeviceCategory; label: string }> = [
  { id: 'ftth', label: 'FTTH & Optik' },
  { id: 'routing', label: 'Routing & Switch' },
  { id: 'client_iot', label: 'Klien & IoT' },
  { id: 'infrastructure', label: 'Infrastruktur' },
];

export const DevicePalette: React.FC<DevicePaletteProps> = ({ onAddDevice, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<DeviceCategory>('ftth');
  const [hoveredDevice, setHoveredDevice] = useState<NodeType | null>(null);

  const getDeviceIcon = (type: NodeType) => {
    switch (type) {
      case 'internet': return <Globe className="h-4 w-4 text-sky-600" />;
      case 'metro': return <Radio className="h-4 w-4 text-indigo-600" />;
      case 'olt': return <Server className="h-4 w-4 text-emerald-600" />;
      case 'odc': return <Box className="h-4 w-4 text-amber-600" />;
      case 'odp': return <Box className="h-4 w-4 text-teal-600" />;
      case 'splitter': return <Share2 className="h-4 w-4 text-rose-600" />;
      case 'htb': return <Cpu className="h-4 w-4 text-purple-600" />;
      case 'ont': return <Radio className="h-4 w-4 text-sky-600" />;
      case 'mikrotik': return <Cpu className="h-4 w-4 text-orange-600" />;
      case 'switch': return <Layers className="h-4 w-4 text-blue-600" />;
      case 'switch_managed': return <Layers className="h-4 w-4 text-indigo-700" />;
      case 'router': return <Radio className="h-4 w-4 text-cyan-600" />;
      case 'ap_ptp': return <Radio className="h-4 w-4 text-sky-700" />;
      case 'mesh': return <Radio className="h-4 w-4 text-emerald-600" />;
      case 'access_point': return <Wifi className="h-4 w-4 text-sky-600" />;
      case 'firewall': return <Shield className="h-4 w-4 text-red-600" />;
      case 'nas': return <HardDrive className="h-4 w-4 text-slate-700" />;
      case 'pc': return <Monitor className="h-4 w-4 text-slate-700" />;
      case 'laptop': return <Laptop className="h-4 w-4 text-slate-700" />;
      case 'printer': return <Printer className="h-4 w-4 text-teal-700" />;
      case 'voip_phone': return <Phone className="h-4 w-4 text-sky-700" />;
      case 'cctv': return <Camera className="h-4 w-4 text-purple-600" />;
      case 'smartphone': return <Smartphone className="h-4 w-4 text-cyan-600" />;
      case 'iot': return <Zap className="h-4 w-4 text-teal-600" />;
      case 'server': return <Server className="h-4 w-4 text-slate-800" />;
      default: return <Box className="h-4 w-4" />;
    }
  };

  const devicesInCategory = Object.values(DEVICE_METADATA).filter((d) => d.category === activeTab);
  const hoveredMeta = hoveredDevice ? DEVICE_METADATA[hoveredDevice] : null;

  return (
    <aside
      className={`
        md:relative md:flex md:flex-col md:w-72 md:shrink-0 md:border-r md:border-slate-200 md:bg-white md:shadow-xs md:z-20
        fixed inset-x-3 bottom-[92px] z-[55] flex-col max-h-[calc(100dvh-190px)] overflow-hidden rounded-2xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur-md
        transition-all duration-200
        ${isOpen ? 'flex' : 'hidden md:flex'}
      `}
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Katalog Perangkat</span>
          <span className="text-[10px] font-medium text-slate-500">(Klik untuk pasang)</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 md:hidden"
          title="Tutup katalog perangkat"
        >
          <X className="h-4 w-4" />
        </button>
        <ChevronUp className="hidden h-4 w-4 text-slate-500 md:block" />
      </div>

      <div className="flex min-h-0 flex-col gap-2 overflow-hidden p-2.5">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`truncate rounded-md px-2 py-1.5 text-center text-[11px] font-medium transition-all ${
                activeTab === tab.id ? 'bg-white font-semibold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 md:grid-cols-1">
          {devicesInCategory.map((dev) => (
            <button
              key={dev.type}
              onClick={() => onAddDevice(dev.type)}
              onMouseEnter={() => setHoveredDevice(dev.type)}
              onMouseLeave={() => setHoveredDevice(null)}
              className="group flex items-start gap-2 rounded-lg border border-slate-200/90 bg-white p-2 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40 hover:shadow-2xs"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 transition-colors group-hover:border-sky-300 group-hover:bg-white">
                {getDeviceIcon(dev.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-semibold text-slate-800 group-hover:text-sky-900">{dev.name.split('(')[0]}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:text-sky-600 group-hover:opacity-100" />
                </div>
                <p className="line-clamp-1 text-[10px] leading-tight text-slate-500">{dev.shortDesc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 text-xs text-slate-700">
          {hoveredMeta ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-900">
                <Info className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                <span className="truncate">{hoveredMeta.name}</span>
              </div>
              <p className="text-[10.5px] leading-snug text-slate-600">{hoveredMeta.technicianRole}</p>
              {hoveredMeta.standardOpticalLoss && <div className="text-[10px] font-medium text-amber-700">Standar: {hoveredMeta.standardOpticalLoss}</div>}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Info className="h-4 w-4 shrink-0 text-slate-400" />
              <span>Arahkan kursor ke perangkat untuk melihat fungsi teknis & standar SOP.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
