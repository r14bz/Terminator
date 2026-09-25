import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  NetworkDevice,
  NetworkLink,
  DeviceType,
  CableType,
  TestResult,
  PacketAnimation,
  TrafficGeneratorStream,
} from './types/network';
import { PRESET_SCENARIOS, PresetScenario } from './constants/presetTopologies';
import { createDeviceFromTemplate, DEVICE_TEMPLATES } from './constants/deviceCatalog';
import { getRecommendedCable, isPortCompatibleWithCable } from './constants/cableCatalog';
import { runDiagnostics, applyAutoFix, DiagnosticsReport } from './utils/diagnosticsEngine';
import { runDHCPSimulation, simulatePing, evaluateIoTAutomations } from './utils/networkEngine';
import { calculateLinkCongestion } from './utils/trafficEngine';

import { Header } from './components/Header';
import { Toolbar, ActiveTool } from './components/Toolbar';
import { DeviceSidebar } from './components/DeviceSidebar';
import { Canvas, CanvasHandle } from './components/Canvas';
import { DeviceConfigModal } from './components/DeviceConfigModal';
import { PortSelectorModal } from './components/PortSelectorModal';
import { PingTestModal } from './components/PingTestModal';
import { TroubleshootingDrawer } from './components/TroubleshootingDrawer';
import { DocumentationModal } from './components/DocumentationModal';
import { QuickGuideModal } from './components/QuickGuideModal';
import { TrafficGeneratorModal } from './components/TrafficGeneratorModal';
import { LiveMonitoringDrawer } from './components/LiveMonitoringDrawer';
import { ExportImageModal } from './components/ExportImageModal';

interface HistoryStep {
  description: string;
  devices: NetworkDevice[];
  links: NetworkLink[];
}

export default function App() {
  // Topology state (Initialized with SOHO network scenario)
  const initialScenario = PRESET_SCENARIOS[0];
  const [topologyName, setTopologyName] = useState(initialScenario.name);
  const [devices, setDevices] = useState<NetworkDevice[]>(initialScenario.devices);
  const [links, setLinks] = useState<NetworkLink[]>(initialScenario.links);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Selection & Active Tools
  const [activeTool, setActiveTool] = useState<ActiveTool>('pointer');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  // Connection Workflow State
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [portSelectorPair, setPortSelectorPair] = useState<{
    devA: NetworkDevice;
    devB: NetworkDevice;
    cableType: CableType;
  } | null>(null);

  // Traffic Generator & Monitoring State
  const [activeStreams, setActiveStreams] = useState<TrafficGeneratorStream[]>([]);
  const [isTrafficModalOpen, setIsTrafficModalOpen] = useState(false);
  const [isLiveMonitoringOpen, setIsLiveMonitoringOpen] = useState(false);
  const [isExportImageOpen, setIsExportImageOpen] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString('id-ID')}] TERMINATOR v3.0 siap. Topologi default dimuat: ${initialScenario.name}`,
    `[${new Date().toLocaleTimeString('id-ID')}] Sistem Undo/Redo dan Ekspor Gambar (PNG/SVG) aktif.`,
  ]);

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Ref to the Canvas so we can trigger fit-to-view after a topology loads
  // (preset scenario selected, JSON imported), keeping it centered on any
  // screen size instead of drifting off-screen on mobile.
  const canvasRef = useRef<CanvasHandle>(null);

  // Modal Views
  const [configuringDevice, setConfiguringDevice] = useState<NetworkDevice | null>(null);
  const [isPingModalOpen, setIsPingModalOpen] = useState(false);
  const [isTroubleshootingOpen, setIsTroubleshootingOpen] = useState(false);
  const [isDocumentationOpen, setIsDocumentationOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Packet animation state
  const [packetAnimations, setPacketAnimations] = useState<PacketAnimation[]>([]);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistoryStep[]>([
    {
      description: `Inisialisasi: ${initialScenario.name}`,
      devices: JSON.parse(JSON.stringify(initialScenario.devices)),
      links: JSON.parse(JSON.stringify(initialScenario.links)),
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  const addLog = useCallback((log: string) => {
    setLiveLogs((prev) => [...prev.slice(-300), log]);
  }, []);

  // Records a new undo snapshot
  const pushHistory = useCallback(
    (newDevices: NetworkDevice[], newLinks: NetworkLink[], description: string) => {
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIndex + 1);
        const updated = [
          ...truncated,
          {
            description,
            devices: JSON.parse(JSON.stringify(newDevices)),
            links: JSON.parse(JSON.stringify(newLinks)),
          },
        ];
        if (updated.length > 50) return updated.slice(-50);
        return updated;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex],
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevStep = history[historyIndex - 1];
      const undoneStep = history[historyIndex];
      setDevices(JSON.parse(JSON.stringify(prevStep.devices)));
      setLinks(JSON.parse(JSON.stringify(prevStep.links)));
      setHistoryIndex(historyIndex - 1);
      setSelectedDeviceId(null);
      setSelectedLinkId(null);
      setConnectingSourceId(null);
      showToast(`Urungkan: ${undoneStep.description}`);
      addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Undo] Mengurungkan aksi: ${undoneStep.description}`);
    }
  }, [history, historyIndex, showToast, addLog]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextStep = history[historyIndex + 1];
      setDevices(JSON.parse(JSON.stringify(nextStep.devices)));
      setLinks(JSON.parse(JSON.stringify(nextStep.links)));
      setHistoryIndex(historyIndex + 1);
      setSelectedDeviceId(null);
      setSelectedLinkId(null);
      setConnectingSourceId(null);
      showToast(`Ulangi: ${nextStep.description}`);
      addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Redo] Mengulangi aksi: ${nextStep.description}`);
    }
  }, [history, historyIndex, showToast, addLog]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const undoDescription = canUndo ? history[historyIndex]?.description : undefined;
  const redoDescription = canRedo ? history[historyIndex + 1]?.description : undefined;

  // Real-time Network Diagnostic Engine
  const diagnosticReport: DiagnosticsReport = useMemo(() => {
    return runDiagnostics(devices, links, activeStreams);
  }, [devices, links, activeStreams]);

  // Handle adding device from sidebar or drop
  const handleAddDevice = (type: DeviceType, x?: number, y?: number) => {
    const existingCount = devices.filter((d) => d.type === type).length;
    const posX = x ?? 350 + (existingCount % 5) * 60;
    const posY = y ?? 250 + Math.floor(existingCount / 5) * 60;

    const newDev = createDeviceFromTemplate(type, posX, posY, existingCount);
    const updatedDevices = [...devices, newDev];
    setDevices(updatedDevices);
    setSelectedDeviceId(newDev.id);
    pushHistory(updatedDevices, links, `Tambah ${newDev.name}`);
    showToast(`Perangkat ${newDev.name} ditambahkan ke kanvas.`);
    addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Perangkat] ${newDev.name} (${newDev.type}) dipasang di kanvas.`);
  };

  // Move device on canvas (live update while dragging)
  const handleDeviceMove = (id: string, x: number, y: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, x: Math.max(20, x), y: Math.max(20, y) } : d)),
    );
  };

  // Move device end (creates undo checkpoint once per drag drop)
  const handleDeviceMoveEnd = (id: string, finalX: number, finalY: number, initialX: number, initialY: number) => {
    if (finalX !== initialX || finalY !== initialY) {
      const dev = devices.find((d) => d.id === id);
      const updatedDevices = devices.map((d) => (d.id === id ? { ...d, x: finalX, y: finalY } : d));
      pushHistory(updatedDevices, links, `Geser ${dev?.name || 'Perangkat'}`);
    }
  };

  // Delete selected device or link
  const handleDeleteSelected = () => {
    if (selectedDeviceId) {
      const devName = devices.find((d) => d.id === selectedDeviceId)?.name || '';
      const updatedDevices = devices.filter((d) => d.id !== selectedDeviceId);
      const updatedLinks = links.filter((l) => l.fromDeviceId !== selectedDeviceId && l.toDeviceId !== selectedDeviceId);

      setDevices(updatedDevices);
      setLinks(updatedLinks);
      // Remove any streams referencing this device
      setActiveStreams((prev) =>
        prev.filter((s) => s.sourceDeviceId !== selectedDeviceId && s.targetDeviceId !== selectedDeviceId),
      );
      setSelectedDeviceId(null);
      pushHistory(updatedDevices, updatedLinks, `Hapus ${devName}`);
      showToast(`Perangkat ${devName} dan kabel terkait telah dihapus.`);
      addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Hapus] Perangkat ${devName} dihapus.`);
    } else if (selectedLinkId) {
      const updatedLinks = links.filter((l) => l.id !== selectedLinkId);
      setLinks(updatedLinks);
      setSelectedLinkId(null);
      pushHistory(devices, updatedLinks, `Lepas kabel`);
      showToast(`Kabel telah dilepas.`);
      addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Hapus] Kabel link dilepas.`);
    }
  };

  // Auto-connect two devices with first free compatible ports
  const executeAutoConnect = (devA: NetworkDevice, devB: NetworkDevice) => {
    const isPortOccupied = (pId: string) =>
      links.some((l) => l.fromPortId === pId || l.toPortId === pId);

    const primaryPortA = devA.ports[0];
    const primaryPortB = devB.ports[0];
    if (!primaryPortA || !primaryPortB) {
      showToast('Salah satu perangkat tidak memiliki port fisik.');
      return;
    }

    const recommendedCable = getRecommendedCable(devA.type, devB.type, primaryPortA.type, primaryPortB.type);

    let freePortA = devA.ports.find((p) => !isPortOccupied(p.id) && isPortCompatibleWithCable(p.type, recommendedCable));
    let freePortB = devB.ports.find((p) => !isPortOccupied(p.id) && isPortCompatibleWithCable(p.type, recommendedCable));

    if (!freePortA || !freePortB) {
      freePortA = devA.ports.find((p) => isPortCompatibleWithCable(p.type, recommendedCable)) || devA.ports[0];
      freePortB = devB.ports.find((p) => isPortCompatibleWithCable(p.type, recommendedCable)) || devB.ports[0];
    }

    const newLink: NetworkLink = {
      id: `link_${Date.now()}`,
      fromDeviceId: devA.id,
      fromPortId: freePortA.id,
      toDeviceId: devB.id,
      toPortId: freePortB.id,
      cableType: recommendedCable,
      lengthMeters: recommendedCable.includes('fiber') ? 1200 : 15,
      status: 'active',
    };

    const updatedLinks = [...links, newLink];
    setLinks(updatedLinks);
    setConnectingSourceId(null);
    pushHistory(devices, updatedLinks, `Koneksi ${devA.name} <-> ${devB.name}`);
    showToast(`Auto-koneksi: ${devA.name} [${freePortA.name}] <-> ${devB.name} [${freePortB.name}]`);
    addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Link] Tersambung: ${devA.name} (${freePortA.name}) <-> ${devB.name} (${freePortB.name}) via ${recommendedCable}`);
  };

  // Handle clicking device with current tool
  const handleDeviceClickWithTool = (device: NetworkDevice) => {
    if (activeTool === 'pointer') {
      setSelectedDeviceId(device.id);
      setSelectedLinkId(null);
      return;
    }

    if (activeTool === 'ping_tool') {
      setIsPingModalOpen(true);
      return;
    }

    if (activeTool === 'auto_connect') {
      if (!connectingSourceId) {
        setConnectingSourceId(device.id);
        showToast(`Pilih perangkat tujuan untuk auto-koneksi dari ${device.name}...`);
      } else if (connectingSourceId === device.id) {
        setConnectingSourceId(null);
      } else {
        const sourceDev = devices.find((d) => d.id === connectingSourceId);
        if (sourceDev) {
          executeAutoConnect(sourceDev, device);
        }
      }
      return;
    }

    // Manual cable tools
    if (activeTool.startsWith('cable_') || activeTool.includes('ethernet') || activeTool.includes('fiber') || activeTool.includes('dropcore') || activeTool.includes('wireless')) {
      const cableType = activeTool.startsWith('cable_') ? (activeTool.replace('cable_', '') as CableType) : (activeTool as CableType);

      if (!connectingSourceId) {
        setConnectingSourceId(device.id);
        showToast(`Klik perangkat kedua untuk menyambungkan kabel (${cableType})...`);
      } else if (connectingSourceId === device.id) {
        setConnectingSourceId(null);
      } else {
        const sourceDev = devices.find((d) => d.id === connectingSourceId);
        if (sourceDev) {
          setPortSelectorPair({
            devA: sourceDev,
            devB: device,
            cableType,
          });
        }
        setConnectingSourceId(null);
      }
    }
  };

  // Periodic simulation tick for Traffic Saturation & IoT Automations
  useEffect(() => {
    const timer = setInterval(() => {
      // 1. IoT Automation rules evaluation
      const iotResult = evaluateIoTAutomations(devices);
      if (iotResult.logs.length > 0) {
        setDevices(iotResult.updatedDevices);
        iotResult.logs.forEach((l) => addLog(l));
      }

      // 2. Traffic animations if active streams exist
      const runningStreams = activeStreams.filter((s) => s.isActive ?? s.active);
      if (runningStreams.length > 0) {
        const stream = runningStreams[Math.floor(Math.random() * runningStreams.length)];
        const srcDev = devices.find((d) => d.id === stream.sourceDeviceId);
        const tgtDev = devices.find((d) => d.id === stream.targetDeviceId);

        if (srcDev && tgtDev) {
          const sim = simulatePing(srcDev.id, tgtDev.id, devices, links, activeStreams);
          if (sim.pathCoordinates.length > 1) {
            triggerPacketAnimation(sim.pathCoordinates, sim.success, stream.rateMbps > 80 ? '#ef4444' : '#f59e0b');
          }
        }
      }
    }, 2800);

    return () => clearInterval(timer);
  }, [devices, links, activeStreams, addLog]);

  // Packet animation trigger
  const triggerPacketAnimation = (
    pathCoordinates: { x: number; y: number }[],
    success: boolean,
    customColor?: string,
  ) => {
    if (pathCoordinates.length < 2) return;

    for (let i = 0; i < pathCoordinates.length - 1; i++) {
      const from = pathCoordinates[i];
      const to = pathCoordinates[i + 1];
      const animId = `pkt_${Date.now()}_${i}`;

      const newAnim: PacketAnimation = {
        id: animId,
        fromX: from.x + 38,
        fromY: from.y + 38,
        toX: to.x + 38,
        toY: to.y + 38,
        progress: 0,
        color: customColor || (success ? '#10b981' : '#ef4444'),
      };

      setTimeout(() => {
        setPacketAnimations((prev) => [...prev, newAnim]);

        let progress = 0;
        const interval = setInterval(() => {
          progress += 0.08;
          if (progress >= 1) {
            clearInterval(interval);
            setPacketAnimations((prev) => prev.filter((p) => p.id !== animId));
          } else {
            setPacketAnimations((prev) =>
              prev.map((p) => (p.id === animId ? { ...p, progress } : p)),
            );
          }
        }, 30);
      }, i * 220);
    }
  };

  // Preset Scenario loader
  const handleSelectScenario = (scenario: PresetScenario) => {
    setTopologyName(scenario.name);
    setDevices(scenario.devices);
    setLinks(scenario.links);
    setTestResults([]);
    setSelectedDeviceId(null);
    setSelectedLinkId(null);
    setConnectingSourceId(null);
    setActiveStreams([]);
    pushHistory(scenario.devices, scenario.links, `Muat: ${scenario.name}`);
    showToast(`Topologi "${scenario.name}" berhasil dimuat.`);
    addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Skenario] Memuat topologi ${scenario.name}.`);
    requestAnimationFrame(() => canvasRef.current?.fitView());
  };

  // Apply auto-fix from diagnostics drawer
  const handleApplyAutoFix = (action: string) => {
    const result = applyAutoFix(action, devices, links);
    setDevices(result.updatedDevices);
    setLinks(result.updatedLinks);
    pushHistory(result.updatedDevices, result.updatedLinks, `Perbaikan Otomatis: ${action}`);
    showToast(result.message);
    addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Auto-Fix] ${result.message}`);
  };

  // Run DHCP DORA simulation
  const handleRunDHCPAllocation = () => {
    const dhcpRes = runDHCPSimulation(devices, links);
    if (dhcpRes.assignedCount > 0) {
      setDevices(dhcpRes.updatedDevices);
      pushHistory(dhcpRes.updatedDevices, links, 'Alokasi IP DHCP');
      showToast(`${dhcpRes.assignedCount} perangkat berhasil mendapatkan IP otomatis dari DHCP Server.`);
      dhcpRes.logs.forEach((log) => addLog(log));
    } else {
      showToast('Tidak ada DHCP Server aktif atau semua klien telah memiliki IP.');
    }
  };

  // Export topology as JSON
  const handleExportJson = () => {
    const data = {
      name: topologyName,
      devices,
      links,
      testResults,
      activeStreams,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Terminator_${topologyName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File topologi JSON berhasil diunduh.');
  };

  const handleImportJson = (data: any) => {
    if (data.devices && data.links) {
      setTopologyName(data.name || 'Topologi Baru');
      setDevices(data.devices);
      setLinks(data.links);
      setTestResults(data.testResults || []);
      setActiveStreams(data.activeStreams || []);
      pushHistory(data.devices, data.links, `Import ${data.name || 'Topologi'}`);
      showToast('Topologi berhasil diimport dari file JSON.');
      addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Import] File topologi ${data.name || 'Baru'} diimport.`);
      requestAnimationFrame(() => canvasRef.current?.fitView());
    } else {
      showToast('Format JSON tidak sesuai dengan skema TERMINATOR.');
    }
  };

  const handleClearCanvas = () => {
    if (window.confirm('Bersihkan seluruh kanvas? Semua perangkat dan kabel akan dihapus.')) {
      setDevices([]);
      setLinks([]);
      setTestResults([]);
      setActiveStreams([]);
      setSelectedDeviceId(null);
      setSelectedLinkId(null);
      setConnectingSourceId(null);
      pushHistory([], [], 'Bersihkan kanvas');
      showToast('Kanvas telah dibersihkan.');
      addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Reset] Kanvas topologi dibersihkan.`);
    }
  };

  // Keyboard shortcut listener (including Undo & Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Undo: Ctrl+Z or Cmd+Z
      if (isCtrlOrMeta && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z
      if (isCtrlOrMeta && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === 'Escape') {
        setActiveTool('pointer');
        setConnectingSourceId(null);
        setSelectedDeviceId(null);
        setSelectedLinkId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key.toLowerCase() === 'v') {
        setActiveTool('pointer');
      } else if (e.key.toLowerCase() === 'a') {
        setActiveTool('auto_connect');
      } else if (e.key.toLowerCase() === 'p') {
        setActiveTool('ping_tool');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDeviceId, selectedLinkId, handleUndo, handleRedo]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Header */}
      <Header
        topologyName={topologyName}
        onSelectScenario={handleSelectScenario}
        diagnosticReport={diagnosticReport}
        onOpenPingModal={() => setIsPingModalOpen(true)}
        onOpenTroubleshooting={() => setIsTroubleshootingOpen(true)}
        onOpenDocumentation={() => setIsDocumentationOpen(true)}
        onOpenTrafficGenerator={() => setIsTrafficModalOpen(true)}
        onOpenLiveMonitoring={() => setIsLiveMonitoringOpen(true)}
        onOpenExportImage={() => setIsExportImageOpen(true)}
        onRunDHCPAllocation={handleRunDHCPAllocation}
        onClearCanvas={handleClearCanvas}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenHelp={() => setIsHelpOpen(true)}
        isTrafficActive={activeStreams.some((s) => s.isActive ?? s.active)}
        logCount={liveLogs.length}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        undoDescription={undoDescription}
        redoDescription={redoDescription}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Device Catalog Sidebar (With Mobile slide-over support) */}
        <DeviceSidebar
          onAddDevice={(type) => handleAddDevice(type)}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Mobile backdrop for sidebar */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-xs"
          />
        )}

        {/* Central Canvas Workspace */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Top Floating Toolbar — wraps onto multiple lines on narrow
              screens instead of hiding tools behind horizontal scroll */}
          <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-[calc(100vw-3rem)] z-20">
            <Toolbar
              activeTool={activeTool}
              setActiveTool={(tool) => {
                setActiveTool(tool);
                setConnectingSourceId(null);
              }}
              isAutoConnecting={!!connectingSourceId}
              onCancelConnecting={() => setConnectingSourceId(null)}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              undoDescription={undoDescription}
              redoDescription={redoDescription}
              onOpenExportImage={() => setIsExportImageOpen(true)}
            />
          </div>

          {/* Interactive Topology Canvas */}
          <Canvas
            ref={canvasRef}
            devices={devices}
            links={links}
            selectedDeviceId={selectedDeviceId}
            selectedLinkId={selectedLinkId}
            activeTool={activeTool}
            isConnecting={!!connectingSourceId}
            connectingSourceId={connectingSourceId}
            packetAnimations={packetAnimations}
            activeStreams={activeStreams}
            onSelectDevice={(id) => {
              setSelectedDeviceId(id);
              setSelectedLinkId(null);
            }}
            onSelectLink={(id) => {
              setSelectedLinkId(id);
              setSelectedDeviceId(null);
            }}
            onDeviceMove={handleDeviceMove}
            onDeviceMoveEnd={handleDeviceMoveEnd}
            onDeviceDoubleClick={(dev) => setConfiguringDevice(dev)}
            onDeviceClickWithTool={handleDeviceClickWithTool}
            onDeleteSelected={handleDeleteSelected}
            onDropNewDevice={(type, x, y) => handleAddDevice(type as DeviceType, x, y)}
          />

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="absolute left-3 right-3 sm:left-6 sm:right-auto bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 z-30 sm:max-w-md bg-slate-900/95 border border-slate-700/80 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
              <span className="leading-snug">{toastMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Device Configuration Modal (with VLAN, OSPF, BGP, FTTH, IoT tabs) */}
      {configuringDevice && (
        <DeviceConfigModal
          device={configuringDevice}
          allDevices={devices}
          onUpdateDevice={(updated) => {
            const updatedDevices = devices.map((d) => (d.id === updated.id ? updated : d));
            setDevices(updatedDevices);
            pushHistory(updatedDevices, links, `Konfigurasi ${updated.name}`);
            showToast(`Konfigurasi ${updated.name} berhasil disimpan.`);
            addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Konfigurasi] ${updated.name} diperbarui.`);
          }}
          onClose={() => setConfiguringDevice(null)}
        />
      )}

      {/* 2. Manual Port Selector Modal */}
      {portSelectorPair && (
        <PortSelectorModal
          deviceA={portSelectorPair.devA}
          deviceB={portSelectorPair.devB}
          cableType={portSelectorPair.cableType}
          existingLinks={links}
          onConfirm={(portAId, portBId, cableType, lengthMeters) => {
            const newLink: NetworkLink = {
              id: `link_${Date.now()}`,
              fromDeviceId: portSelectorPair.devA.id,
              fromPortId: portAId,
              toDeviceId: portSelectorPair.devB.id,
              toPortId: portBId,
              cableType,
              lengthMeters,
              status: 'active',
            };
            const updatedLinks = [...links, newLink];
            setLinks(updatedLinks);
            setPortSelectorPair(null);
            pushHistory(devices, updatedLinks, `Koneksi kabel ${cableType}`);
            showToast(
              `Koneksi berhasil dibuat antara ${portSelectorPair.devA.name} dan ${portSelectorPair.devB.name}.`,
            );
            addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Link] Terhubung ${portSelectorPair.devA.name} <-> ${portSelectorPair.devB.name} (${cableType}, ${lengthMeters}m).`);
          }}
          onCancel={() => setPortSelectorPair(null)}
        />
      )}

      {/* 3. Real-Time Ping & Traceroute Modal */}
      {isPingModalOpen && (
        <PingTestModal
          devices={devices}
          links={links}
          activeStreams={activeStreams}
          onTriggerAnimation={triggerPacketAnimation}
          onSaveTestResult={(res) => {
            setTestResults((prev) => [res, ...prev]);
            addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Ping] Hasil pengujian ke ${res.targetIp}: ${res.success ? 'SUKSES' : 'GAGAL'} (${res.rttAvg}ms, loss ${res.packetLoss}%)`);
          }}
          onOpenTroubleshooting={() => setIsTroubleshootingOpen(true)}
          onClose={() => setIsPingModalOpen(false)}
        />
      )}

      {/* 4. Troubleshooting & Diagnostic Drawer */}
      <TroubleshootingDrawer
        report={diagnosticReport}
        isOpen={isTroubleshootingOpen}
        onClose={() => setIsTroubleshootingOpen(false)}
        onRefresh={() => showToast('Audit jaringan selesai diperbarui.')}
        onApplyAutoFix={handleApplyAutoFix}
      />

      {/* 5. Printable Documentation Report Modal */}
      {isDocumentationOpen && (
        <DocumentationModal
          topologyName={topologyName}
          devices={devices}
          links={links}
          testResults={testResults}
          diagnosticReport={diagnosticReport}
          onClose={() => setIsDocumentationOpen(false)}
        />
      )}

      {/* 6. Traffic Generator Modal */}
      <TrafficGeneratorModal
        isOpen={isTrafficModalOpen}
        onClose={() => setIsTrafficModalOpen(false)}
        devices={devices}
        links={links}
        activeStreams={activeStreams}
        onUpdateStreams={(streams) => {
          setActiveStreams(streams);
          addLog(`[${new Date().toLocaleTimeString('id-ID')}] [Traffic Gen] Daftar aliran trafik diperbarui (${streams.length} stream aktif).`);
        }}
      />

      {/* 7. Live Monitoring & Logs Drawer */}
      <LiveMonitoringDrawer
        isOpen={isLiveMonitoringOpen}
        onClose={() => setIsLiveMonitoringOpen(false)}
        logs={liveLogs}
        onClearLogs={() => setLiveLogs([])}
        devices={devices}
        links={links}
        activeStreams={activeStreams}
      />

      {/* 8. Export Image PNG & SVG Modal */}
      <ExportImageModal
        isOpen={isExportImageOpen}
        onClose={() => setIsExportImageOpen(false)}
        devices={devices}
        links={links}
        topologyName={topologyName}
      />

      {/* 9. Quick Help Guide Modal */}
      {isHelpOpen && <QuickGuideModal onClose={() => setIsHelpOpen(false)} />}
    </div>
  );
}
