import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './store.js';

const setCount = (n) => (state) => ({ ...state, count: n });
const increment = () => (state) => ({ ...state, count: state.count + 1 });

test('commit applies the reducer and notifies subscribers', () => {
  const store = createStore({ count: 0 });
  let notified = null;
  store.subscribe((s) => { notified = s; });

  store.commit((state) => ({ ...state, count: 1 }), null);

  assert.equal(store.getState().count, 1);
  assert.equal(notified.count, 1);
});

test('undo/redo restore previous and next states', () => {
  const store = createStore({ count: 0 });
  store.commit(setCount(1), null);
  store.commit(setCount(2), null);

  assert.equal(store.getState().count, 2);
  store.undo();
  assert.equal(store.getState().count, 1);
  store.undo();
  assert.equal(store.getState().count, 0);
  assert.equal(store.canUndo(), false);

  store.redo();
  assert.equal(store.getState().count, 1);
  store.redo();
  assert.equal(store.getState().count, 2);
  assert.equal(store.canRedo(), false);
});

test('a new commit after undo clears the redo stack', () => {
  const store = createStore({ count: 0 });
  store.commit(setCount(1), null);
  store.commit(setCount(2), null);
  store.undo();
  assert.equal(store.canRedo(), true);

  store.commit(setCount(99), null);
  assert.equal(store.canRedo(), false);
  assert.equal(store.getState().count, 99);
});

test('history is capped at 50 entries (§7.2)', () => {
  const store = createStore({ count: 0 });
  for (let i = 1; i <= 60; i++) {
    store.commit(setCount(i), null);
  }
  assert.equal(store.historyDepth().past, 50);

  let undoCount = 0;
  while (store.canUndo()) {
    store.undo();
    undoCount++;
  }
  assert.equal(undoCount, 50);
  // Oldest states beyond the cap were dropped, so we land on count=10,
  // not count=0 (60 commits - 50 undoable steps = state after commit #10).
  assert.equal(store.getState().count, 10);
});

test('coalescing groups consecutive commits into a single undo step (§7.2 drag example)', () => {
  const store = createStore({ x: 0 });
  const moveTo = (x) => (state) => ({ ...state, x });

  store.commit(moveTo(0), null); // baseline, not part of the drag
  store.commit(moveTo(1), null, { coalesceKey: 'drag:slot-1' });
  store.commit(moveTo(2), null, { coalesceKey: 'drag:slot-1' });
  store.commit(moveTo(3), null, { coalesceKey: 'drag:slot-1' });

  assert.equal(store.getState().x, 3);
  store.undo();
  // One undo should jump straight back to the pre-drag state (x=0), not
  // step through 2 and 1.
  assert.equal(store.getState().x, 0);
});

test('endCoalescing() starts a fresh undo step even with the same key', () => {
  const store = createStore({ x: 0 });
  const moveTo = (x) => (state) => ({ ...state, x });

  store.commit(moveTo(1), null, { coalesceKey: 'drag:slot-1' });
  store.endCoalescing();
  store.commit(moveTo(2), null, { coalesceKey: 'drag:slot-1' });

  assert.equal(store.getState().x, 2);
  store.undo();
  assert.equal(store.getState().x, 1);
  store.undo();
  assert.equal(store.getState().x, 0);
});

test('historyEntry:false (Zoom/Pan/Selection) bypasses undo entirely (§7.3)', () => {
  const store = createStore({ count: 0, zoom: 1 });
  store.commit(setCount(1), null);
  store.commit((state) => ({ ...state, zoom: 2 }), null, { historyEntry: false });

  assert.equal(store.getState().zoom, 2);
  assert.equal(store.canUndo(), true);
  store.undo();
  // Undo skips straight past the zoom change to before count=1, since the
  // zoom commit never touched the undo stack.
  assert.equal(store.getState().count, 0);
});

test('state is frozen — mutating it outside a reducer throws (§7.1 guard)', () => {
  'use strict';
  const store = createStore({ items: [1, 2, 3] });
  assert.throws(() => {
    store.getState().items.push(4);
  });
  assert.throws(() => {
    store.getState().extra = true;
  });
});

test('increment reducer composes correctly across multiple commits', () => {
  const store = createStore({ count: 0 });
  store.commit(increment(), null);
  store.commit(increment(), null);
  store.commit(increment(), null);
  assert.equal(store.getState().count, 3);
});
