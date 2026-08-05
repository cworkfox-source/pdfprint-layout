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

    // Compute the next state BEFORE touching any history bookkeeping. A
    // reducer that validates and throws (e.g. free-layout.js's mergeSlots
    // on a non-rectangular selection, or deleteSlots on a locked slot) must
    // leave history exactly as it was — otherwise a failed, no-op action
    // would still push a spurious duplicate onto `past` and clear `future`.
    const nextState = deepFreeze(reducer(current, action));

    past.push(current);
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
    pendingCoalesceKey = coalesceKey;
    current = nextState;
    notify();
    return current;
  }

  // Closes the current coalescing group so the NEXT commit (even with the
  // same coalesceKey) starts a fresh undo step.
  function endCoalescing() {
    pendingCoalesceKey = null;
  }

  // Phase 9 (§17.1 Project load) — a full state REPLACEMENT, not a derived
  // edit: loading a different project is a context switch, not something
  // Undo should be able to step back out of into a completely unrelated
  // project's own history (and retaining that history would waste up to
  // HISTORY_LIMIT large snapshots for no benefit). Deliberately separate
  // from commit(reducer, action) rather than a `loadProjectAction` reducer
  // dispatched through it — see decision_log D-018.
  function resetWithState(newState) {
    current = deepFreeze(newState);
    past = [];
    future = [];
    pendingCoalesceKey = null;
    notify();
    return current;
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

  return { getState, subscribe, commit, endCoalescing, resetWithState, undo, redo, canUndo, canRedo, historyDepth };
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
