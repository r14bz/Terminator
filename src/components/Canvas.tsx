import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Globe, Radio, Server, Layers, Box, Share2, Cpu, Monitor, Camera, Smartphone, Zap, AlertCircle, Move, Cable as Grid, Tag } from 'lucide-react';
import { NetworkNode, CableConnection, NodeCableType, SimulationPacket, ActiveTool, DiagnosticIssue } from '../types/network';
import { OpticalCalculationResult } from '../utils/opticalCalculator';
import { CABLE_METADATA } from '../data/cableDefinitions';
import { checkInternetAccess } from '../utils/ipUtils';
import { boundsOf, clampZoom, computeFitView } from '../utils/zoom';
import { CARD_MIN_HEIGHT, CARD_WIDTH } from '../utils/nodePlacement';

interface CanvasProps {
  nodes: NetworkNode[];
  cables: CableConnection[];
  opticalResults: Map<string, OpticalCalculationResult>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
  activeTool: ActiveTool;
  selectedCableType: NodeCableType;
  onConnectNodes: (fromNodeId: string, toNodeId: string, cableType: NodeCableType) => void;
  onSelectCable: (cableId: string) => void;
  selectedCableId: string | null;
  onDeleteCable: (cableId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onProbeOpm: (nodeId: string) => void;
  onTriggerPing: (fromNodeId: string, toNodeId: string) => void;
  zoomLevel: number;
  onSetZoomLevel: (zoom: number) => void;
  isRunning: boolean;
  connectingSourceNodeId: string | null;
  setConnectingSourceNodeId: (id: string | null) => void;
  pingSourceNodeId: string | null;
  setPingSourceNodeId: (id: string | null) => void;
  issues?: DiagnosticIssue[];
}

export interface CanvasHandle {
  fitView: () => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(({
  nodes,
  cables,
  opticalResults,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
  activeTool,
  selectedCableType,
  onConnectNodes,
  onSelectCable,
  selectedCableId,
  onDeleteCable,
  onDeleteNode,
  onProbeOpm,
  onTriggerPing,
  zoomLevel,
  onSetZoomLevel,
  isRunning,
  connectingSourceNodeId,
  setConnectingSourceNodeId,
  pingSourceNodeId,
  setPingSourceNodeId,
  issues = [],
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Fit the whole topology into view — recenters & rescales so nothing is
  // left off-screen, especially important on narrow mobile viewports where
  // a topology laid out for desktop would otherwise only show one corner.
  const fitView = useCallback(() => {
    if (nodes.length === 0) {
      onSetZoomLevel(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const box = boundsOf(nodes.map((n) => ({ x: n.x, y: n.y })), {
      width: CARD_WIDTH,
      height: CARD_MIN_HEIGHT,
    });
    const view = computeFitView(box, {
      width: containerRef.current?.clientWidth || 1000,
      height: containerRef.current?.clientHeight || 700,
    });
    onSetZoomLevel(view.zoom);
    setPan(view.pan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  useImperativeHandle(ref, () => ({ fitView }), [fitView]);

  // Auto-fit once on first mount, and again on resize/orientation change
  // (e.g. rotating a phone) so the topology stays visible.
  useEffect(() => {
    const raf = requestAnimationFrame(() => fitView());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => fitView(), 200);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [fitView]);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const startPointerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas background style: 'clean' (no dots) or 'subtle_lines'
  const [gridStyle, setGridStyle] = useState<'clean' | 'subtle_lines'>('clean');

  // 2-Finger Pinch to Zoom state
  const touchDistRef = useRef<number | null>(null);
  const isPinchingRef = useRef<boolean>(false);

  // Animated packets simulation state
  const [simPackets, setSimPackets] = useState<SimulationPacket[]>([]);

  // Keyboard shortcut listener (Delete / Backspace to delete selected cable or node)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCableId) {
          e.preventDefault();
          onDeleteCable(selectedCableId);
        } else if (selectedNodeId) {
          e.preventDefault();
          onDeleteNode(selectedNodeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCableId, selectedNodeId, onDeleteCable, onDeleteNode]);

  // Simulation loop for packets when running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (cables.length > 0 && Math.random() > 0.35) {
        const randomCable = cables[Math.floor(Math.random() * cables.length)];
        if (randomCable.status !== 'broken') {
          const fromNode = nodes.find((n) => n.id === randomCable.fromNodeId);
          const toNode = nodes.find((n) => n.id === randomCable.toNodeId);

          if (fromNode && toNode) {
            const fromNet = checkInternetAccess(fromNode, nodes, cables);
            const toNet = checkInternetAccess(toNode, nodes, cables);

            const hasCriticalIssue =
              !fromNode.poweredOn ||
              !toNode.poweredOn ||
              issues.some(
                (iss) =>
                  iss.severity === 'critical' &&
                  (iss.targetNodeId === fromNode.id || iss.targetNodeId === toNode.id)
              );

            const isClientCable = ['lan', 'wireless'].includes(randomCable.type);
            const isClientWithoutInternet = isClientCable && (!fromNet.hasInternet || !toNet.hasInternet);

            // If link has critical issue or client has no internet routing, normal data doesn't flow
            const isOptical = ['feeder', 'distribusi', 'drop_core'].includes(randomCable.type);
            
            // Only generate red dropped packets occasionally on broken/blocked links
            const shouldSendPacket = !isClientWithoutInternet && !hasCriticalIssue ? true : Math.random() < 0.25;

            if (shouldSendPacket) {
              const newPacket: SimulationPacket = {
                id: `pkt-${Date.now()}-${Math.random()}`,
                fromNodeId: randomCable.fromNodeId,
                toNodeId: randomCable.toNodeId,
                cableId: randomCable.id,
                progress: 0,
                type: isOptical ? 'optical' : 'data',
                color: (hasCriticalIssue || isClientWithoutInternet) ? '#ef4444' : isOptical ? '#10b981' : '#38bdf8',
              };
              setSimPackets((prev) => [...prev.slice(-20), newPacket]);
            }
          }
        }
      }

      setSimPackets((prev) =>
        prev
          .map((p) => ({ ...p, progress: p.progress + 0.07 }))
          .filter((p) => p.progress < 1.0)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, cables, nodes, issues]);

  // Native wheel handler: Scroll pans the canvas; ONLY Ctrl+Scroll or Trackpad Pinch zooms!
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Trackpad Pinch / Ctrl + MouseWheel -> Controlled gentle zoom
        const factor = e.deltaY < 0 ? 1.05 : 0.95;
        onSetZoomLevel(clampZoom(zoomLevel * factor));
      } else {
        // Standard Mouse Wheel / 2-finger swipe -> PAN canvas smoothly (NEVER ZOOM!)
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [zoomLevel, onSetZoomLevel]);

  // Handle canvas mouse down (panning)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    // If clicking background or in pan mode
    if (
      activeTool === 'pan' ||
      e.target === containerRef.current ||
      (e.target as HTMLElement).tagName === 'svg'
    ) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      startPointerPos.current = { x: e.clientX, y: e.clientY };
      hasMovedRef.current = false;

      if (activeTool !== 'move') {
        onSelectNode(null);
        onSelectCable('');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dist = Math.hypot(e.clientX - startPointerPos.current.x, e.clientY - startPointerPos.current.y);
    if (dist > 4) {
      hasMovedRef.current = true;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    } else if (draggingNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const newX = (e.clientX - rect.left - pan.x) / zoomLevel - dragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoomLevel - dragOffset.y;
      onUpdateNodePosition(
        draggingNodeId,
        Math.max(20, Math.round(newX)),
        Math.max(20, Math.round(newY))
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // TOUCH HANDLERS (Mobile Friendly, with Stable Pinch-To-Zoom & Pan)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 FINGERS: STABLE PINCH-TO-ZOOM
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

      // Only initiate if fingers are separated by at least 25px
      if (dist > 25) {
        isPinchingRef.current = true;
        touchDistRef.current = dist;
        setIsPanning(false);
        setDraggingNodeId(null);
      }
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      // 1 FINGER: PAN CANVAS
      const touch = e.touches[0];
      startPointerPos.current = { x: touch.clientX, y: touch.clientY };
      hasMovedRef.current = false;

      if (
        activeTool === 'pan' ||
        e.target === containerRef.current ||
        (e.target as HTMLElement).tagName === 'svg'
      ) {
        setIsPanning(true);
        setStartPan({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinchingRef.current && touchDistRef.current !== null) {
      // 2 FINGERS PINCH TO ZOOM: Smooth incremental delta (NEVER JUMPS!)
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const delta = currentDist - touchDistRef.current;

      // Minimum movement threshold
      if (Math.abs(delta) > 3) {
        const factor = delta > 0 ? 1.025 : 0.975;
        onSetZoomLevel(clampZoom(zoomLevel * factor));
        touchDistRef.current = currentDist;
      }
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      const touch = e.touches[0];
      const moveDist = Math.hypot(touch.clientX - startPointerPos.current.x, touch.clientY - startPointerPos.current.y);
      if (moveDist > 4) {
        hasMovedRef.current = true;
      }

      if (draggingNodeId) {
        // MOVE NODE
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const newX = (touch.clientX - rect.left - pan.x) / zoomLevel - dragOffset.x;
        const newY = (touch.clientY - rect.top - pan.y) / zoomLevel - dragOffset.y;
        onUpdateNodePosition(
          draggingNodeId,
          Math.max(20, Math.round(newX)),
          Math.max(20, Math.round(newY))
        );
      } else if (isPanning) {
        // PAN CANVAS
        setPan({
          x: touch.clientX - startPan.x,
          y: touch.clientY - startPan.y,
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      isPinchingRef.current = false;
      touchDistRef.current = null;
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
      setDraggingNodeId(null);
    }
  };

  // Node Click / Select Dispatcher
  const handleNodeClick = (node: NetworkNode, e: React.MouseEvent) => {
    e.stopPropagation();

    // If user dragged more than 5px, don't open inspector on drag release
    if (hasMovedRef.current && activeTool === 'move') {
      return;
    }

    if (activeTool === 'select' || activeTool === 'move') {
      onSelectNode(node.id);
    } else if (activeTool === 'opm') {
      onProbeOpm(node.id);
    } else if (activeTool === 'cable') {
      if (!connectingSourceNodeId) {
        setConnectingSourceNodeId(node.id);
      } else {
        if (connectingSourceNodeId !== node.id) {
          onConnectNodes(connectingSourceNodeId, node.id, selectedCableType);
        }
        setConnectingSourceNodeId(null);
      }
    } else if (activeTool === 'ping') {
      if (!pingSourceNodeId) {
        setPingSourceNodeId(node.id);
      } else {
        if (pingSourceNodeId !== node.id) {
          onTriggerPing(pingSourceNodeId, node.id);
        }
        setPingSourceNodeId(null);
      }
    }
  };

  // Node Drag Start (Mouse)
  const handleNodeDragStart = (node: NetworkNode, e: React.MouseEvent) => {
    // Only drag node if tool is 'move'
    if (activeTool !== 'move') return;
    e.stopPropagation();

    startPointerPos.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
    setDraggingNodeId(node.id);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - pan.x) / zoomLevel;
    const mouseY = (e.clientY - rect.top - pan.y) / zoomLevel;
    setDragOffset({
      x: mouseX - node.x,
      y: mouseY - node.y,
    });
  };

  // Node Drag Start (Touch)
  const handleNodeTouchStart = (node: NetworkNode, e: React.TouchEvent) => {
    if (activeTool !== 'move') return;
    if (e.touches.length !== 1) return;
    e.stopPropagation();

    const touch = e.touches[0];
    startPointerPos.current = { x: touch.clientX, y: touch.clientY };
    hasMovedRef.current = false;
    setDraggingNodeId(node.id);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchX = (touch.clientX - rect.left - pan.x) / zoomLevel;
    const touchY = (touch.clientY - rect.top - pan.y) / zoomLevel;
    setDragOffset({
      x: touchX - node.x,
      y: touchY - node.y,
    });
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'internet': return <Globe className="h-5 w-5 text-sky-600" />;
      case 'metro': return <Radio className="h-5 w-5 text-indigo-600" />;
      case 'olt': return <Server className="h-5 w-5 text-emerald-600" />;
      case 'odc': return <Box className="h-5 w-5 text-amber-600" />;
      case 'odp': return <Box className="h-5 w-5 text-teal-600" />;
      case 'splitter': return <Share2 className="h-5 w-5 text-rose-600" />;
      case 'htb': return <Cpu className="h-5 w-5 text-purple-600" />;
      case 'ont': return <Radio className="h-5 w-5 text-sky-600" />;
      case 'mikrotik': return <Cpu className="h-5 w-5 text-orange-600" />;
      case 'switch': return <Layers className="h-5 w-5 text-blue-600" />;
      case 'router': return <Radio className="h-5 w-5 text-cyan-600" />;
      case 'mesh': return <Radio className="h-5 w-5 text-emerald-600" />;
      case 'pc': return <Monitor className="h-5 w-5 text-slate-700" />;
      case 'cctv': return <Camera className="h-5 w-5 text-purple-600" />;
      case 'smartphone': return <Smartphone className="h-5 w-5 text-cyan-600" />;
      case 'iot': return <Zap className="h-5 w-5 text-teal-600" />;
      case 'server': return <Server className="h-5 w-5 text-slate-800" />;
      default: return <Box className="h-5 w-5" />;
    }
  };

  return (
    <div
      id="network-canvas-container"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative flex-1 h-full w-full overflow-hidden select-none transition-colors duration-150 touch-none ${
        gridStyle === 'clean' ? 'bg-[#f8fafc]' : 'bg-[#f1f5f9]'
      } ${
        activeTool === 'move'
          ? 'cursor-move'
          : activeTool === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool === 'cable'
          ? 'cursor-crosshair'
          : 'cursor-default'
      }`}
      style={{
        backgroundImage:
          gridStyle === 'subtle_lines'
            ? `linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)`
            : 'none',
        backgroundSize: `${36 * zoomLevel}px ${36 * zoomLevel}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        touchAction: 'none', // Prevents browser from hijacking touch gestures
      }}
    >
      {/* Mode Indicator Banner */}
      {activeTool === 'move' && (
        <div className="export-exclude absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-1.5 text-xs font-semibold shadow-md backdrop-blur-xs animate-in fade-in">
          <Move className="h-3.5 w-3.5" />
          <span>Mode Geser Node: Sentuh / seret perangkat untuk memindahkan</span>
        </div>
      )}

      {/* Grid Style Toggle Button */}
      <div className="export-exclude absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-white/90 px-2 py-1 rounded-lg border border-slate-200 shadow-2xs text-[10px] text-slate-600 backdrop-blur-xs">
        <Grid className="h-3 w-3 text-slate-400" />
        <button
          onClick={() => setGridStyle(gridStyle === 'clean' ? 'subtle_lines' : 'clean')}
          className="font-medium hover:text-slate-900 transition-colors"
          title="Ubah tampilan grid kanvas (Bersih Polos vs Garis Halus)"
        >
          Grid: {gridStyle === 'clean' ? 'Bersih Polos' : 'Garis Halus'}
        </button>
      </div>

      {/* SVG Canvas for Cables and Signal Pulses */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="cableShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.2" />
          </filter>
          <filter id="packetGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Transformed Group synchronized with Pan & Zoom */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoomLevel})`}>
          {/* Render Cable Lines */}
          {cables.map((cable) => {
            const fromNode = nodes.find((n) => n.id === cable.fromNodeId);
            const toNode = nodes.find((n) => n.id === cable.toNodeId);
            if (!fromNode || !toNode) return null;

            const meta = CABLE_METADATA[cable.type];
            const isSelected = selectedCableId === cable.id;

            // Center coordinates of nodes (Node width is 132px, height is ~85px)
            const x1 = Number(fromNode.x) + 66;
            const y1 = Number(fromNode.y) + 42;
            const x2 = Number(toNode.x) + 66;
            const y2 = Number(toNode.y) + 42;

            // Smooth Bezier Curve calculation
            const dx = x2 - x1;
            const cx1 = x1 + dx * 0.45;
            const cy1 = y1;
            const cx2 = x2 - dx * 0.45;
            const cy2 = y2;
            const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

            const isBroken = cable.status === 'broken';
            const cableColor = isBroken ? '#ef4444' : (meta?.colorHex || '#0284c7');

            return (
              <g
                key={cable.id}
                className="pointer-events-auto cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCable(cable.id);
                }}
              >
                {/* 1. Wide invisible hover stroke */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="24"
                  className="hover:stroke-sky-400/20 transition-all"
                />

                {/* 2. White Halo Contrast Backing */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? '#38bdf8' : '#ffffff'}
                  strokeWidth={isSelected ? 9 : 6.5}
                  strokeOpacity={isSelected ? 0.8 : 0.95}
                  strokeLinecap="round"
                />

                {/* 3. Main Colored Cable Wire */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={cableColor}
                  strokeWidth={isSelected ? 4.5 : 3.5}
                  strokeLinecap="round"
                  strokeDasharray={
                    isBroken
                      ? '5,5'
                      : cable.type === 'drop_core' || cable.type === 'distribusi'
                      ? '8,4'
                      : cable.type === 'wireless'
                      ? '4,5'
                      : 'none'
                  }
                  filter="url(#cableShadow)"
                  className="transition-colors"
                />

                {/* 4. Port Terminal Connectors at both ends */}
                <circle
                  cx={x1}
                  cy={y1}
                  r="5.5"
                  fill={cableColor}
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="url(#cableShadow)"
                />
                <circle
                  cx={x2}
                  cy={y2}
                  r="5.5"
                  fill={cableColor}
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="url(#cableShadow)"
                />

                {/* 5. Cable Midpoint Badge */}
                <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                  <rect
                    x="-38"
                    y="-13"
                    width="76"
                    height="26"
                    rx="13"
                    fill="#ffffff"
                    stroke={isSelected ? '#0284c7' : isBroken ? '#ef4444' : cableColor}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    filter="url(#cableShadow)"
                    className="group-hover:scale-110 transition-transform"
                  />
                  <text
                    x="0"
                    y="4.5"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#0f172a"
                    className="font-mono select-none"
                  >
                    {isBroken ? 'PUTUS' : cable.type === 'lan' ? `${(cable.lengthKm * 1000).toFixed(0)}m` : `${cable.lengthKm.toFixed(1)}km`}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Animated Packets Moving Across Cables during RUN */}
          {isRunning &&
            simPackets.map((pkt) => {
              const fromNode = nodes.find((n) => n.id === pkt.fromNodeId);
              const toNode = nodes.find((n) => n.id === pkt.toNodeId);
              if (!fromNode || !toNode) return null;

              const x1 = Number(fromNode.x) + 66;
              const y1 = Number(fromNode.y) + 42;
              const x2 = Number(toNode.x) + 66;
              const y2 = Number(toNode.y) + 42;

              // Cubic bezier interpolation
              const dx = x2 - x1;
              const cx1 = x1 + dx * 0.45;
              const cy1 = y1;
              const cx2 = x2 - dx * 0.45;
              const cy2 = y2;

              const t = pkt.progress;
              const u = 1 - t;
              const currX =
                u * u * u * x1 +
                3 * u * u * t * cx1 +
                3 * u * t * t * cx2 +
                t * t * t * x2;
              const currY =
                u * u * u * y1 +
                3 * u * u * t * cy1 +
                3 * u * t * t * cy2 +
                t * t * t * y2;

              return (
                <g key={pkt.id}>
                  <circle
                    cx={currX}
                    cy={currY}
                    r="5.5"
                    fill={pkt.color}
                    filter="url(#packetGlow)"
                  />
                  <circle cx={currX} cy={currY} r="2.5" fill="#ffffff" />
                </g>
              );
            })}
        </g>
      </svg>

      {/* Nodes HTML Layer */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isSourceConnect = connectingSourceNodeId === node.id;
          const isPingSource = pingSourceNodeId === node.id;
          const optResult = opticalResults.get(node.id);
          const nodeIssues = (issues || []).filter((iss) => iss.targetNodeId === node.id);
          const criticalIssue = nodeIssues.find((iss) => iss.severity === 'critical');
          const warningIssue = nodeIssues.find((iss) => iss.severity === 'warning');
          const isOpticalLos = optResult?.status === 'critical_los';
          const isPowerOff = !node.poweredOn;

          const netAccess = checkInternetAccess(node, nodes, cables);
          const isClientDevice = ['pc', 'cctv', 'smartphone', 'iot', 'server'].includes(node.type);
          const hasInternetIssue = isClientDevice && !netAccess.hasInternet && node.poweredOn;
          const isOntBridge = node.type === 'ont' && node.ontConfig?.wanMode === 'bridge';

          const hasCritical = Boolean(criticalIssue) || isOpticalLos || hasInternetIssue;
          const hasWarning = Boolean(warningIssue) || optResult?.status === 'acceptable' || isOntBridge;

          return (
            <div
              key={node.id}
              onClick={(e) => handleNodeClick(node, e)}
              onMouseDown={(e) => handleNodeDragStart(node, e)}
              onTouchStart={(e) => handleNodeTouchStart(node, e)}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
              }}
              className={`absolute pointer-events-auto w-[132px] rounded-xl bg-white border p-2.5 transition-shadow select-none shadow-xs ${
                activeTool === 'move' ? 'cursor-move hover:ring-2 hover:ring-indigo-400' : 'cursor-pointer'
              } ${
                isSourceConnect
                  ? 'border-sky-500 ring-4 ring-sky-300 animate-pulse'
                  : isPingSource
                  ? 'border-purple-500 ring-4 ring-purple-300 animate-pulse'
                  : isSelected
                  ? 'border-sky-600 ring-2 ring-sky-400 shadow-md'
                  : hasCritical
                  ? 'border-rose-400 ring-1 ring-rose-300'
                  : hasWarning
                  ? 'border-amber-400 ring-1 ring-amber-200'
                  : 'border-slate-300 hover:border-slate-400 hover:shadow-sm'
              }`}
            >
              {/* Drag Handle Indicator if in 'move' mode */}
              {activeTool === 'move' && (
                <div className="flex items-center justify-center gap-1 rounded bg-indigo-50 py-0.5 mb-1.5 text-[9px] font-bold text-indigo-700">
                  <Move className="h-3 w-3" />
                  <span>TARIK GESER</span>
                </div>
              )}

              {/* Header Icon + Power Status */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                  {getNodeIcon(node.type)}
                </div>

                <div className="flex items-center gap-1">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isPowerOff
                        ? 'bg-slate-300'
                        : isOpticalLos
                        ? 'bg-rose-500 animate-ping'
                        : hasCritical
                        ? 'bg-rose-500 animate-pulse'
                        : hasWarning
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    title={
                      isPowerOff
                        ? 'Perangkat Mati (Power Off)'
                        : criticalIssue
                        ? `Error: ${criticalIssue.title}`
                        : warningIssue
                        ? `Peringatan: ${warningIssue.title}`
                        : 'Perangkat Hidup & Normal'
                    }
                  />
                  <span className="text-[9.5px] text-slate-400 font-mono font-bold">
                    {node.type.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Title & Brand Tag */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs font-bold text-slate-800 truncate" title={node.name}>
                    {node.name.split('(')[0].trim()}
                  </div>
                  {/* Brand Tag (ZTE, Huawei, MikroTik, Cisco, dll) */}
                  {node.brand && (
                    <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200 shrink-0">
                      {node.brand}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={node.label || node.model}>
                  {node.model || node.label}
                </div>

                {/* Real-time Issue Badge Tag on Node Card */}
                {criticalIssue ? (
                  <div
                    className="mt-1 flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-700 border border-rose-200 truncate"
                    title={criticalIssue.title}
                  >
                    <AlertCircle className="h-2.5 w-2.5 shrink-0 text-rose-600" />
                    <span className="truncate">
                      {criticalIssue.title.includes('Bridge')
                        ? '⚠️ Mode Bridge (No Internet)'
                        : criticalIssue.title.includes('Gateway')
                        ? '⚠️ Gateway Salah'
                        : criticalIssue.title.includes('Subnet')
                        ? '⚠️ Subnet Beda'
                        : criticalIssue.title.includes('Konflik')
                        ? '⚠️ IP Konflik'
                        : '⚠️ Error IP/Koneksi'}
                    </span>
                  </div>
                ) : hasInternetIssue ? (
                  <div
                    className="mt-1 flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-700 border border-rose-200 truncate"
                    title={netAccess.reason || 'Koneksi internet terputus'}
                  >
                    <AlertCircle className="h-2.5 w-2.5 shrink-0 text-rose-600" />
                    <span className="truncate">
                      {node.type === 'cctv' ? '⚠️ Stream Offline' : '⚠️ Internet Putus'}
                    </span>
                  </div>
                ) : isOntBridge ? (
                  <div
                    className="mt-1 flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-800 border border-amber-300 truncate"
                    title="ONT dalam Mode Bridge (Layer 2) - Klien butuh router dialer PPPoE"
                  >
                    <AlertCircle className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                    <span className="truncate">⚠️ Bridge (No Route)</span>
                  </div>
                ) : warningIssue ? (
                  <div
                    className="mt-1 flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-700 border border-amber-200 truncate"
                    title={warningIssue.title}
                  >
                    <AlertCircle className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                    <span className="truncate">
                      {warningIssue.title.includes('Gateway Kosong') ? 'Gateway Kosong' : 'Peringatan'}
                    </span>
                  </div>
                ) : null}

                {/* VLAN Tag Badge if enabled */}
                {node.vlanConfig?.enabled && (
                  <div
                    className="mt-1 flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[8.5px] font-bold text-indigo-700 border border-indigo-200 truncate"
                    title={`VLAN ID: ${node.vlanConfig.vlanId} (${node.vlanConfig.mode.toUpperCase()}) - ${node.vlanConfig.vlanName || 'Tagged'}`}
                  >
                    <Tag className="h-2.5 w-2.5 shrink-0 text-indigo-600" />
                    <span className="truncate">
                      VLAN {node.vlanConfig.vlanId} ({node.vlanConfig.mode === 'trunk' ? 'TRUNK' : 'ACC'})
                    </span>
                  </div>
                )}
              </div>

              {/* Technical Indicator / Telemetry summary */}
              <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-0.5 text-[9.5px]">
                {/* Optical Rx power if FTTH */}
                {optResult && optResult.status !== 'disconnected' && node.type !== 'olt' && (
                  <div
                    className={`flex items-center justify-between font-mono font-bold ${
                      optResult.status === 'critical_los'
                        ? 'text-rose-600'
                        : optResult.status === 'acceptable'
                        ? 'text-amber-600'
                        : 'text-emerald-700'
                    }`}
                  >
                    <span>Rx:</span>
                    <span>{optResult.rxPowerDbm} dBm</span>
                  </div>
                )}

                {/* OLT TX Power */}
                {node.type === 'olt' && (
                  <div className="flex items-center justify-between font-mono text-emerald-700 font-bold">
                    <span>Tx:</span>
                    <span>+{node.opticalConfig?.txPowerDbm ?? 3.0} dBm</span>
                  </div>
                )}

                {/* Splitter ratio badge */}
                {node.type === 'splitter' && (
                  <div className="flex items-center justify-between text-slate-600 font-mono">
                    <span>Rasio:</span>
                    <span>{node.opticalConfig?.splitterRatio ?? '1:8'}</span>
                  </div>
                )}

                {/* ONT WAN Mode and DHCP indicator */}
                {node.type === 'ont' && (
                  <>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-500 font-normal">WAN:</span>
                      <span className={node.ontConfig?.wanMode === 'bridge' ? 'text-amber-700 font-bold' : 'text-sky-700 font-bold'}>
                        {node.ontConfig?.wanMode?.toUpperCase() || 'PPPOE'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-500 font-normal">DHCP:</span>
                      <span className={node.ontConfig?.dhcpServerEnabled ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {node.ontConfig?.dhcpServerEnabled ? 'Aktif' : 'Mati'}
                      </span>
                    </div>
                  </>
                )}

                {/* IP address if configured */}
                {node.ipConfig?.ip && node.ipConfig.ip !== '0.0.0.0' && node.type !== 'ont' && (
                  <div className="flex items-center justify-between text-slate-600 font-mono truncate">
                    <span>IP:</span>
                    <span className="truncate">{node.ipConfig.ip}</span>
                  </div>
                )}

                {/* Client Internet Status Indicator */}
                {isClientDevice && node.poweredOn && (
                  <div className="flex items-center justify-between font-mono font-bold">
                    <span className="text-slate-500 font-normal">Internet:</span>
                    <span className={netAccess.hasInternet ? 'text-emerald-600' : 'text-rose-600'}>
                      {netAccess.hasInternet ? '● Online' : '✕ Putus'}
                    </span>
                  </div>
                )}

                {/* VLAN Tag Indicator if configured */}
                {node.vlanConfig?.enabled && (
                  <div className="flex items-center justify-between font-mono text-[9px] text-indigo-700 font-bold">
                    <span className="text-slate-500 font-normal">VLAN:</span>
                    <span>ID {node.vlanConfig.vlanId}</span>
                  </div>
                )}

                {/* HTB Role */}
                {node.type === 'htb' && (
                  <div className="flex items-center justify-between font-mono font-bold text-purple-700">
                    <span>Tipe:</span>
                    <span>HTB-{node.htbRole || 'A'}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

Canvas.displayName = 'Canvas';
