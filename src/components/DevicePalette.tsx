import React, { useState } from 'react';
import {
  Globe,
  Radio,
  Server,
  Layers,
  Box,
  Share2,
  Cpu,
  Monitor,
  Camera,
  Smartphone,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { NodeType, DeviceCategory } from '../types/network';
import { DEVICE_METADATA } from '../data/deviceDefinitions';

interface DevicePaletteProps {
  onAddDevice: (type: NodeType) => void;
}

const CATEGORY_TABS: Array<{ id: DeviceCategory; label: string }> = [
  { id: 'ftth', label: 'FTTH & Optik' },
  { id: 'routing', label: 'Routing & Switch' },
  { id: 'client_iot', label: 'Klien & IoT' },
  { id: 'infrastructure', label: 'Infrastruktur' },
];

export const DevicePalette: React.FC<DevicePaletteProps> = ({ onAddDevice }) => {
  const [activeTab, setActiveTab] = useState<DeviceCategory>('ftth');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredDevice, setHoveredDevice] = useState<NodeType | null>(null);

  const getDeviceIcon = (type: NodeType) => {
    switch (type) {
      case 'internet':
        return <Globe className="h-4 w-4 text-sky-600" />;
      case 'metro':
        return <Radio className="h-4 w-4 text-indigo-600" />;
      case 'olt':
        return <Server className="h-4 w-4 text-emerald-600" />;
      case 'odc':
        return <Box className="h-4 w-4 text-amber-600" />;
      case 'odp':
        return <Box className="h-4 w-4 text-teal-600" />;
      case 'splitter':
        return <Share2 className="h-4 w-4 text-rose-600" />;
      case 'htb':
        return <Cpu className="h-4 w-4 text-purple-600" />;
      case 'ont':
        return <Radio className="h-4 w-4 text-sky-600" />;
      case 'mikrotik':
        return <Cpu className="h-4 w-4 text-orange-600" />;
      case 'switch':
        return <Layers className="h-4 w-4 text-blue-600" />;
      case 'router':
        return <Radio className="h-4 w-4 text-cyan-600" />;
      case 'mesh':
        return <Radio className="h-4 w-4 text-emerald-600" />;
      case 'pc':
        return <Monitor className="h-4 w-4 text-slate-700" />;
      case 'cctv':
        return <Camera className="h-4 w-4 text-purple-600" />;
      case 'smartphone':
        return <Smartphone className="h-4 w-4 text-cyan-600" />;
      case 'iot':
        return <Zap className="h-4 w-4 text-teal-600" />;
      case 'server':
        return <Server className="h-4 w-4 text-slate-800" />;
      default:
        return <Box className="h-4 w-4" />;
    }
  };

  const devicesInCategory = Object.values(DEVICE_METADATA).filter(
    (d) => d.category === activeTab
  );

  const hoveredMeta = hoveredDevice ? DEVICE_METADATA[hoveredDevice] : null;

  return (
    <aside className="relative flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white shadow-xs z-20 md:w-72 shrink-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Katalog Perangkat
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            (Klik untuk pasang)
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="md:hidden p-1 text-slate-500 hover:text-slate-800 rounded"
          title="Buka/Tutup Palet"
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col p-2.5 space-y-2">
          {/* Category Tabs (Segmented Control) */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-all truncate text-center ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Device list */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5 max-h-52 md:max-h-72 overflow-y-auto pr-0.5">
            {devicesInCategory.map((dev) => (
              <button
                key={dev.type}
                onClick={() => onAddDevice(dev.type)}
                onMouseEnter={() => setHoveredDevice(dev.type)}
                onMouseLeave={() => setHoveredDevice(null)}
                className="group flex items-start gap-2 rounded-lg border border-slate-200/90 bg-white p-2 text-left hover:border-sky-300 hover:bg-sky-50/40 hover:shadow-2xs transition-all"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50 border border-slate-200 group-hover:bg-white group-hover:border-sky-300 transition-colors">
                  {getDeviceIcon(dev.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-900 truncate">
                      {dev.name.split('(')[0]}
                    </span>
                    <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 leading-tight">
                    {dev.shortDesc}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Educational Tooltip Box for Beginners (Sangat ramah teknisi) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 text-xs text-slate-700">
            {hoveredMeta ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-[11px]">
                  <Info className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                  <span className="truncate">{hoveredMeta.name}</span>
                </div>
                <p className="text-[10.5px] text-slate-600 leading-snug">
                  {hoveredMeta.technicianRole}
                </p>
                {hoveredMeta.standardOpticalLoss && (
                  <div className="text-[10px] text-amber-700 font-medium">
                    Standar: {hoveredMeta.standardOpticalLoss}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                <Info className="h-4 w-4 shrink-0 text-slate-400" />
                <span>Arahkan kursor ke perangkat untuk melihat fungsi teknis & standar SOP.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
