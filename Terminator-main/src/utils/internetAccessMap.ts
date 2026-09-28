/**
 * Internet reachability for every node, computed once per topology change.
 *
 * Canvas used to call `checkInternetAccess` once per node inside the render,
 * and twice more per active cable on every 100ms simulation tick. Because the
 * result depends only on (node, nodes, cables) -- none of which change while
 * packets are moving -- the same BFS was being re-run ten times a second.
 *
 * Measured on a chain of N clients behind a MikroTik and an ONT, one call per
 * node per pass:
 *
 *     20 clients    0.58 ms
 *     50 clients    5.32 ms
 *    100 clients   44.21 ms
 *    200 clients  276.36 ms
 *
 * 44ms is already over a 16.7ms frame before React does any of its own work,
 * and that pass happened on every one of the ten renders per second.
 *
 * What is left on the table: this is still N independent BFS walks rather than
 * one multi-source sweep from the gateways, so the cost above is now paid on
 * every topology *edit* instead of every frame. A single sweep would make it
 * O(V+E) overall, but it has to reproduce the self-exclusion in
 * `findUpstreamGateway` (a gateway is not its own gateway) or the status text
 * changes. Not worth doing without a way to exercise the UI.
 *
 * The per-node logic is untouched: this only changes how often it runs, so the
 * status text shown in the UI cannot drift.
 *
 * Deliberately free of React so the test suite can drive it under plain node;
 * the caller wraps it in a `useMemo` keyed on the two collections.
 */

import type { CableConnection, NetworkNode } from '../types/network';
import { checkInternetAccess, type InternetAccessStatus } from './ipUtils';

/**
 * Status for an id that is not in the map.
 *
 * Unreachable for any node drawn from the same array the map was built from,
 * so it never renders. It is a distinct, visible reason rather than a
 * plausible-looking "no internet", so that if it ever *is* reached the UI says
 * the status was not computed instead of quietly showing a wrong answer.
 */
const NOT_COMPUTED: InternetAccessStatus = {
  hasInternet: false,
  reason: 'Status internet belum dihitung untuk perangkat ini.',
};

/**
 * The map, with a total `get`.
 *
 * `Map.get` is typed `T | undefined` even though every key here comes from
 * `nodes`, so a miss is a type error at every call site. Returning a defined
 * fallback keeps callers free of assertions without pretending a miss is
 * impossible at the type level.
 */
export interface InternetAccessLookup {
  get(nodeId: string): InternetAccessStatus;
  has(nodeId: string): boolean;
  readonly size: number;
}

/**
 * Status for every node, keyed by id.
 *
 * A pure function so the caller can memoise it and the test suite can call it
 * without React.
 */
export function buildInternetAccessMap(
  nodes: readonly NetworkNode[],
  cables: readonly CableConnection[],
): InternetAccessLookup {
  const map = new Map<string, InternetAccessStatus>();
  for (const node of nodes) {
    map.set(node.id, checkInternetAccess(node, nodes, cables));
  }
  return {
    get size() {
      return map.size;
    },
    has: (id) => map.has(id),
    get: (id) => map.get(id) ?? NOT_COMPUTED,
  };
}
