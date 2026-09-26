/**
 * Undo/redo stack for the topology editor.
 *
 * The editor edits {nodes, cables} in bursts -- a drag fires dozens of position
 * updates -- so a snapshot is recorded only once things settle. The stack lives
 * here as pure data so the truncation and cursor rules can be tested directly,
 * rather than being tangled up with the debounce timer that drives it.
 */

export interface TopologySnapshot {
  nodes: unknown[];
  cables: unknown[];
}

export interface HistoryState {
  /** Snapshots that can be restored, oldest first. `present` is not in here. */
  past: TopologySnapshot[];
  present: TopologySnapshot;
  /** Snapshots undone away from, newest first. Cleared by any new edit. */
  future: TopologySnapshot[];
}

export const createHistory = (initial: TopologySnapshot): HistoryState => ({
  past: [],
  present: initial,
  future: [],
});

/**
 * Record an edit. Any redo tail is discarded first, which is what makes undo
 * linear: editing after an undo must not resurrect a branch that was abandoned.
 */
export function pushSnapshot(state: HistoryState, next: TopologySnapshot): HistoryState {
  return {
    past: [...state.past, state.present],
    present: next,
    future: [],
  };
}

export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const [next, ...rest] = state.future;
  return {
    past: [...state.past, state.present],
    present: next,
    future: rest,
  };
}

export const canUndo = (state: HistoryState): boolean => state.past.length > 0;
export const canRedo = (state: HistoryState): boolean => state.future.length > 0;

/** Snapshot identity is by value, not by reference: callers pass fresh literals. */
export const sameSnapshot = (a: TopologySnapshot, b: TopologySnapshot): boolean =>
  a === b || (a.nodes === b.nodes && a.cables === b.cables);
