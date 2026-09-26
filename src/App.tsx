import { useState, useMemo, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { DevicePalette } from './components/DevicePalette';
import { CableToolbar } from './components/CableToolbar';
import type { CanvasHandle } from './components/Canvas';
import { Canvas } from './components/Canvas';
import { NodeInspector } from './components/NodeInspector';
import { CableInspector } from './components/CableInspector';
import { TroubleshootingModal } from './components/TroubleshootingModal';
import { TerminalModal } from './components/TerminalModal';
import { OPMFloatingTool } from './components/OPMFloatingTool';
import { GlossaryModal } from './components/GlossaryModal';
import { TemplateModal } from './components/TemplateModal';

import type { NetworkNode, CableConnection, NodeCableType, NodeType, ActiveTool, DevicePort, PortMedium } from './types/network';
import type { TopologyTemplate } from './data/templates';
import { TOPOLOGY_TEMPLATES } from './data/templates';
import { DEVICE_METADATA } from './data/deviceDefinitions';
import { DEVICE_BRANDS } from './data/deviceBrands';
import { calculateOpticalPowers } from './utils/opticalCalculator';
import { runNetworkDiagnostics } from './utils/diagnosticEngine';
import { planPing } from './utils/pingTool';
import { findFreeSlot } from './utils/nodePlacement';
import { mediumForCable, reconcilePorts, synthesisePort } from './utils/portReconcile';
import { allocateStaticHost, gatewayAddressOf, primaryGateway } from './utils/ipAlloc';
import { zoomIn, zoomOut } from './utils/zoom';
import type { HistoryState } from './utils/historyCore';
import { canRedo as stackCanRedo, canUndo as stackCanUndo, createHistory, isSameSnapshot, pushSnapshot, redo as stackRedo, undo as stackUndo } from './utils/historyCore';
import { toPng } from 'html-to-image';

// Templates are module-level singletons. Seeding state with them directly
// would alias the same node/cable objects, so any in-place mutation (e.g.
// auto-created ports) would permanently corrupt the template and every undo
// snapshot would share objects with it. Always deep-clone on the way in.
//
// The clone then gets its ports reconciled against its cables. All three shipped
// templates declare cables but mark no ports at all, so without this the first
// free ethernet port was handed out again for every new connection: on the SOHO
// MikroTik, whose ether1/ether2 already had cables, a new device landed on
// ether1 (WAN) instead of ether3 (Hotspot).
const cloneTemplate = (t: TopologyTemplate) => {
  const cables = structuredClone(t.cables);
  return { nodes: reconcilePorts(structuredClone(t.nodes), cables), cables };
};

export default function App() {
  // Initial default: FTTH GPON Standard template.
  //
  // One clone, shared between the live state and the initial history snapshot.
  // This used to be three separate cloneTemplate() calls -- one for nodes, one
  // for cables, one for the history -- so the initial snapshot could never be
  // reference-equal to the state it was supposed to describe, and that is what
  // produced a phantom undo step: 500ms after every page load the pristine
  // template was pushed into the history, undo lit up with nothing to undo, and
  // clicking it changed nothing while still toasting "Perubahan diurungkan."
  // The reference guard in the history effect below depends on this shared
  // identity, so it has to start from one clone.
  const [initial] = useState(() => cloneTemplate(TOPOLOGY_TEMPLATES[0]));

  const [nodes, setNodes] = useState<NetworkNode[]>(initial.nodes);
  const [cables, setCables] = useState<CableConnection[]>(initial.cables);

  const canvasRef = useRef<CanvasHandle>(null);

  // ---- Undo / Redo history -------------------------------------------
  // Implemented as a debounced snapshot of {nodes, cables}: any change is
  // recorded ~500ms after things settle, so a drag gesture (which fires many
  // rapid position updates) collapses into a single undo step instead of
  // flooding the history with every intermediate frame. The stack itself is
  // plain data in src/utils/historyCore.ts, which keeps the cursor and
  // truncation rules testable on their own.
  const [history, setHistory] = useState<HistoryState>(
    () => createHistory({ nodes: initial.nodes, cables: initial.cables }),
  );
  const isRestoringRef = useRef(false);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      // Nothing actually changed, so there is no step to record. Without this
      // guard every page load pushed its own pristine template into the history
      // half a second after mount: undo became clickable with an empty past, and
      // the click restored the identical topology while still reporting
      // success. isSameSnapshot lives in historyCore so the wiring test and the
      // stack tests run the same predicate this does.
      setHistory((h) => (isSameSnapshot(h, { nodes, cables }) ? h : pushSnapshot(h, { nodes, cables })));
    }, 500);
    return () => clearTimeout(historyDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, cables]);

  const canUndo = stackCanUndo(history);
  const canRedo = stackCanRedo(history);

  const handleUndo = () => {
    if (!canUndo) return;
    const next = stackUndo(history);
    isRestoringRef.current = true;
    setNodes(next.present.nodes as NetworkNode[]);
    setCables(next.present.cables as CableConnection[]);
    setHistory(next);
    showToast('Perubahan diurungkan.');
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const next = stackRedo(history);
    isRestoringRef.current = true;
    setNodes(next.present.nodes as NetworkNode[]);
    setCables(next.present.cables as CableConnection[]);
    setHistory(next);
    showToast('Perubahan diulangi.');
  };

  // ---- Import / Export topology as a .json file ----------------------
  const handleExportJson = () => {
    const payload = {
      name: 'Topologi TERMINATOR',
      exportedAt: new Date().toISOString(),
      nodes,
      cables,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    a.href = url;
    a.download = `Terminator_Topologi_${dateStr}.json`;
    a.click();
    // Revoking synchronously can cancel the download in some browsers; give
    // the browser a tick to pick up the blob first.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('✓ Topologi berhasil disimpan sebagai file .json');
  };

  const handleImportJson = (data: any) => {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.cables)) {
      showToast('⚠️ Format file JSON tidak sesuai dengan skema TERMINATOR.');
      return;
    }
    // Same reconciliation as a template load: a .json saved before this existed
    // carries cables with no port references, and would otherwise hand the same
    // port to every new connection.
    const importedCables = structuredClone(data.cables);
    setNodes(reconcilePorts(structuredClone(data.nodes), importedCables));
    setCables(importedCables);
    setSelectedNodeId(null);
    setSelectedCableId(null);
    setProbedNodeId(null);
    showToast(`Topologi "${data.name || 'tanpa nama'}" berhasil diimport.`);
    requestAnimationFrame(() => canvasRef.current?.fitView());
  };

  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedCableType, setSelectedCableType] = useState<NodeCableType>('drop_core');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);
  const [pingSourceNodeId, setPingSourceNodeId] = useState<string | null>(null);

  // Modals
  const [isTroubleshootingOpen, setIsTroubleshootingOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [terminalNodeId, setTerminalNodeId] = useState<string | null>(null);
  // IP yang harus di-ping begitu terminal dibuka; null = terminal biasa.
  const [terminalPingIp, setTerminalPingIp] = useState<string | null>(null);
  const [probedNodeId, setProbedNodeId] = useState<string | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Kept in a ref so a rapid second toast cancels the first one's timer —
  // otherwise the older timeout clears the newer message early.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // Optical Calculations (Power budget & attenuation)
  const opticalResults = useMemo(() => {
    return calculateOpticalPowers(nodes, cables);
  }, [nodes, cables]);

  // Diagnostics & Problem Solver engine
  const issues = useMemo(() => {
    return runNetworkDiagnostics(nodes, cables, opticalResults);
  }, [nodes, cables, opticalResults]);

  // Add new device to canvas
  const handleAddDevice = (type: NodeType) => {
    const meta = DEVICE_METADATA[type];
    const newId = `node-${type}-${Date.now().toString(36)}`;
    const countSameType = nodes.filter((n) => n.type === type).length;
    const brandsForType = DEVICE_BRANDS[type] || [];
    const defaultBrand = brandsForType[0]?.brand || '';
    const defaultModel = brandsForType[0]?.models[0] || meta.name;
    const displayName = `${meta.name.split('(')[0].trim()} ${countSameType + 1}`;
    const slot = findFreeSlot(nodes.map((n) => ({ x: n.x, y: n.y })));

    // Address for a device joining the existing LAN.
    //
    // The old code used `192.168.1.${100 + countSameType}`, and countSameType
    // counts nodes of the *same type*: adding a PC and then a router produced
    // two nodes on 192.168.1.100, a live IP conflict created by the app itself
    // and reported as normal operation. The walk now looks at every address
    // anyone holds, so the new device lands on the first genuinely free host.
    //
    // `router` and `server` used to get no `ipConfig` at all, which meant their
    // cards showed no address and the conflict check had nothing to compare.
    // A new router is modelled as an AP on the existing LAN -- static address,
    // upstream as gateway, no DHCP server of its own -- which is exactly how the
    // shipped SOHO template describes its router (192.168.88.2 via
    // 192.168.88.1).
    const lanGateway = primaryGateway(nodes);
    const lanAddress = allocateStaticHost(lanGateway, nodes);
    const lanSubnet = lanGateway?.ipConfig?.subnet || lanGateway?.ontConfig?.lanSubnet || '255.255.255.0';
    const lanGatewayIp = gatewayAddressOf(lanGateway);

    const newNode: NetworkNode = {
      id: newId,
      type,
      name: displayName,
      label: defaultModel,
      brand: defaultBrand,
      model: defaultModel,
      // First grid slot that collides with nothing already on the canvas. The
      // old arithmetic stepped 60px against a 132px card and repeated every 20
      // devices, so new devices covered their neighbours and node 21 landed
      // exactly on node 1.
      ...slot,
      poweredOn: true,
      status: 'online',
      ports: meta.defaultPorts.map((p, idx) => ({
        id: `p-${newId}-${idx}`,
        name: p.name,
        medium: p.medium,
        status: 'up',
      })),
      opticalConfig:
        type === 'olt'
          ? { txPowerDbm: 3.0, connectorType: 'SC/UPC' }
          : type === 'splitter'
          ? { splitterRatio: '1:8' }
          : type === 'ont'
          ? { rxPowerDbm: -19.0, connectorType: 'SC/UPC' }
          : undefined,
      ontConfig:
        type === 'ont'
          ? {
              brand: defaultBrand || 'ZTE',
              model: defaultModel || 'ZTE ZXHN F609',
              wanMode: 'pppoe',
              pppoeUsername: `user_${countSameType + 1}@telkom.net`,
              pppoePassword: 'password123',
              vlanId: 1049,
              staticWanIp: '10.10.0.15',
              staticWanSubnet: '255.255.255.0',
              staticWanGateway: '10.10.0.1',
              staticWanDns: '8.8.8.8',
              lanIp: '192.168.1.1',
              lanSubnet: '255.255.255.0',
              dhcpServerEnabled: true,
              dhcpPoolStart: '192.168.1.2',
              dhcpPoolEnd: '192.168.1.254',
              wifiSsid: `Wi-Fi-Klien-${countSameType + 1}`,
              wifiPassword: 'admin12345',
            }
          : undefined,
      htbRole: type === 'htb' ? (countSameType % 2 === 0 ? 'A' : 'B') : undefined,
      ipConfig:
        ['pc', 'cctv', 'smartphone', 'iot', 'server', 'router'].includes(type)
          ? {
              mode: 'static',
              // `null` means the pool is exhausted. Left as a constant .100 it
              // would collide with whatever already sits there, which is the
              // exact conflict this allocator exists to avoid. An empty address
              // is honest, and Check 6 reports it.
              ip: lanAddress ?? '',
              subnet: lanSubnet,
              gateway: lanGatewayIp ?? '192.168.1.1',
              dns: '8.8.8.8',
              // A router added to a running LAN is an AP on it, not a second
              // DHCP server competing with the upstream one.
              ...(type === 'router' ? { isDhcpServerEnabled: false } : {}),
            }
          : type === 'ont'
          ? {
              mode: 'static',
              // Deliberate: an ONT's address is the gateway of its *own* LAN
              // on its own PON leg, so two ONTs legitimately both answer to
              // 192.168.1.1 on different broadcast domains. The duplicate
              // warning is what is wrong there -- it needs one subnet per
              // broadcast domain, which this single flat node list cannot
              // express. Do not "fix" this by allocating: that would just
              // hide the modelling gap behind unique-looking addresses.
              ip: '192.168.1.1',
              subnet: '255.255.255.0',
              gateway: '10.10.0.1',
              dns: '8.8.8.8',
              isDhcpServerEnabled: true,
              dhcpRangeStart: '192.168.1.2',
              dhcpRangeEnd: '192.168.1.254',
            }
          : type === 'mikrotik'
          ? {
              mode: 'static',
              // A MikroTik added to a running LAN is a host on it, so it is
              // allocated like any other member. This was a hardcoded
              // 192.168.88.1 -- the exact address the MikroTik in the shipped
              // SOHO template already holds, so every MikroTik added to that
              // topology came up as a duplicate, was flagged as a conflict,
              // and was reachable through nothing.
              ip: allocateStaticHost(lanGateway, nodes) ?? '',
              subnet: lanSubnet,
              // The old hardcoded upstream 202.134.0.1 is only the fallback;
              // when the LAN already has a gateway, that is the real one.
              gateway: lanGatewayIp ?? '202.134.0.1',
              dns: '8.8.8.8',
              isDhcpServerEnabled: true,
            }
          : undefined,
      mikrotikConfig:
        type === 'mikrotik'
          ? {
              firewallNat: true,
              pppoeServer: false,
              dnsServer: true,
              totalQueues: 5,
              bandwidthLimitMbps: 50,
            }
          : undefined,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
    showToast(`Perangkat ${displayName} (${defaultBrand || meta.name}) berhasil ditambahkan.`);
  };

  // Connect nodes via selected cable type
  const handleConnectNodes = (fromNodeId: string, toNodeId: string, cableType: NodeCableType) => {
    const fromNode = nodes.find((n) => n.id === fromNodeId);
    const toNode = nodes.find((n) => n.id === toNodeId);
    if (!fromNode || !toNode) return;

    // Check if duplicate connection
    const alreadyConnected = cables.some(
      (c) =>
        (c.fromNodeId === fromNodeId && c.toNodeId === toNodeId) ||
        (c.fromNodeId === toNodeId && c.toNodeId === fromNodeId)
    );
    if (alreadyConnected) {
      showToast(`Kedua perangkat ini sudah terhubung kabel.`);
      return;
    }

    // Required medium for selected cable. Shared with port reconciliation so
    // the medium a port is claimed for and the medium reconciliation searches
    // for cannot drift apart.
    const requiredMedium: PortMedium = mediumForCable(cableType);

    // Claim a free port of the required medium, or synthesise a new one.
    // NOTE: never push onto `node.ports` here — that array is owned by React
    // state (and by the undo snapshots). The returned port is attached to the
    // node immutably further down, once the cable id exists.
    const claimPort = (node: NetworkNode, suffix: 'a' | 'b'): DevicePort => {
      const free = node.ports.find((p) => p.medium === requiredMedium && !p.connectedCableId);
      if (free) return { ...free };
      return {
        ...synthesisePort(node, requiredMedium, `${Date.now().toString(36)}-${suffix}`),
      };
    };

    const fromPort = claimPort(fromNode, 'a');
    const toPort = claimPort(toNode, 'b');

    // Calculate approximate physical distance in km
    const dx = Math.abs(fromNode.x - toNode.x);
    const dy = Math.abs(fromNode.y - toNode.y);
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const lengthKm =
      cableType === 'lan'
        ? Math.max(0.005, Number((distPx / 15000).toFixed(3)))
        : cableType === 'drop_core'
        ? Math.max(0.05, Number((distPx / 2000).toFixed(2)))
        : Math.max(0.5, Number((distPx / 300).toFixed(1)));

    const newCable: CableConnection = {
      id: `cable-${Date.now().toString(36)}`,
      type: cableType,
      fromNodeId,
      fromPortId: fromPort.id,
      toNodeId,
      toPortId: toPort.id,
      lengthKm,
      attenuationDb: Number((lengthKm * 0.35).toFixed(2)),
      status: 'active',
    };

    // Attach the claimed ports immutably and record the back-reference so
    // `claimPort` can tell occupied ports from free ones on the next cable.
    const attachPort = (node: NetworkNode, port: typeof fromPort) => {
      const exists = node.ports.some((p) => p.id === port.id);
      const ports = exists
        ? node.ports.map((p) => (p.id === port.id ? { ...p, connectedCableId: newCable.id } : p))
        : [...node.ports, { ...port, connectedCableId: newCable.id }];
      return { ...node, ports };
    };

    setNodes((prev) =>
      prev.map((n) =>
        n.id === fromNodeId ? attachPort(n, fromPort) : n.id === toNodeId ? attachPort(n, toPort) : n
      )
    );
    setCables((prev) => [...prev, newCable]);
    showToast(`Kabel ${cableType.toUpperCase()} berhasil menghubungkan ${fromNode.name} ke ${toNode.name}.`);
  };

  // Release every port back-reference held by the given cables.
  const releasePortsOf = (prev: NetworkNode[], cableIds: Set<string>) =>
    prev.map((n) => {
      if (!n.ports.some((p) => p.connectedCableId && cableIds.has(p.connectedCableId))) return n;
      return {
        ...n,
        ports: n.ports.map((p) =>
          p.connectedCableId && cableIds.has(p.connectedCableId)
            ? { ...p, connectedCableId: undefined }
            : p
        ),
      };
    });

  // Node position update
  const handleUpdateNodePosition = (nodeId: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
    );
  };

  // Update node properties from Inspector
  const handleUpdateNode = (updated: NetworkNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    const orphanedCableIds = new Set(
      cables.filter((c) => c.fromNodeId === nodeId || c.toNodeId === nodeId).map((c) => c.id)
    );
    setNodes((prev) => releasePortsOf(prev.filter((n) => n.id !== nodeId), orphanedCableIds));
    setCables((prev) =>
      prev.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId)
    );
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    if (probedNodeId === nodeId) setProbedNodeId(null);
    showToast('Node dan kabel terkait telah dihapus.');
  };

  // Delete cable
  const handleDeleteCable = (cableId: string) => {
    setNodes((prev) => releasePortsOf(prev, new Set([cableId])));
    setCables((prev) => prev.filter((c) => c.id !== cableId));
    if (selectedCableId === cableId) setSelectedCableId(null);
    showToast('Kabel telah dihapus dari topologi.');
  };

  // Update cable properties (length, status)
  const handleUpdateCable = (updated: CableConnection) => {
    setCables((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Trigger ping test between two nodes
  const handleTriggerPing = (fromNodeId: string, toNodeId: string) => {
    const plan = planPing(
      nodes.find((n) => n.id === fromNodeId),
      nodes.find((n) => n.id === toNodeId),
    );
    if (plan.kind === 'reject') {
      showToast(plan.reason);
      return;
    }
    // Open the source terminal with the ping already running against the target.
    setTerminalPingIp(plan.targetIp);
    setTerminalNodeId(plan.sourceNodeId);
  };

  // Reset or clear canvas
  const handleReset = () => {
    if (confirm('Apakah Anda ingin mengembalikan topologi ke template awal FTTH GPON?')) {
      const fresh = cloneTemplate(TOPOLOGY_TEMPLATES[0]);
      setNodes(fresh.nodes);
      setCables(fresh.cables);
      setSelectedNodeId(null);
      setSelectedCableId(null);
      setProbedNodeId(null);
      showToast('Topologi di-reset ke template awal.');
      requestAnimationFrame(() => canvasRef.current?.fitView());
    }
  };

  // Save Topology as High-Resolution PNG Image
  const handleSaveTopologyImage = async () => {
    const canvasEl = document.getElementById('network-canvas-container');
    if (!canvasEl) {
      showToast('Kanvas topologi tidak ditemukan.');
      return;
    }

    try {
      showToast('Sedang membuat gambar topologi (PNG)...');
      const dataUrl = await toPng(canvasEl, {
        backgroundColor: '#f8fafc',
        pixelRatio: 2, // 2x crisp HD resolution
        cacheBust: true,
        filter: (node) => {
          const el = node as HTMLElement;
          if (el?.classList?.contains('export-exclude')) return false;
          return true;
        },
      });

      const a = document.createElement('a');
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
      a.download = `topologi-jaringan-${dateStr}_${timeStr}.png`;
      a.href = dataUrl;
      a.click();
      showToast('✓ Gambar topologi berhasil diunduh (PNG)!');
    } catch (err) {
      console.error('Save image failed:', err);
      showToast('Gagal membuat gambar topologi. Silakan coba lagi.');
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedCable = cables.find((c) => c.id === selectedCableId) || null;
  const probedNode = nodes.find((n) => n.id === probedNodeId) || null;
  const terminalNode = nodes.find((n) => n.id === terminalNodeId) || null;

  const connectingSourceNode = nodes.find((n) => n.id === connectingSourceNodeId);
  const pingSourceNode = nodes.find((n) => n.id === pingSourceNodeId);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans text-slate-800 antialiased selection:bg-sky-200">
      {/* Top Navbar */}
      <Navbar
        isRunning={isRunning}
        onToggleRun={() => setIsRunning(!isRunning)}
        onReset={handleReset}
        issues={issues}
        onOpenTroubleshooting={() => setIsTroubleshootingOpen(true)}
        onOpenGlossary={() => setIsGlossaryOpen(true)}
        onOpenTemplates={() => setIsTemplateOpen(true)}
        onSaveImage={handleSaveTopologyImage}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      {/* Cable & Interactive Tool Controls */}
      <CableToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        selectedCableType={selectedCableType}
        setSelectedCableType={setSelectedCableType}
        zoomLevel={zoomLevel}
        onZoomIn={() => setZoomLevel(zoomIn)}
        onZoomOut={() => setZoomLevel(zoomOut)}
        onResetZoom={() => setZoomLevel(1.0)}
        connectingSourceNodeName={connectingSourceNode?.name}
        onCancelConnection={() => setConnectingSourceNodeId(null)}
        pingSourceNodeName={pingSourceNode?.name}
        onCancelPing={() => setPingSourceNodeId(null)}
      />

      {/* Main Workspace (Device Palette + Canvas + Side Inspector) */}
      <div className="relative flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Device Library & Palette */}
        <DevicePalette onAddDevice={handleAddDevice} />

        {/* Interactive Network Topology Canvas */}
        <Canvas
          ref={canvasRef}
          nodes={nodes}
          cables={cables}
          opticalResults={opticalResults}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onUpdateNodePosition={handleUpdateNodePosition}
          activeTool={activeTool}
          selectedCableType={selectedCableType}
          onConnectNodes={handleConnectNodes}
          onSelectCable={setSelectedCableId}
          selectedCableId={selectedCableId}
          onDeleteCable={handleDeleteCable}
          onDeleteNode={handleDeleteNode}
          onProbeOpm={(nodeId) => setProbedNodeId(nodeId)}
          onTriggerPing={handleTriggerPing}
          zoomLevel={zoomLevel}
          onSetZoomLevel={setZoomLevel}
          isRunning={isRunning}
          connectingSourceNodeId={connectingSourceNodeId}
          setConnectingSourceNodeId={setConnectingSourceNodeId}
          pingSourceNodeId={pingSourceNodeId}
          setPingSourceNodeId={setPingSourceNodeId}
          issues={issues}
        />

        {/* Node Inspector Drawer */}
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            allNodes={nodes}
            allCables={cables}
            onClose={() => setSelectedNodeId(null)}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            opticalResult={opticalResults.get(selectedNode.id)}
            onOpenTerminal={(nodeId) => {
              setTerminalPingIp(null);
              setTerminalNodeId(nodeId);
            }}
            connectedCables={cables.filter(
              (c) => c.fromNodeId === selectedNode.id || c.toNodeId === selectedNode.id
            )}
          />
        )}
      </div>

      {/* Floating Cable Inspector & Deletion tool */}
      {selectedCable && (
        <CableInspector
          cable={selectedCable}
          nodes={nodes}
          onClose={() => setSelectedCableId(null)}
          onDeleteCable={handleDeleteCable}
          onUpdateCable={handleUpdateCable}
        />
      )}

      {/* Floating Optical Power Meter (OPM) tool */}
      {probedNode && (
        <OPMFloatingTool
          probedNode={probedNode}
          opticalResult={opticalResults.get(probedNode.id)}
          onClose={() => setProbedNodeId(null)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900/90 text-white px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* Troubleshooting & Problem Solver Modal */}
      <TroubleshootingModal
        isOpen={isTroubleshootingOpen}
        onClose={() => setIsTroubleshootingOpen(false)}
        issues={issues}
        onFocusNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setIsTroubleshootingOpen(false);
        }}
      />

      {/* Interactive Terminal CLI Modal */}
      <TerminalModal
        isOpen={Boolean(terminalNodeId)}
        onClose={() => {
          setTerminalNodeId(null);
          setTerminalPingIp(null);
        }}
        node={terminalNode}
        nodes={nodes}
        pingTargetIp={terminalPingIp}
      />

      {/* Educational Glossary Modal */}
      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />

      {/* Topology Template Loader Modal */}
      <TemplateModal
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onSelectTemplate={(template: TopologyTemplate) => {
          const fresh = cloneTemplate(template);
          setNodes(fresh.nodes);
          setCables(fresh.cables);
          setSelectedNodeId(null);
          setSelectedCableId(null);
          setProbedNodeId(null);
          showToast(`Topologi "${template.name}" berhasil dimuat.`);
          requestAnimationFrame(() => canvasRef.current?.fitView());
        }}
      />
    </div>
  );
}
