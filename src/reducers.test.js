import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './store.js';
import { createAppState, createPage, createSlot, createSource, createTemplate, createTextBox } from './model.js';
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
  autoFillAction,
  addPageAction,
  deletePageAction,
  duplicatePageAction,
  movePageAction,
  addSourceAction,
  removeSourceAction,
  setPaperAction,
  setProjectNameAction,
  setCropMarksAction,
  saveTemplateAction,
  deleteTemplateAction,
  applyTemplateAction,
  setBleedAction,
  setSafeAreaAction,
  setHeaderFooterAction,
  setPageNumberAction,
  setWatermarkAction,
  addTextBoxAction,
  moveTextBoxesAction,
  resizeTextBoxAction,
  setTextBoxContentAction,
  deleteTextBoxesAction,
  duplicateTextBoxesAction,
  bringTextBoxForwardAction,
  sendTextBoxToBackAction,
  alignSlotsLeftAction,
  matchSlotsWidthAction,
  distributeSlotsHorizontalAction,
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

// --- Auto Imposition actions (§11, Phase 6) --------------------------------

test('autoFillAction replaces the template page with N generated pages, other pages untouched', () => {
  const store = createStore(makeTwoPageState()); // page-a: 1 slot, page-b: 1 slot
  const sourceIds = ['s1', 's2', 's3'];
  store.commit(autoFillAction('page-a', sourceIds, {}), null);

  const pages = store.getState().pages;
  // page-a (1 slot/page) -> 3 generated pages; page-b is untouched and now 4th
  assert.equal(pages.length, 4);
  assert.deepEqual(pages.slice(0, 3).map((p) => p.slots[0].sourceId), ['s1', 's2', 's3']);
  assert.equal(pages[3].id, 'page-b');
  assert.equal(pages[3].slots[0].sourceId, null); // untouched
});

test('autoFillAction applies fillOptions (order/filter/repeat) before generating pages', () => {
  const store = createStore(makeTwoPageState());
  store.commit(autoFillAction('page-a', ['photo'], { repeatCount: 3 }), null);
  const pages = store.getState().pages;
  assert.equal(pages.length, 4); // 3 generated (1 slot/page x 3 repeats) + untouched page-b
  assert.deepEqual(pages.slice(0, 3).map((p) => p.slots[0].sourceId), ['photo', 'photo', 'photo']);
});

test('autoFillAction throws for an unknown template pageId', () => {
  const store = createStore(makeTwoPageState());
  assert.throws(() => store.commit(autoFillAction('missing', ['a'], {}), null), /No page with id/);
});

test('addPageAction/deletePageAction/duplicatePageAction/movePageAction operate on AppState.pages', () => {
  const store = createStore(makeTwoPageState());

  store.commit(addPageAction(createPage({ id: 'page-c' })), null);
  assert.deepEqual(store.getState().pages.map((p) => p.id), ['page-a', 'page-b', 'page-c']);

  store.commit(duplicatePageAction('page-a'), null);
  assert.equal(store.getState().pages.length, 4);
  assert.equal(store.getState().pages[1].slots[0].id !== 'a1', true); // fresh slot id in the clone

  store.commit(movePageAction('page-c', 0), null);
  assert.equal(store.getState().pages[0].id, 'page-c');

  store.commit(deletePageAction('page-b'), null);
  assert.ok(!store.getState().pages.some((p) => p.id === 'page-b'));
});

test('deletePageAction refuses to remove the last remaining page (integration: store state/history untouched)', () => {
  const page = createPage({ id: 'only' });
  const store = createStore(createAppState({ pages: [page] }));
  const before = store.getState();
  assert.throws(() => store.commit(deletePageAction('only'), null), /last remaining page/);
  assert.equal(store.getState(), before);
});

// --- Sources (§5.1/§5.2, gap found in Phase 7 — see decision_log D-016) ----

test('addSourceAction appends a Source to AppState.sources', () => {
  const store = createStore(makeTwoPageState());
  const source = createSource({ id: 'src-1', kind: 'image', naturalWidth: 10, naturalHeight: 10 });
  store.commit(addSourceAction(source), null);
  assert.deepEqual(store.getState().sources, [source]);
});

test('removeSourceAction removes a Source by id, leaving others untouched', () => {
  const store = createStore(makeTwoPageState());
  const a = createSource({ id: 'src-a', kind: 'image', naturalWidth: 1, naturalHeight: 1 });
  const b = createSource({ id: 'src-b', kind: 'image', naturalWidth: 1, naturalHeight: 1 });
  store.commit(addSourceAction(a), null);
  store.commit(addSourceAction(b), null);
  store.commit(removeSourceAction('src-a'), null);
  assert.deepEqual(store.getState().sources, [b]);
});

// --- Project settings (§5.1/§8, Phase 12 12c) -------------------------------

test('setPaperAction merges a partial update into state.project.paper, leaving other fields untouched', () => {
  const store = createStore(makeTwoPageState());
  const before = store.getState().project.paper;
  assert.equal(before.size, 'A4');

  store.commit(setPaperAction({ size: 'A3' }), null);
  const after = store.getState().project.paper;
  assert.equal(after.size, 'A3');
  assert.equal(after.orientation, before.orientation); // untouched fields survive the merge
  assert.equal(after.marginTopPt, before.marginTopPt);
});

test('setPaperAction can update multiple fields at once', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setPaperAction({ orientation: 'landscape', marginTopPt: 20, gapHorizontalPt: 5 }), null);
  const after = store.getState().project.paper;
  assert.equal(after.orientation, 'landscape');
  assert.equal(after.marginTopPt, 20);
  assert.equal(after.gapHorizontalPt, 5);
});

test('setProjectNameAction replaces state.project.name', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setProjectNameAction('我的專案'), null);
  assert.equal(store.getState().project.name, '我的專案');
});

// --- Crop Marks (§16, Phase 8) ----------------------------------------------

test('setCropMarksAction merges a partial update into state.project.cropMarks, leaving other fields untouched', () => {
  const store = createStore(makeTwoPageState());
  const before = store.getState().project.cropMarks;
  assert.equal(before.enabled, false);

  store.commit(setCropMarksAction({ enabled: true }), null);
  const after = store.getState().project.cropMarks;
  assert.equal(after.enabled, true);
  assert.equal(after.lengthPt, before.lengthPt); // untouched fields survive the merge
  assert.equal(after.gapPt, before.gapPt);
  assert.equal(after.lineWidthPt, before.lineWidthPt);
});

test('setCropMarksAction can update multiple fields at once', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setCropMarksAction({ enabled: true, lengthPt: 20, gapPt: 10, lineWidthPt: 1 }), null);
  assert.deepEqual(store.getState().project.cropMarks, { enabled: true, lengthPt: 20, gapPt: 10, lineWidthPt: 1 });
});

// --- Templates (§17.3, Phase 9 — gap found the same way D-016 found the
// AppState.sources gap: nothing had ever written to AppState.templates) ---

test('saveTemplateAction appends a Template to AppState.templates', () => {
  const store = createStore(makeTwoPageState());
  const template = createTemplate({ name: 'A4_2up', slots: [createSlot()] });
  store.commit(saveTemplateAction(template), null);
  assert.deepEqual(store.getState().templates, [template]);
});

test('deleteTemplateAction removes a Template by id, leaving others untouched', () => {
  const store = createStore(makeTwoPageState());
  const a = createTemplate({ id: 'tmpl-a', name: 'A', slots: [] });
  const b = createTemplate({ id: 'tmpl-b', name: 'B', slots: [] });
  store.commit(saveTemplateAction(a), null);
  store.commit(saveTemplateAction(b), null);
  store.commit(deleteTemplateAction('tmpl-a'), null);
  assert.deepEqual(store.getState().templates, [b]);
});

test('applyTemplateAction replaces only the targeted page\'s paper+slots, other pages untouched', () => {
  const store = createStore(makeTwoPageState());
  const template = createTemplate({ name: 't', slots: [createSlot({ x: 0, y: 0, w: 1, h: 0.5 }), createSlot({ x: 0, y: 0.5, w: 1, h: 0.5 })] });
  store.commit(applyTemplateAction('page-a', template), null);

  const state = store.getState();
  assert.equal(state.pages[0].slots.length, 2); // page-a replaced
  assert.equal(state.pages[1].slots.length, 1); // page-b untouched
  assert.equal(state.pages[1].slots[0].id, 'b1');
});

test('applyTemplateAction throws for an unknown pageId', () => {
  const store = createStore(makeTwoPageState());
  const template = createTemplate({ name: 't', slots: [] });
  assert.throws(() => store.commit(applyTemplateAction('missing-page', template), null), /No page with id/);
});

// --- Print Aids (§16, Phase 10) ---------------------------------------------

test('setBleedAction merges a partial update into state.project.bleed', () => {
  const store = createStore(makeTwoPageState());
  const beforeSize = store.getState().project.bleed.sizePt;
  store.commit(setBleedAction({ enabled: true }), null);
  const after = store.getState().project.bleed;
  assert.equal(after.enabled, true);
  assert.equal(after.sizePt, beforeSize);
});

test('setSafeAreaAction merges a partial update into state.project.safeArea', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setSafeAreaAction({ enabled: true, marginPt: 15 }), null);
  const after = store.getState().project.safeArea;
  assert.equal(after.enabled, true);
  assert.equal(after.marginPt, 15);
});

test('setHeaderFooterAction merges nested header/footer overrides without clobbering the untouched side', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setHeaderFooterAction({ header: { enabled: true, text: 'Confidential' } }), null);
  const after = store.getState().project.headerFooter;
  assert.equal(after.header.enabled, true);
  assert.equal(after.header.text, 'Confidential');
  assert.equal(after.header.align, 'center'); // untouched header field survives
  assert.equal(after.footer.enabled, false); // footer untouched entirely
});

test('setPageNumberAction merges a partial update into state.project.pageNumber', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setPageNumberAction({ enabled: true, position: 'top-right' }), null);
  const after = store.getState().project.pageNumber;
  assert.equal(after.enabled, true);
  assert.equal(after.position, 'top-right');
  assert.equal(after.format, '{page} / {total}'); // untouched field survives
});

test('setWatermarkAction merges a partial update into state.project.watermark', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setWatermarkAction({ enabled: true, text: 'DRAFT' }), null);
  const after = store.getState().project.watermark;
  assert.equal(after.enabled, true);
  assert.equal(after.text, 'DRAFT');
  assert.equal(after.opacity, 0.3); // untouched field survives
});

// --- Text Boxes (§16, Phase 10) ---------------------------------------------

test('addTextBoxAction appends to the targeted page only', () => {
  const store = createStore(makeTwoPageState());
  const newBox = createTextBox({ id: 'box-1', text: 'Hello' });
  store.commit(addTextBoxAction('page-a', newBox), null);
  const state = store.getState();
  assert.deepEqual(state.pages[0].textBoxes, [newBox]);
  assert.deepEqual(state.pages[1].textBoxes, []);
});

test('moveTextBoxesAction translates the targeted box on the targeted page', () => {
  const store = createStore(makeTwoPageState());
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-1', x: 0, y: 0 })), null);
  store.commit(moveTextBoxesAction('page-a', ['box-1'], 0.1, 0.1), null);
  const box = store.getState().pages[0].textBoxes[0];
  assert.equal(box.x, 0.1);
  assert.equal(box.y, 0.1);
});

test('resizeTextBoxAction replaces the rect of one box', () => {
  const store = createStore(makeTwoPageState());
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-1' })), null);
  store.commit(resizeTextBoxAction('page-a', 'box-1', { x: 0.1, y: 0.2, w: 0.5, h: 0.2 }), null);
  const box = store.getState().pages[0].textBoxes[0];
  assert.equal(box.w, 0.5);
  assert.equal(box.h, 0.2);
});

test('setTextBoxContentAction merges partial content overrides', () => {
  const store = createStore(makeTwoPageState());
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-1', text: 'old', bold: false })), null);
  store.commit(setTextBoxContentAction('page-a', 'box-1', { text: 'new', bold: true }), null);
  const box = store.getState().pages[0].textBoxes[0];
  assert.equal(box.text, 'new');
  assert.equal(box.bold, true);
});

test('deleteTextBoxesAction removes only the targeted box', () => {
  const store = createStore(makeTwoPageState());
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-1' })), null);
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-2' })), null);
  store.commit(deleteTextBoxesAction('page-a', ['box-1']), null);
  const boxes = store.getState().pages[0].textBoxes;
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].id, 'box-2');
});

test('duplicateTextBoxesAction clones the targeted box with a fresh id', () => {
  const store = createStore(makeTwoPageState());
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-1' })), null);
  store.commit(duplicateTextBoxesAction('page-a', ['box-1']), null);
  const boxes = store.getState().pages[0].textBoxes;
  assert.equal(boxes.length, 2);
  assert.notEqual(boxes[1].id, 'box-1');
});

test('bringTextBoxForwardAction / sendTextBoxToBackAction reorder z within the targeted page', () => {
  const store = createStore(makeTwoPageState());
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-1', z: 0 })), null);
  store.commit(addTextBoxAction('page-a', createTextBox({ id: 'box-2', z: 1 })), null);
  store.commit(bringTextBoxForwardAction('page-a', 'box-1'), null);
  let boxes = store.getState().pages[0].textBoxes;
  assert.equal(boxes.find((b) => b.id === 'box-1').z, 1);
  assert.equal(boxes.find((b) => b.id === 'box-2').z, 0);

  store.commit(sendTextBoxToBackAction('page-a', 'box-1'), null);
  boxes = store.getState().pages[0].textBoxes;
  assert.equal(boxes.find((b) => b.id === 'box-1').z, 0);
  assert.equal(boxes.find((b) => b.id === 'box-2').z, 1);
});

test('text box actions throw for an unknown pageId', () => {
  const store = createStore(makeTwoPageState());
  assert.throws(() => store.commit(addTextBoxAction('missing-page', createTextBox()), null), /No page with id/);
});

// --- Align & Distribute (§9.6, Phase 10) ------------------------------------

test('alignSlotsLeftAction/matchSlotsWidthAction/distributeSlotsHorizontalAction only touch the targeted page', () => {
  const store = createStore(makeTwoPageState());
  store.commit(setPageSlotsAction('page-a', [
    createSlot({ id: 'x', x: 0.1, w: 0.1 }),
    createSlot({ id: 'y', x: 0.5, w: 0.1 }),
  ]), null);

  store.commit(alignSlotsLeftAction('page-a', ['x', 'y']), null);
  let slots = store.getState().pages[0].slots;
  assert.equal(slots.find((s) => s.id === 'y').x, 0.1);
  assert.equal(store.getState().pages[1].slots[0].id, 'b1'); // page-b untouched

  store.commit(matchSlotsWidthAction('page-a', ['x', 'y']), null);
  slots = store.getState().pages[0].slots;
  assert.equal(slots.find((s) => s.id === 'y').w, slots.find((s) => s.id === 'x').w);

  store.commit(setPageSlotsAction('page-a', [
    createSlot({ id: 'x', x: 0, w: 0.1 }),
    createSlot({ id: 'y', x: 0.3, w: 0.1 }),
    createSlot({ id: 'z', x: 0.8, w: 0.1 }),
  ]), null);
  store.commit(distributeSlotsHorizontalAction('page-a', ['x', 'y', 'z']), null);
  slots = store.getState().pages[0].slots;
  assert.ok(Math.abs(slots.find((s) => s.id === 'y').x - 0.4) < 1e-9);
});
