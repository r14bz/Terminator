import React, { useState } from 'react';
import {
  Monitor,
  Laptop,
  Server,
  Smartphone,
  Printer,
  Network,
  Boxes,
  Waypoints,
  Cpu,
  Zap,
  Split,
  Radio,
  Camera,
  Wifi,
  Share2,
  Cloud,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react';
import { DeviceType } from '../types/network';
import { DEVICE_TEMPLATES } from '../constants/deviceCatalog';

interface DeviceSidebarProps {
  onAddDevice: (type: DeviceType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Monitor,
  Laptop,
  Server,
  Smartphone,
  Printer,
  Network,
  Boxes,
  Waypoints,
  Cpu,
  Zap,
  Split,
  Radio,
  Camera,
  Wifi,
  Share2,
  Cloud,
};

export const DeviceSidebar: React.FC<DeviceSidebarProps> = ({ onAddDevice, isOpenMobile = true, onCloseMobile }) => {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    end_device: false,
    switching: false,
    routing: false,
    optical: false,
    iot: false,
    wireless: false,
  });

  const categories = [
    { id: 'end_device', label: 'Perangkat Pengguna (End Devices)' },
    { id: 'switching', label: 'Switching & Hub LAN' },
    { id: 'routing', label: 'Routing & Gateway ISP' },
    { id: 'optical', label: 'Infrastruktur FTTH GPON (ODC, ODP, OLT, ONT)' },
    { id: 'iot_smart', label: 'Perangkat IoT, Sensor & Smart Device' },
    { id: 'wireless_iot', label: 'Nirkabel, Access Point & Mesh' },
  ];

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const filteredDevices = Object.entries(DEVICE_TEMPLATES).filter(([_, tmpl]) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      tmpl.defaultName.toLowerCase().includes(q) ||
      tmpl.type.toLowerCase().includes(q) ||
      tmpl.description.toLowerCase().includes(q)
    );
  });

  const handleDragStart = (e: React.DragEvent, type: DeviceType) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-30 w-64 sm:w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none shrink-0 text-slate-200 transition-transform duration-200 ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Search Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Cari perangkat (PC, OLT, ODC, Sensor)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5 text-[10px] text-slate-400">
          <span>Klik / seret ke kanvas</span>
          {onCloseMobile && (
            <button onClick={onCloseMobile} className="md:hidden text-blue-400 font-medium">
              Tutup Panel &times;
            </button>
          )}
        </div>
      </div>

      {/* Device List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
        {categories.map((cat) => {
          const catDevices = filteredDevices.filter(([_, tmpl]) => tmpl.category === cat.id);
          if (catDevices.length === 0) return null;
          const isCollapsed = collapsedCategories[cat.id];

          return (
            <div key={cat.id} className="space-y-1">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  )}
                  <span className="truncate">{cat.label}</span>
                </span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                  {catDevices.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 gap-1 pl-1 pr-0.5">
                  {catDevices.map(([typeKey, tmpl]) => {
                    const devType = typeKey as DeviceType;
                    const Icon = ICON_MAP[tmpl.iconName] || Monitor;

                    return (
                      <div
                        key={devType}
                        draggable
                        onDragStart={(e) => handleDragStart(e, devType)}
                        onClick={() => {
                          onAddDevice(devType);
                          if (window.innerWidth < 768 && onCloseMobile) {
                            onCloseMobile();
                          }
                        }}
                        className="group flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/70 hover:border-blue-500/50 cursor-pointer transition-all hover:shadow-md"
                        title={tmpl.description}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: `${tmpl.color}20`, color: tmpl.color }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-200 group-hover:text-blue-300 truncate">
                              {tmpl.defaultName}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {tmpl.defaultPorts.length} Port{' '}
                              {tmpl.category === 'optical' ? '(FTTH FO)' : tmpl.category === 'iot_smart' ? '(IoT)' : ''}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddDevice(devType);
                            if (window.innerWidth < 768 && onCloseMobile) {
                              onCloseMobile();
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white hover:bg-blue-600 rounded transition-all shrink-0 ml-1"
                          title="Tambah ke kanvas"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Total: {Object.keys(DEVICE_TEMPLATES).length} Perangkat</span>
        <span className="text-emerald-400 font-mono text-[10px]">TERMINATOR v3.0</span>
      </div>
    </aside>
  );
};
