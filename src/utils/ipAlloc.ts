/**
 * Address allocation for newly added and newly DHCP-enabled devices.
 *
 * Two defects motivated this module, both reproduced on the running app:
 *
 * 1. `handleAddDevice` numbered new addresses with `100 + countSameType`, which
 *    counts nodes *of the same type*. Adding a PC and then a router produced
 *    PC=192.168.1.100 and Router=192.168.1.100 -- a live conflict the moment it
 *    happened, reported as normal operation.
 *
 * 2. The inspector's "DHCP Client" button wrote
 *    `` `${routerLanIp.replace(/\.\d+$/, '')}.115` `` for every client. With two
 *    routers on one hub, both showed IP 192.168.88.115. The hardcoded 115 was
 *    also written into `gateway`, so each router's gateway ended up being the
 *    other router's own address.
 *
 * So: a lease is now the first address in the server's pool that nobody holds.
 * The pool is read from the gateway (`dhcpRangeStart/End`, else
 * `ontConfig.dhcpPoolStart/End`, else a derived .100-.254); exhaustion returns
 * `null` rather than wrapping onto somebody else's address, which is what a
 * real DHCP server does before falling back to APIPA.
 *
 * Free of React so the test suite can drive it under plain node.
 */
import type { NetworkNode } from '../types/network';
import { addressOf, isValidIpv4 } from './ipUtils';

/** `192.168.1.` for a valid IPv4 address, else `null`. */
function prefixOf(ip: string): string | null {
  if (!isValidIpv4(ip)) return null;
  const cut = ip.lastIndexOf('.');
  return cut < 0 ? null : ip.slice(0, cut + 1);
}

function hostOf(ip: string): number {
  return Number(ip.slice(ip.lastIndexOf('.') + 1));
}

function join(prefix: string, host: number): string {
  return `${prefix}${host}`;
}

/**
 * Every address currently held by a node.
 *
 * Uses the same {@link addressOf} the ping tool and the inspector read, so the
 * allocator cannot disagree with the rest of the app about who owns what. A
 * powered-off device still holds its address: unplugging a PC does not hand its
 * IP to the next device, and a duplicate is far more visible than a late reuse.
 */
export function usedAddresses(nodes: readonly NetworkNode[]): Set<string> {
  const used = new Set<string>();
  for (const node of nodes) {
    const ip = addressOf(node);
    if (ip && isValidIpv4(ip) && ip !== '0.0.0.0') used.add(ip);
  }
  return used;
}

export interface AddressPool {
  prefix: string;
  start: number;
  end: number;
}

/**
 * First free host in `[start, end]`, or `null` when the range is exhausted.
 *
 * `keep` is an *address* one caller may keep even though it is in `used` -- the
 * lease a client already holds. Passing a node id here silently never matches,
 * and the client gets pushed to the next free address on every read.
 */
export function firstFreeHost(
  pool: AddressPool,
  used: ReadonlySet<string>,
  keep?: string,
): string | null {
  for (let host = pool.start; host <= pool.end; host++) {
    const candidate = join(pool.prefix, host);
    if (used.has(candidate) && candidate !== keep) continue;
    return candidate;
  }
  return null;
}

/**
 * The address range a gateway hands out on its LAN.
 *
 * Precedence: the explicit `dhcpRange*` on the gateway's own `ipConfig`, then
 * the ONT-style `dhcpPool*`, then a derived `.100`-.254 around the gateway's LAN
 * address. The derived fallback is what every shipped template ends up on, since
 * none of them set a range.
 */
export function dhcpPoolOf(gateway: NetworkNode | null | undefined): AddressPool | null {
  if (!gateway) return null;

  const explicit =
    gateway.ipConfig?.dhcpRangeStart && gateway.ipConfig.dhcpRangeEnd
      ? { start: gateway.ipConfig.dhcpRangeStart, end: gateway.ipConfig.dhcpRangeEnd }
      : gateway.ontConfig?.dhcpPoolStart && gateway.ontConfig.dhcpPoolEnd
        ? { start: gateway.ontConfig.dhcpPoolStart, end: gateway.ontConfig.dhcpPoolEnd }
        : null;

  if (explicit) {
    const startPrefix = prefixOf(explicit.start);
    const endPrefix = prefixOf(explicit.end);
    if (startPrefix && startPrefix === endPrefix) {
      // The range has to sit on the LAN this gateway actually serves. A pool on
      // another subnet hands out addresses no client can reach the gateway
      // through, and the config is then wrong in a way the duplicate check
      // cannot see: every lease is unique.
      const lan = addressOf(gateway);
      const lanPrefix = lan ? prefixOf(lan) : null;
      if (!lanPrefix || lanPrefix !== startPrefix) return null;

      const start = hostOf(explicit.start);
      const end = hostOf(explicit.end);
      // An inverted or out-of-byte range is a config typo, not a licence to
      // wrap around into the network address or the broadcast address.
      if (start >= 1 && end <= 254 && start <= end) return { prefix: startPrefix, start, end };
    }
    return null;
  }

  const lan = addressOf(gateway);
  const prefix = lan ? prefixOf(lan) : null;
  if (!prefix) return null;
  return { prefix, start: 100, end: 254 };
}

/**
 * The lease a client would be handed by `gateway`, or `null` if the pool is
 * full.
 *
 * `forNodeId` lets a client that already holds an address keep it when the pool
 * is re-read, instead of being pushed to the next free address every time the
 * inspector renders.
 */
export function allocateDhcpLease(
  gateway: NetworkNode | null | undefined,
  nodes: readonly NetworkNode[],
  forNodeId?: string,
): string | null {
  const pool = dhcpPoolOf(gateway);
  if (!pool) return null;
  // Resolve the id to the address that node holds; `firstFreeHost` compares
  // addresses, not identities.
  const keep = forNodeId ? addressOf(nodes.find((x) => x.id === forNodeId) ?? {}) : undefined;
  return firstFreeHost(pool, usedAddresses(nodes), keep ?? undefined);
}

/**
 * The default gateway a client on `gateway`'s LAN should carry.
 *
 * The gateway's own LAN address. Returning the client's own address here is how
 * a router ended up with `Gateway: 192.168.88.115` while holding
 * `IP: 192.168.88.115`.
 */
export function gatewayAddressOf(gateway: NetworkNode | null | undefined): string | null {
  const lan = gateway ? addressOf(gateway) : undefined;
  return lan && isValidIpv4(lan) ? lan : null;
}

/**
 * The LAN a newly added device should join.
 *
 * A device being added has no cables yet, so `findUpstreamGateway` cannot
 * answer this -- it walks *from* a node. The intended answer is "the network
 * this topology is already built around": the first gateway node that holds a
 * LAN address. Falls back to a plain 192.168.1.0/24 on an empty canvas, which
 * is what the old hardcoded default assumed anyway.
 */
export function primaryGateway(nodes: readonly NetworkNode[]): NetworkNode | null {
  for (const node of nodes) {
    if (!['ont', 'mikrotik', 'router'].includes(node.type)) continue;
    if (gatewayAddressOf(node)) return node;
  }
  return null;
}

/** Used when the topology has no gateway at all yet. */
export const FALLBACK_LAN: AddressPool = { prefix: '192.168.1.', start: 100, end: 254 };

/** The router address implied by FALLBACK_LAN. */
export const FALLBACK_LAN_GATEWAY = '192.168.1.1';

/**
 * The subnet and default gateway a client should be handed, as a pair.
 *
 * The two have to be decided together. A device with no reachable gateway gets
 * a lease out of FALLBACK_LAN, and pairing that with a gateway from somewhere
 * else produced a client on 192.168.1.100 whose default gateway was
 * 192.168.88.1 -- a configuration that is internally contradictory, which the
 * app then reported as "Gateway Salah" on a card the user had just configured.
 */
export function lanDefaultsFor(
  gateway: NetworkNode | null | undefined,
): { gateway: string; subnet: string } {
  const addr = gatewayAddressOf(gateway);
  if (addr) {
    const subnet = gateway?.ipConfig?.subnet || gateway?.ontConfig?.lanSubnet;
    return { gateway: addr, subnet: isValidIpv4(subnet ?? '') ? (subnet as string) : '255.255.255.0' };
  }
  return { gateway: FALLBACK_LAN_GATEWAY, subnet: '255.255.255.0' };
}

/**
 * A free static address on `gateway`'s LAN, for a device added by hand.
 *
 * Same walk as a DHCP lease, but reported as a static address with the gateway
 * as default gateway -- which is what a technician configuring an AP or a
 * server by hand actually does.
 */
export function allocateStaticHost(
  gateway: NetworkNode | null | undefined,
  nodes: readonly NetworkNode[],
): string | null {
  // Fall back to a plain LAN only when there is no gateway at all. A gateway
  // whose pool is configured but unusable is a different thing, and silently
  // inventing an off-subnet address there would hide the misconfiguration.
  const pool = gateway ? dhcpPoolOf(gateway) : FALLBACK_LAN;
  if (!pool) return null;
  return firstFreeHost(pool, usedAddresses(nodes));
}
