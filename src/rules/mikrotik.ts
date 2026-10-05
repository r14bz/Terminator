import type { DiagnosticIssue, NetworkNode } from '../types/network';
import type { RuleContext } from './types';
import { isStructuredMikrotik, issue, vlanPath } from './common';
import { isSameSubnet, isValidIpv4 } from '../utils/ipUtils';

type MkConfig = NonNullable<NetworkNode['mikrotikConfig']>;

const DEFAULT_ROUTE = '0.0.0.0/0';

/** Interface yang memiliki subnet tempat `gateway` berada. */
function interfaceOfGateway(cfg: MkConfig, gateway: string): string | undefined {
  return (cfg.addresses ?? []).find((a) => isValidIpv4(a.address) && isValidIpv4(a.mask) && isSameSubnet(a.address, gateway, a.mask))?.interface;
}

/** Interface keluar ke ONT ISP: dari default route, atau dari field uplinkInterface. */
export function uplinkInterfaceOf(cfg: MkConfig): string | undefined {
  const def = (cfg.routes ?? []).find((r) => r.dst === DEFAULT_ROUTE);
  if (def && isValidIpv4(def.gateway)) return interfaceOfGateway(cfg, def.gateway);
  return cfg.uplinkInterface;
}

/** True jika MikroTik ini melayani client (DHCP, hotspot, atau PPPoE server). */
function servesClients(cfg: MkConfig): boolean {
  return (cfg.dhcpServers?.length ?? 0) + (cfg.hotspots?.length ?? 0) + (cfg.pppoeServers?.length ?? 0) > 0;
}

/**
 * Apakah firewall MikroTik memblokir trafik antara dua VLAN (aturan 5.6.1/5.6.2)?
 * Aturan drop di chain forward dari interface VLAN A ke VLAN B (atau sebaliknya).
 */
export function interVlanBlocked(cfg: MkConfig, vlanA: number, vlanB: number): boolean {
  const name = (v: number) => (cfg.interfaces ?? []).find((i) => i.type === 'vlan' && i.vlanId === v)?.name;
  const a = name(vlanA), b = name(vlanB);
  if (!a || !b) return false;
  return (cfg.filterRules ?? []).some((r) => r.chain === 'forward' && r.action === 'drop'
    && ((r.inInterface === a && r.outInterface === b) || (r.inInterface === b && r.outInterface === a)));
}

/** Nama interface RouterOS pada port tempat kabel `cableId` tertancap (mis. port "ether1 (WAN)" -> "ether1"). */
function ingressInterface(mk: NetworkNode, cableId: string | undefined, ctx: RuleContext): string | undefined {
  if (!cableId) return undefined;
  const c = ctx.cables.find((x) => x.id === cableId);
  const portId = c ? (c.fromNodeId === mk.id ? c.fromPortId : c.toPortId) : undefined;
  const port = mk.ports.find((p) => p.id === portId || p.connectedCableId === cableId || p.connectedCableIds?.includes(cableId));
  return port?.name.split(/\s+/)[0];
}

/** Kabel pertama dari ONT yang menuju MikroTik (langsung atau lewat switch). Hanya kabel langsung yang bisa dipetakan ke port. */
function directCable(ontId: string, mkId: string, ctx: RuleContext): string | undefined {
  return ctx.cables.find((c) => (c.fromNodeId === ontId && c.toNodeId === mkId) || (c.fromNodeId === mkId && c.toNodeId === ontId))?.id;
}

export type PppoeResult =
  | { status: 'ok'; mikrotik: NetworkNode }
  | { status: 'fail'; issue: DiagnosticIssue }
  | { status: 'skipped'; reason: string };

/**
 * Sesi PPPoE ONT RT/RW net ke MikroTik (aturan 5.4.1 sampai 5.4.4).
 * Hanya dievaluasi bila pengguna menyatakan `pppoeTarget: 'mikrotik'`.
 */
export function evaluatePppoe(ont: NetworkNode, ctx: RuleContext): PppoeResult {
  const cfg = ont.ontConfig;
  if (ont.type !== 'ont' || cfg?.wanMode !== 'pppoe') return { status: 'skipped', reason: 'ONT tidak memakai mode PPPoE.' };
  if (cfg.pppoeTarget !== 'mikrotik') return { status: 'skipped', reason: 'Tujuan PPPoE ONT belum ditentukan (ISP/BRAS atau MikroTik).' };

  const servers = ctx.nodes.filter((n) => n.poweredOn && isStructuredMikrotik(n) && (n.mikrotikConfig!.pppoeServers?.length ?? 0) > 0);
  const reachable = servers.filter((m) => vlanPath(ont.id, m.id, undefined, ctx.nodes, ctx.cables).reachable);
  const mk = reachable[0];
  const base = { layer: 'service' as const, category: 'configuration' as const, targetNodeId: ont.id };

  if (!mk) {
    return { status: 'fail', issue: issue({ ...base, id: `pppoe-no-server-${ont.id}`, ruleRef: '5.4.3',
      title: `ONT "${ont.name}" tidak menemukan PPPoE server`,
      cause: 'Tidak ada MikroTik dengan PPPoE server yang tersambung ke ONT lewat jalur Layer 2. Discovery PPPoE memakai broadcast, jadi jalurnya harus utuh dari ONT sampai MikroTik.',
      solution: 'Hubungkan ONT ke MikroTik dan pasang PPPoE server di interface yang menghadap ONT.' }) };
  }

  const mkCfg = mk.mikrotikConfig!;
  const vlan = cfg.vlanId;

  if (vlan !== undefined) {
    const path = vlanPath(ont.id, mk.id, vlan, ctx.nodes, ctx.cables);
    if (!path.reachable) {
      return { status: 'fail', issue: issue({ ...base, id: `pppoe-vlan-blocked-${ont.id}`, ruleRef: '5.4.4',
        title: `VLAN WAN ${vlan} terputus sebelum sampai MikroTik`,
        cause: `${path.blockedBy ? `${path.blockedBy.name} tidak mengizinkan VLAN ${vlan}` : `VLAN ${vlan} tidak sampai ke ${mk.name}`}, jadi ONT tidak menemukan server PPPoE.`,
        solution: `Izinkan VLAN ${vlan} di semua perangkat antara ONT dan MikroTik (OLT, switch, trunk).` }) };
    }
  }

  const ingress = ingressInterface(mk, directCable(ont.id, mk.id, ctx), ctx);
  const ifaceMatches = (name: string) => {
    const i = (mkCfg.interfaces ?? []).find((x) => x.name === name);
    if (!i) return false;
    if (vlan !== undefined) return i.type === 'vlan' && i.vlanId === vlan && (!ingress || !i.parent || i.parent === ingress);
    // Tanpa tag VLAN: server harus di port yang menerima kabel (bila port diketahui), kalau tidak cukup port ether.
    return ingress ? i.name === ingress : i.type === 'ether';
  };
  if (!(mkCfg.pppoeServers ?? []).some((s) => ifaceMatches(s.interface))) {
    return { status: 'fail', issue: issue({ ...base, id: `pppoe-wrong-iface-${ont.id}`, ruleRef: '5.4.3',
      title: `PPPoE server ${mk.name} dipasang di interface yang salah`,
      cause: vlan !== undefined
        ? `ONT mengirim PPPoE lewat VLAN ${vlan}, tetapi tidak ada PPPoE server di interface VLAN ${vlan} pada ${mk.name}.`
        : `ONT mengirim PPPoE tanpa tag VLAN, tetapi tidak ada PPPoE server di port ether pada ${mk.name}.`,
      solution: 'Pasang PPPoE server pada interface yang menerima trafik dari ONT.' }) };
  }

  if (mkCfg.pppSecrets) {
    const ok = mkCfg.pppSecrets.some((s) => s.service === 'pppoe' && s.name === cfg.pppoeUsername && s.password === cfg.pppoePassword);
    if (!ok) {
      return { status: 'fail', issue: issue({ ...base, id: `pppoe-auth-${ont.id}`, ruleRef: '5.4.2', severity: 'warning',
        title: `Autentikasi PPPoE gagal pada "${ont.name}"`,
        cause: `Username atau password PPPoE ONT tidak cocok dengan secret di ${mk.name}. Client tetap dapat IP dari ONT, tetapi tidak ada internet.`,
        solution: 'Samakan username dan password di ONT dengan PPP > Secrets pada MikroTik.' }) };
    }
  }
  return { status: 'ok', mikrotik: mk };
}

/**
 * MikroTik: interface, IP, DHCP, route, NAT, PPPoE, firewall.
 * Aturan dokumen: 5.1.2, 5.1.3, 5.2.2, 5.2.3, 5.3.2, 5.3.3, 5.4.x, 5.6.3.
 *
 * Hanya berjalan untuk MikroTik dengan konfigurasi terstruktur. Node lama tanpa
 * konfigurasi itu dilaporkan sebagai "tidak terdefinisi" oleh validator,
 * bukan sebagai error.
 */
export function validateMikrotikRules(ctx: RuleContext): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = [];

  for (const n of ctx.nodes.filter((x) => x.poweredOn && isStructuredMikrotik(x))) {
    const cfg = n.mikrotikConfig!;
    const names = new Set((cfg.interfaces ?? []).map((i) => i.name));
    const addrs = cfg.addresses ?? [];
    const target = { targetNodeId: n.id };

    // 5.1.3: layanan memakai interface yang tidak ada.
    const referenced = new Set<string>();
    for (const x of cfg.dhcpServers ?? []) referenced.add(x.interface);
    for (const x of cfg.pppoeServers ?? []) referenced.add(x.interface);
    for (const x of cfg.hotspots ?? []) referenced.add(x.interface);
    for (const x of cfg.addresses ?? []) referenced.add(x.interface);
    for (const x of cfg.natRules ?? []) referenced.add(x.outInterface);
    for (const name of referenced) {
      if (!names.has(name)) out.push(issue({ ...target, id: `mikrotik-iface-missing-${n.id}-${name}`, ruleRef: '5.1.3', layer: 'layer2', category: 'configuration',
        title: `${n.name} tidak punya interface "${name}"`,
        cause: `Ada layanan atau alamat yang memakai interface ${name}, padahal interface itu tidak dibuat di ${n.name}. Client di VLAN itu tidak akan dapat IP.`,
        solution: `Buat interface ${name} (VLAN) di menu Interfaces.` }));
    }

    // 5.1.2: DHCP server tanpa IP address pada interface-nya.
    for (const d of cfg.dhcpServers ?? []) {
      if (names.has(d.interface) && !addrs.some((a) => a.interface === d.interface)) {
        out.push(issue({ ...target, id: `mikrotik-dhcp-no-ip-${n.id}-${d.interface}`, ruleRef: '5.1.2', layer: 'ip', category: 'configuration',
          title: `DHCP server ${d.interface} tidak jalan`,
          cause: `DHCP server dibuat di ${d.interface}, tetapi interface itu belum punya IP address, jadi DHCP tidak melayani client.`,
          solution: `Tambahkan IP address pada ${d.interface} di menu IP > Addresses.` }));
      }
    }

    if (!servesClients(cfg)) continue;

    // 5.2: default route.
    const def = (cfg.routes ?? []).find((r) => r.dst === DEFAULT_ROUTE);
    if (!def) {
      out.push(issue({ ...target, id: `mikrotik-no-default-route-${n.id}`, ruleRef: '5.2.2', layer: 'route', category: 'configuration',
        title: `${n.name} belum punya default route`,
        cause: 'Tanpa default route (0.0.0.0/0), MikroTik tidak tahu jalur ke internet. Client dapat IP tetapi tidak ada internet.',
        solution: 'Tambahkan default route dengan gateway IP ONT ISP di menu IP > Routes.' }));
    } else if (!isValidIpv4(def.gateway) || !interfaceOfGateway(cfg, def.gateway)) {
      out.push(issue({ ...target, id: `mikrotik-route-inactive-${n.id}`, ruleRef: '5.2.3', layer: 'route', category: 'configuration',
        title: `Default route ${n.name} tidak aktif`,
        cause: `Gateway ${def.gateway || '(kosong)'} tidak berada di jaringan yang sama dengan interface mana pun, jadi route tidak aktif.`,
        solution: 'Pakai gateway yang satu subnet dengan interface keluar ke ONT ISP.' }));
    }

    // 5.3: NAT. Dievaluasi hanya bila route ke uplink jelas (aturan 5.2 lebih dulu).
    const uplink = uplinkInterfaceOf(cfg);
    const masq = (cfg.natRules ?? []).filter((r) => r.chain === 'srcnat' && r.action === 'masquerade');
    if (cfg.firewallNat === false || masq.length === 0) {
      out.push(issue({ ...target, id: `nat-off-${n.id}`, ruleRef: '5.3.2', layer: 'nat', category: 'configuration',
        title: `NAT tidak aktif pada "${n.name}"`,
        cause: 'Tidak ada aturan NAT masquerade, jadi client dapat IP tetapi tidak ada internet.',
        solution: 'Tambahkan NAT masquerade pada interface keluar ke ONT ISP.' }));
    } else if (uplink && !masq.some((r) => r.outInterface === uplink)) {
      out.push(issue({ ...target, id: `nat-wrong-iface-${n.id}`, ruleRef: '5.3.3', layer: 'nat', category: 'configuration',
        title: `NAT ${n.name} dipasang di interface yang salah`,
        cause: `Masquerade dipasang di ${masq.map((r) => r.outInterface).join(', ')}, bukan di interface keluar ${uplink}. IP sumber tidak diganti saat keluar, jadi client tidak ada internet.`,
        solution: `Ubah out-interface masquerade menjadi ${uplink}.` }));
    }

    // 5.6.3: aturan blok terlalu luas.
    const rules = cfg.filterRules ?? [];
    const broadIdx = rules.findIndex((r) => r.chain === 'forward' && r.action === 'drop' && !r.srcAddress && !r.dstAddress && !r.inInterface && !r.outInterface);
    if (broadIdx >= 0 && !rules.slice(0, broadIdx).some((r) => r.action === 'accept' && !r.srcAddress && !r.dstAddress && !r.inInterface && !r.outInterface)) {
      out.push(issue({ ...target, id: `firewall-too-broad-${n.id}`, ruleRef: '5.6.3', layer: 'nat', category: 'configuration',
        title: `Aturan firewall ${n.name} memblokir semua trafik`,
        cause: 'Ada aturan drop di chain forward tanpa batasan sumber, tujuan, atau interface, sehingga semua trafik client ikut terblokir dan internet hilang.',
        solution: 'Batasi aturan drop hanya untuk trafik antar-VLAN (in-interface dan out-interface VLAN).' }));
    }
  }

  // 5.4: PPPoE ONT ke MikroTik.
  for (const ont of ctx.nodes.filter((x) => x.type === 'ont' && x.poweredOn)) {
    const r = evaluatePppoe(ont, ctx);
    if (r.status === 'fail') out.push(r.issue);
  }
  return out;
}
