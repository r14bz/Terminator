import type { CableConnection, NetworkNode, DiagnosticIssue } from '../types/network';
import type { RuleContext } from './types';
import { isValidIpv4, ipToNumber, maskToPrefixLength } from '../utils/ipUtils';
const ROUTERS = new Set(['router','mikrotik']); const CLIENTS = new Set(['pc','laptop','printer','voip_phone','cctv','smartphone','iot','server']); const L2_SWITCHES = new Set(['switch','switch_managed']);
export function issue(partial: Omit<DiagnosticIssue,'severity'> & {severity?:DiagnosticIssue['severity']}): DiagnosticIssue { return {severity:'error',...partial}; }
export function activeCable(c:CableConnection){return c.status!=='broken'&&c.status!=='mismatch';}
export function neighbors(id:string,nodes:readonly NetworkNode[],cables:readonly CableConnection[]){const r:NetworkNode[]=[];for(const c of cables){if(!activeCable(c))continue;const oid=c.fromNodeId===id?c.toNodeId:c.toNodeId===id?c.fromNodeId:null;if(oid){const n=nodes.find(x=>x.id===oid);if(n)r.push(n)}}return r;}
function nodeVlan(n:NetworkNode){return n.vlanConfig?.enabled?n.vlanConfig.vlanId:undefined;}
export function sameL2Domain(a:NetworkNode,b:NetworkNode,c:CableConnection){if(c.type==='wireless')return true;const va=nodeVlan(a),vb=nodeVlan(b);if(va===undefined&&vb===undefined)return true;if(va!==undefined&&vb!==undefined){if(a.vlanConfig?.mode==='access'&&b.vlanConfig?.mode==='access')return va===vb;if(a.vlanConfig?.mode==='access'&&b.vlanConfig?.mode==='trunk')return (b.vlanConfig.allowedVlans??[]).includes(va);if(b.vlanConfig?.mode==='access'&&a.vlanConfig?.mode==='trunk')return (a.vlanConfig.allowedVlans??[]).includes(vb);if(a.vlanConfig?.mode==='trunk'&&b.vlanConfig?.mode==='trunk'){const aa=a.vlanConfig.allowedVlans??[],bb=b.vlanConfig.allowedVlans??[];return aa.some(v=>bb.includes(v));}}return false;}
function isL2TransportCable(c:CableConnection,a:NetworkNode,b:NetworkNode){
  if(c.type==='lan'||c.type==='wireless')return true;
  // HTB converters are transparent media converters. Their optical leg
  // carries the same Ethernet/L2 broadcast domain end-to-end. Do not treat
  // the GPON/PON fiber types as a shared LAN: an OLT can serve many ONTs
  // without putting their LAN broadcast domains together.
  return c.type==='drop_core' && (a.type==='htb'||b.type==='htb');
}
export function l2Domains(nodes:readonly NetworkNode[],cables:readonly CableConnection[]){const domains:Set<string>[]=[];const seen=new Set<string>();for(const node of nodes){if(seen.has(node.id))continue;const d=new Set<string>([node.id]);const q=[node.id];while(q.length){const id=q.shift()!;const current=nodes.find(n=>n.id===id);if(current&&current.type!=='ont'&&isRouter(current))continue;for(const c of cables){if(!activeCable(c)||(c.fromNodeId!==id&&c.toNodeId!==id))continue;const oid=c.fromNodeId===id?c.toNodeId:c.fromNodeId;const a=nodes.find(n=>n.id===id),b=nodes.find(n=>n.id===oid);if(!a||!b||!isL2TransportCable(c,a,b)||!sameL2Domain(a,b,c)||d.has(oid))continue;d.add(oid);q.push(oid)}}for(const id of d)seen.add(id);domains.push(d)}return domains;}
export function ipFor(n:NetworkNode){return n.type==='ont'?(n.ontConfig?.lanIp||n.ipConfig?.ip):n.ipConfig?.ip;}
export function subnetFor(n:NetworkNode){return n.type==='ont'?(n.ontConfig?.lanSubnet||n.ipConfig?.subnet):n.ipConfig?.subnet;}
export function gatewayFor(n:NetworkNode){return n.type==='ont'?(n.ontConfig?.staticWanGateway||n.ipConfig?.gateway):n.ipConfig?.gateway;}
export function ipv4Network(ip:string,mask:string){return ipToNumber(ip)&ipToNumber(mask);}
export function ipv4Broadcast(ip:string,mask:string){const hostBits=32-maskToPrefixLength(mask);return ipv4Network(ip,mask)+(2**hostBits-1);}
export function validAddressAndMask(n:NetworkNode,out:DiagnosticIssue[]){const ip=ipFor(n),mask=subnetFor(n);if(ip&&!isValidIpv4(ip))out.push(issue({id:`invalid-ip-${n.id}`,title:`IPv4 tidak valid pada "${n.name}"`,targetNodeId:n.id,category:'ip',cause:`Alamat ${ip} bukan IPv4 yang sah.`,solution:'Masukkan alamat IPv4 yang sah.'}));if(mask&&!isValidIpv4(mask))out.push(issue({id:`invalid-mask-${n.id}`,title:`Subnet mask tidak valid pada "${n.name}"`,targetNodeId:n.id,category:'ip',cause:`Subnet mask ${mask} bukan mask IPv4 yang sah.`,solution:'Masukkan subnet mask IPv4 yang sah.'}));}
export function dhcpEnabled(n:NetworkNode){return n.type==='ont'?(n.ontConfig?.dhcpServerEnabled===true||n.ipConfig?.isDhcpServerEnabled===true):n.ipConfig?.isDhcpServerEnabled===true;}
export function isRouter(n:NetworkNode){return ROUTERS.has(n.type)||(n.type==='ont'&&n.ontConfig?.wanMode!=='bridge');}
export function isClient(n:NetworkNode){return CLIENTS.has(n.type);}
export function isSwitch(n:NetworkNode){return L2_SWITCHES.has(n.type);}
