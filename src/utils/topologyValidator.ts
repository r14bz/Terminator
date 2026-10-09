import type { CableConnection, DiagnosticIssue, NetworkNode } from '../types/network';
import {
  validateDhcpRules, validateEndpointRules, validateIpRules, validateLayer2Rules,
  validateMikrotikRules, validateOntRules, validatePhysicalRules, validateRouterRules, validateWirelessRules, evaluatePppoe,
} from '../rules';
import { dhcpEnabled, dhcpServesDomain, isClient, isStructuredMikrotik, l2Domains, pickDhcpServer, vlanPath } from '../rules/common';
import { seededIndex } from './dhcpAuto';
import type { RuleContext } from '../rules/types';
import { checkInternetAccess, findUpstreamGateway } from './ipUtils';

/** Empat status hasil sesuai dokumen aturan. */
export type TopologyStatus = 'not_connected' | 'connected_no_ip' | 'ip_no_internet' | 'internet_normal';
export type ValidationLayer = NonNullable<DiagnosticIssue['layer']>;

export interface NodeResult {
  status: TopologyStatus;
  /** Lapisan tempat gagal (kosong bila internet normal). */
  layer?: ValidationLayer;
  /** Alasan dalam bahasa sederhana, selalu terisi. */
  reason: string;
  /** Nomor aturan di dokumen, bila ada. */
  ruleRef?: string;
}

export interface TopologyValidationResult {
  issues: DiagnosticIssue[];
  statusByNode: Map<string, TopologyStatus>;
  /** Status + alasan lengkap per node. */
  resultByNode: Map<string, NodeResult>;
  /** Kondisi pada topologi ini yang tidak tercakup dokumen. Tampilkan sebagai pertanyaan ke pengguna, bukan error. */
  undefinedRules: string[];
}

/** Aturan yang belum bisa dievaluasi karena modelnya belum ada. Bukan masalah topologi. */
export const PENDING_RULES: readonly string[] = [
  '4A.7 dan 4A.8: static route antar-router (belum ada tabel route untuk router umum/ONT).',
  '4B.5 dan 4C.6: mode router vs AP/bridge pada access point dan node utama mesh belum dimodelkan.',
  '4B.6 sampai 4B.8: password WiFi, jangkauan sinyal, dan band per client belum dimodelkan.',
  '4B.11: tumpang tindih kanal butuh posisi/jarak antar-AP.',
  '4C.3, 4C.4, 4C.7: kecepatan backhaul per hop dan sistem/merek mesh (EasyMesh) belum dimodelkan.',
  '3.8: router di port access (hanya satu VLAN yang punya gateway) belum dievaluasi.',
  '4A.6: router umum belum punya pengaturan NAT di model data; NAT hanya dievaluasi untuk MikroTik (5.3.2).',
  '4A.5: router umum tanpa default route masih dianggap punya internet (celah yang ditemukan saat uji); hanya MikroTik yang dicek (5.2.2).',
  '5.3.4: koneksi masuk dari luar ke IP lokal tanpa port forward belum dimodelkan.',
  '5.5.1 dan 5.5.2: status login voucher hotspot (belum ada field status login client).',
  '6.x per-SSID: mode WAN dan DHCP per SSID pada ONT belum dimodelkan (ONT baru punya satu set konfigurasi).',
];

/** Issue yang lebih spesifik menggantikan issue umum untuk node yang sama (hindari dua peringatan untuk satu sebab). */
const SUPERSEDES: Array<[specific: string, generic: string]> = [['gw-mismatch-', 'subnet-mismatch-gw-']];

function dedupe(issues: DiagnosticIssue[]): DiagnosticIssue[] {
  const ids = new Set(issues.map((i) => i.id));
  return issues.filter((i) => !SUPERSEDES.some(([s, g]) => i.id.startsWith(g) && ids.has(s + i.id.slice(g.length))));
}

const ROUTE_LEVEL_IP_ISSUES = ['no-gw-', 'gw-mismatch-', 'subnet-mismatch-gw-'];
const isRouteLevel = (i: DiagnosticIssue) => ROUTE_LEVEL_IP_ISSUES.some((p) => i.id.startsWith(p));

function undefinedRulesFor(nodes: readonly NetworkNode[], ctx: RuleContext): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === 'mikrotik' && !isStructuredMikrotik(n)) {
      out.push(`MikroTik "${n.name}": konfigurasi interface, IP, route, dan NAT belum diisi lengkap, jadi aturan 5.1 sampai 5.6 belum bisa dicek.`);
    }
    if (n.type === 'ont' && n.ontConfig?.wanMode === 'pppoe' && n.ontConfig.pppoeTarget === undefined
      && nodes.some((m) => isStructuredMikrotik(m) && (m.mikrotikConfig!.pppoeServers?.length ?? 0) > 0)) {
      out.push(`ONT "${n.name}": belum ditentukan PPPoE-nya dial ke ISP (BRAS) atau ke MikroTik, jadi aturan 5.4 tidak dievaluasi.`);
    }
    if (n.type === 'mikrotik' && isStructuredMikrotik(n) && n.mikrotikConfig!.pppSecrets === undefined
      && (n.mikrotikConfig!.pppoeServers?.length ?? 0) > 0) {
      out.push(`MikroTik "${n.name}": PPP > Secrets belum diisi, jadi aturan 5.4.2 (autentikasi) belum bisa dicek.`);
    }
  }
  void ctx;
  return out;
}

/** ONT ISP yang tersambung Layer 2 ke router: bila semuanya tanpa uplink optik, tidak ada internet (aturan 1.3, 6.4). */
function upstreamOpticalBlocker(router: NetworkNode, ctx: RuleContext): NetworkNode | undefined {
  // Sumber Internet tidak punya uplink optik; internetnya instan (aturan 8.1).
  if (router.type === 'internet_source') return undefined;
  const hasUplink = (o: NetworkNode) => o.ontConfig?.ponStatus !== 'LOS (No Signal)'
    && ctx.cables.some((c) => c.status !== 'broken' && ['drop_core', 'distribusi', 'feeder'].includes(c.type) && (c.fromNodeId === o.id || c.toNodeId === o.id));
  // Gateway-nya sendiri ONT (mis. client di belakang ONT bridge yang tersambung ke ONT online, aturan 2.1):
  // yang menentukan hanya uplink optik ONT gateway itu, bukan ONT bridge di sisi client.
  if (router.type === 'ont') return hasUplink(router) ? undefined : router;
  const onts: NetworkNode[] = [];
  const seen = new Set([router.id]);
  const q = [router.id];
  while (q.length) {
    const id = q.shift()!;
    for (const c of ctx.cables) {
      if (c.status === 'broken' || !['lan', 'wireless'].includes(c.type)) continue;
      if (c.fromNodeId !== id && c.toNodeId !== id) continue;
      const oid = c.fromNodeId === id ? c.toNodeId : c.fromNodeId;
      if (seen.has(oid)) continue;
      seen.add(oid);
      const o = ctx.nodes.find((x) => x.id === oid);
      if (!o || !o.poweredOn) continue;
      if (o.type === 'ont') { if (o.ontConfig?.pppoeTarget !== 'mikrotik') onts.push(o); continue; }
      if (['switch', 'switch_managed', 'htb', 'ap_ptp', 'access_point'].includes(o.type)) q.push(oid);
    }
  }
  if (!onts.length) return undefined;
  return onts.every((o) => !hasUplink(o)) ? onts[0] : undefined;
}

export function validateTopology(nodes: readonly NetworkNode[], cables: readonly CableConnection[]): TopologyValidationResult {
  const ctx: RuleContext = { nodes, cables };
  // Urutan mengikuti prinsip umum: fisik, layer 2, IP, route/NAT/layanan.
  const issues = dedupe([
    ...validatePhysicalRules(ctx), ...validateLayer2Rules(ctx), ...validateWirelessRules(ctx), ...validateIpRules(ctx), ...validateDhcpRules(ctx),
    ...validateEndpointRules(ctx), ...validateRouterRules(ctx), ...validateMikrotikRules(ctx), ...validateOntRules(ctx),
  ]);

  const domains = l2Domains(nodes, cables);
  const resultByNode = new Map<string, NodeResult>();
  const put = (id: string, status: TopologyStatus, reason: string, layer?: ValidationLayer, ruleRef?: string) =>
    resultByNode.set(id, { status, reason, layer, ruleRef });
  const fromIssue = (i: DiagnosticIssue) => i.cause ?? i.title;

  for (const n of nodes) {
    const own = issues.filter((i) => i.severity !== 'info' && (i.targetNodeId === n.id
      || (i.targetCableId && cables.some((c) => c.id === i.targetCableId && (c.fromNodeId === n.id || c.toNodeId === n.id)))));

    if (!isClient(n)) {
      const bad = own.find((i) => i.category === 'physical' || i.category === 'topology');
      if (bad) { put(n.id, 'not_connected', fromIssue(bad), bad.layer, bad.ruleRef); continue; }
      const ipBad = own.find((i) => i.category === 'ip');
      if (ipBad) { put(n.id, 'connected_no_ip', fromIssue(ipBad), ipBad.layer, ipBad.ruleRef); continue; }
      const cfgBad = own.find((i) => i.category === 'configuration');
      if (cfgBad) { put(n.id, 'ip_no_internet', fromIssue(cfgBad), cfgBad.layer, cfgBad.ruleRef); continue; }
      put(n.id, 'internet_normal', 'Tidak ada masalah pada konfigurasi perangkat ini.');
      continue;
    }

    // ---- Client: periksa dari lapisan paling bawah ----
    // 1. Fisik
    if (!n.poweredOn) { put(n.id, 'not_connected', 'Perangkat sedang mati (Power Off).', 'physical'); continue; }
    if (!cables.some((c) => c.fromNodeId === n.id || c.toNodeId === n.id)) {
      put(n.id, 'not_connected', 'Tidak tersambung karena belum ada kabel atau koneksi WiFi yang terpasang.', 'physical'); continue;
    }
    const phys = own.find((i) => i.category === 'physical' || i.category === 'topology');
    if (phys) { put(n.id, 'not_connected', fromIssue(phys), phys.layer, phys.ruleRef); continue; }

    const upstream = findUpstreamGateway(n, nodes, cables);

    // 2. Layer 2: VLAN harus utuh dari client sampai router
    const vlan = n.vlanConfig?.enabled && n.vlanConfig.mode === 'access' ? n.vlanConfig.vlanId : undefined;
    if (vlan !== undefined && upstream) {
      const p = vlanPath(n.id, upstream.id, vlan, nodes, cables);
      if (!p.reachable && p.blockedBy) {
        put(n.id, 'not_connected', `Tidak tersambung karena VLAN ${vlan} terputus di ${p.blockedBy.name} (tidak mengizinkan VLAN ${vlan}).`, 'layer2', '3.5'); continue;
      }
    }

    // 2b. SSID access point bertag VLAN, tetapi uplink AP tidak meloloskan VLAN itu (4B.10).
    const apBlocked = issues.find((i) => i.id.startsWith('ap-vlan-blocked-')
      && cables.some((c) => (c.fromNodeId === n.id || c.toNodeId === n.id) && (c.fromNodeId === i.targetNodeId || c.toNodeId === i.targetNodeId)));
    if (apBlocked) { put(n.id, 'connected_no_ip', `Tersambung ke WiFi, tetapi tidak dapat IP. ${fromIssue(apBlocked)}`, 'layer2', '4B.10'); continue; }

    // 3. IP / DHCP
    const domain = domains.find((d) => d.has(n.id));
    const dhcpServers = nodes.filter((x) => !!domain && domain.has(x.id) && x.poweredOn && dhcpEnabled(x) && dhcpServesDomain(x, domain, cables));
    if (n.ipConfig?.mode === 'dhcp' && dhcpServers.length === 0) {
      const why = own.find((i) => i.id.startsWith('dhcp-server-off-'));
      put(n.id, 'connected_no_ip', why ? fromIssue(why) : 'Tersambung, tetapi tidak dapat IP karena tidak ada DHCP server aktif di jaringan ini.', 'ip', '3.6'); continue;
    }
    // 2.2 / 2.5: server DHCP yang melayani client (yang terdekat) adalah ONT mode bridge.
    // ONT bridge hanya meneruskan Layer 2, jadi client yang mengambil IP darinya tidak punya jalur ke internet.
    if (n.ipConfig?.mode === 'dhcp' && dhcpServers.length > 0) {
      const served = pickDhcpServer(n, dhcpServers, nodes, cables, (len) => seededIndex(n.id, len));
      if (served?.type === 'ont' && served.ontConfig?.wanMode === 'bridge') {
        put(n.id, 'ip_no_internet', `Dapat IP dari ${served.name}, tetapi ${served.name} berada di mode Bridge (hanya meneruskan Layer 2, tanpa routing atau NAT), jadi tidak ada internet. Matikan DHCP server pada ${served.name}.`, 'ip', '2.5');
        continue;
      }
    }

    // 5.1.3: client di VLAN tertentu, tetapi satu-satunya DHCP server adalah MikroTik yang tidak punya DHCP untuk VLAN itu.
    if (n.ipConfig?.mode === 'dhcp' && vlan !== undefined && upstream && isStructuredMikrotik(upstream)
      && dhcpServers.length > 0 && dhcpServers.every((s) => s.id === upstream.id)) {
      const cfg = upstream.mikrotikConfig!;
      const vlanOf = (name: string) => cfg.interfaces?.find((i) => i.name === name)?.vlanId;
      if (!(cfg.dhcpServers ?? []).some((d) => vlanOf(d.interface) === vlan)) {
        put(n.id, 'connected_no_ip', `Tersambung, tetapi tidak dapat IP karena ${upstream.name} tidak punya interface VLAN ${vlan} dengan DHCP server.`, 'ip', '5.1.3'); continue;
      }
    }
    const mkIp = upstream && issues.find((i) => i.targetNodeId === upstream.id && i.id.startsWith('mikrotik-dhcp-no-ip-'));
    if (n.ipConfig?.mode === 'dhcp' && mkIp) { put(n.id, 'connected_no_ip', fromIssue(mkIp), 'ip', mkIp.ruleRef); continue; }
    const ipBad = own.find((i) => i.category === 'ip' && !isRouteLevel(i));
    if (ipBad) { put(n.id, 'connected_no_ip', fromIssue(ipBad), 'ip', ipBad.ruleRef); continue; }

    // 4. Route, NAT, layanan
    const routeBad = own.find(isRouteLevel);
    if (routeBad) { put(n.id, 'ip_no_internet', `Dapat IP, tetapi tidak ada internet. ${fromIssue(routeBad)}`, 'route', routeBad.ruleRef); continue; }
    const bridgeBad = own.find((i) => i.id.startsWith('client-no-internet-bridge-'));
    if (bridgeBad) { put(n.id, 'ip_no_internet', fromIssue(bridgeBad), 'ip', bridgeBad.ruleRef); continue; }

    if (!upstream || !upstream.poweredOn) {
      put(n.id, 'ip_no_internet', 'Tidak ada router atau ONT aktif di jaringan ini, jadi tidak ada jalur keluar ke internet.', 'route'); continue;
    }
    // ONT pelanggan yang dial PPPoE ke MikroTik: masalah route/NAT di MikroTik itu ikut memutus internet client di belakang ONT (aturan 5.4.5).
    const viaMikrotik = new Set<string>();
    if (upstream.type === 'ont' && upstream.ontConfig?.pppoeTarget === 'mikrotik') {
      const ontDomain = domains.find((d) => d.has(upstream.id));
      for (const m of nodes) if (ontDomain?.has(m.id) && m.poweredOn && isStructuredMikrotik(m)) viaMikrotik.add(m.id);
    }
    const gatewayIssue = issues.find((i) => (i.targetNodeId === upstream.id || (!!i.targetNodeId && viaMikrotik.has(i.targetNodeId)))
      && i.category === 'configuration' && (i.layer === 'route' || i.layer === 'nat'));
    if (gatewayIssue) { put(n.id, 'ip_no_internet', `Dapat IP, tetapi tidak ada internet. ${fromIssue(gatewayIssue)}`, gatewayIssue.layer, gatewayIssue.ruleRef); continue; }

    const blocker = upstreamOpticalBlocker(upstream, ctx);
    if (blocker) {
      put(n.id, 'ip_no_internet', `Dapat IP dari perangkat lokal, tetapi tidak ada internet karena ${blocker.name} tidak punya uplink optik (LOS atau fiber ISP putus).`, 'physical', '1.3'); continue;
    }
    for (const ont of nodes.filter((x) => x.type === 'ont')) {
      const r = evaluatePppoe(ont, ctx);
      if (r.status === 'fail' && r.issue.severity !== 'info' && domain?.has(ont.id)) {
        put(n.id, 'ip_no_internet', `Dapat IP dari ONT, tetapi tidak ada internet. ${fromIssue(r.issue)}`, 'service', r.issue.ruleRef); break;
      }
    }
    if (resultByNode.has(n.id)) continue;

    // MikroTik terstruktur sudah dievaluasi penuh oleh rules/mikrotik.ts; pengecekan lama hanya untuk perangkat tanpa konfigurasi terstruktur.
    const legacy = isStructuredMikrotik(upstream) ? { hasInternet: true } as { hasInternet: boolean; reason?: string } : checkInternetAccess(n, nodes, cables);
    if (!legacy.hasInternet) { put(n.id, 'ip_no_internet', `Dapat IP, tetapi tidak ada internet. ${legacy.reason ?? ''}`.trim(), 'route'); continue; }

    const note = dhcpServers.length > 1 ? ` Catatan: ada ${dhcpServers.length} DHCP server di jaringan ini, IP dipilih acak dari salah satunya.` : '';
    put(n.id, 'internet_normal', `Internet normal: kabel, VLAN, IP, route, dan NAT semuanya benar.${note}`);
  }

  const statusByNode = new Map<string, TopologyStatus>();
  for (const [id, r] of resultByNode) statusByNode.set(id, r.status);
  return { issues, statusByNode, resultByNode, undefinedRules: undefinedRulesFor(nodes, ctx) };
}
