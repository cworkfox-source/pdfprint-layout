import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './store.js';
import { createAppState, createPage, createSlot } from './model.js';
import {
  setPageSlotsAction,
  moveSlotsAction,
  resizeSlotAction,
  deleteSlotsAction,
  duplicateSlotsAction,
  splitSlotHorizontalAction,
  splitSlotVerticalAction,
  mergeSlotsAction,
  setSlotLockedAction,
  bringSlotForwardAction,
  sendSlotBackwardAction,
  bringSlotToFrontAction,
  sendSlotToBackAction,
  setSelectionAction,
  setSlotSourceAction,
  setSlotFitModeAction,
  setSlotScaleAction,
  setSlotRotationAction,
  rotateSlotContentAction,
  setSlotOffsetAction,
  setSlotFlipAction,
  clearSlotContentAction,
} from './reducers.js';

function makeTwoPageState() {
  const slotA1 = createSlot({ id: 'a1', x: 0, y: 0, w: 1, h: 1 });
  const slotB1 = createSlot({ id: 'b1', x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  const pageA = createPage({ id: 'page-a', slots: [slotA1] });
  const pageB = createPage({ id: 'page-b', slots: [slotB1] });
  return createAppState({ pages: [pageA, pageB] });
}

test('moveSlotsAction only touches the targeted page', () => {
  const store = createStore(makeTwoPageState());
  store.commit(moveSlotsAction('page-a', ['a1'], 0.1, 0.1), null);

  const [pageA, pageB] = store.getState().pages;
  assert.equal(pageA.slots[0].x, 0.1);
  assert.equal(pageB.slots[0].x, 0.25); // untouched
});

test('resizeSlotAction updates the rect on the correct page', () => {
  const store = createStore(makeTwoPageState());
  store.commit(resizeSlotAction('page-b', 'b1', { x: 0, y: 0, w: 1, h: 1 }), null);
  assert.deepEqual(
    (({ x, y, w, h }) => ({ x, y, w, h }))(store.getState().pages[1].slots[0]),
    { x: 0, y: 0, w: 1, h: 1 },
  );
});

test('deleteSlotsAction removes the slot from its page', () => {
  const store = createStore(makeTwoPageState());
  store.commit(deleteSlotsAction('page-a', ['a1']), null);
  assert.equal(store.getState().pages[0].slots.length, 0);
});

test('duplicateSlotsAction adds one slot to the target page', () => {
  const store = createStore(makeTwoPageState());
  store.commit(duplicateSlotsAction('page-b', ['b1']), null);
  assert.equal(store.getState().pages[1].slots.length, 2);
});

test('splitSlotHorizontalAction / splitSlotVerticalAction each turn 1 slot into 2', () => {
  const store = createStore(makeTwoPageState());
  store.commit(splitSlotHorizontalAction('page-a', 'a1'), null);
  assert.equal(store.getState().pages[0].slots.length, 2);

  const store2 = createStore(makeTwoPageState());
  store2.commit(splitSlotVerticalAction('page-b', 'b1'), null);
  assert.equal(store2.getState().pages[1].slots.length, 2);
});

test('mergeSlotsAction merges two slots on a page back into one', () => {
  const left = createSlot({ id: 'l', x: 0, y: 0, w: 0.5, h: 1 });
  const right = createSlot({ id: 'r', x: 0.5, y: 0, w: 0.5, h: 1 });
  const page = createPage({ id: 'p1', slots: [left, right] });
  const store = createStore(createAppState({ pages: [page] }));

  store.commit(mergeSlotsAction('p1', ['l', 'r']), null);
  const slots = store.getState().pages[0].slots;
  assert.equal(slots.length, 1);
  assert.deepEqual({ x: slots[0].x, y: slots[0].y, w: slots[0].w, h: slots[0].h }, { x: 0, y: 0, w: 1, h: 1 });
});

test('mergeSlotsAction on a non-rectangular selection throws AND leaves store state/history untouched (§23.4.2, integration with the store.js fix)', () => {
  const a = createSlot({ id: 'a', x: 0, y: 0, w: 0.5, h: 0.5 });
  const b = createSlot({ id: 'b', x: 0.5, y: 0, w: 0.5, h: 0.5 });
  const c = createSlot({ id: 'c', x: 0, y: 0.5, w: 0.5, h: 0.5 }); // L-shape with a,b
  const page = createPage({ id: 'p1', slots: [a, b, c] });
  const store = createStore(createAppState({ pages: [page] }));
  const before = store.getState();
  const depthBefore = store.historyDepth();

  assert.throws(() => store.commit(mergeSlotsAction('p1', ['a', 'b', 'c']), null), /do not form a rectangle/);

  assert.equal(store.getState(), before); // exact same frozen object, nothing replaced
  assert.deepEqual(store.historyDepth(), depthBefore);
  assert.equal(store.getState().pages[0].slots.length, 3);
});

test('setSelectionAction bypasses undo history when committed with historyEntry:false (§7.3)', () => {
  const store = createStore(makeTwoPageState());
  store.commit(moveSlotsAction('page-a', ['a1'], 0.1, 0), null);
  store.commit(setSelectionAction(['a1']), null, { historyEntry: false });

  assert.deepEqual(store.getState().selection, ['a1']);
  store.undo();
  // Undo skips the selection change (never entered history) and reverts
  // straight past it to the pre-move position.
  assert.equal(store.getState().pages[0].slots[0].x, 0);
});

test('setPageSlotsAction replaces the whole slot list (§9.3/§9.4 apply-preset / commit-drag-created-slot use case)', () => {
  const store = createStore(makeTwoPageState());
  const newSlots = [createSlot({ x: 0, y: 0, w: 0.5, h: 1 }), createSlot({ x: 0.5, y: 0, w: 0.5, h: 1 })];
  store.commit(setPageSlotsAction('page-a', newSlots), null);
  assert.equal(store.getState().pages[0].slots.length, 2);
});

test('drag-style coalescing collapses a whole move gesture into one undo step (§7.2)', () => {
  const store = createStore(makeTwoPageState());
  store.commit(moveSlotsAction('page-a', ['a1'], 0.01, 0), null, { coalesceKey: 'drag:a1' });
  store.commit(moveSlotsAction('page-a', ['a1'], 0.01, 0), null, { coalesceKey: 'drag:a1' });
  store.commit(moveSlotsAction('page-a', ['a1'], 0.01, 0), null, { coalesceKey: 'drag:a1' });

  assert.ok(Math.abs(store.getState().pages[0].slots[0].x - 0.03) < 1e-9);
  store.undo();
  assert.equal(store.getState().pages[0].slots[0].x, 0); // one undo -> all the way back to pre-drag
});

test('full split -> merge -> undo x2 round-trip restores the original single slot', () => {
  const original = createSlot({ id: 'orig', x: 0, y: 0, w: 1, h: 1 });
  const page = createPage({ id: 'p1', slots: [original] });
  const store = createStore(createAppState({ pages: [page] }));

  store.commit(splitSlotHorizontalAction('p1', 'orig', 0.5), null);
  const [top, bottom] = store.getState().pages[0].slots;
  assert.equal(store.getState().pages[0].slots.length, 2);

  store.commit(mergeSlotsAction('p1', [top.id, bottom.id]), null);
  assert.equal(store.getState().pages[0].slots.length, 1);

  store.undo(); // back to split (2 slots)
  assert.equal(store.getState().pages[0].slots.length, 2);
  store.undo(); // back to original (1 slot)
  assert.equal(store.getState().pages[0].slots.length, 1);
  assert.equal(store.getState().pages[0].slots[0].id, 'orig');
});

test('an unknown pageId throws instead of silently doing nothing', () => {
  const store = createStore(makeTwoPageState());
  assert.throws(() => store.commit(moveSlotsAction('does-not-exist', ['a1'], 0.1, 0), null), /No page with id/);
});

// --- Lock/Unlock + Z-order actions (§10.3/§6.5, gap-fill — see D-013) ------

test('setSlotLockedAction toggles the flag on the correct page/slot only', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setSlotLockedAction('page-a', 'a1', true), null);
  const [pageA, pageB] = store.getState().pages;
  assert.equal(pageA.slots[0].locked, true);
  assert.equal(pageB.slots[0].locked, false); // untouched
});

test('Z-order actions (bringSlotForward/sendSlotBackward/bringSlotToFront/sendSlotToBack) target the correct page', () => {
  const top = createSlot({ id: 't', z: 0 });
  const mid = createSlot({ id: 'm', z: 1 });
  const bottom = createSlot({ id: 'b', z: 2 });
  const page = createPage({ id: 'p1', slots: [top, mid, bottom] });
  const store = createStore(createAppState({ pages: [page] }));

  store.commit(bringSlotToFrontAction('p1', 't'), null);
  let slots = store.getState().pages[0].slots;
  assert.deepEqual([...slots].sort((a, b) => a.z - b.z).map((s) => s.id), ['m', 'b', 't']);

  store.commit(sendSlotToBackAction('p1', 't'), null);
  slots = store.getState().pages[0].slots;
  assert.deepEqual([...slots].sort((a, b) => a.z - b.z).map((s) => s.id), ['t', 'm', 'b']);

  store.commit(bringSlotForwardAction('p1', 't'), null);
  slots = store.getState().pages[0].slots;
  assert.deepEqual([...slots].sort((a, b) => a.z - b.z).map((s) => s.id), ['m', 't', 'b']);

  store.commit(sendSlotBackwardAction('p1', 't'), null);
  slots = store.getState().pages[0].slots;
  assert.deepEqual([...slots].sort((a, b) => a.z - b.z).map((s) => s.id), ['t', 'm', 'b']);
});

// --- Source Placement actions (§10.1/§10.2, Phase 5) ------------------------

test('§10.1 — the SAME sourceId can be assigned to multiple Slots at once (no exclusivity constraint)', () => {
  const left = createSlot({ id: 'l', x: 0, y: 0, w: 0.5, h: 1 });
  const right = createSlot({ id: 'r', x: 0.5, y: 0, w: 0.5, h: 1 });
  const page = createPage({ id: 'p1', slots: [left, right] });
  const store = createStore(createAppState({ pages: [page] }));

  store.commit(setSlotSourceAction('p1', 'l', 'src-shared'), null);
  store.commit(setSlotSourceAction('p1', 'r', 'src-shared'), null);

  const slots = store.getState().pages[0].slots;
  assert.equal(slots[0].sourceId, 'src-shared');
  assert.equal(slots[1].sourceId, 'src-shared');
});

test('setSlotSourceAction assigns a Source to the correct page/slot only', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setSlotSourceAction('page-a', 'a1', 'src-1'), null);
  const [pageA, pageB] = store.getState().pages;
  assert.equal(pageA.slots[0].sourceId, 'src-1');
  assert.equal(pageB.slots[0].sourceId, null); // untouched
});

test('setSlotFitModeAction / setSlotScaleAction / setSlotRotationAction / setSlotOffsetAction / setSlotFlipAction each update one field', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setSlotFitModeAction('page-a', 'a1', 'cover'), null);
  store.commit(setSlotScaleAction('page-a', 'a1', 1.5), null);
  store.commit(setSlotRotationAction('page-a', 'a1', 90), null);
  store.commit(setSlotOffsetAction('page-a', 'a1', 0.2, -0.1), null);
  store.commit(setSlotFlipAction('page-a', 'a1', true, true), null);

  const slot = store.getState().pages[0].slots[0];
  assert.equal(slot.fitMode, 'cover');
  assert.equal(slot.scale, 1.5);
  assert.equal(slot.rotation, 90);
  assert.equal(slot.offsetX, 0.2);
  assert.equal(slot.offsetY, -0.1);
  assert.equal(slot.flipX, true);
  assert.equal(slot.flipY, true);
});

test('rotateSlotContentAction rotates relative to the current value', () => {
  const store = createStore(makeTwoPageState());
  store.commit(rotateSlotContentAction('page-a', 'a1', 90), null);
  store.commit(rotateSlotContentAction('page-a', 'a1', 90), null);
  assert.equal(store.getState().pages[0].slots[0].rotation, 180);
});

test('clearSlotContentAction resets Source + transform but leaves the other slot on the page alone', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setSlotSourceAction('page-a', 'a1', 'src-1'), null);
  store.commit(setSlotRotationAction('page-a', 'a1', 180), null);
  store.commit(clearSlotContentAction('page-a', 'a1'), null);

  const slot = store.getState().pages[0].slots[0];
  assert.equal(slot.sourceId, null);
  assert.equal(slot.rotation, 0);
  assert.equal(store.getState().pages[1].slots[0].sourceId, null);
});

test('setSlotRotationAction rejects a non-MVP angle and leaves history untouched', () => {
  const store = createStore(makeTwoPageState());
  const depthBefore = store.historyDepth();
  assert.throws(() => store.commit(setSlotRotationAction('page-a', 'a1', 45), null), /MVP only supports/);
  assert.deepEqual(store.historyDepth(), depthBefore);
});

test('Source Placement edits coalesce like Free Layout drags (§7.2) — e.g. an Offset slider drag', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setSlotOffsetAction('page-a', 'a1', 0.1, 0), null, { coalesceKey: 'offset:a1' });
  store.commit(setSlotOffsetAction('page-a', 'a1', 0.2, 0), null, { coalesceKey: 'offset:a1' });
  store.commit(setSlotOffsetAction('page-a', 'a1', 0.3, 0), null, { coalesceKey: 'offset:a1' });

  assert.equal(store.getState().pages[0].slots[0].offsetX, 0.3);
  store.undo();
  assert.equal(store.getState().pages[0].slots[0].offsetX, 0); // one undo -> all the way back
});
