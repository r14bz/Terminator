import type { DiagnosticIssue, NetworkNode } from '../types/network';
import type { RuleContext } from './types';
import { dhcpEnabled, hasGateway, isClient, issue, l2Domains, routerOwnAddresses } from './common';
import { findRouterConnectedToBridge, findUpstreamGateway, isSameSubnet, isValidIpv4 } from '../utils/ipUtils';

/**
 * Aturan sisi client: gateway, subnet, DHCP, dan ONT bridge.
 * Aturan dokumen: 4A.1, 4A.2, 3.6, 2.1 sampai 2.5, dan status "Tidak tersambung".
 *
 * Aturan hanya berjalan bila ada router di jalur client (findUpstreamGateway).
 * Tanpa router tidak ada yang bisa dijadikan acuan, jadi tidak ada peringatan
 * (aturan 7: jangan menandai hal yang normal sebagai masalah).
 */
export function validateEndpointRules(ctx: RuleContext): DiagnosticIssue[] {
  const { nodes, cables } = ctx;
  const out: DiagnosticIssue[] = [];
  const domains = l2Domains(nodes, cables);

  for (const n of nodes.filter((x) => isClient(x) && x.poweredOn)) {
    // Client tanpa kabel sama sekali: status "Tidak tersambung".
    if (!cables.some((c) => c.fromNodeId === n.id || c.toNodeId === n.id)) {
      out.push(issue({
        id: `isolated-${n.id}`, severity: 'info', layer: 'physical', category: 'topology', targetNodeId: n.id,
        title: `"${n.name}" belum tersambung ke jaringan`,
        cause: 'Belum ada kabel atau koneksi WiFi yang terpasang pada perangkat ini.',
        solution: 'Hubungkan perangkat ke switch, router, atau ONT.',
      }));
      continue;
    }

    const ip = n.ipConfig;
    const upstream = findUpstreamGateway(n, nodes, cables);
    if (!ip || !upstream || !upstream.poweredOn) continue;
    const domain = domains.find((d) => d.has(n.id));

    // ONT bridge tanpa router di belakangnya: client tidak punya yang memberi IP/internet.
    if (upstream.type === 'ont' && upstream.ontConfig?.wanMode === 'bridge' && ontBridgeIsDeadEnd(upstream, nodes, cables)) {
      out.push(issue({
        id: `client-no-internet-bridge-${n.id}`, ruleRef: '2.1', layer: 'ip', category: 'configuration', targetNodeId: n.id,
        title: `"${n.name}" tidak dapat internet: ONT berada di mode Bridge`,
        cause: `${upstream.name} mode Bridge (hanya meneruskan Layer 2) dan tidak ada router PPPoE di belakangnya, jadi client tidak mendapat IP maupun internet.`,
        solution: 'Pasang router (MikroTik) yang dial PPPoE, atau kembalikan WAN ONT ke mode PPPoE/router.',
      }));
      continue;
    }

    const own = routerOwnAddresses(upstream);

    if (ip.mode === 'static') {
      // 4A.2: gateway kosong atau salah.
      if (!hasGateway(ip.gateway)) {
        out.push(issue({
          id: `no-gw-${n.id}`, ruleRef: '4A.2', layer: 'ip', category: 'ip', severity: 'warning', targetNodeId: n.id,
          title: `Gateway kosong pada "${n.name}"`,
          cause: 'Gateway belum diisi, jadi client hanya bisa berkomunikasi di jaringan lokal, tidak ke jaringan lain atau internet.',
          solution: 'Isi gateway dengan IP router di jaringan ini.',
        }));
      } else if (own.length && isValidIpv4(ip.gateway) && !own.some((a) => a.ip === ip.gateway)) {
        const outside = ip.ip && ip.subnet && isValidIpv4(ip.ip) && isValidIpv4(ip.subnet) && !isSameSubnet(ip.ip, ip.gateway, ip.subnet);
        out.push(issue({
          id: `gw-mismatch-${n.id}`, ruleRef: '4A.2', layer: 'ip', category: 'ip', targetNodeId: n.id,
          title: outside ? `Gateway berada di luar subnet "${n.name}"` : `Gateway "${n.name}" tidak mengarah ke router`,
          cause: `Gateway ${ip.gateway} bukan IP router ${upstream.name} (${own.map((a) => a.ip).join(', ')}), jadi paket ke luar jaringan tidak sampai ke router.`,
          solution: `Ganti gateway menjadi ${own[0].ip}.`,
        }));
      }
    }

    // IP client di luar semua subnet router yang terhubung.
    if (ip.ip && isValidIpv4(ip.ip) && ip.ip !== '0.0.0.0' && own.length && !own.some((a) => isSameSubnet(ip.ip, a.ip, a.mask))) {
      out.push(issue({
        id: `ip-subnet-mismatch-${n.id}`, ruleRef: '4A.1', layer: 'ip', category: 'ip', targetNodeId: n.id,
        title: `IP "${n.name}" di luar subnet router`,
        cause: `${ip.ip} tidak berada di subnet router ${upstream.name} (${own.map((a) => `${a.ip}/${a.mask}`).join(', ')}), jadi tidak bisa berkomunikasi dengan router.`,
        solution: 'Pakai IP dari subnet router, atau set client ke DHCP.',
      }));
    }

    // 3.6: client DHCP, tidak ada DHCP server aktif di domain Layer 2-nya.
    if (ip.mode === 'dhcp' && domain && !nodes.some((x) => domain.has(x.id) && x.poweredOn && dhcpEnabled(x))) {
      out.push(issue({
        id: `dhcp-server-off-${n.id}`, ruleRef: '3.6', layer: 'ip', category: 'ip', severity: 'warning', targetNodeId: n.id,
        title: `Tidak ada DHCP server untuk "${n.name}"`,
        cause: `Client memakai DHCP, tetapi tidak ada DHCP server aktif di jaringan Layer 2-nya (DHCP ${upstream.name} mati atau berada di VLAN lain tanpa relay).`,
        solution: `Aktifkan DHCP server pada ${upstream.name}.`,
      }));
    }
  }

  // ONT bridge dengan client langsung dan tanpa router.
  for (const ont of nodes.filter((x) => x.type === 'ont' && x.poweredOn && x.ontConfig?.wanMode === 'bridge')) {
    if (!ontBridgeIsDeadEnd(ont, nodes, cables)) continue;
    const hasClient = cables.some((c) => {
      if (c.fromNodeId !== ont.id && c.toNodeId !== ont.id) return false;
      const o = nodes.find((x) => x.id === (c.fromNodeId === ont.id ? c.toNodeId : c.fromNodeId));
      return !!o && isClient(o);
    });
    if (!hasClient) continue;
    out.push(issue({
      id: `ont-bridge-no-router-${ont.id}`, ruleRef: '2.1', layer: 'ip', category: 'configuration', targetNodeId: ont.id,
      title: `ONT "${ont.name}" mode Bridge tanpa router`,
      cause: 'ONT di mode Bridge hanya meneruskan Layer 2. Client yang tersambung langsung tidak punya router PPPoE untuk dial ke ISP.',
      solution: 'Pasang router PPPoE di belakang ONT, atau ubah WAN ONT ke mode PPPoE.',
    }));
  }
  return out;
}

/** Bridge buntu: tidak ada router di belakangnya dan tidak ada ONT lain yang online di segmen yang sama (2.1). */
function ontBridgeIsDeadEnd(ont: NetworkNode, nodes: readonly NetworkNode[], cables: RuleContext['cables']): boolean {
  if (findRouterConnectedToBridge(ont, nodes, cables)) return false;
  const domain = l2Domains(nodes, cables).find((d) => d.has(ont.id));
  if (!domain) return true;
  return !nodes.some((x) => x.id !== ont.id && domain.has(x.id) && x.poweredOn && x.type === 'ont' && x.ontConfig?.ponStatus !== 'LOS (No Signal)');
}
