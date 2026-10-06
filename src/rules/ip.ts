import type { DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import {
  gatewayFor, hasGateway, ipFor, issue, ipv4Broadcast, ipv4Network, l2Domains,
  routerLanGroups, routerOwnAddresses, subnetFor, validAddressAndMask, isRouter,
} from './common';
import { isSameSubnet, isValidIpv4, ipToNumber } from '../utils/ipUtils';

/**
 * Alamat IP. Aturan dokumen: P3 sampai P8, 4A.3.
 * Bentrok IP dicek PER domain Layer 2, bukan global (aturan P1/P2 tidak boleh
 * menghasilkan peringatan).
 */
export function validateIpRules(ctx: RuleContext): DiagnosticIssue[] {
  const { nodes } = ctx;
  const out: DiagnosticIssue[] = [];

  for (const n of nodes) validAddressAndMask(n, out); // P8

  // P3 / P4: IP sama dalam satu domain Layer 2.
  const conflicts = new Map<string, Set<string>>();
  for (const d of l2Domains(nodes, ctx.cables)) {
    const byIp = new Map<string, string[]>();
    for (const id of d) {
      const n = nodes.find((x) => x.id === id);
      if (!n || !n.poweredOn) continue;
      // Aturan 2.7: ONT mode bridge hanya meneruskan Layer 2 dan tidak punya alamat LAN yang ikut dicek bentrok.
      if (n.type === 'ont' && n.ontConfig?.wanMode === 'bridge') continue;
      const ip = ipFor(n);
      if (!ip || !isValidIpv4(ip) || ip === '0.0.0.0') continue;
      byIp.set(ip, [...(byIp.get(ip) ?? []), n.name]);
    }
    for (const [ip, names] of byIp) {
      if (names.length > 1) conflicts.set(ip, new Set([...(conflicts.get(ip) ?? []), ...names]));
    }
  }
  // Client yang menempel ke LAN router yang sama juga satu segmen (per VLAN).
  for (const g of routerLanGroups(nodes, ctx.cables)) {
    const byIp = new Map<string, string[]>();
    const add = (ip: string | undefined, name: string) => {
      if (ip && isValidIpv4(ip) && ip !== '0.0.0.0') byIp.set(ip, [...(byIp.get(ip) ?? []), name]);
    };
    for (const c of g.clients) add(ipFor(c), c.name);
    if (g.vlan === undefined) {
      const own = routerOwnAddresses(g.router);
      for (const a of own) if (g.clients.some((c) => { const ip = ipFor(c); return !!ip && isValidIpv4(ip) && isSameSubnet(ip, a.ip, a.mask); })) add(a.ip, g.router.name);
    }
    for (const [ip, names] of byIp) {
      if (names.length > 1) conflicts.set(ip, new Set([...(conflicts.get(ip) ?? []), ...names]));
    }
  }
  for (const [ip, names] of conflicts) {
    out.push(issue({
      // autoFix membaca alamat IP dari id ini.
      id: `ip-conflict-${ip}`, ruleRef: 'P3', layer: 'ip', category: 'ip',
      title: `IP bentrok: ${[...names].join(' dan ')} memakai ${ip}`,
      cause: `${[...names].join(', ')} memakai alamat ${ip} pada satu domain broadcast yang sama.`,
      solution: 'Ubah salah satu alamat IP, atau pisahkan perangkat ke domain Layer 2 yang berbeda.',
    }));
  }

  for (const n of nodes) {
    const ip = ipFor(n), mask = subnetFor(n), gw = gatewayFor(n);
    if (!ip || !mask || !isValidIpv4(ip) || !isValidIpv4(mask)) continue;
    const network = ipv4Network(ip, mask), broadcast = ipv4Broadcast(ip, mask), num = ipToNumber(ip);

    if (num === network) out.push(issue({
      id: `ip-network-${n.id}`, ruleRef: 'P6', layer: 'ip', category: 'ip', targetNodeId: n.id,
      title: `IP ${n.name} adalah alamat network`, cause: `${ip} adalah alamat jaringan untuk mask ${mask}, tidak bisa dipakai perangkat.`,
      solution: 'Gunakan alamat host yang valid.',
    }));
    if (num === broadcast) out.push(issue({
      id: `ip-broadcast-${n.id}`, ruleRef: 'P6', layer: 'ip', category: 'ip', targetNodeId: n.id,
      title: `IP ${n.name} adalah alamat broadcast`, cause: `${ip} adalah alamat broadcast untuk mask ${mask}, tidak bisa dipakai perangkat.`,
      solution: 'Gunakan alamat host yang valid.',
    }));

    // Gateway router/ONT adalah alamat upstream di antarmuka WAN yang tidak dimodelkan
    // per interface, jadi subnet-nya tidak bisa dibandingkan dengan IP LAN (aturan 7).
    if (!isRouter(n) && hasGateway(gw) && isValidIpv4(gw)) {
      // Router punya banyak interface: gateway cukup berada di salah satu subnet miliknya.
      const subnets = isRouter(n) ? routerOwnAddresses(n) : [];
      const gwReachable = subnets.length > 1 ? subnets.some((a) => isSameSubnet(a.ip, gw, a.mask)) : isSameSubnet(ip, gw, mask);
      if (!gwReachable) out.push(issue({
        id: `subnet-mismatch-gw-${n.id}`, ruleRef: 'P5', layer: 'ip', category: 'ip', targetNodeId: n.id,
        title: `Gateway berada di luar subnet "${n.name}"`,
        cause: `Gateway ${gw} tidak berada dalam subnet ${ip}/${mask}, jadi tidak bisa dijangkau.`,
        solution: 'Gunakan gateway yang berada pada subnet interface tersebut.',
      }));
      else if (ipToNumber(gw) === network || ipToNumber(gw) === broadcast) out.push(issue({
        id: `gateway-special-${n.id}`, ruleRef: 'P6', layer: 'ip', category: 'ip', targetNodeId: n.id,
        title: 'Gateway tidak boleh network/broadcast',
        cause: `Gateway ${gw} adalah alamat network atau broadcast subnet ${ip}/${mask}.`,
        solution: 'Gunakan alamat host yang valid sebagai gateway.',
      }));
    }
  }

  // P5 untuk sisi WAN statis ONT (gateway WAN harus satu subnet dengan IP WAN).
  for (const n of nodes.filter((x) => x.type === 'ont' && x.ontConfig?.wanMode === 'static')) {
    const { staticWanIp: ip, staticWanSubnet: mask, staticWanGateway: gw } = n.ontConfig!;
    if (ip && mask && gw && isValidIpv4(ip) && isValidIpv4(mask) && isValidIpv4(gw) && !isSameSubnet(ip, gw, mask)) {
      out.push(issue({
        id: `wan-gateway-outside-${n.id}`, ruleRef: 'P5', layer: 'ip', category: 'ip', targetNodeId: n.id,
        title: `Gateway WAN di luar subnet WAN "${n.name}"`,
        cause: `Gateway WAN ${gw} tidak berada dalam subnet ${ip}/${mask}.`,
        solution: 'Gunakan gateway WAN yang satu subnet dengan IP WAN.',
      }));
    }
  }

  // P7 / 4A.3: dua interface satu router di subnet yang sama atau bertumpuk.
  for (const r of nodes.filter(isRouter)) {
    const ifs = routerOwnAddresses(r);
    for (let i = 0; i < ifs.length; i++) {
      for (let j = i + 1; j < ifs.length; j++) {
        if (isSameSubnet(ifs[i].ip, ifs[j].ip, ifs[i].mask) || isSameSubnet(ifs[i].ip, ifs[j].ip, ifs[j].mask)) {
          out.push(issue({
            id: `router-overlap-${r.id}-${i}-${j}`, ruleRef: 'P7', layer: 'ip', category: 'ip', targetNodeId: r.id,
            title: `Subnet interface router bertumpuk pada "${r.name}"`,
            cause: `${ifs[i].ip}/${ifs[i].mask} dan ${ifs[j].ip}/${ifs[j].mask} berada di subnet yang sama atau bertumpuk, sehingga router tidak tahu harus meneruskan paket ke interface mana.`,
            solution: 'Gunakan subnet yang berbeda untuk setiap interface router.',
          }));
        }
      }
    }
  }
  return out;
}
