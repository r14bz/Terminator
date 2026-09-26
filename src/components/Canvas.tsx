import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  NetworkDevice,
  NetworkLink,
  PortConfig,
  CableType,
  PacketAnimation,
  TrafficGeneratorStream,
} from '../types/network';
import { CABLE_CATALOG } from '../constants/cableCatalog';
import { DEVICE_TEMPLATES } from '../constants/deviceCatalog';
import { ActiveTool } from './Toolbar';
import { calculateLinkCongestion, LinkCongestionMetrics } from '../utils/trafficEngine';
import { calculateDeviceOpticalPower } from '../utils/networkEngine';
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Trash2,
  Settings,
  Flame,
  AlertTriangle,
} from 'lucide-react';

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

export interface CanvasHandle {
  fitView: () => void;
}

interface CanvasProps {
  devices: NetworkDevice[];
  links: NetworkLink[];
  selectedDeviceId: string | null;
  selectedLinkId: string | null;
  activeTool: ActiveTool;
  isConnecting: boolean;
  connectingSourceId: string | null;
  packetAnimations: PacketAnimation[];
  activeStreams?: TrafficGeneratorStream[];
  onSelectDevice: (id: string | null) => void;
  onSelectLink: (id: string | null) => void;
  onDeviceMove: (id: string, x: number, y: number) => void;
  onDeviceMoveEnd?: (id: string, x: number, y: number, initialX: number, initialY: number) => void;
  onDeviceDoubleClick: (device: NetworkDevice) => void;
  onDeviceClickWithTool: (device: NetworkDevice) => void;
  onDeleteSelected: () => void;
  onDropNewDevice: (type: string, x: number, y: number) => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(({
  devices,
  links,
  selectedDeviceId,
  selectedLinkId,
  activeTool,
  isConnecting,
  connectingSourceId,
  packetAnimations,
  activeStreams = [],
  onSelectDevice,
  onSelectLink,
  onDeviceMove,
  onDeviceMoveEnd,
  onDeviceDoubleClick,
  onDeviceClickWithTool,
  onDeleteSelected,
  onDropNewDevice,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Node Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeOffset, setNodeOffset] = useState({ x: 0, y: 0 });
  const [nodeDragOrigin, setNodeDragOrigin] = useState<{ id: string; x: number; y: number } | null>(null);

  // Two-finger pinch-to-zoom gesture state. Stored in a ref (not React state)
  // because it's read/written on every touchmove frame and doesn't need to
  // trigger re-renders itself — only zoom/pan do.
  const pinchStateRef = useRef<{
    distance: number;
    zoom: number;
    pan: { x: number; y: number };
    mid: { x: number; y: number };
  } | null>(null);

  // Congestion metrics
  const linkCongestions = calculateLinkCongestion(devices, links, activeStreams);
  const congestionMap = new Map<string, LinkCongestionMetrics>(
    linkCongestions.map((m) => [m.linkId, m]),
  );

  // Handle canvas mouse down for panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      onSelectDevice(null);
      onSelectLink(null);

      if (e.button === 0 || e.button === 1) {
        setIsPanning(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    if (draggingNodeId) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const rawX = (e.clientX - containerRect.left - pan.x) / zoom;
      const rawY = (e.clientY - containerRect.top - pan.y) / zoom;

      // Snap to 10px grid
      const snappedX = Math.round((rawX - nodeOffset.x) / 10) * 10;
      const snappedY = Math.round((rawY - nodeOffset.y) / 10) * 10;

      onDeviceMove(draggingNodeId, Math.max(30, snappedX), Math.max(30, snappedY));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggingNodeId && nodeDragOrigin && onDeviceMoveEnd) {
      const currentDev = devices.find((d) => d.id === draggingNodeId);
      if (currentDev && (currentDev.x !== nodeDragOrigin.x || currentDev.y !== nodeDragOrigin.y)) {
        onDeviceMoveEnd(draggingNodeId, currentDev.x, currentDev.y, nodeDragOrigin.x, nodeDragOrigin.y);
      }
    }
    setDraggingNodeId(null);
    setNodeDragOrigin(null);
  };

  // Touch event handlers for Mobile friendly support
  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchMidpoint = (touches: React.TouchList, containerRect: DOMRect) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2 - containerRect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - containerRect.top,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two fingers down: start a pinch-to-zoom gesture. Cancel any single-
      // finger pan/drag that may have been in progress.
      setIsPanning(false);
      setDraggingNodeId(null);
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      pinchStateRef.current = {
        distance: getTouchDistance(e.touches),
        zoom,
        pan,
        mid: getTouchMidpoint(e.touches, containerRect),
      };
      return;
    }

    if (e.touches.length === 1 && (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg')) {
      const touch = e.touches[0];
      setIsPanning(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStateRef.current) {
      // Pinch-to-zoom: scale relative to the gesture's starting distance,
      // keeping the midpoint between the two fingers anchored on-screen
      // (same math as the mouse-wheel zoom, just driven by touch distance).
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const { distance: startDistance, zoom: startZoom, pan: startPan, mid } = pinchStateRef.current;
      if (startDistance < 1) return;

      const newDistance = getTouchDistance(e.touches);
      const scaleFactor = newDistance / startDistance;
      const newZoom = Math.min(Math.max(0.4, startZoom * scaleFactor), 2.5);

      setZoom(newZoom);
      setPan({
        x: mid.x - (mid.x - startPan.x) * (newZoom / startZoom),
        y: mid.y - (mid.y - startPan.y) * (newZoom / startZoom),
      });
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isPanning) {
        setPan({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        });
      } else if (draggingNodeId) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        const rawX = (touch.clientX - containerRect.left - pan.x) / zoom;
        const rawY = (touch.clientY - containerRect.top - pan.y) / zoom;

        const snappedX = Math.round((rawX - nodeOffset.x) / 10) * 10;
        const snappedY = Math.round((rawY - nodeOffset.y) / 10) * 10;

        onDeviceMove(draggingNodeId, Math.max(30, snappedX), Math.max(30, snappedY));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Once fewer than two fingers remain, the pinch gesture is over.
    if (e.touches.length < 2) {
      pinchStateRef.current = null;
    }
    setIsPanning(false);
    if (draggingNodeId && nodeDragOrigin && onDeviceMoveEnd) {
      const currentDev = devices.find((d) => d.id === draggingNodeId);
      if (currentDev && (currentDev.x !== nodeDragOrigin.x || currentDev.y !== nodeDragOrigin.y)) {
        onDeviceMoveEnd(draggingNodeId, currentDev.x, currentDev.y, nodeDragOrigin.x, nodeDragOrigin.y);
      }
    }
    setDraggingNodeId(null);
    setNodeDragOrigin(null);
  };

  // Zoom on wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(Math.max(0.4, zoom * zoomFactor), 2.5);

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Drag and drop from device catalog sidebar
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const deviceType = e.dataTransfer.getData('text/plain');
    if (!deviceType) return;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const dropX = (e.clientX - containerRect.left - pan.x) / zoom;
    const dropY = (e.clientY - containerRect.top - pan.y) / zoom;

    onDropNewDevice(deviceType, Math.round(dropX / 10) * 10, Math.round(dropY / 10) * 10);
  };

  const handleFitView = useCallback(() => {
    if (devices.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    devices.forEach((d) => {
      minX = Math.min(minX, d.x);
      minY = Math.min(minY, d.y);
      maxX = Math.max(maxX, d.x);
      maxY = Math.max(maxY, d.y);
    });

    const padding = 120;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const containerWidth = containerRef.current?.clientWidth || 1000;
    const containerHeight = containerRef.current?.clientHeight || 700;

    const newZoom = Math.min(Math.min(containerWidth / width, containerHeight / height), 1.4);
    setZoom(newZoom);
    setPan({
      x: (containerWidth - width * newZoom) / 2 - minX * newZoom + padding * newZoom,
      y: (containerHeight - height * newZoom) / 2 - minY * newZoom + padding * newZoom,
    });
  }, [devices]);

  // Expose fitView so the parent (App) can re-center the topology after
  // loading a preset scenario, importing a file, or on initial page load.
  useImperativeHandle(ref, () => ({
    fitView: handleFitView,
  }), [handleFitView]);

  // Auto-fit the topology into view on first mount (fixes topology being
  // invisible off-screen on small/mobile viewports where the canvas is
  // narrower than the desktop layout the devices were originally placed for).
  useEffect(() => {
    const raf = requestAnimationFrame(() => handleFitView());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit when the viewport is resized or the device orientation changes
  // (e.g. rotating a phone/tablet), so the topology stays centered and
  // visible instead of drifting off-screen.
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => handleFitView(), 200);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleFitView]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex-1 h-full w-full bg-[var(--app-bg)] overflow-hidden select-none cursor-crosshair touch-none"
    >
      {/* Background Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, var(--canvas-dot) 1.5px, transparent 1.5px)
          `,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Main Pan-Zoom Transform Plane */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {/* SVG Plane for Cables, Links & Packet Animations */}
        <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none z-10 overflow-visible">
          <defs>
            <filter id="packet-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="congestion-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Cable Links */}
          {links.map((link) => {
            const devA = devices.find((d) => d.id === link.fromDeviceId);
            const devB = devices.find((d) => d.id === link.toDeviceId);
            if (!devA || !devB) return null;

            const isSelected = selectedLinkId === link.id;
            const isDown = link.status === 'down';
            const spec = CABLE_CATALOG[link.cableType] || CABLE_CATALOG['ethernet_straight'];

            // Congestion evaluation
            const metric = congestionMap.get(link.id);
            const isCongested = metric && (metric.status === 'congested' || metric.status === 'critical');
            const isCritical = metric && metric.status === 'critical';

            let lineColor = spec.color;
            if (isDown) lineColor = '#ef4444';
            else if (isSelected) lineColor = '#3b82f6';
            else if (isCritical) lineColor = '#f43f5e';
            else if (isCongested) lineColor = '#f59e0b';

            const posA = { x: devA.x + 38, y: devA.y + 38 };
            const posB = { x: devB.x + 38, y: devB.y + 38 };

            const midX = (posA.x + posB.x) / 2;
            const midY = (posA.y + posB.y) / 2;
            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const normalX = -dy * 0.08;
            const normalY = dx * 0.08;
            const ctrlX = midX + normalX;
            const ctrlY = midY + normalY;

            const pathD = `M ${posA.x} ${posA.y} Q ${ctrlX} ${ctrlY} ${posB.x} ${posB.y}`;

            const portA = devA.ports.find((p) => p.id === link.fromPortId);
            const portB = devB.ports.find((p) => p.id === link.toPortId);

            return (
              <g
                key={link.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLink(link.id);
                }}
                className="cursor-pointer group pointer-events-auto"
              >
                {/* Invisible hover hitbox */}
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="18" />

                {/* Cable Wire */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={isCritical ? 4.5 : isSelected ? 4 : spec.category === 'optical' ? 3 : 2.5}
                  strokeDasharray={isDown ? '4 4' : spec.strokeDashArray}
                  strokeLinecap="round"
                  filter={isCritical ? 'url(#congestion-glow)' : undefined}
                  className={`transition-all ${isCritical ? 'animate-pulse' : ''}`}
                />

                {/* End Point Markers (Status LEDs) */}
                <circle cx={posA.x} cy={posA.y} r="4" fill={portA?.isUp ? '#10b981' : '#ef4444'} stroke="#0f172a" strokeWidth="1.5" />
                <circle cx={posB.x} cy={posB.y} r="4" fill={portB?.isUp ? '#10b981' : '#ef4444'} stroke="#0f172a" strokeWidth="1.5" />

                {/* Congestion load badge & info on link */}
                <g className="transition-opacity duration-200">
                  {metric && metric.currentLoadMbps > 0 ? (
                    <>
                      <rect
                        x={midX - 45}
                        y={midY - 26}
                        width="90"
                        height="20"
                        rx="5"
                        fill={isCritical ? '#991b1b' : isCongested ? '#78350f' : '#020617'}
                        stroke={isCritical ? '#f43f5e' : isCongested ? '#f59e0b' : '#334155'}
                        strokeWidth="1"
                        opacity="0.95"
                      />
                      <text
                        x={midX}
                        y={midY - 12}
                        textAnchor="middle"
                        fill={isCritical ? '#fecdd3' : isCongested ? '#fef08a' : '#38bdf8'}
                        fontSize="9.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {metric.currentLoadMbps}M ({metric.loadPercent}%)
                      </text>
                    </>
                  ) : (
                    <>
                      {/* Standard Cable type & length badge */}
                      <rect
                        x={midX - 35}
                        y={midY - 24}
                        width="70"
                        height="16"
                        rx="4"
                        fill="#020617"
                        stroke="#334155"
                        strokeWidth="0.8"
                        opacity="0.95"
                      />
                      <text x={midX} y={midY - 12} textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="500">
                        {link.lengthMeters}m {spec.category === 'optical' ? '• FO' : ''}
                      </text>
                    </>
                  )}
                </g>
              </g>
            );
          })}

          {/* Render Animated Packets */}
          {packetAnimations.map((pkt) => (
            <g key={pkt.id} filter="url(#packet-glow)">
              <circle
                cx={pkt.fromX + (pkt.toX - pkt.fromX) * pkt.progress}
                cy={pkt.fromY + (pkt.toY - pkt.fromY) * pkt.progress}
                r="6"
                fill={pkt.color}
              />
              <circle
                cx={pkt.fromX + (pkt.toX - pkt.fromX) * pkt.progress}
                cy={pkt.fromY + (pkt.toY - pkt.fromY) * pkt.progress}
                r="12"
                fill={pkt.color}
                opacity="0.3"
              />
            </g>
          ))}
        </svg>

        {/* Render Device Nodes */}
        {devices.map((device) => {
          const tmpl = DEVICE_TEMPLATES[device.type] || DEVICE_TEMPLATES['pc'];
          const Icon = ICON_MAP[tmpl.iconName] || Monitor;
          const isSelected = selectedDeviceId === device.id;
          const isConnectingSource = connectingSourceId === device.id;

          const primaryPort = device.ports.find((p) => p.isUp && p.ipAddress);
          const ipDisplay = primaryPort?.ipAddress || null;

          // Optical power computation for FTTH nodes
          const isOptical = ['ont', 'odp', 'odc', 'olt', 'splitter', 'splitter_1_8', 'splitter_1_4', 'splitter_1_2'].includes(device.type);
          const opticalInfo = isOptical ? calculateDeviceOpticalPower(device.id, devices, links) : null;

          return (
            <div
              key={device.id}
              style={{
                left: `${device.x}px`,
                top: `${device.y}px`,
                width: '76px',
              }}
              onMouseDown={(e) => {
                e.stopPropagation();

                if (isConnecting || activeTool !== 'pointer') {
                  onDeviceClickWithTool(device);
                  return;
                }

                onSelectDevice(device.id);

                const containerRect = containerRef.current?.getBoundingClientRect();
                if (!containerRect) return;

                const mouseX = (e.clientX - containerRect.left - pan.x) / zoom;
                const mouseY = (e.clientY - containerRect.top - pan.y) / zoom;

                setDraggingNodeId(device.id);
                setNodeOffset({ x: mouseX - device.x, y: mouseY - device.y });
                setNodeDragOrigin({ id: device.id, x: device.x, y: device.y });
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (isConnecting || activeTool !== 'pointer') {
                  onDeviceClickWithTool(device);
                  return;
                }
                onSelectDevice(device.id);

                const touch = e.touches[0];
                const containerRect = containerRef.current?.getBoundingClientRect();
                if (!containerRect) return;

                const mouseX = (touch.clientX - containerRect.left - pan.x) / zoom;
                const mouseY = (touch.clientY - containerRect.top - pan.y) / zoom;

                setDraggingNodeId(device.id);
                setNodeOffset({ x: mouseX - device.x, y: mouseY - device.y });
                setNodeDragOrigin({ id: device.id, x: device.x, y: device.y });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onDeviceDoubleClick(device);
              }}
              className={`absolute flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing group transition-transform ${
                isSelected ? 'scale-105 z-30' : 'z-20'
              }`}
            >
              {/* Device Box Icon */}
              <div
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all shadow-xl ${
                  isConnectingSource
                    ? 'ring-4 ring-amber-400 border-amber-300 bg-amber-950/60 scale-110 animate-pulse'
                    : isSelected
                    ? 'ring-4 ring-blue-500/50 border-blue-400 bg-[var(--surface-1)] shadow-blue-500/20'
                    : 'border-[var(--border-1)]/80 bg-[var(--surface-1)]/90 hover:border-[var(--border-1)] hover:bg-[var(--surface-2)]'
                }`}
                style={{
                  boxShadow: isSelected ? `0 0 20px ${tmpl.color}40` : '0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                <Icon className="w-7 h-7 transition-colors" style={{ color: tmpl.color }} />

                {/* Status Indicator Dot */}
                <div
                  className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                    device.status === 'online'
                      ? 'bg-emerald-500'
                      : device.status === 'warning'
                      ? 'bg-amber-500 animate-ping'
                      : 'bg-red-500'
                  }`}
                  title={`Status: ${device.status}`}
                />

                {/* Port count badge */}
                <div className="absolute -bottom-1 -left-1 bg-[var(--surface-2)] border border-[var(--border-1)] text-[var(--text-secondary)] text-[9px] font-mono px-1 rounded">
                  {device.ports.length}p
                </div>
              </div>

              {/* Hostname & IP / FTTH / IoT Badges */}
              <div className="mt-1.5 flex flex-col items-center text-center max-w-[120px]">
                <span className="text-xs font-semibold text-[var(--text-secondary)] truncate leading-tight group-hover:text-blue-400">
                  {device.name}
                </span>

                {/* IP Display */}
                {ipDisplay && (
                  <span className="text-[10px] font-mono font-medium text-emerald-400/90 bg-[var(--surface-1)]/90 px-1 rounded border border-[var(--border-2)]/80 mt-0.5 truncate max-w-full">
                    {ipDisplay}
                  </span>
                )}

                {/* Optical Redaman (dBm) Badge */}
                {opticalInfo && opticalInfo.rxPowerDbm > -90 && (
                  <span
                    className={`text-[9px] font-mono font-bold px-1 rounded border mt-0.5 ${
                      opticalInfo.isWithinMargin
                        ? 'text-purple-300 bg-purple-950/60 border-purple-800/50'
                        : 'text-rose-400 bg-rose-950/70 border-rose-800/70 animate-pulse'
                    }`}
                  >
                    Rx: {opticalInfo.rxPowerDbm} dBm
                  </span>
                )}

                {/* IoT Telemetry Badges */}
                {device.iotTelemetry && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {device.iotTelemetry.tempCelsius !== undefined && (
                      <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/60 px-1 rounded border border-amber-800/50">
                        {device.iotTelemetry.tempCelsius.toFixed(1)}°C
                      </span>
                    )}
                    {device.iotTelemetry.plugState && (
                      <span
                        className={`text-[8px] font-bold px-1 rounded ${
                          device.iotTelemetry.plugState === 'ON' ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                        }`}
                      >
                        {device.iotTelemetry.plugState}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Canvas Controls (Bottom Right) */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-[var(--surface-1)]/90 border border-[var(--border-2)] rounded-xl p-1.5 shadow-2xl backdrop-blur-md text-xs text-[var(--text-secondary)]">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}
          className="p-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
          title="Perbesar (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-mono px-1.5 text-[var(--text-muted)] min-w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom((z) => Math.max(0.4, z * 0.8))}
          className="p-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
          title="Perkecil (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-[var(--surface-2)] mx-0.5" />

        <button
          onClick={handleFitView}
          className="p-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
          title="Pusatkan Seluruh Topologi (Fit to Screen)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
          title="Reset Sudut Pandang (100%)"
        >
          <Move className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Action Quick Toolbar (Top Center) */}
      {(selectedDeviceId || selectedLinkId) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[var(--surface-1)]/95 border border-[var(--border-2)] rounded-xl px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs text-[var(--text-secondary)] animate-in fade-in slide-in-from-top-2">
          {selectedDeviceId && (
            <>
              <span className="font-semibold text-[var(--text-primary)]">
                {devices.find((d) => d.id === selectedDeviceId)?.name}
              </span>
              <button
                onClick={() => {
                  const dev = devices.find((d) => d.id === selectedDeviceId);
                  if (dev) onDeviceDoubleClick(dev);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Konfigurasi</span>
              </button>
            </>
          )}

          {selectedLinkId && (
            <span className="font-semibold text-[var(--text-secondary)]">
              Kabel: {links.find((l) => l.id === selectedLinkId)?.cableType.replace('_', ' ')}
            </span>
          )}

          <div className="h-4 w-[1px] bg-[var(--surface-2)]" />

          <button
            onClick={onDeleteSelected}
            className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus</span>
          </button>
        </div>
      )}
    </div>
  );
});

Canvas.displayName = 'Canvas';
