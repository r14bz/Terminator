import assert from 'node:assert/strict';
import { validateTopology } from '../src/utils/topologyValidator.ts';

let seq = 0;
const node = (type, extra = {}) => ({ id: `${type}-${++seq}`, type, name: `${type}-${seq}`, label: type, x: 0, y: 0, ports: [], status: 'online', poweredOn: true, ...extra });
const cable = (a, b, extra = {}) => ({ id: `c-${++seq}`, type: 'lan', fromNodeId: a.id, fromPortId: 'p1', toNodeId: b.id, toPortId: 'p1', lengthKm: 0.01, attenuationDb: 0, status: 'active', ...extra });
const has = (result, text) => result.issues.some(i => i.title.includes(text) || i.cause?.includes(text));
const expectNoIssues = (name, nodes, cables) => assert.equal(validateTopology(nodes, cables).issues.length, 0, name);
const expectIssue = (name, nodes, cables, text) => assert.equal(has(validateTopology(nodes, cables), text), true, name);

// P1/P2: isolated ONT router LANs may reuse the same default gateway without warning.
{
  const a=node('ont',{ontConfig:{brand:'A',model:'x',wanMode:'pppoe',pppoeUsername:'user',pppoePassword:'pass',lanIp:'192.168.1.1',lanSubnet:'255.255.255.0'}});
  const b=node('ont',{ontConfig:{brand:'B',model:'x',wanMode:'pppoe',pppoeUsername:'user',pppoePassword:'pass',lanIp:'192.168.1.1',lanSubnet:'255.255.255.0'}});
  expectNoIssues('P1 same gateway on isolated ONTs', [a,b], []);
  const c=node('ont',{ontConfig:{brand:'C',model:'x',wanMode:'pppoe',pppoeUsername:'user',pppoePassword:'pass',lanIp:'192.168.100.1',lanSubnet:'255.255.255.0'}});
  expectNoIssues('P2 non-default gateway is valid', [c], []);
}

// P3/P4: duplicate IP only matters inside the same LAN broadcast segment.
{
  const a=node('pc',{ipConfig:{mode:'static',ip:'192.168.10.10',subnet:'255.255.255.0',gateway:'192.168.10.1'}});
  const b=node('server',{ipConfig:{mode:'static',ip:'192.168.10.10',subnet:'255.255.255.0',gateway:'192.168.10.1'}});
  expectIssue('P3 duplicate IP', [a,b], [cable(a,b)], 'IP bentrok');
  const o1=node('ont',{ontConfig:{brand:'A',model:'x',wanMode:'pppoe',pppoeUsername:'user',pppoePassword:'pass',lanIp:'192.168.1.1',lanSubnet:'255.255.255.0'}});
  const o2=node('ont',{ontConfig:{brand:'B',model:'x',wanMode:'pppoe',pppoeUsername:'user',pppoePassword:'pass',lanIp:'192.168.1.1',lanSubnet:'255.255.255.0'}});
  expectIssue('P4 duplicate ONT gateways after LAN interconnect', [o1,o2], [cable(o1,o2)], 'IP bentrok');
}

// P5/P6/P8 invalid addressing.
{
  const n=node('pc',{ipConfig:{mode:'static',ip:'192.168.10.10',subnet:'255.255.255.0',gateway:'192.168.20.1'}});
  expectIssue('P5 gateway outside subnet', [n], [], 'Gateway berada di luar subnet');
  const n2=node('pc',{ipConfig:{mode:'static',ip:'192.168.10.10',subnet:'255.255.255.0',gateway:'192.168.10.0'}});
  expectIssue('P6 network address as gateway', [n2], [], 'network/broadcast');
  const n3=node('pc',{ipConfig:{mode:'static',ip:'192.168.10.999',subnet:'255.255.255.0',gateway:'192.168.10.1'}});
  expectIssue('P8 invalid IPv4', [n3], [], 'IPv4 tidak valid');
}

// 2.5: bridge WAN must not keep the ONT DHCP service active.
{
  const ont=node('ont',{ontConfig:{brand:'A',model:'x',wanMode:'bridge',dhcpServerEnabled:true}});
  expectIssue('2.5 bridge + ONT DHCP', [ont], [], 'DHCP ONT aktif');
}

// 3.5: trunk that does not allow the access VLAN breaks the VLAN path.
{
  const pc=node('pc',{vlanConfig:{enabled:true,vlanId:10,mode:'access'}});
  const sw=node('switch_managed',{vlanConfig:{enabled:true,vlanId:1,mode:'trunk',allowedVlans:[20]},managedSwitchConfig:{managementIp:'10.0.0.2',managementSubnet:'255.255.255.0',managementGateway:'10.0.0.1',stpMode:'rstp',igmpSnooping:false,lacpTrunkEnabled:false,portMirroring:false,poeBudgetWatts:0,poeUsageWatts:0,loopProtect:true}});
  expectIssue('3.5 VLAN not allowed on trunk', [pc,sw], [cable(pc,sw)], 'tidak diizinkan pada trunk');
}

// 4.5/4.6: parallel switch links warn only without STP/LACP.
{
  const a=node('switch_managed',{managedSwitchConfig:{managementIp:'10.0.0.2',managementSubnet:'255.255.255.0',managementGateway:'10.0.0.1',stpMode:'disabled',igmpSnooping:false,lacpTrunkEnabled:false,portMirroring:false,poeBudgetWatts:0,poeUsageWatts:0,loopProtect:false}});
  const b=node('switch_managed',{managedSwitchConfig:{managementIp:'10.0.0.3',managementSubnet:'255.255.255.0',managementGateway:'10.0.0.1',stpMode:'disabled',igmpSnooping:false,lacpTrunkEnabled:false,portMirroring:false,poeBudgetWatts:0,poeUsageWatts:0,loopProtect:false}});
  const links=[cable(a,b),cable(a,b)];
  expectIssue('4.5 parallel switch links without STP', [a,b], links, 'Loop Layer 2');
  a.managedSwitchConfig.stpMode='rstp';
  expectNoIssues('4.6 parallel switch links with STP', [a,b], links);
}

// 5.3.2: explicit MikroTik NAT-off configuration is an error.
{
  const mk=node('mikrotik',{mikrotikConfig:{firewallNat:false,pppoeServer:true,dnsServer:true,totalQueues:0}});
  expectIssue('5.3.2 NAT disabled', [mk], [], 'NAT tidak aktif');
}

// 7/8: normal topology must not warn merely because devices use common private ranges.
{
  const r=node('router',{ipConfig:{mode:'static',ip:'192.168.1.1',subnet:'255.255.255.0',gateway:'0.0.0.0'}});
  const p=node('pc',{ipConfig:{mode:'static',ip:'192.168.1.2',subnet:'255.255.255.0',gateway:'192.168.1.1'}});
  expectNoIssues('normal host/router addressing', [r,p], [cable(r,p)]);
}

console.log('topology rule tests: PASS');
