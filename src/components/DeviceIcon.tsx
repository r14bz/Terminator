import React from 'react';
import {
  Globe, Radio, Server, Layers, Box, Share2, Cpu, Monitor, Camera, Smartphone, Zap,
  Wifi, Shield, HardDrive, Laptop, Printer, Phone, Network, Router,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Satu sumber ikon + warna untuk semua perangkat (Canvas & DevicePalette).
 * Memakai warna inline (gradient) supaya tampil sama kontras di mode terang
 * maupun gelap, dan tidak terpengaruh override kelas Tailwind di index.css.
 */
interface DeviceStyle { Icon: LucideIcon; from: string; to: string }

const STYLES: Record<string, DeviceStyle> = {
  internet:       { Icon: Globe,      from: '#38bdf8', to: '#0284c7' },
  internet_source:{ Icon: Globe,      from: '#4ade80', to: '#15803d' },
  metro:          { Icon: Network,    from: '#818cf8', to: '#4f46e5' },
  olt:            { Icon: Server,     from: '#34d399', to: '#059669' },
  odc:            { Icon: Box,        from: '#fbbf24', to: '#d97706' },
  odp:            { Icon: Box,        from: '#2dd4bf', to: '#0d9488' },
  splitter:       { Icon: Share2,     from: '#fb7185', to: '#e11d48' },
  htb:            { Icon: Cpu,        from: '#c084fc', to: '#7c3aed' },
  ont:            { Icon: Radio,      from: '#22d3ee', to: '#0891b2' },
  mikrotik:       { Icon: Router,     from: '#fb923c', to: '#ea580c' },
  switch:         { Icon: Layers,     from: '#60a5fa', to: '#2563eb' },
  switch_managed: { Icon: Layers,     from: '#a78bfa', to: '#6d28d9' },
  router:         { Icon: Router,     from: '#2dd4bf', to: '#0f766e' },
  ap_ptp:         { Icon: Radio,      from: '#38bdf8', to: '#0369a1' },
  mesh:           { Icon: Share2,     from: '#4ade80', to: '#16a34a' },
  access_point:   { Icon: Wifi,       from: '#38bdf8', to: '#0284c7' },
  firewall:       { Icon: Shield,     from: '#f87171', to: '#dc2626' },
  nas:            { Icon: HardDrive,  from: '#94a3b8', to: '#475569' },
  pc:             { Icon: Monitor,    from: '#818cf8', to: '#4338ca' },
  laptop:         { Icon: Laptop,     from: '#a78bfa', to: '#7c3aed' },
  printer:        { Icon: Printer,    from: '#2dd4bf', to: '#0f766e' },
  voip_phone:     { Icon: Phone,      from: '#f472b6', to: '#db2777' },
  cctv:           { Icon: Camera,     from: '#e879f9', to: '#a21caf' },
  smartphone:     { Icon: Smartphone, from: '#22d3ee', to: '#0e7490' },
  iot:            { Icon: Zap,        from: '#facc15', to: '#ca8a04' },
  server:         { Icon: Server,     from: '#fb923c', to: '#c2410c' },
};

const FALLBACK: DeviceStyle = { Icon: Box, from: '#94a3b8', to: '#475569' };

interface DeviceIconProps {
  type: string;
  /** Ukuran kotak ikon dalam px. */
  size?: number;
  className?: string;
}

export const DeviceIcon: React.FC<DeviceIconProps> = ({ type, size = 28, className = '' }) => {
  const { Icon, from, to } = STYLES[type] ?? FALLBACK;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: `linear-gradient(135deg, ${from}, ${to})`,
        boxShadow: `0 1px 3px ${to}66, inset 0 1px 0 rgba(255,255,255,.28)`,
      }}
    >
      <Icon style={{ width: size * 0.58, height: size * 0.58, color: '#fff' }} strokeWidth={2.2} />
    </span>
  );
};

export const DEVICE_ICON_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(STYLES).map(([k, v]) => [k, v.to]),
);
