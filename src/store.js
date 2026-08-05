// The single mutation entry point (docs/plan.md §7). No other module may
// write to AppState directly — every change goes through store.commit()
// with a pure reducer. This is a Phase 0 acceptance item (§7.1), not
// something to retrofit later.

const HISTORY_LIMIT = 50;

export function createStore(initialState) {
  let current = deepFreeze(initialState);
  let past = [];
  let future = [];
  let pendingCoalesceKey = null;
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn(current);
  }

  function getState() {
    return current;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // reducer: (state, action) => newState — must be pure (return a new
  // object; never mutate `state` in place). `options.coalesceKey` groups
  // consecutive commits (e.g. every pointermove of one drag) into a single
  // undo step; call endCoalescing() on pointerup/blur/idle-timeout to
  // close the group (§7.2). `options.historyEntry: false` skips the undo
  // stack entirely (Zoom/Pan/Selection — §7.3).
  function commit(reducer, action, options = {}) {
    const { coalesceKey = null, historyEntry = true } = options;

    if (!historyEntry) {
      current = deepFreeze(reducer(current, action));
      notify();
      return current;
    }

    if (coalesceKey !== null && coalesceKey === pendingCoalesceKey) {
      current = deepFreeze(reducer(current, action));
      notify();
      return current;
    }

    past.push(current);
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
    pendingCoalesceKey = coalesceKey;
    current = deepFreeze(reducer(current, action));
    notify();
    return current;
  }

  // Closes the current coalescing group so the NEXT commit (even with the
  // same coalesceKey) starts a fresh undo step.
  function endCoalescing() {
    pendingCoalesceKey = null;
  }

  function undo() {
    if (past.length === 0) return current;
    future.push(current);
    current = past.pop();
    pendingCoalesceKey = null;
    notify();
    return current;
  }

  function redo() {
    if (future.length === 0) return current;
    past.push(current);
    current = future.pop();
    pendingCoalesceKey = null;
    notify();
    return current;
  }

  function canUndo() {
    return past.length > 0;
  }

  function canRedo() {
    return future.length > 0;
  }

  function historyDepth() {
    return { past: past.length, future: future.length };
  }

  return { getState, subscribe, commit, endCoalescing, undo, redo, canUndo, canRedo, historyDepth };
}

// Recursively freezes the whole state tree so any mutation attempt from
// outside a reducer (`state.selection = [...]`, `state.pages[0].slots.push`)
// throws in strict mode instead of silently corrupting history.
function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key], seen);
  }
  return value;
}
