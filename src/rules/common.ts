import type { CableConnection, NetworkNode, DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import { isValidIpv4, ipToNumber, maskToPrefixLength } from '../utils/ipUtils';
const ROUTERS = new Set(['router','mikrotik','internet_source']); const CLIENTS = new Set(['pc','laptop','printer','voip_phone','cctv','smartphone','iot','server']); const L2_SWITCHES = new Set(['switch','switch_managed']);
export function issue(partial: Omit<DiagnosticIssue,'severity'> & {severity?:DiagnosticIssue['severity']}): DiagnosticIssue { return {severity:'critical',...partial}; }
export function activeCable(c:CableConnection){return c.status!=='broken'&&c.status!=='mismatch';}
export function neighbors(id:string,nodes:readonly NetworkNode[],cables:readonly CableConnection[]){const r:NetworkNode[]=[];for(const c of cables){if(!activeCable(c))continue;const oid=c.fromNodeId===id?c.toNodeId:c.toNodeId===id?c.fromNodeId:null;if(oid){const n=nodes.find(x=>x.id===oid);if(n)r.push(n)}}return r;}
function nodeVlan(n:NetworkNode){return n.vlanConfig?.enabled?n.vlanConfig.vlanId:undefined;}
/** Daftar VLAN yang diizinkan pada port trunk; undefined bila node bukan trunk. */
function trunkAllowed(n:NetworkNode){return n.vlanConfig?.enabled&&n.vlanConfig.mode==='trunk'?(n.vlanConfig.allowedVlans??[]):undefined;}
/** VLAN yang dilayani MikroTik terstruktur lewat interface VLAN-nya (IP > Addresses / DHCP terikat ke interface itu). */
function mikrotikVlans(n:NetworkNode){return n.type==='mikrotik'&&Array.isArray(n.mikrotikConfig?.interfaces)?n.mikrotikConfig!.interfaces!.filter(i=>i.type==='vlan'&&i.vlanId!==undefined).map(i=>i.vlanId as number):[];}
export function sameL2Domain(a:NetworkNode,b:NetworkNode,c:CableConnection){if(c.type==='wireless')return true;const va=nodeVlan(a),vb=nodeVlan(b);if(va===undefined&&vb===undefined)return true;if(va!==undefined&&vb!==undefined){if(a.vlanConfig?.mode==='access'&&b.vlanConfig?.mode==='access')return va===vb;if(a.vlanConfig?.mode==='access'&&b.vlanConfig?.mode==='trunk')return (b.vlanConfig.allowedVlans??[]).includes(va);if(b.vlanConfig?.mode==='access'&&a.vlanConfig?.mode==='trunk')return (a.vlanConfig.allowedVlans??[]).includes(vb);if(a.vlanConfig?.mode==='trunk'&&b.vlanConfig?.mode==='trunk'){const aa=a.vlanConfig.allowedVlans??[],bb=b.vlanConfig.allowedVlans??[];return aa.some(v=>bb.includes(v));}}
  // Trunk ke MikroTik terstruktur yang punya interface VLAN: sambung bila ada VLAN yang diizinkan trunk dan dilayani MikroTik (aturan 3.3, 3.7).
  const ta=trunkAllowed(a),tb=trunkAllowed(b);if(ta&&vb===undefined&&mikrotikVlans(b).some(v=>ta.includes(v)))return true;if(tb&&va===undefined&&mikrotikVlans(a).some(v=>tb.includes(v)))return true;
  // Aturan 2.6: VLAN pada ONT (router) berlaku untuk sisi WAN/uplink-nya. Perangkat LAN tanpa tag
  // (termasuk lewat HTB atau ONT bridge lain) tetap berada di LAN ONT dan dilayani DHCP ONT.
  if((va===undefined&&b.type==='ont')||(vb===undefined&&a.type==='ont'))return true;
  return false;}
export function l2Domains(nodes:readonly NetworkNode[],cables:readonly CableConnection[]){const domains:Set<string>[]=[];const seen=new Set<string>();for(const node of nodes){if(seen.has(node.id))continue;const d=new Set<string>([node.id]);const q=[node.id];while(q.length){const id=q.shift()!;const current=nodes.find(n=>n.id===id);if(current&&current.type!=='ont'&&isRouter(current)&&!isBridgedAp(current,nodes))continue;for(const c of cables){if(!activeCable(c)||!carriesL2(c,nodes)||(c.fromNodeId!==id&&c.toNodeId!==id))continue;const oid=c.fromNodeId===id?c.toNodeId:c.fromNodeId;const a=nodes.find(n=>n.id===id),b=nodes.find(n=>n.id===oid);if(!a||!b||!sameL2Domain(a,b,c)||d.has(oid))continue;d.add(oid);q.push(oid)}}for(const id of d)seen.add(id);domains.push(d)}return domains;}

/**
 * Jumlah lompatan kabel dari `startId` ke tiap node di domain Layer 2-nya.
 * Aturan tepinya sama persis dengan l2Domains (kabel aktif, carriesL2, sameL2Domain, router memutus).
 */
export function l2Distances(startId:string,nodes:readonly NetworkNode[],cables:readonly CableConnection[]):Map<string,number>{
  const dist=new Map<string,number>([[startId,0]]);const q=[startId];
  while(q.length){
    const id=q.shift()!;const current=nodes.find(n=>n.id===id);
    if(current&&current.type!=='ont'&&isRouter(current)&&!isBridgedAp(current,nodes))continue;
    for(const c of cables){
      if(!activeCable(c)||!carriesL2(c,nodes)||(c.fromNodeId!==id&&c.toNodeId!==id))continue;
      const oid=c.fromNodeId===id?c.toNodeId:c.fromNodeId;
      const a=nodes.find(n=>n.id===id),b=nodes.find(n=>n.id===oid);
      if(!a||!b||!sameL2Domain(a,b,c)||dist.has(oid))continue;
      dist.set(oid,dist.get(id)!+1);q.push(oid);
    }
  }
  return dist;
}

/**
 * Server DHCP yang melayani `client` bila ada beberapa server di domain Layer 2 yang sama:
 * yang TERDEKAT (lompatan Layer 2 paling sedikit) menang, karena OFFER-nya tiba lebih dulu.
 * Hanya jika jaraknya seri, dipilih acak lewat `choose` (deterministik per client lewat seed).
 * Dipakai bersama oleh dhcpAuto (pemberi lease) dan validator (penilai internet) supaya keduanya sepakat.
 */
export function pickDhcpServer(client:NetworkNode,candidates:readonly NetworkNode[],nodes:readonly NetworkNode[],cables:readonly CableConnection[],choose:(len:number)=>number):NetworkNode|undefined{
  if(!candidates.length)return undefined;
  const sorted=[...candidates].sort((a,b)=>a.id.localeCompare(b.id));
  const dist=l2Distances(client.id,nodes,cables);
  const d=(n:NetworkNode)=>dist.get(n.id)??Number.POSITIVE_INFINITY;
  const best=Math.min(...sorted.map(d));
  const tied=sorted.filter(n=>d(n)===best);
  return tied[choose(tied.length)];
}

/**
 * Apakah DHCP server `n` benar-benar melayani domain Layer 2 `domain`?
 * Router (MikroTik, router umum) hanya melayani domain di sisi LAN-nya. Kalau router
 * tersambung ke domain itu lewat port WAN/uplink-nya (mis. ONT ISP yang DHCP-nya aktif
 * dicolok ke ether1 MikroTik), DHCP router itu melayani segmen LAN yang berbeda, jadi
 * tidak dihitung sebagai DHCP ganda di domain tersebut (aturan 2.4, 4A.10).
 * Port yang tidak punya nama (data lama) dianggap sisi LAN, sehingga perilaku lama tetap.
 */
export function dhcpServesDomain(n:NetworkNode,domain:ReadonlySet<string>,cables:readonly CableConnection[]):boolean{
  if(n.type!=='router'&&n.type!=='mikrotik')return true;
  const links=cables.filter(c=>activeCable(c)&&(c.fromNodeId===n.id||c.toNodeId===n.id)&&domain.has(c.fromNodeId===n.id?c.toNodeId:c.fromNodeId));
  if(!links.length)return true;
  const uplink=n.mikrotikConfig?.uplinkInterface;
  const isWan=(c:CableConnection)=>{
    const portId=c.fromNodeId===n.id?c.fromPortId:c.toPortId;
    const port=n.ports.find(p=>p.id===portId||p.connectedCableId===c.id||p.connectedCableIds?.includes(c.id));
    if(!port)return false;
    return /wan/i.test(port.name)||(!!uplink&&port.name.split(/\s+/)[0]===uplink);
  };
  return !links.every(isWan);
}

/**
 * Kabel yang meneruskan Layer 2: LAN dan wireless, plus fiber yang berujung di
 * media converter HTB (HTB hanya mengubah media, bukan memutus broadcast).
 */
export function carriesL2(c:CableConnection,nodes:readonly NetworkNode[]){
  if(c.type==='lan'||c.type==='wireless')return true;
  if(!['drop_core','distribusi','feeder'].includes(c.type))return false;
  const a=nodes.find(n=>n.id===c.fromNodeId),b=nodes.find(n=>n.id===c.toNodeId);
  return a?.type==='htb'&&b?.type==='htb';
}

/**
 * Perangkat bertipe "router" yang DHCP-nya mati dan gateway-nya menunjuk ke IP
 * router lain berperan sebagai access point mode bridge, bukan router sendiri.
 * Dalam kasus yang ambigu begini validator tidak menganggapnya batas domain
 * (aturan 7: jangan menandai hal normal sebagai masalah).
 */
export function isBridgedAp(n:NetworkNode,nodes:readonly NetworkNode[]){
  if(n.type!=='router'||n.ipConfig?.isDhcpServerEnabled===true)return false;
  const gw=n.ipConfig?.gateway;
  if(!gw||gw==='0.0.0.0'||gw===n.ipConfig?.ip)return false;
  return nodes.some(o=>o.id!==n.id&&(o.type==='router'||o.type==='mikrotik'||o.type==='ont')&&ipFor(o)===gw);
}
export function ipFor(n:NetworkNode){return n.type==='ont'?(n.ontConfig?.lanIp||n.ipConfig?.ip):n.ipConfig?.ip;}
export function subnetFor(n:NetworkNode){return n.type==='ont'?(n.ontConfig?.lanSubnet||n.ipConfig?.subnet):n.ipConfig?.subnet;}
/** Sisi LAN ONT tidak punya gateway. Gateway WAN statis dicek terpisah terhadap subnet WAN-nya. */
export function gatewayFor(n:NetworkNode){return n.type==='ont'?undefined:n.ipConfig?.gateway;}
export function ipv4Network(ip:string,mask:string){return (ipToNumber(ip)&ipToNumber(mask))>>>0;}
export function ipv4Broadcast(ip:string,mask:string){const hostBits=32-maskToPrefixLength(mask);return (ipv4Network(ip,mask)+(2**hostBits-1))>>>0;}
export function validAddressAndMask(n:NetworkNode,out:DiagnosticIssue[]){const ip=ipFor(n),mask=subnetFor(n);if(ip&&!isValidIpv4(ip))out.push(issue({id:`invalid-ip-${n.id}`,title:`IPv4 tidak valid pada "${n.name}"`,targetNodeId:n.id,category:'ip',cause:`Alamat ${ip} bukan IPv4 yang sah.`,solution:'Masukkan alamat IPv4 yang sah.'}));if(mask&&!isValidIpv4(mask))out.push(issue({id:`invalid-mask-${n.id}`,title:`Subnet mask tidak valid pada "${n.name}"`,targetNodeId:n.id,category:'ip',cause:`Subnet mask ${mask} bukan mask IPv4 yang sah.`,solution:'Masukkan subnet mask IPv4 yang sah.'}));}
/** Untuk ONT, pengaturan ontConfig menang atas ipConfig bila sudah diisi (false berarti benar-benar mati). */
export function dhcpEnabled(n:NetworkNode){
  if(n.type==='ont'&&n.ontConfig?.dhcpServerEnabled!==undefined)return n.ontConfig.dhcpServerEnabled===true;
  // MikroTik terstruktur: DHCP aktif bila ada server DHCP pada salah satu interface-nya.
  if(n.type==='mikrotik'&&Array.isArray(n.mikrotikConfig?.interfaces))return (n.mikrotikConfig!.dhcpServers?.length??0)>0;
  return n.ipConfig?.isDhcpServerEnabled===true;
}
export function isRouter(n:NetworkNode){return ROUTERS.has(n.type)||(n.type==='ont'&&n.ontConfig?.wanMode!=='bridge');}
export function isClient(n:NetworkNode){return CLIENTS.has(n.type);}
export function isSwitch(n:NetworkNode){return L2_SWITCHES.has(n.type);}

// ---------------------------------------------------------------------------
// Helper tambahan untuk aturan endpoint, MikroTik, dan alasan per hasil
// ---------------------------------------------------------------------------

/** Gateway kosong / 0.0.0.0 berarti "tidak diisi", bukan alamat yang salah. */
export function hasGateway(gw: string | undefined): gw is string {
  return !!gw && gw.trim() !== '' && gw.trim() !== '0.0.0.0';
}

export interface OwnAddress { ip: string; mask: string }

/**
 * Alamat yang dimiliki sebuah router di sisi LAN. MikroTik dengan konfigurasi
 * terstruktur memakai tabel IP > Addresses, perangkat lain memakai satu IP.
 */
export function routerOwnAddresses(n: NetworkNode): OwnAddress[] {
  const structured = n.type === 'mikrotik' ? n.mikrotikConfig?.addresses : undefined;
  if (structured && structured.length) {
    return structured
      .filter((a) => isValidIpv4(a.address) && isValidIpv4(a.mask))
      .map((a) => ({ ip: a.address, mask: a.mask }));
  }
  const ip = ipFor(n), mask = subnetFor(n);
  return ip && mask && isValidIpv4(ip) && isValidIpv4(mask) ? [{ ip, mask }] : [];
}

/** True jika MikroTik ini memakai konfigurasi terstruktur (interfaces diisi). */
export function isStructuredMikrotik(n: NetworkNode): boolean {
  return n.type === 'mikrotik' && Array.isArray(n.mikrotikConfig?.interfaces);
}

const TRANSPARENT_L2 = new Set(['switch','switch_managed','olt','odc','odp','splitter','htb','ap_ptp','access_point','mesh','metro']);

/**
 * Jalur Layer 2 dari `fromId` ke `toId` untuk satu VLAN. Router (selain titik
 * awal dan akhir) memutus jalur. Node perantara dengan port trunk yang tidak
 * mengizinkan VLAN, atau port access di VLAN lain, memutus VLAN itu
 * (aturan: "satu titik yang tidak mengizinkan sebuah VLAN memutus VLAN itu").
 */
export function vlanPath(fromId: string, toId: string, vlan: number | undefined, nodes: readonly NetworkNode[], cables: readonly CableConnection[]): { reachable: boolean; blockedBy?: NetworkNode } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>([fromId]);
  const queue = [fromId];
  let blockedBy: NetworkNode | undefined;
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of cables) {
      if (c.status === 'broken') continue;
      if (c.fromNodeId !== id && c.toNodeId !== id) continue;
      const oid = c.fromNodeId === id ? c.toNodeId : c.fromNodeId;
      if (seen.has(oid)) continue;
      const other = byId.get(oid);
      if (!other || !other.poweredOn) continue;
      if (oid === toId) return { reachable: true };
      if (!TRANSPARENT_L2.has(other.type)) continue;
      const v = other.vlanConfig;
      if (vlan !== undefined && v?.enabled) {
        const blocks = v.mode === 'trunk' ? !(v.allowedVlans ?? []).includes(vlan) : v.mode === 'access' ? v.vlanId !== vlan : false;
        if (blocks) { blockedBy = other; continue; }
      }
      seen.add(oid);
      queue.push(oid);
    }
  }
  return { reachable: false, blockedBy };
}

/**
 * Client yang menempel ke LAN sebuah router (langsung atau lewat switch/AP)
 * berada di satu segmen broadcast yang sama per VLAN, seperti port LAN router
 * rumahan atau bridge MikroTik. Router lain dan ONT tidak ikut (batas router).
 */
export function routerLanGroups(nodes: readonly NetworkNode[], cables: readonly CableConnection[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Array<{ router: NetworkNode; vlan: number | undefined; clients: NetworkNode[] }> = [];
  for (const r of nodes.filter((n) => n.poweredOn && n.type !== 'ont' && isRouter(n))) {
    const seen = new Set<string>([r.id]);
    const q = [r.id];
    const clients: NetworkNode[] = [];
    while (q.length) {
      const id = q.shift()!;
      for (const c of cables) {
        if (!activeCable(c) || !['lan', 'wireless'].includes(c.type)) continue;
        if (c.fromNodeId !== id && c.toNodeId !== id) continue;
        const oid = c.fromNodeId === id ? c.toNodeId : c.fromNodeId;
        if (seen.has(oid)) continue;
        seen.add(oid);
        const o = byId.get(oid);
        if (!o || !o.poweredOn) continue;
        if (isClient(o)) clients.push(o);
        else if (TRANSPARENT_L2.has(o.type)) q.push(oid);
      }
    }
    const groups = new Map<number | undefined, NetworkNode[]>();
    for (const c of clients) {
      const v = c.vlanConfig?.enabled ? c.vlanConfig.vlanId : undefined;
      groups.set(v, [...(groups.get(v) ?? []), c]);
    }
    for (const [vlan, list] of groups) out.push({ router: r, vlan, clients: list });
  }
  return out;
}
